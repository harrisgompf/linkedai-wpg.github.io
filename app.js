// ─── State ───────────────────────────────────────────────────────────────────

let receipts = [];
let bankTransactions = [];
let matches = [];

let pickerApiLoaded = false;
let tokenClient = null;
let accessToken = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const receiptFilesInput = document.getElementById('receipt-files');
const scanReceiptsButton = document.getElementById('scan-receipts');
const loadDriveButton = document.getElementById('load-drive');
const exportReceiptsButton = document.getElementById('export-receipts');
const exportReceiptsXlsxButton = document.getElementById('export-receipts-xlsx');
const receiptStatus = document.getElementById('receipt-status');
const driveStatus = document.getElementById('drive-status');
const receiptTableBody = document.querySelector('#receipt-table tbody');
const employeeInput = document.getElementById('employee-name');

const bankFileInput = document.getElementById('bank-file');
const loadBankButton = document.getElementById('load-bank');
const matchDataButton = document.getElementById('match-data');
const exportMatchesButton = document.getElementById('export-matches');
const exportMatchesXlsxButton = document.getElementById('export-matches-xlsx');
const bankStatus = document.getElementById('bank-status');
const bankTableBody = document.querySelector('#bank-table tbody');

const matchStatus = document.getElementById('match-status');
const matchTableBody = document.querySelector('#match-table tbody');

const previewPanel = document.getElementById('preview-panel');
const previewTitle = document.getElementById('preview-title');
const previewContent = document.getElementById('preview-content');
const closePreviewButton = document.getElementById('close-preview');

const cfgClientId = document.getElementById('cfg-client-id');
const cfgApiKey = document.getElementById('cfg-api-key');
const cfgAppId = document.getElementById('cfg-app-id');

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatCurrency(value) {
  return value == null || Number.isNaN(value)
    ? '—'
    : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
}

function parseDecimal(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── Receipt extraction via Claude backend ────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractReceiptData(file) {
  const base64 = await fileToBase64(file);
  const response = await fetch('/api/extract-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mediaType: file.type, filename: file.name })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Extraction failed');
  }
  return response.json();
}

async function processReceiptFile(file, source = 'local', employee = '') {
  receiptStatus.textContent = `Processing ${file.name}…`;
  const previewUrl = URL.createObjectURL(file);
  const previewType = file.type;
  const resolvedEmployee = employee || employeeInput.value.trim();

  let data = {};
  let extractionError = null;

  try {
    data = await extractReceiptData(file);
  } catch (err) {
    console.error('Extraction error:', err);
    extractionError = err.message;
  }

  receipts.push({
    filename: file.name,
    employee: resolvedEmployee,
    business: data.business || file.name.replace(/\.[^/.]+$/, ''),
    date: data.date || '',
    subtotal: data.subtotal ?? null,
    gst: data.gst ?? null,
    pst: data.pst ?? null,
    tax: data.tax ?? null,
    total: data.total ?? null,
    last4: data.last4 ?? null,
    category: data.category || 'Other',
    currency: data.currency || 'CAD',
    previewUrl,
    previewType,
    source,
    error: extractionError
  });

  updateReceiptTable();
}

// ─── Google Drive integration ─────────────────────────────────────────────────

function gapiLoaded() {
  gapi.load('picker', () => { pickerApiLoaded = true; });
}

function gisLoaded() {
  const clientId = cfgClientId.value.trim();
  if (!clientId) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    callback: async tokenResponse => {
      accessToken = tokenResponse.access_token;
      openPicker();
    }
  });
}

function openPicker() {
  const apiKey = cfgApiKey.value.trim();
  const appId = cfgAppId.value.trim();

  const imageView = new google.picker.DocsView(google.picker.ViewId.DOCS)
    .setMimeTypes('image/jpeg,image/png,image/webp,image/gif,application/pdf')
    .setMode(google.picker.DocsViewMode.LIST);

  const folderView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setSelectFolderEnabled(true);

  new google.picker.PickerBuilder()
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setAppId(appId)
    .setOAuthToken(accessToken)
    .setDeveloperKey(apiKey)
    .addView(imageView)
    .addView(folderView)
    .setCallback(onPickerPicked)
    .build()
    .setVisible(true);
}

