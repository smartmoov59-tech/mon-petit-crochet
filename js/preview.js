/* ==========================================================================
   APERÇU COULEUR : illustrations SVG recolorables (sac, paniers, cordon, pochette)
   Chaque pièce est dessinée en vectoriel avec un motif de mailles ; seules les couleurs changent.
   ========================================================================== */
(function () {
  let uid = 0;
  const clamp = v => Math.max(0, Math.min(255, v));
  const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const lighten = (h, t) => mix(h, '#ffffff', t);
  const darken = (h, t) => mix(h, '#000000', t);

  /* Renvoie { defs, ref } pour une couleur : uni, ou dégradé métallisé pour l'argenté / le doré */
  function paint(prefix, key, colorId) {
    const c = window.MPC_COLOR[colorId] || window.MPC_COLOR.beige;
    if (!c.metal) return { defs: '', ref: c.hex, hex: c.hex };
    const id = `${prefix}-${key}`;
    return {
      hex: c.hex,
      ref: `url(#${id})`,
      defs: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${lighten(c.hex, .55)}"/><stop offset=".3" stop-color="${c.hex}"/>
        <stop offset=".55" stop-color="${lighten(c.hex, .65)}"/><stop offset=".8" stop-color="${darken(c.hex, .18)}"/>
        <stop offset="1" stop-color="${lighten(c.hex, .3)}"/></linearGradient>`
    };
  }

  /* Définitions communes : motif de mailles, ombrage, ombre portée */
  function commonDefs(p) {
    return `
    <pattern id="${p}-st" width="11" height="9" patternUnits="userSpaceOnUse">
      <path d="M1.2 1.6 L5.5 7.6 L9.8 1.6" fill="none" stroke="#000" stroke-opacity=".17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M1.2 .5 L5.5 6.5 L9.8 .5" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M0 8.7 H11" stroke="#000" stroke-opacity=".06" stroke-width="1"/>
    </pattern>
    <linearGradient id="${p}-sh" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".2" stop-color="#000" stop-opacity=".02"/>
      <stop offset=".55" stop-color="#fff" stop-opacity=".10"/><stop offset=".85" stop-color="#000" stop-opacity=".06"/>
      <stop offset="1" stop-color="#000" stop-opacity=".34"/>
    </linearGradient>
    <linearGradient id="${p}-sv" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/>
    </linearGradient>
    <filter id="${p}-bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>`;
  }

  /* Remplit une forme (path d) avec couleur(s) + mailles + ombrage */
  function yarnShape(p, d, fill, extra = '') {
    return `<path d="${d}" fill="${fill}" fill-rule="evenodd" ${extra}/>
      <path d="${d}" fill="url(#${p}-st)" fill-rule="evenodd"/>
      <path d="${d}" fill="url(#${p}-sh)" fill-rule="evenodd"/>
      <path d="${d}" fill="url(#${p}-sv)" fill-rule="evenodd"/>`;
  }

  /* Remplissage « mélange » : deux couleurs en mailles alternées */
  function mixPattern(p, aRef, bRef) {
    return `<pattern id="${p}-mx" width="32" height="26" patternUnits="userSpaceOnUse">
      <rect width="32" height="26" fill="${aRef}"/>
      <path d="M1 2 L9 12 L17 2" fill="none" stroke="${bRef}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M17 15 L25 25 L33 15" fill="none" stroke="${bRef}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-15 15 L-7 25 L1 15" fill="none" stroke="${bRef}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </pattern>`;
  }

  const wrap = (p, inner, vb = '0 0 400 380') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-hidden="true" focusable="false"><defs>${commonDefs(p)}</defs>${inner}</svg>`;

  /* ---------- SAC À ANSE ---------- */
  const BAG = 'M 70 206 Q 70 188 88 188 L 146 188 Q 146 112 200 112 Q 254 112 254 188 L 312 188 Q 330 188 330 206 L 338 322 Q 340 350 312 350 L 88 350 Q 60 350 62 322 Z M 174 188 Q 174 140 200 140 Q 226 140 226 188 Z';
  function bag(o) {
    const p = 'b' + (++uid);
    const A = paint(p, 'a', o.c1), B = paint(p, 'b', o.c2 || o.c1);
    let defs = A.defs + B.defs, fill = A.ref, extra = '';
    if (o.model === 'm2') { defs += mixPattern(p, A.ref, B.ref); fill = `url(#${p}-mx)`; }
    let body = '';
    if (o.model === 'm3') {
      defs += `<clipPath id="${p}-lo"><rect x="0" y="292" width="400" height="120"/></clipPath>`;
      body = yarnShape(p, BAG, A.ref) + `<g clip-path="url(#${p}-lo)">${yarnShape(p, BAG, B.ref)}</g>`;
    } else if (o.model === 'm4') {
      defs += `<clipPath id="${p}-hd"><rect x="0" y="0" width="400" height="186"/></clipPath>`;
      body = yarnShape(p, BAG, A.ref) + `<g clip-path="url(#${p}-hd)">${yarnShape(p, BAG, B.ref)}</g>`;
    } else body = yarnShape(p, BAG, fill, extra);
    return wrap(p, `${defs ? '<defs>' + defs + '</defs>' : ''}
      <ellipse cx="200" cy="356" rx="138" ry="14" fill="#5a4034" opacity=".22" filter="url(#${p}-bl)"/>${body}`);
  }

  /* ---------- PANIERS (rond / ovale) ---------- */
  function basket(o, oval) {
    const p = (oval ? 'o' : 'r') + (++uid);
    const rx = oval ? 168 : 138, ry = oval ? 50 : 44, cx = 200, top = oval ? 150 : 140, bot = oval ? 286 : 296;
    const body = `M ${cx - rx} ${top} L ${cx - rx} ${bot} A ${rx} ${ry} 0 0 0 ${cx + rx} ${bot} L ${cx + rx} ${top} Z`;
    const A = paint(p, 'a', o.c1), B = paint(p, 'b', o.c2 || o.c1);
    let defs = A.defs + B.defs, fill = A.ref;
    let main;
    if (o.model === 'm3') {
      defs += mixPattern(p, A.ref, B.ref); fill = `url(#${p}-mx)`; main = yarnShape(p, body, fill);
    } else if (o.model === 'm4') {
      const split = bot - (bot - top) * 0.42;
      defs += `<clipPath id="${p}-lo"><rect x="0" y="${split}" width="400" height="200"/></clipPath>`;
      main = yarnShape(p, body, A.ref) + `<g clip-path="url(#${p}-lo)">${yarnShape(p, body, B.ref)}</g>`;
    } else main = yarnShape(p, body, fill);
    const rimColor = (o.finish === 'dore' || o.model === 'm2' && o.finish === 'dore') ? paint(p, 'rd', 'dore') : (o.finish === 'argente' ? paint(p, 'rs', 'argente') : null);
    if (rimColor) defs += rimColor.defs;
    const innerFill = o.model === 'm4' ? A.ref : fill;
    return wrap(p, `<defs>${defs}
      <linearGradient id="${p}-wd" x1="0" x2="1"><stop offset="0" stop-color="#b98f66"/><stop offset=".5" stop-color="#e2c29b"/><stop offset="1" stop-color="#a77d56"/></linearGradient></defs>
      <ellipse cx="${cx}" cy="${bot + 26}" rx="${rx + 16}" ry="${ry - 6}" fill="#5a4034" opacity=".22" filter="url(#${p}-bl)"/>
      <path d="M ${cx - rx - 4} ${bot - 2} A ${rx + 4} ${ry + 2} 0 0 0 ${cx + rx + 4} ${bot - 2} L ${cx + rx + 4} ${bot + 12} A ${rx + 4} ${ry + 2} 0 0 1 ${cx - rx - 4} ${bot + 12} Z" fill="url(#${p}-wd)"/>
      ${main}
      <ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="${innerFill}"/>
      <ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="url(#${p}-st)"/>
      <ellipse cx="${cx}" cy="${top + 7}" rx="${rx - 16}" ry="${ry - 11}" fill="#000" opacity=".30"/>
      <ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="none" stroke="${rimColor ? rimColor.ref : '#fff'}" stroke-opacity="${rimColor ? 1 : .35}" stroke-width="${rimColor ? 7 : 3}"/>
      <ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="url(#${p}-sh)" opacity=".7"/>`, '0 0 400 380');
  }

  /* ---------- CORDON DE TÉLÉPHONE ---------- */
  function strap(o) {
    const p = 's' + (++uid);
    const A = paint(p, 'a', o.c1), B = paint(p, 'b', o.c2 || o.c1);
    const path = 'M 58 40 C 150 120 110 214 214 276 C 262 305 292 322 300 334';
    const two = o.model === 'm2' && o.c2;
    const metalPad = paint(p, 'm', 'argente');
    return wrap(p, `<defs>${A.defs}${B.defs}${metalPad.defs}</defs>
      <path d="${path}" fill="none" stroke="#5a4034" stroke-opacity=".18" stroke-width="34" stroke-linecap="round" filter="url(#${p}-bl)" transform="translate(6 16)"/>
      <path d="${path}" fill="none" stroke="${A.ref}" stroke-width="30" stroke-linecap="round"/>
      ${two ? `<path d="${path}" fill="none" stroke="${B.ref}" stroke-width="30" stroke-linecap="butt" stroke-dasharray="17 17"/>` : ''}
      <path d="${path}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="30" stroke-dasharray="3 10" stroke-linecap="butt"/>
      <path d="${path}" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="10" stroke-dasharray="9 11" stroke-linecap="round" transform="translate(-4 -3)"/>
      <path d="${path}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="30" stroke-linecap="round" stroke-dasharray="0.1 400" />
      <circle cx="300" cy="338" r="13" fill="none" stroke="${metalPad.ref}" stroke-width="5"/>
      <rect x="262" y="338" width="86" height="26" rx="13" fill="#2d2824" opacity=".85" transform="translate(0 4)"/>
      <rect x="258" y="332" width="92" height="28" rx="14" fill="#efe9df" stroke="#cfc4b4"/>
      <circle cx="58" cy="40" r="14" fill="none" stroke="${metalPad.ref}" stroke-width="5"/>`);
  }

  /* ---------- POCHETTE ORDI / iPAD ---------- */
  function sleeve(o) {
    const p = 'p' + (++uid);
    const A = paint(p, 'a', o.c1), B = paint(p, 'b', o.c2 || o.c1);
    let defs = A.defs + B.defs, fill = A.ref;
    if (o.c2) { defs += mixPattern(p, A.ref, B.ref); fill = `url(#${p}-mx)`; }
    const d = 'M 96 150 Q 96 136 110 136 L 290 136 Q 304 136 304 150 L 304 338 Q 304 352 290 352 L 110 352 Q 96 352 96 338 Z';
    return wrap(p, `<defs>${defs}<linearGradient id="${p}-lp" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ececee"/><stop offset="1" stop-color="#cfd0d4"/></linearGradient></defs>
      <ellipse cx="200" cy="360" rx="120" ry="12" fill="#5a4034" opacity=".22" filter="url(#${p}-bl)"/>
      <rect x="106" y="52" width="188" height="128" rx="10" fill="url(#${p}-lp)" stroke="#bdbec4"/>
      <rect x="116" y="62" width="168" height="108" rx="5" fill="#fff" opacity=".35"/>
      ${yarnShape(p, d, fill)}
      <path d="M 96 176 Q 200 196 304 176" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="3"/>`);
  }

  window.mpcPreview = function (type, o) {
    o = Object.assign({ c1: 'beige', c2: null, model: 'm1', finish: 'aucune' }, o || {});
    if (type === 'bag') return bag(o);
    if (type === 'basketRound') return basket(o, false);
    if (type === 'basketOval') return basket(o, true);
    if (type === 'strap') return strap(o);
    if (type === 'sleeve') return sleeve(o);
    return '';
  };
})();
