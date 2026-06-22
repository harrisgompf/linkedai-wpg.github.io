const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');

// Load .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '25mb' }));

const EXTRACT_PROMPT = `You are a receipt data extraction assistant for a Canadian company. Extract all available fields from this receipt and return ONLY a valid JSON object with no other text.

Required JSON structure:
{
  "business": "exact vendor/store name as printed on receipt",
  "date": "purchase date in YYYY-MM-DD format, or empty string if not visible",
  "total": numeric total amount charged (including tax), or null if not found,
  "subtotal": numeric amount before tax, or null if not found,
  "gst": numeric GST amount, or null if not found,
  "pst": numeric PST/QST amount, or null if not found,
  "tax": numeric total tax (gst + pst combined), or null if not found,
  "last4": "last 4 digits of card number as a string (e.g. '1234'), or null if not found",
  "category": "one of: Meals, Supplies, Travel, Software, Equipment, Utilities, Other",
  "currency": "3-letter currency code, default CAD"
}

Rules:
- All monetary values are plain numbers with no currency symbols or commas
- If both GST and PST are found, set tax = GST + PST
- Card last4 appears as **** 1234 or XXXX-1234 or similar masked formats
- Return null for any field not visible on the receipt — never guess
- Return ONLY the JSON object, nothing else`;

const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const VALID_DOC_TYPES = new Set(['application/pdf']);

app.post('/api/extract-receipt', async (req, res) => {
  const { base64, mediaType, filename } = req.body;

  if (!base64 || !mediaType) {
    return res.status(400).json({ error: 'base64 and mediaType are required' });
  }

  const isImage = VALID_IMAGE_TYPES.has(mediaType);
  const isDoc = VALID_DOC_TYPES.has(mediaType);

  if (!isImage && !isDoc) {
    return res.status(400).json({ error: `Unsupported file type: ${mediaType}` });
  }

  try {
    const contentBlock = isImage
      ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }
      : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: [{ type: 'text', text: EXTRACT_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: 'Extract the receipt data.' }] }]
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Model returned no JSON', raw: text });
    }

    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error('Extract receipt error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const BANK_PROMPT = `You are a bank statement parser for a Canadian company. Extract every transaction from this bank statement and return ONLY a valid JSON array with no other text.

Each transaction object must have:
{
  "date": "transaction date in YYYY-MM-DD format",
  "description": "merchant/payee name exactly as shown",
  "amount": numeric amount as a positive number (purchases/debits are positive),
  "card": "last 4 digits of card number if shown, otherwise empty string"
}

Rules:
- Include only purchase/debit transactions, not payments or credits to the account
- amount is always a positive number
- If the statement covers multiple cards, populate card with the last 4 for each transaction
- Return ONLY the JSON array, nothing else`;

app.post('/api/parse-bank-statement', async (req, res) => {
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 is required' });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: [{ type: 'text', text: BANK_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extract all transactions from this bank statement.' }
        ]
      }]
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Model returned no JSON array', raw: text });

    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error('Parse bank statement error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Receipt Tracker → http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set — receipt extraction will fail');
  }
});