async function onPickerPicked(data) {
  if (data.action !== google.picker.Action.PICKED) return;

  let loaded = 0;
  for (const doc of data.docs) {
    if (doc.mimeType === 'application/vnd.google-apps.folder') {
      loaded += await loadDriveFolder(doc.id, doc.name);
    } else {
      await loadDriveFile(doc.id, doc.name, doc.mimeType, doc.parentId);
      loaded++;
    }
  }

  driveStatus.textContent = loaded
    ? `Loaded ${loaded} receipt(s) from Google Drive.`
    : 'No receipts loaded from Drive.';

  updateExportButtons();
}

async function loadDriveFolder(folderId, folderName) {
  driveStatus.textContent = `Loading folder: ${folderName}…`;
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false+and+mimeType!='application/vnd.google-apps.folder'&fields=files(id,name,mimeType)&pageSize=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const { files = [] } = await res.json();

  const supported = files.filter(f =>
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(f.mimeType)
  );

  for (const file of supported) {
    await loadDriveFile(file.id, file.name, file.mimeType, folderId, folderName);
  }
  return supported.length;
}

async function loadDriveFile(fileId, fileName, mimeType, parentId, employeeOverride = null) {
  let employee = employeeOverride;

  if (!employee && parentId) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${parentId}?fields=name`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const { name } = await res.json();
      employee = name;
    } catch {}
  }

  driveStatus.textContent = `Downloading ${fileName}…`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    console.error(`Failed to download ${fileName}:`, res.statusText);
    return;
  }

  const blob = await res.blob();
  const file = new File([blob], fileName, { type: mimeType });
  await processReceiptFile(file, 'drive', employee || '');
}

loadDriveButton.addEventListener('click', () => {
  const clientId = cfgClientId.value.trim();
  const apiKey = cfgApiKey.value.trim();
  const appId = cfgAppId.value.trim();

  if (!clientId || !apiKey || !appId) {
    driveStatus.textContent = 'Expand "Google Drive Setup" above and fill in all three fields first.';
    return;
  }

  if (!pickerApiLoaded) {
    driveStatus.textContent = 'Google Picker API still loading — try again in a moment.';
    return;
  }

  if (accessToken) {
    openPicker();
  } else {
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: async tokenResponse => {
          accessToken = tokenResponse.access_token;
          openPicker();
        }
      });
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }
});

// ─── Local file scan ──────────────────────────────────────────────────────────

scanReceiptsButton.addEventListener('click', async () => {
  const files = Array.from(receiptFilesInput.files || []);
  if (!files.length) {
    receiptStatus.textContent = 'Select one or more receipt files first.';
    return;
  }

  scanReceiptsButton.disabled = true;
  receipts = [];
  receiptTableBody.innerHTML = '';

  for (const file of files) {
    try {
      await processReceiptFile(file);
    } catch (err) {
      console.error('Processing error:', err);
    }
  }

  receiptStatus.textContent = `Processed ${receipts.length} receipt(s).`;
  updateExportButtons();
  scanReceiptsButton.disabled = false;
});

// ─── Preview ──────────────────────────────────────────────────────────────────

receiptTableBody.addEventListener('click', event => {
  if (!event.target.matches('.preview-button')) return;
  const receipt = receipts[Number(event.target.dataset.index)];
  if (!receipt) return;

  previewTitle.textContent = receipt.filename;
  previewContent.innerHTML = '';

  if (receipt.filename.toLowerCase().endsWith('.pdf')) {
    const obj = document.createElement('object');
    obj.data = receipt.previewUrl;
    obj.type = 'application/pdf';
    obj.width = '100%';
    obj.height = '520';
    previewContent.appendChild(obj);
  } else {
    const img = document.createElement('img');
    img.src = receipt.previewUrl;
    img.alt = receipt.filename;
    previewContent.appendChild(img);
  }

  previewPanel.classList.remove('hidden');
});

closePreviewButton.addEventListener('click', () => previewPanel.classList.add('hidden'));

// ─── Table rendering ──────────────────────────────────────────────────────────

function categoryBadge(cat) {
  return `<span class="badge badge-${(cat || 'other').toLowerCase()}">${cat || 'Other'}</span>`;
}

function updateReceiptTable() {
  receiptTableBody.innerHTML = receipts.map((r, i) => `
    <tr class="${r.error ? 'row-error' : ''}">
      <td>${r.employee || '—'}</td>
      <td>${r.filename}${r.error ? ` <span class="err-tag" title="${r.error}">⚠ extraction failed</span>` : ''}</td>
      <td>${r.business}</td>
      <td>${r.date || '—'}</td>
      <td>${formatCurrency(r.subtotal)}</td>
      <td>${formatCurrency(r.gst)}</td>
      <td>${formatCurrency(r.pst)}</td>
      <td>${formatCurrency(r.tax)}</td>
      <td>${formatCurrency(r.total)}</td>
      <td>${r.last4 || '—'}</td>
      <td>${categoryBadge(r.category)}</td>
      <td><button class="preview-button" data-index="${i}">View</button></td>
    </tr>
  `).join('');
}

function updateBankTable() {
  bankTableBody.innerHTML = bankTransactions.map(tx => `
    <tr>
      <td>${tx.date || '—'}</td>
      <td>${tx.description || '—'}</td>
      <td>${formatCurrency(tx.amount)}</td>
      <td>${tx.card || '—'}</td>
    </tr>
  `).join('');
}

function updateMatchTable() {
  matchTableBody.innerHTML = matches.map(m => `
    <tr>
      <td>${m.receipt.employee || '—'}</td>
      <td>${m.receipt.filename}</td>
      <td>${m.receipt.business}</td>
      <td>${formatCurrency(m.receipt.total)}</td>
      <td>${m.receipt.last4 || '—'}</td>
      <td>${m.transaction?.date || '—'}</td>
      <td>${m.transaction?.description || '—'}</td>
      <td>${formatCurrency(m.transaction?.amount)}</td>
      <td class="status-cell">${m.status}</td>
      <td class="reason-cell">${m.reason}</td>
    </tr>
  `).join('');
}

// ─── Bank statement parsing ───────────────────────────────────────────────────

function parseBankTransactions(rows) {
  return rows.map(row => {
    const lc = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
    const dateKey = Object.keys(lc).find(k => /date|transaction date|posted/.test(k)) || '';
    const descKey = Object.keys(lc).find(k => /description|memo|details|payee/.test(k)) || '';
    const amountKey = Object.keys(lc).find(k => /amount|debit|credit|value/.test(k)) || '';
    const cardKey = Object.keys(lc).find(k => /card|account|acct|last4/.test(k)) || '';

    return {
      date: lc[dateKey] || '',
      description: lc[descKey] || Object.values(row).join(' '),
      amount: parseDecimal(lc[amountKey]),
      card: lc[cardKey] || ''
    };
  });
}

loadBankButton.addEventListener('click', async () => {
  const file = bankFileInput.files?.[0];
  if (!file) { bankStatus.textContent = 'Select a bank statement PDF or CSV first.'; return; }

  loadBankButton.disabled = true;

  if (file.name.toLowerCase().endsWith('.pdf')) {
    bankStatus.textContent = 'Reading bank statement with AI…';
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch('/api/parse-bank-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || 'Parsing failed');
      }
      bankTransactions = await response.json();
      bankStatus.textContent = `Loaded ${bankTransactions.length} transaction(s) from PDF.`;
      updateBankTable();
      matchDataButton.disabled = !(receipts.length && bankTransactions.length);
    } catch (err) {
      bankStatus.textContent = `PDF parse error: ${err.message}`;
    }
  } else {
    bankStatus.textContent = 'Parsing CSV…';
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        bankTransactions = parseBankTransactions(results.data);
        bankStatus.textContent = `Loaded ${bankTransactions.length} transaction(s) from CSV.`;
        updateBankTable();
        matchDataButton.disabled = !(receipts.length && bankTransactions.length);
      },
      error: err => { bankStatus.textContent = `CSV error: ${err.message}`; }
    });
  }

  loadBankButton.disabled = false;
});

// ─── Matching ─────────────────────────────────────────────────────────────────

function nameWordsMatch(business, description) {
  const words = business.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const desc = description.toLowerCase();
  return words.some(word => desc.includes(word));
}

function computeMatchScore(receipt, tx) {
  let score = 0;
  if (receipt.total != null && tx.amount != null && Math.abs(receipt.total - tx.amount) < 0.02) score += 5;
  if (receipt.last4 && tx.card && tx.card.includes(receipt.last4)) score += 4;
  if (receipt.business && tx.description) {
    if (tx.description.toLowerCase().includes(receipt.business.toLowerCase())) score += 3;
    else if (nameWordsMatch(receipt.business, tx.description)) score += 2;
  }
  if (receipt.date && tx.date && (tx.date.includes(receipt.date) || receipt.date.includes(tx.date))) score += 1;
  return score;
}

function buildMatchReason(receipt, tx, score) {
  if (!tx) return 'No bank transactions loaded to compare against';

  const matched = [];
  const mismatched = [];

  if (receipt.total != null && tx.amount != null) {
    if (Math.abs(receipt.total - tx.amount) < 0.02) {
      matched.push('amount');
    } else {
      mismatched.push(`amount (receipt ${formatCurrency(receipt.total)} vs bank ${formatCurrency(tx.amount)})`);
    }
  } else if (receipt.total == null) {
    mismatched.push('receipt total could not be extracted');
  }

  if (receipt.last4 && tx.card) {
    if (tx.card.includes(receipt.last4)) {
      matched.push('card last 4');
    } else {
      mismatched.push(`card (receipt …${receipt.last4} vs bank …${tx.card.slice(-4) || tx.card})`);
    }
  } else if (!receipt.last4) {
    mismatched.push('card number not found on receipt');
  }

  if (receipt.business && tx.description) {
    if (tx.description.toLowerCase().includes(receipt.business.toLowerCase())) {
      matched.push('business name');
    } else if (nameWordsMatch(receipt.business, tx.description)) {
      matched.push('partial business name');
    } else {
      mismatched.push(`business name ("${receipt.business}" not in "${tx.description}")`);
    }
  }

  if (receipt.date && tx.date) {
    if (tx.date.includes(receipt.date) || receipt.date.includes(tx.date)) {
      matched.push('date');
    } else {
      mismatched.push(`date (receipt ${receipt.date} vs bank ${tx.date})`);
    }
  }

  if (score >= 7) {
    return `Matched on: ${matched.join(', ')}`;
  }
  const parts = [];
  if (matched.length) parts.push(`Matched: ${matched.join(', ')}`);
  if (mismatched.length) parts.push(`Differs: ${mismatched.join('; ')}`);
  return parts.join(' — ') || 'Insufficient data to match';
}

matchDataButton.addEventListener('click', () => {
  matches = receipts.map(receipt => {
    let best = null, bestScore = -1;
    for (const tx of bankTransactions) {
      const score = computeMatchScore(receipt, tx);
      if (score > bestScore) { bestScore = score; best = tx; }
    }
    const status = bestScore >= 7 ? '✅ Match' : bestScore >= 4 ? '⚠️ Possible' : '❌ No match';
    const reason = buildMatchReason(receipt, best, bestScore);
    return { receipt, transaction: best, status, score: bestScore, reason };
  });

  matchStatus.textContent = `Reconciled ${matches.length} receipt(s). ` +
    `${matches.filter(m => m.status.startsWith('✅')).length} matched, ` +
    `${matches.filter(m => m.status.startsWith('⚠️')).length} possible, ` +
    `${matches.filter(m => m.status.startsWith('❌')).length} unmatched.`;

  updateMatchTable();
  exportMatchesButton.disabled = false;
  exportMatchesXlsxButton.disabled = false;
});

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportCSV(rows, filename) {
  const csv = rows
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: filename
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportXlsx(rows, sheetName, filename) {
  const aoa = rows.map(row => row.map(cell => (cell && cell.value !== undefined) ? cell.value : cell));
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      if (cell && cell.hyperlink) {
        const addr = XLSX.utils.encode_cell({ c: ci, r: ri });
        ws[addr].l = { Target: cell.hyperlink };
      }
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function receiptRows() {
  const header = ['Employee', 'File', 'Business', 'Date', 'Subtotal', 'GST', 'PST', 'Tax', 'Total', 'Last 4', 'Category', 'Currency', 'Source'];
  const data = receipts.map(r => [
    r.employee, r.filename, r.business, r.date,
    r.subtotal ?? '', r.gst ?? '', r.pst ?? '', r.tax ?? '', r.total ?? '',
    r.last4 ?? '', r.category, r.currency, r.source
  ]);
  return [header, ...data];
}

function receiptRowsXlsx() {
  const header = ['Employee', 'File', 'Business', 'Date', 'Subtotal', 'GST', 'PST', 'Tax', 'Total', 'Last 4', 'Category', 'Currency', 'Preview'];
  const data = receipts.map(r => [
    r.employee, r.filename, r.business, r.date,
    r.subtotal ?? '', r.gst ?? '', r.pst ?? '', r.tax ?? '', r.total ?? '',
    r.last4 ?? '', r.category, r.currency,
    r.previewUrl ? { value: 'View', hyperlink: r.previewUrl } : ''
  ]);
  return [header, ...data];
}

function matchRows() {
  const header = ['Employee', 'Receipt File', 'Business', 'Receipt Total', 'Last 4', 'Bank Date', 'Bank Description', 'Bank Amount', 'Status', 'Reason'];
  const data = matches.map(m => [
    m.receipt.employee, m.receipt.filename, m.receipt.business,
    m.receipt.total ?? '', m.receipt.last4 ?? '',
    m.transaction?.date ?? '', m.transaction?.description ?? '',
    m.transaction?.amount ?? '', m.status, m.reason
  ]);
  return [header, ...data];
}

function matchRowsXlsx() {
  const header = ['Employee', 'Receipt File', 'Business', 'Receipt Total', 'Last 4', 'Preview', 'Bank Date', 'Bank Description', 'Bank Amount', 'Status', 'Reason'];
  const data = matches.map(m => [
    m.receipt.employee, m.receipt.filename, m.receipt.business,
    m.receipt.total ?? '', m.receipt.last4 ?? '',
    m.receipt.previewUrl ? { value: 'View', hyperlink: m.receipt.previewUrl } : '',
    m.transaction?.date ?? '', m.transaction?.description ?? '',
    m.transaction?.amount ?? '', m.status, m.reason
  ]);
  return [header, ...data];
}

exportReceiptsButton.addEventListener('click', () => exportCSV(receiptRows(), 'receipts.csv'));
exportReceiptsXlsxButton.addEventListener('click', () => exportXlsx(receiptRowsXlsx(), 'Receipts', 'receipts.xlsx'));
exportMatchesButton.addEventListener('click', () => exportCSV(matchRows(), 'reconciliation.csv'));
exportMatchesXlsxButton.addEventListener('click', () => exportXlsx(matchRowsXlsx(), 'Reconciliation', 'reconciliation.xlsx'));

function updateExportButtons() {
  exportReceiptsButton.disabled = receipts.length === 0;
  exportReceiptsXlsxButton.disabled = receipts.length === 0;
  matchDataButton.disabled = !(receipts.length && bankTransactions.length);
}
