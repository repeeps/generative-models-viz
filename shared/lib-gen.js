/* ============================================================
   생성모델 엔진 (VZ.GEN — Generative Models)
   "생성모델, 눈으로 보기" 전용 렌더러. 순수 함수(상태→SVG 문자열),
   전부 방어적(빈 배열·0 division·NaN 가드). 베이스 lib.js 재사용.
   핵심 모티프: glyph(z1,z2) — 두 잠재좌표로 "매끄럽게" 모핑되는
   생성물 대역(작은 얼굴). 연속이라 보간·잠재공간이 시각적으로 정직.
   색: data/real=청록(--q) generated=보라(--v) accept/real라벨=초록(--good)
       noise·fake=코랄(--dead) 보조=앰버(--hot)
   ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ;
  const LA = VZ.LA, clamp = VZ.clamp;

  const C = {
    data: 'var(--q)', gen: 'var(--v)', real: 'var(--good)', noise: 'var(--dead)',
    fake: 'var(--dead)', accent: 'var(--hot)', ink: 'var(--ink)', muted: 'var(--muted)',
    faint: 'var(--faint)', line: 'var(--line)', q: 'var(--q)', v: 'var(--v)',
    hot: 'var(--hot)', good: 'var(--good)', dead: 'var(--dead)', slate: 'var(--slate)',
  };
  const num = (v, d = 0) => (isFinite(v) ? v : d);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function rng(seed) { let s = (seed >>> 0) || 1; return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function svg(W, H, inner, aria) {
    return `<svg viewBox="0 0 ${num(W, 100)} ${num(H, 100)}" width="100%" role="img" aria-label="${esc(aria) || '생성모델 그림'}" style="max-width:100%;display:block;background:var(--panel-2);border:1px solid var(--line);border-radius:12px">${inner || ''}</svg>`;
  }
  function chip(cx, cy, text, opts = {}) {
    const col = opts.color || C.q, w = Math.max(opts.minW || 30, String(text).length * 7 + 14), h = opts.h || 20;
    return `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="6" fill="${opts.fill || 'var(--panel)'}" stroke="${col}" stroke-width="1.2"${opts.dim ? ' opacity="0.45"' : ''}/>` +
      `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="${opts.fs || 10.5}" font-family="JetBrains Mono" font-weight="700" fill="${col}">${esc(text)}</text>`;
  }
  function arrow(x1, y1, x2, y2, opts = {}) {
    const col = opts.color || C.line;
    if (opts.dash) return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${opts.lw || 1.6}" stroke-dasharray="${opts.dash}"${opts.dim ? ' opacity="0.4"' : ''}/>`;
    return LA.arrowPx(x1, y1, x2, y2, col, { lw: opts.lw || 1.8 });
  }

  // 좌표 매핑 [0..1]→픽셀 (y 위가 큼)
  function plane(box) {
    const { x, y, w, h } = box, pad = 6;
    return {
      px: nx => x + pad + clamp(nx, 0, 1) * (w - 2 * pad),
      py: ny => y + h - pad - clamp(ny, 0, 1) * (h - 2 * pad),
      frame: () => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="var(--bg)" stroke="var(--line)" stroke-width="1"/>`,
    };
  }

  // ---- 색 보간 (글리프 색조) ----
  function hx(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function lerpHex(a, b, t) { const pa = hx(a), pb = hx(b); const m = i => Math.round(pa[i] + (pb[i] - pa[i]) * clamp(t, 0, 1)); return `rgb(${m(0)},${m(1)},${m(2)})`; }
  const STOPS = ['#37bdf8', '#c084fc', '#fbbf24']; // 청록→보라→앰버
  function glyphHue(t) { t = clamp(t, 0, 1) * (STOPS.length - 1); const i = Math.floor(t), f = t - i; return lerpHex(STOPS[i], STOPS[Math.min(i + 1, STOPS.length - 1)], f); }

  // ---- 글리프: 두 잠재좌표 z1,z2 → 매끄럽게 모핑되는 "생성물"(작은 얼굴) ----
  // glyph(cx,cy,s,z1,z2,opts) : 전 파라미터 연속(스냅 없음) — 보간이 정직함
  function glyph(cx, cy, s, z1, z2, opts = {}) {
    z1 = clamp(num(z1, 0.5), 0, 1); z2 = clamp(num(z2, 0.5), 0, 1);
    const col = glyphHue(z1);
    const rx = s * (0.52 + 0.20 * z2), ry = s * (0.52 + 0.20 * (1 - z2));
    let g = '';
    if (opts.frame !== false) g += `<rect x="${(cx - s * 0.82).toFixed(1)}" y="${(cy - s * 0.82).toFixed(1)}" width="${(s * 1.64).toFixed(1)}" height="${(s * 1.64).toFixed(1)}" rx="${(s * 0.22).toFixed(1)}" fill="var(--bg)" stroke="${opts.stroke || 'var(--line)'}" stroke-width="${opts.lw || 1}"/>`;
    g += `<ellipse cx="${cx}" cy="${(cy + s * 0.06).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${col}" opacity="0.92"/>`;
    const ex = s * (0.15 + 0.20 * z1), ey = cy - s * 0.13, er = s * (0.07 + 0.06 * z2);
    g += `<circle cx="${(cx - ex).toFixed(1)}" cy="${ey.toFixed(1)}" r="${er.toFixed(1)}" fill="#0b0e14"/><circle cx="${(cx + ex).toFixed(1)}" cy="${ey.toFixed(1)}" r="${er.toFixed(1)}" fill="#0b0e14"/>`;
    const mw = s * 0.34, mc = (z2 - 0.5) * s * 0.55, my = cy + s * 0.30;
    g += `<path d="M${(cx - mw).toFixed(1)},${my.toFixed(1)} Q${cx.toFixed(1)},${(my + mc).toFixed(1)} ${(cx + mw).toFixed(1)},${my.toFixed(1)}" fill="none" stroke="#0b0e14" stroke-width="${(s * 0.05).toFixed(1)}" stroke-linecap="round"/>`;
    if (opts.label != null) g += `<text x="${cx}" y="${(cy + s * 0.82 + 11).toFixed(1)}" text-anchor="middle" font-size="9" font-family="JetBrains Mono" fill="${C.faint}">${esc(opts.label)}</text>`;
    return g;
  }

  // ---- 노이즈 낀 글리프 (확산 forward/reverse): level 0=깨끗 1=순수 노이즈 ----
  function glyphNoisy(cx, cy, s, z1, z2, level, seed, opts = {}) {
    level = clamp(num(level, 0), 0, 1);
    const R = rng(seed || 1);
    const fr = s * 1.64;
    let g = `<rect x="${(cx - s * 0.82).toFixed(1)}" y="${(cy - s * 0.82).toFixed(1)}" width="${fr.toFixed(1)}" height="${fr.toFixed(1)}" rx="${(s * 0.22).toFixed(1)}" fill="var(--bg)" stroke="${opts.stroke || 'var(--line)'}" stroke-width="${opts.lw || 1}"/>`;
    g += `<g opacity="${(1 - level * 0.9).toFixed(2)}">${glyph(cx, cy, s, z1, z2, { frame: false })}</g>`;
    const n = Math.round(level * 90), cell = s * 0.16;
    for (let i = 0; i < n; i++) {
      const px = cx - s * 0.78 + R() * (fr - cell), py = cy - s * 0.78 + R() * (fr - cell);
      const shade = Math.round(R() * 255);
      g += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="rgb(${shade},${shade},${shade})" opacity="${(0.35 + 0.4 * level).toFixed(2)}"/>`;
    }
    if (opts.label != null) g += `<text x="${cx}" y="${(cy + s * 0.82 + 11).toFixed(1)}" text-anchor="middle" font-size="9" font-family="JetBrains Mono" fill="${C.faint}">${esc(opts.label)}</text>`;
    return g;
  }

  // ---- 잠재공간 격자: z1=가로, z2=세로 → 글리프 그리드 ----
  // latentGrid(x,y,w,h,opts) opts:{cols,rows,s, sel:{z1,z2}, valid(z1,z2)->bool, title}
  function latentGrid(x, y, w, h, opts = {}) {
    const cols = opts.cols || 5, rows = opts.rows || 5, P = plane({ x, y, w, h });
    let g = P.frame();
    if (opts.title != null) g += `<text x="${x + w / 2}" y="${y - 6}" text-anchor="middle" font-size="10" font-family="JetBrains Mono" fill="${C.muted}">${esc(opts.title)}</text>`;
    const s = opts.s || Math.min((w - 16) / cols, (h - 16) / rows) * 0.42;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const z1 = cols > 1 ? i / (cols - 1) : 0.5, z2 = rows > 1 ? j / (rows - 1) : 0.5;
      const cx = P.px((i + 0.5) / cols), cy = P.py((j + 0.5) / rows);
      const ok = opts.valid ? opts.valid(z1, z2) : true;
      if (ok) g += glyph(cx, cy, s, z1, z2, { frame: false });
      else g += glyphNoisy(cx, cy, s, z1, z2, 0.85, (i * 17 + j * 7 + 1), { });
    }
    if (opts.sel) { const cx = P.px(opts.sel.z1), cy = P.py(1 - opts.sel.z2);
      g += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(s + 6).toFixed(1)}" fill="none" stroke="${C.hot}" stroke-width="2"/>`; }
    if (opts.axes !== false) {
      g += `<text x="${x + w / 2}" y="${y + h + 13}" text-anchor="middle" font-size="8.5" font-family="JetBrains Mono" fill="${C.faint}">잠재축 z₁ →</text>`;
      g += `<text x="${x - 4}" y="${y + h / 2}" text-anchor="middle" font-size="8.5" font-family="JetBrains Mono" fill="${C.faint}" transform="rotate(-90 ${x - 4} ${y + h / 2})">잠재축 z₂ →</text>`;
    }
    return g;
  }

  // ---- 1D 분포 곡선 (+ 표본 눈금 + 채우기) ----
  // dist1d(x,y,w,h,opts) opts:{fn(nx)->density(0..1), samples:[nx..], title, color, fill}
  function dist1d(x, y, w, h, opts = {}) {
    const P = plane({ x, y, w, h }), fn = opts.fn, N = 64, col = opts.color || C.data;
    let g = P.frame();
    if (opts.title != null) g += `<text x="${x + w / 2}" y="${y - 6}" text-anchor="middle" font-size="10" font-family="JetBrains Mono" fill="${C.muted}">${esc(opts.title)}</text>`;
    if (fn) {
      let d = '', area = `M${P.px(0).toFixed(1)},${P.py(0).toFixed(1)} `;
      for (let i = 0; i <= N; i++) { const nx = i / N, ny = clamp(fn(nx), 0, 1); const X = P.px(nx).toFixed(1), Y = P.py(ny).toFixed(1); d += (i === 0 ? 'M' : 'L') + X + ',' + Y + ' '; area += 'L' + X + ',' + Y + ' '; }
      area += `L${P.px(1).toFixed(1)},${P.py(0).toFixed(1)} Z`;
      if (opts.fill !== false) g += `<path d="${area}" fill="${col}" opacity="0.14"/>`;
      g += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.4"/>`;
    }
    (opts.samples || []).forEach(nx => { const X = P.px(nx); g += `<line x1="${X.toFixed(1)}" y1="${P.py(0).toFixed(1)}" x2="${X.toFixed(1)}" y2="${(P.py(0) - 10).toFixed(1)}" stroke="${opts.sampleColor || C.gen}" stroke-width="2"/><circle cx="${X.toFixed(1)}" cy="${(P.py(0) - 12).toFixed(1)}" r="2.6" fill="${opts.sampleColor || C.gen}"/>`; });
    return g;
  }

  // ---- 점구름 산점도 ----
  // scatter(x,y,w,h,opts) opts:{pts:[{x,y,c?}], r, color, line, title, axes}
  function scatter(x, y, w, h, opts = {}) {
    const P = plane({ x, y, w, h }), pts = opts.pts || [], r = opts.r || 3.6;
    let g = P.frame();
    if (opts.title != null) g += `<text x="${x + w / 2}" y="${y - 6}" text-anchor="middle" font-size="10" font-family="JetBrains Mono" fill="${C.muted}">${esc(opts.title)}</text>`;
    if (opts.line) { const ln = opts.line; g += `<line x1="${P.px(0)}" y1="${P.py(clamp(ln.b, 0, 1))}" x2="${P.px(1)}" y2="${P.py(clamp(ln.m + ln.b, 0, 1))}" stroke="${ln.color || C.accent}" stroke-width="2"/>`; }
    pts.forEach(p => { const col = p.c != null ? p.c : (opts.color || C.data); g += `<circle cx="${P.px(p.x).toFixed(1)}" cy="${P.py(p.y).toFixed(1)}" r="${r}" fill="${col}" opacity="${opts.op || 0.85}" stroke="var(--bg)" stroke-width="0.6"/>`; });
    if (opts.axes) { g += `<text x="${x + w / 2}" y="${y + h + 13}" text-anchor="middle" font-size="8.5" font-family="JetBrains Mono" fill="${C.faint}">${esc(opts.axes[0])}</text>`; }
    return g;
  }

  // ---- 밀도 구름 (동심 타원 = 분포 "그리기") ----
  function density(cx, cy, rx, ry, opts = {}) {
    const col = opts.color || C.data; let g = '';
    [1, 0.72, 0.46, 0.24].forEach((f, i) => g += `<ellipse cx="${cx}" cy="${cy}" rx="${(rx * f).toFixed(1)}" ry="${(ry * f).toFixed(1)}" fill="${col}" opacity="${(0.10 + i * 0.06).toFixed(2)}"/>`);
    return g;
  }

  // ---- 인코더→z→디코더 모래시계 ----
  // encDec(x,y,w,h,opts) opts:{labels:[enc,z,dec], hi:'enc'|'z'|'dec'}
  function encDec(x, y, w, h, opts = {}) {
    const midY = y + h / 2, ew = w * 0.3, zx = x + w * 0.5, zw = w * 0.1;
    const L = opts.labels || ['인코더', 'z', '디코더'];
    let g = '';
    // encoder trapezoid (wide->narrow)
    g += `<polygon points="${x},${y} ${x + ew},${midY - h * 0.14} ${x + ew},${midY + h * 0.14} ${x},${y + h}" fill="var(--panel)" stroke="${opts.hi === 'enc' ? C.accent : C.q}" stroke-width="${opts.hi === 'enc' ? 2.2 : 1.4}"/>`;
    g += `<text x="${x + ew * 0.5}" y="${midY + 3}" text-anchor="middle" font-size="10" font-family="JetBrains Mono" font-weight="700" fill="${C.q}">${esc(L[0])}</text>`;
    // latent bottleneck
    g += `<rect x="${zx - zw / 2}" y="${midY - h * 0.14}" width="${zw}" height="${h * 0.28}" rx="4" fill="${opts.hi === 'z' ? C.v : 'var(--panel)'}" opacity="${opts.hi === 'z' ? 0.85 : 1}" stroke="${C.v}" stroke-width="1.6"/>`;
    g += `<text x="${zx}" y="${midY + 3}" text-anchor="middle" font-size="11" font-family="JetBrains Mono" font-weight="700" fill="${opts.hi === 'z' ? '#0b0e14' : C.v}">${esc(L[1])}</text>`;
    // decoder trapezoid (narrow->wide)
    const dx = x + w - ew;
    g += `<polygon points="${dx},${midY - h * 0.14} ${x + w},${y} ${x + w},${y + h} ${dx},${midY + h * 0.14}" fill="var(--panel)" stroke="${opts.hi === 'dec' ? C.accent : C.v}" stroke-width="${opts.hi === 'dec' ? 2.2 : 1.4}"/>`;
    g += `<text x="${x + w - ew * 0.5}" y="${midY + 3}" text-anchor="middle" font-size="10" font-family="JetBrains Mono" font-weight="700" fill="${C.v}">${esc(L[2])}</text>`;
    g += arrow(x + ew, midY, zx - zw / 2, midY, { color: C.slate, lw: 1.2 });
    g += arrow(zx + zw / 2, midY, dx, midY, { color: C.slate, lw: 1.2 });
    return g;
  }

  // ---- 게이지 (판별자 점수 등) 0..1 ----
  function gauge(cx, cy, opts = {}) {
    const v = clamp(num(opts.val, 0.5), 0, 1), w = opts.w || 120, h = 14;
    let g = `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="7" fill="var(--panel)" stroke="var(--line)"/>`;
    g += `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${(w * v).toFixed(1)}" height="${h}" rx="7" fill="${opts.color || C.good}" opacity="0.85"/>`;
    if (opts.label != null) g += `<text x="${cx}" y="${cy - h}" text-anchor="middle" font-size="9" font-family="JetBrains Mono" fill="${C.muted}">${esc(opts.label)}</text>`;
    g += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="9.5" font-family="JetBrains Mono" font-weight="700" fill="#0b0e14">${Math.round(v * 100)}%</text>`;
    return g;
  }

  // ---- 가로 막대 ----
  function bars(x, y, opts = {}) {
    const items = opts.items || [], w = opts.w || 200, bh = 22, gap = 12;
    let g = '';
    items.forEach((it, i) => { const yy = y + i * (bh + gap); g += `<text x="${x}" y="${yy + 14}" font-size="10" font-family="JetBrains Mono" font-weight="700" fill="${it.color || C.q}">${esc(it.label)}</text>`;
      g += `<rect x="${x + 84}" y="${yy}" width="${w}" height="${bh}" rx="5" fill="var(--panel)" stroke="var(--line)"/>`;
      g += `<rect x="${x + 84}" y="${yy}" width="${(w * clamp(it.val, 0, 1)).toFixed(1)}" height="${bh}" rx="5" fill="${it.color || C.q}" opacity="0.85"/>`;
      g += `<text x="${x + 84 + w - 8}" y="${yy + 15}" text-anchor="end" font-size="9.5" font-family="JetBrains Mono" font-weight="700" fill="#0b0e14">${Math.round(clamp(it.val, 0, 1) * 100)}%</text>`; });
    return g;
  }

  // ---- 비교 카드 ----
  function card(x, y, w, title, rows, opts = {}) {
    const r = rows || [], h = opts.h || (28 + r.length * 18), col = opts.color || C.q;
    let g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="var(--panel)" stroke="${col}" stroke-width="1.6"/>`;
    g += `<text x="${x + 12}" y="${y + 19}" font-size="12" font-family="'Pretendard'" font-weight="700" fill="${col}">${esc(title)}</text>`;
    r.forEach((row, i) => { const ry = y + 36 + i * 18; g += `<text x="${x + 12}" y="${ry}" font-size="9.5" font-family="JetBrains Mono" fill="${C.muted}">${esc(row[0])}</text><text x="${x + w - 12}" y="${ry}" text-anchor="end" font-size="9.5" font-family="JetBrains Mono" fill="${C.ink}">${esc(row[1])}</text>`; });
    return g;
  }

  VZ.GEN = { C, num, esc, rng, svg, chip, arrow, plane, glyphHue, lerpHex, glyph, glyphNoisy, latentGrid, dist1d, scatter, density, encDec, gauge, bars, card };
})(window);
