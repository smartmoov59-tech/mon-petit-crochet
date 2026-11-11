/* ==========================================================================
   Pop-up de Noël : marchés de décembre 2026 (Cucuron le 6, Pertuis le 19).
   - apparaît 3 secondes après l'arrivée sur le site (une fois le chargement terminé), une seule fois par visite ;
   - se retire tout seul : une date passée disparaît, et après le 19 décembre la fenêtre ne s'affiche plus ;
   - test : ajouter ?noel à l'adresse pour l'afficher tout de suite, sans tenir compte des dates ni de la visite en cours.
   Décors dessinés en SVG et en CSS : aucune image, aucun service extérieur.
   ========================================================================== */
(() => {
  'use strict';
  const el = document.getElementById('noel');
  if (!el) return;
  const KEY = 'mpc-noel-2026', FORCE = /[?&]noel(&|$)/.test(location.search);

  /* ---------- 1. Quelles dates afficher ---------- */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!FORCE) {
    el.querySelectorAll('[data-noel-date]').forEach(li => { if (new Date(li.dataset.noelDate + 'T00:00:00') < today) li.remove(); });
    if (!el.querySelector('[data-noel-date]')) return;                    /* plus aucune date à venir : pas de fenêtre */
    try { if (sessionStorage.getItem(KEY)) return; } catch (e) { /* stockage indisponible : on affiche */ }
  }

  /* ---------- 2. Décors ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k])); if (parent) parent.appendChild(n); return n; };
  let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;   /* hasard fixe : la guirlande est toujours la même */
  const f1 = v => Math.round(v * 10) / 10;

  function bauble(parent, x, y, drop, r, color, delay) {
    const cy = y + drop + r, g = mk('g', { class: 'sw', style: `transform-origin:${x}px ${y}px;animation-delay:${delay}s` }, parent);
    mk('line', { x1: x, y1: y, x2: x, y2: cy - r - 1, stroke: '#C9AB6E', 'stroke-width': 1.2 }, g);
    mk('rect', { x: x - 2.6, y: cy - r - 4.4, width: 5.2, height: 4.8, rx: 1.2, fill: '#C9AB6E' }, g);
    mk('circle', { cx: x, cy, r, fill: color, stroke: 'rgba(60,30,15,.38)', 'stroke-width': .8 }, g);
    mk('ellipse', { cx: x - r * .32, cy: cy - r * .38, rx: r * .27, ry: r * .17, fill: '#fff', opacity: .6, transform: `rotate(-30 ${x - r * .32} ${cy - r * .38})` }, g);
    mk('path', { d: `M${x - r * .75} ${cy + r * .15}Q${x} ${cy + r * .62} ${x + r * .75} ${cy + r * .15}`, fill: 'none', stroke: '#fff', 'stroke-width': 1, opacity: .26 }, g);
  }

  function flake(parent, x, y, R, delay) {   /* flocon crocheté : six branches, pendu à la guirlande */
    const g = mk('g', { class: 'sw', style: `transform-origin:${x}px ${y - R - 12}px;animation-delay:${delay}s` }, parent);
    mk('line', { x1: x, y1: y - R - 12, x2: x, y2: y - R - 1, stroke: '#C9AB6E', 'stroke-width': 1.1 }, g);
    const s = mk('g', { transform: `translate(${x} ${y})`, fill: 'none', stroke: '#C9AB6E', 'stroke-width': 1.9, 'stroke-linecap': 'round' }, g);
    for (let i = 0; i < 6; i++) {
      const a = mk('g', { transform: `rotate(${i * 60})` }, s);
      mk('path', { d: `M0 0L0 ${-R}M0 ${-R * .52}L${-R * .3} ${-R * .8}M0 ${-R * .52}L${R * .3} ${-R * .8}M0 ${-R * .8}L${-R * .17} ${-R * .98}M0 ${-R * .8}L${R * .17} ${-R * .98}` }, a);
    }
    mk('circle', { cx: 0, cy: 0, r: 2.4, fill: '#C9AB6E', stroke: 'none' }, s);
  }

  function buildGarland(svg) {
    /* deux festons qui se rejoignent sous le nœud central : [x0, y0, cx, cy, x1, y1] (courbes de Bézier quadratiques) */
    const swags = [[-4, 16, 130, 100, 260, 16], [260, 16, 392, 100, 524, 16]];
    const pt = (s, t) => { const u = 1 - t; return [u * u * s[0] + 2 * u * t * s[2] + t * t * s[4], u * u * s[1] + 2 * u * t * s[3] + t * t * s[5]]; };
    const tg = (s, t) => { const u = 1 - t; return [2 * u * (s[2] - s[0]) + 2 * t * (s[4] - s[2]), 2 * u * (s[3] - s[1]) + 2 * t * (s[5] - s[3])]; };
    const g = mk('g', {}, svg);
    swags.forEach(s => mk('path', { d: `M${s[0]} ${s[1]}Q${s[2]} ${s[3]} ${s[4]} ${s[5]}`, fill: 'none', stroke: '#244632', 'stroke-width': 5.5, 'stroke-linecap': 'round' }, g));
    /* aiguilles de sapin : trois brins par point, de part et d'autre de la corde */
    const greens = ['#2F5D44', '#3E7A57', '#5E9A6C', '#4F7C74', '#274B38', '#4C8A60'];
    swags.forEach(s => { for (let i = 0; i <= 70; i++) {
      const t = i / 70, p = pt(s, t), d = tg(s, t), L = Math.hypot(d[0], d[1]) || 1, ux = d[0] / L, uy = d[1] / L, nx = -uy, ny = ux;
      for (let k = 0; k < 3; k++) {
        const side = k % 2 ? 1 : -1, a = (rnd() - .5) * .95, len = 10 + rnd() * 9, c = Math.cos(a), sn = Math.sin(a);
        mk('line', { x1: f1(p[0]), y1: f1(p[1]), x2: f1(p[0] + (nx * side * c + ux * sn) * len), y2: f1(p[1] + (ny * side * c + uy * sn) * len), stroke: greens[(rnd() * greens.length) | 0], 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
      }
    } });
    /* baies de houx près du nœud */
    [[246, 13], [252, 7], [270, 8], [276, 14], [262, 5]].forEach(b => { mk('circle', { cx: b[0], cy: b[1], r: 3.4, fill: '#B3382C', stroke: 'rgba(60,15,10,.45)', 'stroke-width': .6 }, g); mk('circle', { cx: b[0] - 1, cy: b[1] - 1.1, r: 1, fill: '#fff', opacity: .55 }, g); });
    /* boules */
    const cols = ['#B3382C', '#C9AB6E', '#F1E6D3', '#2F5D44', '#B3382C', '#C9AB6E', '#F1E6D3', '#B3382C'];
    const rad = [9.5, 8, 8.6, 7.6, 8.4, 9.6, 8.2, 8.8], drops = [13, 22, 10, 19, 15, 9, 21, 12];
    let bi = 0;
    swags.forEach((s, si) => [.2, .4, .66, .86].forEach(t => { const p = pt(s, t); bauble(g, f1(p[0]), f1(p[1]), drops[bi], rad[bi], cols[bi], f1(-bi * .45)); bi++; }));
    flake(g, 130, 90, 15, -1.1);   /* flocon au creux du premier feston */
    flake(g, 392, 90, 13, -2.3);   /* flocon au creux du second */
    /* petites lumières chaudes qui scintillent */
    swags.forEach((s, si) => { for (let i = 1; i <= 8; i++) { const p = pt(s, i / 9 + (si ? .02 : 0)); const l = mk('circle', { cx: f1(p[0]), cy: f1(p[1] + 1), r: 2.3, fill: '#FFE7A0', class: 'lt', style: `animation-delay:${f1(-((i * 7 + si * 3) % 10) * .24)}s` }, g); l.setAttribute('stroke', 'rgba(255,205,90,.55)'); l.setAttribute('stroke-width', 2.2); } });
    /* nœud rouge au centre */
    const bow = mk('g', {}, g);
    mk('path', { d: 'M259 24C252 36 246 46 237 57L248 54L254 63C258 48 261 36 262 25Z', fill: '#96281F' }, bow);
    mk('path', { d: 'M261 24C268 36 274 46 283 57L272 54L266 63C262 48 259 36 258 25Z', fill: '#96281F' }, bow);
    mk('path', { d: 'M260 19C236 -3 220 9 231 23C240 33 254 26 260 19Z', fill: '#B3382C', stroke: '#8F2018', 'stroke-width': .8 }, bow);
    mk('path', { d: 'M260 19C284 -3 300 9 289 23C280 33 266 26 260 19Z', fill: '#B3382C', stroke: '#8F2018', 'stroke-width': .8 }, bow);
    mk('path', { d: 'M259 18C246 8 238 12 238 18', fill: 'none', stroke: '#fff', 'stroke-width': 1.3, opacity: .3, 'stroke-linecap': 'round' }, bow);
    mk('circle', { cx: 260, cy: 20, r: 6.2, fill: '#A32F27', stroke: '#8F2018', 'stroke-width': .8 }, bow);
    mk('circle', { cx: 258, cy: 18, r: 1.7, fill: '#fff', opacity: .45 }, bow);
  }

  function buildSnow(box) {   /* neige : 30 flocons, tailles et vitesses variées, dérive vers la droite */
    for (let i = 0; i < 30; i++) {
      const s = 3 + rnd() * 7, f = document.createElement('i');
      f.style.cssText = `--x:${f1(rnd() * 100)}%;--s:${f1(s)}px;--o:${f1(.45 + rnd() * .5)};--b:${s > 7 ? 1.4 : s > 5 ? .6 : 0}px;--d:${f1(7 + rnd() * 9)}s;--delay:${f1(-rnd() * 16)}s;--dx:${f1(-8 + rnd() * 28)}vw`;
      box.appendChild(f);
    }
  }

  buildGarland(document.getElementById('noelGarland'));
  buildSnow(document.getElementById('noelSnow'));

  /* ---------- 3. Ouverture, fermeture, clavier ---------- */
  let opened = false, prev = null;
  const focusables = () => [...el.querySelectorAll('a[href], button:not([disabled])')].filter(n => n.offsetParent !== null);

  function open() {
    if (opened) return; opened = true;
    prev = document.activeElement;
    el.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    if (window.__lenis) window.__lenis.stop();
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('is-open'); const b = el.querySelector('.noel__close'); if (b) b.focus({ preventScroll: true }); }));
  }
  function close() {
    if (!opened) return; opened = false;
    el.classList.remove('is-open');
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* tant pis */ }
    document.documentElement.style.overflow = '';
    if (window.__lenis) window.__lenis.start();
    setTimeout(() => { if (!opened) el.hidden = true; }, 650);
    if (prev && prev.focus && prev !== document.body) prev.focus({ preventScroll: true });
  }

  el.addEventListener('click', e => { if (e.target.closest('[data-noel-close]')) close(); });
  document.addEventListener('keydown', e => {
    if (!opened) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- 4. Déclenchement : 3 s après la fin du chargement, jamais par-dessus la fiche produit, le panier ou le menu ---------- */
  const busy = () => ['modal', 'drawer'].some(id => { const n = document.getElementById(id); return n && !n.hidden; }) || document.querySelector('.menu.is-open');
  const tryOpen = () => { if (busy()) { setTimeout(tryOpen, 1500); return; } open(); };
  const arm = () => { if (document.body.classList.contains('is-loading')) { setTimeout(arm, 250); return; } setTimeout(tryOpen, FORCE ? 400 : 3000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm); else arm();
})();
