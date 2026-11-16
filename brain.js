/* Business Brain scroll animation:
   tools revolve on a 3D ring -> each one jumps in and lights up part of a
   star-constellation brain -> the finished brain spins once -> its stars
   stream out to form the operating-system window, which then fills in. */
(function () {
  const section = document.getElementById('business-brain');
  const stage = document.getElementById('brain-stage');
  const wrap = document.getElementById('brain-wrap');
  if (!section || !stage) return;
  const caps = section.querySelectorAll('.brain-cap');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const I = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    grid: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    dollar: '<path d="M15 8.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 1.4 1.3 1.8 3 2.3s3 .9 3 2.3c0 1.3-1.3 2.2-3 2.2-1.3 0-2.4-.5-3-1.5M12 5v14"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M16 5.5a3 3 0 0 1 0 5.5M17.5 14.6c1.6.6 2.7 2 3 4.4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    check: '<path d="M5 12.5l4 4L19 7"/>'
  };
  const svg = (k, sw) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.8}" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;

  const TOOLS = [
    { n: 'Email', ic: 'mail', c: '#3b82f6', side: true },
    { n: 'Spreadsheets', ic: 'grid', c: '#16a34a', side: true },
    { n: 'Accounting', ic: 'dollar', c: '#0d9488', side: true },
    { n: 'CRM', ic: 'users', c: '#ea7a2b', side: true },
    { n: 'Calendar', ic: 'cal', c: '#dc4c64', side: true },
    { n: 'Shared drive', ic: 'folder', c: '#ca8a04', side: true },
    { n: 'Applications', ic: 'apps', c: '#6366f1', side: true },
    { n: 'Know-how', ic: 'book', c: '#db2777', side: true }
  ];
  const FEED = [
    { ic: 'mail', c: '#3b82f6', t: 'Quote request from a new customer', s: 'Lead logged' },
    { ic: 'dollar', c: '#0d9488', t: 'Invoice #1048 is 14 days overdue', s: 'Reminder sent' },
    { ic: 'receipt', c: '#a8865a', t: 'March receipts matched to the statement', s: 'Reconciled' },
    { ic: 'cal', c: '#dc4c64', t: 'Thursday site visit double-booked', s: 'Rescheduled' },
    { ic: 'book', c: '#db2777', t: '“How do we price a rush job?”', s: 'Answered' }
  ];

  const LAYOUTS = {
    wide: {
      W: 1200, H: 540, tw: 200, th: 64, R: 450, Ry: 105, P: 1500, S: 1.3, dsep: 6,
      win: { x: 150, y: 26, w: 900, h: 488, bar: 52, side: 220, slotH: 40 }
    },
    narrow: {
      W: 600, H: 760, tw: 220, th: 70, R: 200, Ry: 230, P: 1100, S: 1.38, dsep: 7.2,
      win: { x: 10, y: 16, w: 580, h: 728, bar: 64, side: 210, slotH: 50 }
    }
  };

  // timeline (fractions of the section's scroll)
  const T = { jump0: 0.2, jumpGap: 0.028, jumpDur: 0.09, spin0: 0.49, spin1: 0.6, morph0: 0.6, morph1: 0.71, side0: 0.71, feed0: 0.8 };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ── Constellation brain model (400×300 box, side view, with depth) ── */
  const SHAPE = {
    cerebrum: 'M58 168 C40 120 72 62 140 44 C192 22 272 24 322 56 C366 82 386 128 370 166 C362 190 336 202 308 200 C288 214 256 216 236 206 C202 216 152 216 122 206 C86 200 64 190 58 168 Z',
    ccx: 212, ccy: 150, rx: 165, ry: 95, rz: 105
  };
  let model = null; // { nodes: [{x,y,z,th,tw}], links: [[i,j]] }

  function genModel(dsep) {
    const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
    const P = new Path2D(SHAPE.cerebrum);
    let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const G = []; for (let i = 0; i < 4096; i++) G.push(R());
    const sm = t => t * t * (3 - 2 * t);
    const noise = (px, py) => {
      const xi = Math.floor(px), yi = Math.floor(py), xf = px - xi, yf = py - yi;
      const g = (a, b) => G[(((a % 64) + 64) % 64) * 64 + (((b % 64) + 64) % 64)];
      const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
      const top = a + (b - a) * sm(xf), bot = c + (d - c) * sm(xf); return top + (bot - top) * sm(yf);
    };
    const mask = new Uint8Array(400 * 300);
    for (let y = 0; y < 300; y++) for (let x = 0; x < 400; x++) mask[y * 400 + x] = ctx.isPointInPath(P, x + .5, y + .5) ? 1 : 0;
    const inside = (x, y) => x >= 0 && y >= 0 && x < 400 && y < 300 && mask[(y | 0) * 400 + (x | 0)] === 1;
    const ang = (x, y) => noise(x * .045, y * .045) * Math.PI * 3 + noise(x * .1 + 9, y * .1 + 3) * 1.1;

    const nodes = [], links = [];
    const zmax = (x, y) => {
      const u = (x - SHAPE.ccx) / SHAPE.rx, v = (y - 125) / SHAPE.ry;
      return Math.sqrt(Math.max(0, 1 - u * u - v * v)) * SHAPE.rz;
    };
    const addChain = (pts, th0, thStep, zf, closed) => {
      const start = nodes.length;
      pts.forEach((p, j) => nodes.push({ x: p[0], y: p[1], z: zf(p[0], p[1]), th: th0 + j * thStep, tw: R() * 6.28 }));
      for (let j = 1; j < pts.length; j++) links.push([start + j - 1, start + j]);
      if (closed) links.push([start + pts.length - 1, start]);
    };

    // outline: ray-cast the silhouette from its centre
    const outline = [];
    for (let a = 0; a < 96; a++) {
      const t = a / 96 * Math.PI * 2; let r = 4;
      while (inside(205 + Math.cos(t) * r, 125 + Math.sin(t) * r) && r < 260) r += 1;
      outline.push([205 + Math.cos(t) * (r - 1.5), 125 + Math.sin(t) * (r - 1.5)]);
    }
    addChain(outline, 0, 0.0009, () => 0, true);

    // gyri: evenly spaced flow lines sampled into star chains
    const CELL = 3, occ = new Map();
    const key = (i, j) => i * 1000 + j;
    const hit = (x, y, id) => {
      const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL), r = Math.ceil(dsep / CELL);
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
        const arr = occ.get(key(ci + a, cj + b)); if (!arr) continue;
        for (const q of arr) if (q[2] !== id && (q[0] - x) ** 2 + (q[1] - y) ** 2 < dsep * dsep) return true;
      }
      return false;
    };
    for (let t = 0; t < 5000; t++) {
      const sx = 46 + R() * 330, sy = 30 + R() * 185;
      if (!inside(sx, sy) || hit(sx, sy, -1)) continue;
      let pts = [[sx, sy]];
      for (const dir of [1, -1]) {
        let x = sx, y = sy; const seg = [];
        for (let st = 0; st < 110; st++) {
          const a = ang(x, y), nx = x + Math.cos(a) * 1.2 * dir, ny = y + Math.sin(a) * 1.2 * dir;
          if (!inside(nx, ny) || hit(nx, ny, t)) break;
          x = nx; y = ny; seg.push([x, y]);
        }
        pts = dir === 1 ? pts.concat(seg) : seg.reverse().concat(pts);
      }
      if (pts.length < 10) continue;
      for (const p of pts) { const k = key(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL)); if (!occ.has(k)) occ.set(k, []); occ.get(k).push([p[0], p[1], t]); }
      const sampled = pts.filter((_, j) => j % 6 === 0);
      if (sampled.length < 2) continue;
      const m = sampled[sampled.length >> 1];
      const dn = Math.hypot(m[0] - 205, m[1] - 125) / 190;
      const side = R() < 0.5 ? 1 : -1;
      const depth = 0.55 + 0.45 * R();
      addChain(sampled, 0.08 + 0.58 * R() + 0.3 * dn, 0.006, (x, y) => side * zmax(x, y) * depth, false);
    }

    // cerebellum: folia arcs + rim
    const cb = [];
    for (let i = 0; i < 22; i++) { const t = i / 22 * Math.PI * 2; cb.push([314 + Math.cos(t) * 44, 216 + Math.sin(t) * 20 - Math.cos(t) * 4]); }
    addChain(cb, 0.55, 0.004, () => 0, true);
    for (let f = 0; f < 4; f++) {
      const arc = [];
      for (let i = 0; i <= 7; i++) { const u = i / 7; arc.push([276 + u * 74, 205 + f * 7 + Math.sin(u * Math.PI) * 7 - u * 6]); }
      addChain(arc, 0.6 + f * 0.04, 0.004, (x) => (f % 2 ? 1 : -1) * 18, false);
    }
    // brain stem
    for (const off of [0, 10]) {
      const st = []; for (let i = 0; i <= 5; i++) st.push([250 + off + i * 1.5, 212 + i * 13]);
      addChain(st, 0.7, 0.01, () => (off ? 6 : -6), false);
    }

    // a few cross links between nearby stars for the constellation look
    for (let i = 0; i < nodes.length; i++) {
      if (R() > 0.32) continue;
      let best = -1, bd = 1e9;
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const d = (nodes[i].x - nodes[j].x) ** 2 + (nodes[i].y - nodes[j].y) ** 2 + ((nodes[i].z - nodes[j].z) * .5) ** 2;
        if (d < bd && d > 30) { bd = d; best = j; }
      }
      if (best >= 0 && bd < 260) links.push([i, best]);
    }
    return { nodes, links };
  }

  // glowing star sprite
  const sprite = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(235,250,255,1)'); gr.addColorStop(.18, 'rgba(140,215,255,.9)');
    gr.addColorStop(.45, 'rgba(47,130,255,.35)'); gr.addColorStop(1, 'rgba(47,130,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
  })();

  let L, cards = [], items = [], rows = [], win, cv, ctx, res = 1, cx, cy, k = 1, perim = [], pulse = 0, lastLanded = 0;

  function build() {
    L = window.innerWidth < 760 ? LAYOUTS.narrow : LAYOUTS.wide;
    stage.classList.toggle('narrow', L === LAYOUTS.narrow);
    stage.style.width = L.W + 'px'; stage.style.height = L.H + 'px';
    stage.innerHTML = '';
    cards = []; items = []; rows = [];
    const Wn = L.win;
    cx = Wn.x + Wn.w / 2; cy = Wn.y + Wn.h / 2;

    win = document.createElement('div');
    win.className = 'bw';
    Object.assign(win.style, { left: Wn.x + 'px', top: Wn.y + 'px', width: Wn.w + 'px', height: Wn.h + 'px' });
    win.innerHTML = `
      <div class="bw-bar" style="height:${Wn.bar}px">
        <span class="bw-dots"><i></i><i></i><i></i></span>
        <span class="bw-title">Your Business Brain</span>
        <span class="bw-search">${svg('search')}<span>Ask the brain…</span></span>
      </div>
      <div class="bw-body" style="top:${Wn.bar}px">
        <div class="bw-side" style="width:${Wn.side}px"><p class="bw-label">Connected</p></div>
        <div class="bw-main" style="left:${Wn.side}px">
          <div class="bw-main-head"><span class="bw-h">Today</span><span class="bw-sub">Handled automatically</span></div>
          <div class="bw-feed"></div>
        </div>
      </div>`;
    stage.appendChild(win);
    const side = win.querySelector('.bw-side');
    const feed = win.querySelector('.bw-feed');

    cv = document.createElement('canvas');
    cv.className = 'bcv';
    cv.style.width = L.W + 'px'; cv.style.height = L.H + 'px';
    stage.appendChild(cv);
    ctx = cv.getContext('2d');

    TOOLS.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'bt';
      el.style.width = L.tw + 'px'; el.style.height = L.th + 'px';
      el.innerHTML = `<span class="bt-ic" style="background:${t.c}">${svg(t.ic, 2)}</span><span class="bt-n">${t.n}</span>`;
      stage.appendChild(el);
      cards.push({ el, a0: i / TOOLS.length * Math.PI * 2 });
      if (t.side) {
        const it = document.createElement('div');
        it.className = 'bw-item' + (items.length === 0 ? ' active' : '');
        it.style.height = Wn.slotH + 'px';
        it.innerHTML = `<span class="bw-ic" style="background:${t.c}">${svg(t.ic, 2)}</span>${t.n}`;
        side.appendChild(it);
        items.push(it);
      }
    });
    FEED.forEach(f => {
      const r = document.createElement('div');
      r.className = 'bw-row';
      r.innerHTML = `<span class="bw-ic" style="background:${f.c}">${svg(f.ic, 2)}</span><span class="bw-t">${f.t}</span><span class="bw-s">${svg('check', 2.4)}${f.s}</span>`;
      feed.appendChild(r);
      rows.push(r);
    });

    model = genModel(L.dsep);
    // where each star lands on the window frame: straight out from the centre
    const hw = Wn.w / 2, hh = Wn.h / 2;
    perim = model.nodes.map(nd => {
      const dx = (nd.x - SHAPE.ccx) || 0.01, dy = (nd.y - SHAPE.ccy) || 0.01;
      const t = Math.min(hw / Math.abs(dx), hh / Math.abs(dy));
      return [cx + dx * t, cy + dy * t];
    });
    fit();
  }

  function fit() {
    const r = wrap.getBoundingClientRect();
    k = Math.min(r.width / L.W, r.height / L.H);
    stage.style.transform = `translate(-50%, -50%) scale(${k})`;
    res = Math.min(2.5, (window.devicePixelRatio || 1) * k);
    cv.width = Math.round(L.W * res); cv.height = Math.round(L.H * res);
  }

  const px = new Float32Array(4000), py = new Float32Array(4000), pa = new Float32Array(4000), pz = new Float32Array(4000);

  function drawBrain(f, theta, mo, alpha, time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!model || alpha <= 0.001) return;
    ctx.setTransform(res, 0, 0, res, 0, 0);
    const { nodes, links } = model;
    const S = L.S, cs = Math.cos(theta), sn = Math.sin(theta), Pp = 1100;

    // soft halo behind the brain
    const hR = Math.min(260 * S, L.H / 2 - 6, L.W / 2 - 6);
    const hal = ctx.createRadialGradient(cx, cy, 10, cx, cy, hR);
    hal.addColorStop(0, `rgba(30,110,255,${(0.1 + 0.22 * f + 0.15 * pulse) * alpha * (1 - mo)})`);
    hal.addColorStop(1, 'rgba(30,110,255,0)');
    ctx.fillStyle = hal; ctx.fillRect(cx - hR, cy - hR, hR * 2, hR * 2);

    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      const x0 = nd.x - SHAPE.ccx, y0 = nd.y - SHAPE.ccy;
      const xr = x0 * cs + nd.z * sn, zr = -x0 * sn + nd.z * cs;
      const ps = Pp / (Pp - zr * S);
      let X = cx + xr * S * ps, Y = cy + y0 * S * ps;
      const mi = mo > 0 ? ease(clamp((mo - (i % 13) / 13 * 0.25) / 0.75)) : 0;
      if (mi > 0) { X = lerp(X, perim[i][0], mi); Y = lerp(Y, perim[i][1], mi); }
      px[i] = X; py[i] = Y; pz[i] = zr;
      const reveal = clamp((f - nd.th) / 0.05);
      const depth = 0.45 + 0.55 * clamp((zr + SHAPE.rz) / (2 * SHAPE.rz));
      const tw = 0.82 + 0.18 * Math.sin(time * 0.0025 + nd.tw);
      pa[i] = reveal * depth * tw * alpha * (1 - clamp((mo - 0.55) / 0.45));
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgb(70,150,255)';
    // links in a few alpha buckets to keep draw calls low
    for (let b = 1; b <= 4; b++) {
      const lo = (b - 1) / 4, hi = b / 4;
      ctx.globalAlpha = 0.5 * hi * (1 - clamp(mo / 0.2));
      ctx.beginPath();
      for (let l = 0; l < links.length; l++) {
        const a = links[l][0], c = links[l][1];
        const v = Math.min(pa[a], pa[c]);
        if (v <= lo || v > hi) continue;
        ctx.moveTo(px[a], py[a]); ctx.lineTo(px[c], py[c]);
      }
      ctx.stroke();
    }
    // stars
    for (let i = 0; i < nodes.length; i++) {
      const v = pa[i]; if (v <= 0.01) continue;
      const sz = (5 + 5 * clamp((pz[i] + SHAPE.rz) / (2 * SHAPE.rz))) * (1 + 0.3 * pulse);
      ctx.globalAlpha = Math.min(1, v * 1.1);
      ctx.drawImage(sprite, px[i] - sz / 2, py[i] - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function render(p, time) {
    const o0 = 1 - clamp((p - 0.17) / 0.05);
    const o1 = clamp((p - 0.21) / 0.05) * (1 - clamp((p - 0.57) / 0.05));
    const o2 = clamp((p - 0.62) / 0.05);
    [o0, o1, o2].forEach((o, i) => {
      if (!caps[i]) return;
      caps[i].style.opacity = o;
      caps[i].style.transform = `translateY(${(1 - o) * 10}px)`;
      caps[i].style.visibility = o < 0.01 ? 'hidden' : 'visible';
    });

    const rot = (reduce ? 0 : time * 0.00022) + p * Math.PI * 2.2;
    let landedF = 0, landed = 0;
    cards.forEach((c, i) => {
      const a = c.a0 + rot;
      const z = Math.cos(a) * L.R;
      const s0 = 0.82 * L.P / (L.P - z);
      const x0 = cx + Math.sin(a) * L.R;
      const y0 = cy + Math.cos(a) * L.Ry;
      const depth = (z + L.R) / (2 * L.R);
      const tilt = -Math.sin(a) * 28;
      const ti = ease(clamp((p - T.jump0 - i * T.jumpGap) / T.jumpDur));
      landedF += clamp((ti - 0.7) / 0.3);
      if (ti >= 1) landed++;
      const x = lerp(x0, cx, ti);
      const y = lerp(y0, cy, ti) - Math.sin(Math.PI * ti) * (L.R * 0.38);
      const s = lerp(s0, 0.08, ti);
      const op = lerp(0.5 + 0.5 * depth, 1, Math.min(1, ti * 3)) * (1 - clamp((ti - 0.78) / 0.22));
      c.el.style.transform = `translate(${x - L.tw / 2}px, ${y - L.th / 2}px) perspective(800px) rotateY(${tilt * (1 - ti)}deg) scale(${s})`;
      c.el.style.opacity = op;
      c.el.style.zIndex = ti > 0 ? 3000 : Math.round(1000 + z);
      c.el.style.filter = ti > 0 ? 'none' : `brightness(${0.62 + 0.38 * depth})`;
    });

    // a little flash each time a tool lands
    if (landed > lastLanded) pulse = 1;
    lastLanded = landed;
    pulse *= 0.93;

    const bIn = easeOut(clamp((p - 0.13) / 0.08));
    const f = bIn * (0.1 + 0.9 * landedF / cards.length);
    const theta = ease(clamp((p - T.spin0) / (T.spin1 - T.spin0))) * Math.PI * 2;
    const mo = clamp((p - T.morph0) / (T.morph1 - T.morph0));
    drawBrain(f, theta, mo, bIn, time);

    const wv = ease(clamp((mo - 0.45) / 0.55));
    win.style.opacity = wv;
    win.style.transform = `scale(${lerp(0.96, 1, wv)})`;

    items.forEach((it, j) => {
      const v = ease(clamp((p - T.side0 - j * 0.014) / 0.05));
      it.style.opacity = v;
      it.style.transform = `translateX(${(1 - v) * -12}px)`;
    });
    rows.forEach((r, i) => {
      const v = ease(clamp((p - T.feed0 - i * 0.022) / 0.05));
      r.style.opacity = v;
      r.style.transform = `translateY(${(1 - v) * 10}px)`;
    });
  }

  function progress() {
    const r = section.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    return total > 0 ? clamp(-r.top / total) : 1;
  }

  let running = false, visible = false;
  function loop(t) {
    if (!visible) { running = false; return; }
    render(reduce ? 1 : progress(), t);
    requestAnimationFrame(loop);
  }
  new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible && !running) { running = true; requestAnimationFrame(loop); }
  }).observe(section);

  let lastNarrow = null;
  function onResize() {
    const narrow = window.innerWidth < 760;
    if (narrow !== lastNarrow) { lastNarrow = narrow; build(); } else fit();
    render(reduce ? 1 : progress(), performance.now());
  }
  if (reduce) section.classList.add('static');
  onResize();
  window.addEventListener('resize', onResize);
})();
