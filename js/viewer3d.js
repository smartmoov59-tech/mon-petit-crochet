/* ==========================================================================
   VISUALISEUR 3D : pièces au crochet en volume (three.js, copie locale)
   La couleur « remplit » la pièce du bas vers le haut ; on la fait tourner à la souris ou au doigt.
   Types : bag, tote, basketRound, basketOval, strap, sleeve

   Principe : volumes lisses et fermés, mesurés d'après les vraies photos d'Oriana (sac à anse fendue,
   cabas, paniers ronds et ovales, chaîne de téléphone, pochette), habillés d'une maille de fil ruban
   dessinée par le code (SAC : corps crocheté en rond, une feuille de ruban en 3D par maille, instanciée ; un style par pièce : gros fil double pour le sac
   bicolore, V pleins du cabas (une couleur par jambe) et du panier rond, cordons ronds des paniers fins, épi
   (herringbone) du cordon de téléphone, bandes arquées de la pochette), relief réel (sommets déplacés),
   normales, creux chauds, rangs légèrement ondulés, bord en corde, éclairage de studio.
   Détails décoratifs aux tailles de ses photos : breloques, marguerites brodées, perles, ruban doré / argenté.
   Aucune photo utilisée comme texture.
   ========================================================================== */
(function () {
  'use strict';
  const T = window.THREE;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CREAM = '#EADFCB';
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* Souplesse : le fil n'est pas rigide (sac ferme : amplitudes faibles, seul le haut cède). */
  const SOFT_DECL = 'uniform float uTime; uniform float uSway; uniform float uSoft; uniform mat4 uInv;';
  const SOFT_BODY = `
    float hN = clamp(transformed.y / 3.2, 0.0, 1.0);
    float sd = clamp(transformed.z * 3.0, -1.0, 1.0);
    float breath = sin(uTime * 1.25 + transformed.x * 1.3) * 0.03 + sin(uTime * 0.8 + transformed.y * 2.1) * 0.02;
    transformed.z += sd * hN * hN * sin(uTime * 1.7 + transformed.x * 1.5) * 0.04 * uSoft;
    transformed.y -= hN * hN * (0.5 + 0.5 * sin(uTime * 1.1)) * 0.03 * uSoft;
    float belly = max(1.0 - pow(abs(transformed.x) / 2.1, 2.0), 0.0) * max(1.0 - pow((transformed.y - 1.3) / 1.7, 2.0), 0.0);
    transformed.z += sd * (breath * (0.35 + hN) + 0.05 * belly) * uSoft;
    transformed.x += uSway * hN * hN * 0.4 * uSoft;
    transformed.y -= abs(uSway) * hN * 0.04 * uSoft;
  `;
  /* Bruit, déformation « main » et coordonnées de maille (partagés sommets / pixels).
     Les colonnes penchent de la même façon vues de l'extérieur sur toutes les faces : miroir selon la normale. */
  const NOISE = `
    float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
    float vn3(vec3 p) {
      vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      float a = mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y);
      float b = mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y);
      return mix(a, b, f.z);
    }
    vec3 warpP(vec3 p) { return p + (vec3(vn3(p * 0.9), vn3(p * 0.9 + 5.3), vn3(p * 0.9 + 9.1)) - 0.5) * 0.06 * uWarp; }
    vec2 warpUV(vec2 uv, vec3 p) { return uv + (vec2(vn3(p * 0.9), vn3(p * 0.9 + 7.7)) - 0.5) * 0.04; }
    vec2 cZ(vec3 pw, float sz) { vec2 c = vec2(sz * pw.x, pw.y) * uDens; c.y *= uRowK; c.x += uShear * c.y; return c * 0.25; }
    vec2 cX(vec3 pw, float sx) { vec2 c = vec2(-sx * pw.z, pw.y) * uDens; c.y *= uRowK; c.x += uShear * c.y; return c * 0.25; }
    vec2 cY(vec3 pw) { return pw.xz * uDens * 0.25; }
  `;

  let glOk = null;
  function supported() {
    if (!T) return false;
    if (glOk !== null) return glOk;
    try { const c = document.createElement('canvas'); glOk = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { glOk = false; }
    return glOk;
  }

  /* ---------- Cartes de maille : relief (R), creux (G), masque de mélange par maille (B) + carte de normales ----------
     Tuile de 512 px = 4 × 4 mailles. Un style par pièce, d'après ses photos :
     rows    : cordons horizontaux de grains ronds inclinés (paniers fins, ovales)
     vee     : V à deux jambes plates qui se chevauchent (panier rond épais, cabas)
     cushion : coussins carrés-arrondis à deux lobes et pli en V, colonnes alignées (sac)
     sleeve  : deux bandes parallèles par grain, sens « \ » (pochette)
     plait   : tresse en V (chaîne, bords) */
  const hash = (a, b, c) => { const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return h - Math.floor(h); };
  const BEAN_PHI = 1.1, BEAN_A = .70, BEAN_B = .53, BEAN_T = .5;   /* forme des grains du sac : haricot conique incliné */
  const OFFS = { rows: [0, .875, .75, .875], vee: [0, .75, .5, .25], vcrochet: [0, .04, 0, -.04], ribbon: [0, .75, .5, .25], ovalvee: [0, .96, .92, .96], jersey: [0, 0, 0, 0], tbraid: [0, 0, 0, 0], braid: [0, 0, 0, 0], cushion: [0, 0, 0, 0], sleeve: [0, .14, .04, .18] };
  function cellPrims(kind, cm, rm) {
    const j = k => hash(cm, rm, k) - .5, sz = .94 + .12 * hash(cm, rm, 4), mk = o => Object.assign({ ex: 2, fl: .3, pw: .5, cr: [], lobes: [], rib: [.06, 52], ph: hash(cm, rm, 5) * 6.28, grad: true, sc: 1, band: false }, o);
    let list = [], holes = [];
    if (kind === 'rows') {
      /* cordons de petits grains ronds et pleins qui se touchent (paniers fins) */
      list = [mk({ cx: .5 + j(1) * .09, cy: .5 + j(2) * .09, phi: j(3) * .2, A: .52 * sz, B: .56 * sz, ex: 2.4, fl: .12, pw: .7, rib: [.03, 52] })];
    } else if (kind === 'vee') {
      list = [mk({ cx: .5 + j(1) * .08, cy: .5 + j(2) * .08, phi: -.75 + j(3) * .22, A: .55 * sz, B: .3 * sz, cr: [[0, .2, .004], [.14, .07, .003]] }),
        mk({ cx: .2 + j(6) * .06, cy: .62 + j(7) * .06, phi: .96 + j(8) * .2, A: .4 * sz, B: .19 * sz, sc: .75, cr: [[0, .12, .003]] })];
      holes = [{ x: 1.0, y: .9, rx: .06, ry: .11 }];
    } else if (kind === 'ribbon') {
      /* panier rond jaune (photos) : lobes de ruban larges, arêtes presque horizontales (jambes à ± 25-30°), petit jour à presque chaque maille */
      list = [mk({ cx: .5 + j(1) * .08, cy: .5 + j(2) * .08, phi: -.3 + j(3) * .2, A: .68 * sz, B: .42 * sz, ex: 2.2, cr: [[0, .14, .004], [.14, .06, .003]] }),
        mk({ cx: .2 + j(6) * .06, cy: .64 + j(7) * .06, phi: .5 + j(8) * .2, A: .52 * sz, B: .26 * sz, sc: .75, cr: [[0, .12, .003]] })];
      holes = hash(cm, rm, 12) > .3 ? [{ x: 1.0, y: .9, rx: .11, ry: .14 }] : [];
    } else if (kind === 'ovalvee') {
      /* paniers vert et crème (photos) : V aplati de ruban plat, jambe longue « / » à ≈ 24°, jambe courte plus raide, colonnes presque verticales, un petit jour clair par maille */
      list = [mk({ cx: .5 + j(1) * .06, cy: .5 + j(2) * .06, phi: .42 + j(3) * .15, A: .62 * sz, B: .31 * sz, ex: 2.2, fl: .36, cr: [[0, .12, .003]] }),
        mk({ cx: .2 + j(6) * .05, cy: .62 + j(7) * .05, phi: -.75 + j(8) * .15, A: .45 * sz, B: .23 * sz, sc: .8, cr: [[0, .1, .003]] })];
      holes = [{ x: 1.0, y: .9, rx: .125, ry: .115 }];
    } else if (kind === 'vcrochet') {
      /* cabas : V de ruban bien plein, jambe gauche longue « \ » et jambe droite plus courte « / » */
      list = [mk({ cx: .32 + j(1) * .04, cy: .50 + j(2) * .04, phi: -.85 + j(3) * .15, A: .68 * sz, B: .32 * sz, ex: 2.4, cr: [[0, .2, .004], [.17, .07, .003]] }),
        mk({ cx: .70 + j(6) * .04, cy: .52 + j(7) * .04, phi: .85 + j(8) * .15, A: .56 * sz, B: .30 * sz, sc: .9, ex: 2.4, cr: [[0, .12, .003]] })];
      holes = [{ x: 1.0, y: .92, rx: .05, ry: .06 }];
    } else if (kind === 'braid') {
      /* cordon de téléphone : épi (herringbone), feuilles charnues inclinées vers la couture centrale, qui se recouvrent en tuiles */
      const TH = .49, PL = Math.PI / 2 - TH, PR = Math.PI / 2 + TH;
      [0, .5].forEach((r, ri) => {
        const lf = { A: .38 * sz, B: .175 * sz, taper: .45, ex: 2.2, fl: .35, pw: .85, rib: [.05, 60] };
        list.push(mk(Object.assign({ cx: .30 + j(1) * .05, cy: r + .20, phi: PL + j(3) * .2, fid: 0 }, lf)));
        list.push(mk(Object.assign({ cx: .74 + j(2) * .05, cy: r + .35, phi: PR + j(4) * .2, fid: 1 }, lf)));
        list.push(mk({ cx: .54, cy: r + .51, phi: 0, A: .12, B: .08, fl: .5, fid: ri ? 0 : 1 }));
        holes.push({ x: .52, y: r + .35, rx: .025, ry: .09 });
      });
    } else if (kind === 'jersey') {
      /* sac rouge / rose (photos) : V de jersey, grosse feuille charnue « \ » à ≈ 35° + petite feuille « / », un trou noir à la pointe basse de chaque maille ; la rayure de couleur est parallèle au ruban */
      const szc = .94 + .12 * hash(cm, rm, 4);
      list = [mk({ cx: .42 + j(1) * .05, cy: .44 + j(2) * .05, phi: -.61 + j(3) * .12, A: .68 * szc, B: .42 * szc, taper: .35, ex: 2.2, fl: .14, pw: .75, rib: [.05, 60], grad: -1 }),
        mk({ cx: .10 + j(6) * .03, cy: .62 + j(7) * .03, phi: .96 + j(8) * .15, A: .40 * szc, B: .22 * szc, ex: 2.2, fl: .16, pw: .75, sc: .8, grad: false })];
      holes = [{ x: .93, y: .79, rx: .11, ry: .12 }];
    } else if (kind === 'cushion') {
      /* grain « épi » : haricot allongé, pointe en bas, entaille en V en haut (cf. gros plan de sa photo) */
      const szc = .90 + .20 * hash(cm, rm, 4), ph = BEAN_PHI + j(3) * .35, cp = Math.cos(ph), sp = Math.sin(ph), A = BEAN_A * szc;
      list = [mk({ cx: .5 + j(1) * .08, cy: .5 + j(2) * .08, phi: ph, A, B: BEAN_B * szc, taper: BEAN_T, ex: 2.3, fl: .16, pw: .5, rib: [.06, 70], grad: -1,
        vfold: { x0: -.85 * A * cp, y0: -.85 * A * sp, x1: -.02 * A * cp, y1: -.02 * A * sp, sig: .06, depth: .18 } })];
      if (hash(cm, rm, 11) > .45) holes = [{ x: 1.0, y: .5, rx: .05, ry: .12 }];
    } else if (kind === 'sleeve') {
      const phi = -Math.max(.17, Math.min(1.13, .66 + j(3) * .7)), sp = Math.sin(phi), cp = Math.cos(phi), swap = hash(cm, rm, 29) > .5 ? 1 : 0;
      [-.15, .15].forEach((o, i) => list.push(mk({ cx: .5 + o * sp + j(1) * .07, cy: .5 + o * cp + j(2) * .07, phi: phi + j(13) * .1, A: .72 * sz, B: .27, fl: 0, band: true, sc: (i ? 1 : .94), bid: i ^ swap, rib: [.022, 90] })));
      holes = [{ x: 0, y: 0, rx: .095, ry: .095 }];
    }
    return { list, holes, flip: hash(cm, rm, 8) > .5, jj: hash(cm, rm, 9) };
  }
  function primH(q, dx, dy) {
    const cp = Math.cos(q.phi), sp = Math.sin(q.phi), al = dx * cp - dy * sp, ac = dx * sp + dy * cp;
    let h;
    if (q.band) {
      /* brin légèrement arqué aux bouts effilés, glissés sous les voisins */
      const a = al / q.A, b = (ac - .11 * a * a) / q.B; if (Math.abs(a) >= 1 || Math.abs(b) >= 1) return 0;
      h = Math.pow(1 - a * a, .9) * Math.sqrt(1 - b * b);
    } else {
      const kb = q.taper ? Math.max(.15, 1 - q.taper * al / q.A) : 1;
      const e = Math.pow(Math.abs(al) / q.A, q.ex) + Math.pow(Math.abs(ac) / (q.B * kb), q.ex); if (e >= 1) return 0;
      h = q.fl + (1 - q.fl) * Math.pow(1 - e, q.pw);
      const r = Math.sqrt(1 - e);
      q.cr.forEach(c => { h -= c[1] * Math.exp(-((ac - c[0]) * (ac - c[0])) / c[2]) * r; });
      q.lobes.forEach(l => { const ddx = dx - l[0], ddy = dy - l[1]; h += l[3] * Math.exp(-(ddx * ddx + ddy * ddy) / (2 * l[2] * l[2])); });
      if (q.vfold) {
        const f = q.vfold, vx = f.x1 - f.x0, vy = f.y1 - f.y0, t = Math.min(1, Math.max(0, ((dx - f.x0) * vx + (dy - f.y0) * vy) / (vx * vx + vy * vy))), px = f.x0 + t * vx - dx, py = f.y0 + t * vy - dy;
        h -= f.depth * Math.exp(-(px * px + py * py) / (2 * f.sig * f.sig)) * r;
      }
    }
    h *= q.sc * (1 + q.rib[0] * Math.sin(ac * q.rib[1] + q.ph)) * (q.grad ? .92 + .22 * (q.grad > 0 ? al / q.A * .5 + .5 : .5 - al / q.A * .5) : 1);
    return Math.max(0, h);
  }
  /* « énergie » de la forme (< 1 = dedans) : sert à rattacher un creux à la jambe la plus proche de sa propre maille */
  function primE(q, dx, dy) {
    const cp = Math.cos(q.phi), sp = Math.sin(q.phi), al = dx * cp - dy * sp, ac = dx * sp + dy * cp, kb = q.taper ? Math.max(.15, 1 - q.taper * al / q.A) : 1;
    return Math.pow(Math.abs(al) / q.A, q.ex) + Math.pow(Math.abs(ac) / (q.B * kb), q.ex);
  }
  function genGrain(kind, S, C, H, ID, HOLE, OWN) {
    const off = OFFS[kind], P = [], legId = kind === 'vcrochet';
    for (let r = 0; r < 4; r++) { P[r] = []; for (let c = 0; c < 4; c++) P[r][c] = cellPrims(kind, c, r); }
    for (let y = 0; y < S; y++) {
      const r0 = Math.floor(y / C);
      for (let x = 0; x < S; x++) {
        let hMax = 0, id = 0, hole = 0, eBest = 1e9, idBest = 0, oL = 0, oDc = 0, oDr = 0;
        for (let dr = -1; dr <= 1; dr++) {
          const r = r0 + dr, rm = ((r % 4) + 4) % 4, ro = off[rm] * C, c0 = Math.floor((x - ro) / C);
          for (let dc = -1; dc <= 1; dc++) {
            const c = c0 + dc, cm = ((c % 4) + 4) % 4, pr = P[rm][cm], ox = ro + c * C, oy = r * C, ux = (x - ox) / C, uy = (y - oy) / C;
            for (let k = 0; k < pr.list.length; k++) {
              const q = pr.list[k], h = primH(q, ux - q.cx, uy - q.cy);
              if (legId && dr === 0 && dc === 0) { const e = primE(q, ux - q.cx, uy - q.cy); if (e < eBest) { eBest = e; idBest = k; } }
              if (h > hMax) {
                hMax = h; oL = k; oDc = dc; oDr = dr;
                if (q.band) id = pr.jj > .8 ? .5 : q.bid;
                else if (legId) id = k;                                   /* une jambe = une couleur (pas de dégradé) */
                else if (kind === 'jersey') { const ac = (ux - q.cx) * Math.sin(q.phi) + (uy - q.cy) * Math.cos(q.phi); let u = ac / q.B * .5 + .5; if (pr.flip) u = 1 - u; const w = u + (pr.jj - .5) * .9, s = Math.min(1, Math.max(0, (w - .50) / .24)); id = s * s * (3 - 2 * s); }   /* rayure parallèle à l'axe de la feuille */
                else if (q.fid !== undefined) id = (hash(cm, rm, 21 + k) < .1) ? 1 - q.fid : q.fid;   /* cordon : un bord de bande = une couleur, 10 % d'inversions */
                else { const al = (ux - q.cx) * Math.cos(q.phi) - (uy - q.cy) * Math.sin(q.phi); let u = al / q.A * .5 + .5; if (pr.flip) u = 1 - u; const w = u + (pr.jj - .5) * .55, s = Math.min(1, Math.max(0, (w - .3) / .4)); id = s * s * (3 - 2 * s); }
              }
            }
            for (let k = 0; k < pr.holes.length; k++) { const hl = pr.holes[k], dx = (ux - hl.x) / hl.rx, dy = (uy - hl.y) / hl.ry; if (dx * dx + dy * dy < 1) hole = 1; }
          }
        }
        if (legId && hMax === 0) { id = idBest; oL = idBest; oDc = 0; oDr = 0; }
        if (hole) hMax = 0;
        H[y * S + x] = hMax; ID[y * S + x] = id; HOLE[y * S + x] = hole;
        if (OWN) { const i3 = (y * S + x) * 3; OWN[i3] = oL; OWN[i3 + 1] = oDc + 1; OWN[i3 + 2] = oDr + 1; }   /* à quelle jambe de quelle maille appartient ce pixel */
      }
    }
  }
  function heightPlait(S, C, H, ID) {
    const TH = .3, A = .235, B = .5;
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / C), off = (row & 1) ? C / 2 : 0, v = (y % C) / C;
      for (let x = 0; x < S; x++) {
        const xx = (x - off + S) % S, col = Math.floor(xx / C), u = (xx % C) / C;
        let hMax = 0, id = 0;
        for (let leg = 0; leg < 2; leg++) {
          const dir = leg ? -1 : 1, th = TH + (hash(col, row, leg + 7) - .5) * .18, ca = Math.cos(th), sa = Math.sin(th);
          const dx = u - (leg ? .73 : .27) - (hash(col, row, leg + 5) - .5) * .05, dy = v - .5 - (hash(col, row, leg + 9) - .5) * .05;
          const along = dx * dir * sa + dy * ca, across = dx * ca - dy * dir * sa;
          const e = (across / A) * (across / A) + (along / B) * (along / B);
          if (e < 1) {
            let h = Math.pow(1 - e, .8);
            h *= C === S ? 1 + .10 * Math.sin(across * 135 + hash(col, row, leg) * 6.28) : 1 + .06 * Math.sin(across * 30 + hash(col, row, leg) * 6.28);   /* C === S : tuile « chaîne » = 1 V par maille, bien nervurée */
            h *= .86 + .14 * hash(col, row, leg + 3);
            if (h > hMax) { hMax = h; let u2 = along / B * .5 + .5; if (hash(col, row, leg + 11) > .5) u2 = 1 - u2; const w = u2 + (hash(col, row, leg + 13) - .5) * .5, s = Math.min(1, Math.max(0, (w - .3) / .4)); id = s * s * (3 - 2 * s); }
          }
        }
        H[y * S + x] = hMax; ID[y * S + x] = id;
      }
    }
  }
  /* sangle d'anse du cabas : brins en V plus longs qui se recouvrent, avec une arête de tresse au milieu (cf. sa photo) */
  function heightBraid(S, C, H, ID) {
    const TH = .38, A = .27, B = .72, N = S / C;
    for (let y = 0; y < S; y++) {
      const r0 = Math.floor(y / C);
      for (let x = 0; x < S; x++) {
        let hMax = 0, id = .5;
        for (let dr = -1; dr <= 1; dr++) {
          const r = r0 + dr, rm = ((r % N) + N) % N, off = (rm & 1) ? C / 2 : 0, c0 = Math.floor((x - off) / C), v = (y - r * C) / C;
          for (let dc = -1; dc <= 1; dc++) {
            const c = c0 + dc, cm = ((c % N) + N) % N, u = (x - off - c * C) / C;
            for (let leg = 0; leg < 2; leg++) {
              const dir = leg ? -1 : 1, th = TH + (hash(cm, rm, leg + 7) - .5) * .18, ca = Math.cos(th), sa = Math.sin(th);
              const dx = u - (leg ? .73 : .27) - (hash(cm, rm, leg + 5) - .5) * .05, dy = v - .5 - (hash(cm, rm, leg + 9) - .5) * .05;
              const along = dx * dir * sa + dy * ca, across = dx * ca - dy * dir * sa, e = (across / A) * (across / A) + (along / B) * (along / B);
              if (e < 1) {
                let h = Math.pow(1 - e, .8); h *= 1 + .06 * Math.sin(across * 30 + hash(cm, rm, leg) * 6.28); h *= .86 + .14 * hash(cm, rm, leg + 3);
                if (h > hMax) { hMax = h; id = hash(cm, rm, leg + 11) > .5 ? 1 : 0; }
              }
            }
          }
        }
        const rx = (x / S - .5) / .05;
        H[y * S + x] = hMax + .25 * Math.exp(-rx * rx); ID[y * S + x] = id;
      }
    }
  }
  const stitchCache = {};
  function stitchTextures(kind) {
    if (stitchCache[kind]) return stitchCache[kind];
    const S = 512, C = 128, H = new Float32Array(S * S), ID = new Float32Array(S * S), HOLE = new Uint8Array(S * S);
    const OWN = kind === 'vcrochet' ? new Uint8Array(S * S * 3) : null;
    if (kind === 'plait') heightPlait(S, C, H, ID); else if (kind === 'chain') heightPlait(S, S, H, ID); else if (kind === 'tbraid') heightBraid(S, C, H, ID); else genGrain(kind, S, C, H, ID, HOLE, OWN);
    const cT = document.createElement('canvas'), cN = document.createElement('canvas'); cT.width = cT.height = cN.width = cN.height = S;
    const iT = cT.getContext('2d').createImageData(S, S), iN = cN.getContext('2d').createImageData(S, S), K = ({ plait: 15, chain: 22, tbraid: 15, rows: 8, vee: 9, ribbon: 9, ovalvee: 9, vcrochet: 8, braid: 10, cushion: 9, sleeve: 13 })[kind] || 9;
    const ramp = kind === 'sleeve' ? .22 : .5;   /* pochette : le creux ne mange que le bord de chaque ruban */
    const at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, h = H[i], k = i * 4;
      const cav = HOLE[i] ? (kind === 'cushion' ? .10 : .04) : (kind === 'cushion' ? .25 : .12) + (kind === 'cushion' ? .75 : .88) * Math.min(1, Math.max(0, (h - .02) / ramp));
      iT.data[k] = h * 255; iT.data[k + 1] = cav * 255; iT.data[k + 2] = ID[i] * 255; iT.data[k + 3] = 255;
      const du = (at(x + 1, y) - at(x - 1, y)) * .5, dv = -(at(x, y + 1) - at(x, y - 1)) * .5;
      let nx = -du * K, ny = -dv * K, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      iN.data[k] = (nx * .5 + .5) * 255; iN.data[k + 1] = (ny * .5 + .5) * 255; iN.data[k + 2] = (nz * .5 + .5) * 255; iN.data[k + 3] = 255;
    }
    cT.getContext('2d').putImageData(iT, 0, 0); cN.getContext('2d').putImageData(iN, 0, 0);
    const mk = cv => { const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; return t; };
    stitchCache[kind] = { tex: mk(cT), nrm: mk(cN), ids: null };
    if (OWN) {
      /* carte « propriétaire » (échantillonnage au plus proche, sans filtrage) : jambe + décalage de maille, pour que chaque jambe du V garde UNE couleur */
      const D = new Uint8Array(S * S * 4);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i3 = (y * S + x) * 3, k = (((S - 1 - y) * S) + x) * 4;   /* DataTexture n'est pas retournée comme un canvas */
        D[k] = OWN[i3] ? 255 : 0; D[k + 1] = Math.round(OWN[i3 + 1] * 85); D[k + 2] = Math.round(OWN[i3 + 2] * 85); D[k + 3] = 255;
      }
      const it = new T.DataTexture(D, S, S, T.RGBAFormat); it.wrapS = it.wrapT = T.RepeatWrapping; it.magFilter = it.minFilter = T.NearestFilter; it.generateMipmaps = false; it.needsUpdate = true;
      stitchCache[kind].ids = it;
    }
    return stitchCache[kind];
  }

  /* ---------- Matériau « fil » : maille, relief réel, remplissage progressif, associations de deux couleurs ----------
     dens = mailles par unité (horizontal) ; rowK = rangs par maille ; shear = pente des colonnes ; crev = luminosité des creux ;
     uv = true : UV de la géométrie (1 unité d'UV = 1 tuile = 4 mailles) ; fixed = couleur imposée (chaîne métallique) ;
     lurex = couleur d'un fil métallique fin glissé dans la maille (pochette dorée / argentée). */
  function yarnMaterial(U, o) {
    const m = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: .86, metalness: 0, sheen: .4, sheenRoughness: .5, sheenColor: new T.Color('#f2f2f2'), side: T.DoubleSide, envMapIntensity: .55 });
    if (o.fixed) { m.metalness = .55; m.roughness = .36; m.sheen = 0; m.clearcoat = .35; m.clearcoatRoughness = .2; m.envMapIntensity = 1.5; }
    if (o.spec !== undefined) m.specularIntensity = o.spec;
    /* réglages de ton propres à une pièce (les autres gardent les valeurs par défaut) : rugosité, voile de sheen, teinte du sheen */
    m.userData.tone = { rough: o.rough, sheen: o.sheenK, tint: o.sheenTint, sheenCol: o.sheenCol, env: o.env };
    if (o.env !== undefined) m.envMapIntensity = o.env;
    const own = {
      uDens: { value: o.dens || 4 }, uUV: { value: o.uv ? 1 : 0 }, uBump: { value: o.bump || 1.4 }, uDisp: { value: o.disp === undefined ? .04 : o.disp },
      uShear: { value: o.shear || 0 }, uRowK: { value: o.rowK || 1 }, uCrev: { value: o.crev === undefined ? .45 : o.crev },
      uFixedOn: { value: o.fixed ? 1 : 0 }, uFixed: { value: new T.Color(o.fixed || '#ffffff') },
      uFixed2: { value: new T.Color(o.fixed2 || o.fixed || '#ffffff') }, uDeepK: { value: new T.Vector3().fromArray(o.deepK || [1, 1, 1]) },
      uLur: { value: o.lurex ? 1 : 0 }, uLurCol: { value: new T.Color(o.lurex || '#dba64a') },
      uOff: { value: new T.Vector4().fromArray(OFFS[o.tex] || [0, 0, 0, 0]) },
      uRnd: { value: (o.tex === 'sleeve' || o.tex === 'cushion' || o.tex === 'jersey') ? .25 : o.tex === 'plait' ? .5 : o.tex === 'braid' ? .12 : o.tex === 'tbraid' ? .15 : .9 },
      uVee: { value: o.tex === 'vcrochet' ? 1 : 0 },
      uWarm: { value: o.warm ? 1 : 0 }, uGam: { value: o.gam || 1.1 }, uDeep: { value: o.deep || 0 }, uOcc: { value: o.occ || 0 },
      uGain: { value: o.gain || 1 }, uCavLo: { value: o.cavLo === undefined ? .12 : o.cavLo }, uCavDeep: { value: o.cavDeep || 0 },
      uFoot: { value: o.foot ? 1 : 0 }, uWarp: { value: o.warp || 1 },
      uSaw: { value: o.saw || 0 }, uHole: { value: o.holeLit ? 1 : 0 }
    };
    m.onBeforeCompile = sh => {
      const tx = stitchTextures(o.tex || 'rows');
      Object.assign(sh.uniforms, U, own, { uTex: { value: tx.tex }, uNrm: { value: tx.nrm }, uIdT: { value: tx.ids || tx.tex } });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWP; varying vec3 vLP; varying vec3 vLN; varying vec2 vUV2;
          uniform sampler2D uTex; uniform float uDens; uniform float uUV; uniform float uDisp; uniform float uShear; uniform float uRowK; uniform float uWarp;
          ${SOFT_DECL}
          ${NOISE}
          float heightAt(vec3 p, vec3 n, vec2 uv) {
            float r = 0.0;
            if (uUV > 0.5) { r = texture2D(uTex, warpUV(uv, p)).r; }
            else {
              vec3 pw = warpP(p); vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z);
              float sx = n.x >= 0.0 ? 1.0 : -1.0, sz = n.z >= 0.0 ? 1.0 : -1.0;
              r = texture2D(uTex, cX(pw, sx)).r * b.x + texture2D(uTex, cY(pw)).r * b.y + texture2D(uTex, cZ(pw, sz)).r * b.z;
            }
            return r;
          }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vLP = position; vLN = normal; vUV2 = uv;
          { vec3 nn = normalize(normal); transformed += nn * (heightAt(position, nn, uv) - 0.42) * uDisp; }
          ${SOFT_BODY}
          vWP = (uInv * modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWP; varying vec3 vLP; varying vec3 vLN; varying vec2 vUV2;
          uniform sampler2D uTex; uniform sampler2D uNrm; uniform sampler2D uIdT; uniform float uDens; uniform float uUV; uniform float uBump; uniform mat4 uHold; uniform float uShear; uniform float uRowK; uniform float uCrev;
          uniform float uFixedOn; uniform vec3 uFixed; uniform vec3 uFixed2; uniform vec3 uDeepK; uniform float uLur; uniform vec3 uLurCol; uniform vec4 uOff; uniform float uRnd;
          uniform float uVee; uniform float uWarm; uniform float uGam; uniform float uDeep; uniform float uOcc; uniform float uGain; uniform float uCavLo; uniform float uCavDeep; uniform float uFoot; uniform float uWarp; uniform float uSaw; uniform float uHole;
          uniform vec3 uA; uniform vec3 uB; uniform vec3 uPA; uniform vec3 uPB;
          uniform float uMode; uniform float uPMode; uniform float uSplit; uniform float uPSplit;
          uniform float uFill; uniform vec2 uYR;
          ${NOISE}
          vec3 unp(vec3 c) { return c * 2.0 - 1.0; }
          /* hasard propre à chaque maille (aligné sur la grille de la tuile : 4 x 4 mailles, rangs décalés) : supprime la répétition de la tuile */
          float offOf(float iy) { float rm = 3.0 - mod(iy, 4.0); return rm < 0.5 ? uOff.x : rm < 1.5 ? uOff.y : rm < 2.5 ? uOff.z : uOff.w; }
          vec2 cellId(vec2 cc) { vec2 g = cc * 4.0; float iy = floor(g.y); return vec2(floor(g.x - offOf(iy)), iy); }
          float cellHash(vec2 cc, float salt) { return h31(vec3(cellId(cc), salt)); }
          void sampleYarn(out vec4 st, out vec3 objN, out float cRnd, out vec2 cell, out vec2 tcD) {
            vec3 n = normalize(vLN);
            if (uUV > 0.5) {
              vec2 uvw = warpUV(vUV2, vLP);
              cRnd = cellHash(uvw, 3.7); cell = cellId(uvw); tcD = uvw;
              st = texture2D(uTex, uvw);
              vec3 t = unp(texture2D(uNrm, uvw).xyz); t.xy *= uBump;
              vec3 q0 = dFdx(vLP), q1 = dFdy(vLP); vec2 s0 = dFdx(vUV2), s1 = dFdy(vUV2);
              vec3 q1p = cross(q1, n), q0p = cross(n, q0);
              vec3 T3 = q1p * s0.x + q0p * s1.x, B3 = q1p * s0.y + q0p * s1.y;
              float det = max(dot(T3, T3), dot(B3, B3)); float sc = det == 0.0 ? 0.0 : inversesqrt(det);
              objN = normalize(T3 * (t.x * sc) + B3 * (t.y * sc) + n * t.z);
            } else {
              vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
              vec3 pw = warpP(vLP);
              float sx = n.x >= 0.0 ? 1.0 : -1.0, sz = n.z >= 0.0 ? 1.0 : -1.0;
              vec2 uX = cX(pw, sx), uY = cY(pw), uZ = cZ(pw, sz);
              cRnd = (w.z >= w.x && w.z >= w.y) ? cellHash(uZ, sz) : (w.x >= w.y ? cellHash(uX, 2.0 + sx) : cellHash(uY, 5.0));
              tcD = (w.z >= w.x && w.z >= w.y) ? uZ : (w.x >= w.y ? uX : uY);
              cell = cellId(tcD);
              st = texture2D(uTex, uX) * w.x + texture2D(uTex, uY) * w.y + texture2D(uTex, uZ) * w.z;
              vec3 tx = unp(texture2D(uNrm, uX).xyz), ty = unp(texture2D(uNrm, uY).xyz), tz = unp(texture2D(uNrm, uZ).xyz);
              tx.xy *= uBump; ty.xy *= uBump; tz.xy *= uBump;
              tx.x *= -sx; tz.x *= sz;
              tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
              ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
              tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
              objN = normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
            }
          }
          vec3 yarnPick(vec3 a, vec3 b, float mode, float split, float sid, vec2 cell, float stb, float cav) {
            if (mode < 0.5) return a;
            if (mode < 1.5) {
              if (uVee > 0.5) {
                /* cabas : chaque jambe du V est d'une seule couleur ; plages de 1 à 4 mailles, avec quelques jambes isolées */
                float bn = vn3(vec3(cell.x / 2.2, cell.y / 1.6, 3.0)) - 0.5;
                float hL = h31(vec3(cell, 1.0)) + 0.55 * bn;
                float hR = h31(vec3(cell, 5.0)) < 0.30 ? hL : h31(vec3(cell + 17.3, 2.0)) + 0.55 * bn;
                float h = mix(hL, hR, smoothstep(0.35, 0.65, stb));
                return mix(a, b, 1.0 - smoothstep(0.41, 0.43, h)) * mix(0.45, 1.0, smoothstep(0.15, 0.5, cav));
              }
              float m = smoothstep(0.45, 0.55, sid + (vn3(vLP * uDens * 0.5) - 0.5) * 0.3 + (vn3(vLP * uDens * 0.23 + 7.0) - 0.5) * 0.25); return mix(a, b, m);
            }
            /* limite de couleur en dents de scie : une dent par maille (paniers vert / crème) */
            float sp = split;
            if (uSaw > 0.0 && uUV > 0.5) { float tri = abs(fract(vUV2.x * 4.0 - offOf(floor(vUV2.y * 4.0))) - 0.5) * 2.0; sp += (tri - 0.5) * uSaw; }
            if (uSaw > 0.0 && uUV > 0.5) sp += step(dot(vLN.xz, vLP.xz), 0.0) * 1.5 * uSaw;   /* face intérieure : la limite est plus haute (la crème n'y descend pas aussi bas) */
            if (mode < 2.5) return mix(b, a, smoothstep(sp - 0.02, sp + 0.02, vWP.y));
            return mix(a, b, smoothstep(sp - 0.02, sp + 0.02, vWP.y));
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec4 st; vec3 objN; float cRnd; vec2 cell; vec2 tcD; sampleYarn(st, objN, cRnd, cell, tcD);
          float legV = st.b;
          if (uVee > 0.5) {
            /* cabas : on retrouve la maille et la jambe du V qui possèdent ce pixel (carte « propriétaire », sans filtrage) */
            vec4 idt = texture2D(uIdT, tcD);
            legV = idt.r > 0.5 ? 1.0 : 0.0;
            float dcN = floor(idt.g * 3.0 + 0.5) - 1.0, drN = floor(idt.b * 3.0 + 0.5) - 1.0;
            float ownRow = cell.y - drN;
            cell = vec2(floor(tcD.x * 4.0 - offOf(ownRow)) + dcN, ownRow);
          }
          float sidA = st.b + (cRnd - 0.5) * uRnd;
          vec3 yNew = yarnPick(uA, uB, uMode, uSplit, sidA, cell, legV, st.g);
          vec3 yOld = yarnPick(uPA, uPB, uPMode, uPSplit, sidA, cell, legV, st.g);
          float ny = (vWP.y - uYR.x) / max(uYR.y - uYR.x, 0.001);
          float isOld = smoothstep(uFill - 0.08, uFill + 0.08, ny);
          vec3 yc = uFixedOn > 0.5 ? mix(uFixed, uFixed2, st.b) : pow(mix(yNew, yOld, isOld), vec3(uGam));
          float fab = vn3(vLP * 1.3) * 0.08 + vn3(vLP * 6.0) * 0.05;
          float g0 = uCavLo + (st.g - 0.12) * ((1.0 - uCavLo) / 0.88);   /* creux relevé (identité par défaut) */
          float gs = mix(st.g, g0, uCavDeep);
          float shade = (uCrev + (1.0 - uCrev) * g0) * (0.93 + 0.14 * vn3(vLP * uDens * 0.9)) * (0.98 + fab);
          if (!gl_FrontFacing) shade *= 0.85;
          float yl = dot(yc, vec3(0.2126, 0.7152, 0.0722));
          float wH = smoothstep(0.6, 0.85, min(yc.r, min(yc.g, yc.b)));                          /* fil quasi blanc : creux gris-bleu froid, crêtes moins écrêtées */
          float dkY = (1.0 - smoothstep(0.06, 0.2, yl)) * (uDeep > 0.0 ? 0.0 : 1.0) * (1.0 - uFixedOn);   /* fil foncé : plis plus marqués */
          vec3 deep = uFixedOn > 0.5 ? yc * uDeepK
            : uWarm > 0.5 ? yc * vec3(1.0, 0.82, 0.62) * (0.55 + 0.45 * yc)                      /* paniers : ombres chaudes d'ocre */
            : mix(yc * (yc * 1.15 + uDeep), yc * vec3(0.56, 0.60, 0.70), wH);
          diffuseColor.rgb *= mix(deep, yc, smoothstep(0.1, 0.75, gs)) * shade * (0.90 + 0.08 * st.r) * mix(1.0, 0.92, wH) * uGain;
          diffuseColor.rgb *= mix(1.0, mix(0.5, 1.0, smoothstep(0.1, 0.75, gs)), dkY);
          diffuseColor.rgb *= 1.0 - 0.15 * uFoot * (1.0 - smoothstep(3.21, 3.33, vLP.y));
          /* paniers : les petits jours entre mailles laissent passer la lumière (clairs, comme sur ses photos) */
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.94, 0.84), (1.0 - smoothstep(0.05, 0.10, st.g)) * 0.9 * uHole);
          float lurV = 0.0;
          if (uLur > 0.5) { lurV = smoothstep(0.035, 0.0, abs(st.r - 0.42)) * step(0.16, h31(floor(vLP * uDens * 0.6 + 0.5))); diffuseColor.rgb = mix(diffuseColor.rgb, uLurCol, lurV); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.62, dkY * smoothstep(0.45, 0.85, st.r));   /* reflet satiné doux sur le dessus des mailles foncées (sans carrés de reflet) */
          roughnessFactor = mix(roughnessFactor, 0.3, lurV);`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
          #ifdef USE_SHEEN
          material.sheenColor *= mix(1.0, shade, uOcc);
          #endif
          material.specularColor *= mix(1.0, shade, uOcc);   /* pas de reflet ni de voile dans les creux */`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, 1.0, lurV);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = normalize(mat3(viewMatrix) * mat3(uHold) * objN) * faceDirection;`);
    };
    return m;
  }

  /* ---------- Mailles instanciées (paniers) : chaque maille est un objet 3D ----------
     leafGeo : UNE boucle de ruban plat de jersey, en feuille / haricot arqué : axe x = le long du ruban, y = en travers, z = vers l'extérieur.
     Section bombée (rouleau), pli médian, bouts effilés qui rentrent dans la paroi, légère torsion et courbure en virgule.
     Attribut aAO : occlusion fabriquée (bouts, bords, pli) lue par le shader. */
  function leafGeo(o) {
    const nS = o.nS || 10, nV = o.nV || 6, pos = [], uvs = [], ao = [], idx = [];
    for (let i = 0; i <= nS; i++) {
      const s = i / nS, sp = Math.pow(s, o.skew || 1), ph = Math.sin(Math.PI * sp), w0 = o.w0 === undefined ? .1 : o.w0, w = o.W * (w0 + (1 - w0) * Math.pow(ph, o.tp || .55)) / 2;
      const cx = (s - .5) * o.L, cy = o.kap * o.L * ((s - .5) * (s - .5) - 1 / 12), cz = o.B * (Math.pow(ph, .7) - .22), tw = o.tau * (s - .5) * 2, ct = Math.cos(tw), st = Math.sin(tw);
      for (let j = 0; j <= nV; j++) {
        const v = -1 + 2 * j / nV, cr = (o.crease || 0) * w * Math.exp(-(v - (o.cv || .12)) * (v - (o.cv || .12)) / .05) * (.4 + .6 * ph);
        const y = cy + v * w * ct, z = cz + v * w * st + (o.arch === undefined ? .9 : o.arch) * (1 - v * v) * w * (.35 + .65 * ph) - cr;
        pos.push(cx, y, z); uvs.push((v + 1) / 2, s);
        ao.push(Math.min(.9, .66 * Math.pow(1 - ph, 1.2) + .62 * Math.pow(Math.abs(v), 2.2) * (.5 + .5 * ph) + .34 * (o.crease ? Math.exp(-(v - (o.cv || .12)) * (v - (o.cv || .12)) / .03) * ph : 0)));
      }
    }
    for (let i = 0; i < nS; i++) for (let j = 0; j < nV; j++) { const a = i * (nV + 1) + j, b = a + nV + 1, c = a + 1, d = b + 1; idx.push(a, b, c, b, d, c); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); g.setAttribute('aAO', new T.Float32BufferAttribute(ao, 1));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /* réglages d'aspect des mailles (valeurs finales ; tn(clé, défaut) renvoie le défaut) */
  const TUNE = {};
  const tn = (k, d) => TUNE[k] === undefined ? d : TUNE[k];
  /* quelques variantes de courbure / torsion : (virgule vers le haut ou vers le bas) x (torsion horaire ou non), pour qu'aucune maille ne répète sa voisine */
  const LEAF_VAR = [[.30, .55, .72], [.30, -.5, 1.4], [-.30, .5, .75], [-.28, -.55, 1.35], [.05, .3, .8], [.42, -.15, 1.3], [-.4, .2, .7]];
  const leafSet = o => LEAF_VAR.map((v, i) => leafGeo(Object.assign({}, o, { kap: v[0] * (o.kapK || 1), tau: v[1] * (o.tauK || 1), skew: v[2], cv: (i % 2 ? -.12 : .14) })));

  /* Matériau des mailles instanciées : même logique de couleur que yarnMaterial (remplissage du bas vers le haut, solid / mix / duo / contrast,
     dents de scie par maille), mais la couleur se décide PAR MAILLE (centre de l'instance) ; côtes de jersey par normale procédurale,
     occlusion fabriquée (attribut aAO + bas de chaque rang), creux chauds. back : fond sombre derrière les mailles. */
  function stitchMaterial(U, o) {
    const m = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: o.rough || .82, metalness: 0, sheen: .35, sheenRoughness: .5, sheenColor: new T.Color('#f2f2f2'), side: T.DoubleSide, envMapIntensity: .5 });
    m.userData.tone = { rough: o.rough || .82, env: .5, sheen: o.back ? 0 : .35 }; if (o.back) m.sheen = 0;
    const own = {
      uBackK: { value: o.back || 0 }, uSplitAdd: { value: o.splitAdd || 0 }, uSaw: { value: o.saw || 0 }, uDeepK: { value: new T.Vector3().fromArray(o.deepK || [1, .82, .62]) },
      uTint: { value: new T.Vector3().fromArray(o.tint || [1, 1, 1]) }, uRib: { value: o.rib === undefined ? 1 : o.rib }, uGam: { value: 1.1 }, uRowP: { value: o.rowP || .15 },
      uGainS: { value: o.gain || 1 }, uAOK: { value: o.aoK === undefined ? 1.3 : o.aoK },
      uStripe: { value: o.stripe ? 1 : 0 }, uStripeT: { value: o.stripeT === undefined ? .6 : o.stripeT }, uRowDk: { value: o.rowDk === undefined ? .6 : o.rowDk }
    };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U, own);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aR; attribute float aAO; uniform mat4 uInv;
          varying vec3 vWP; varying vec3 vCen; varying vec4 vR; varying float vAO; varying vec2 vSt; varying float vInst;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vSt = uv; vR = aR; vAO = aAO; vInst = 0.0;
          mat4 imx = modelMatrix;
          #ifdef USE_INSTANCING
            imx = modelMatrix * instanceMatrix; vInst = 1.0;
          #endif
          vWP = (uInv * imx * vec4(transformed, 1.0)).xyz;
          #ifdef USE_INSTANCING
            vCen = (uInv * imx * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
            vCen = vWP;
          #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWP; varying vec3 vCen; varying vec4 vR; varying float vAO; varying vec2 vSt; varying float vInst;
          uniform vec3 uA; uniform vec3 uB; uniform vec3 uPA; uniform vec3 uPB; uniform float uMode; uniform float uPMode; uniform float uSplit; uniform float uPSplit; uniform float uFill; uniform vec2 uYR;
          uniform float uBackK; uniform float uSplitAdd; uniform float uSaw; uniform vec3 uDeepK; uniform vec3 uTint; uniform float uRib; uniform float uGam; uniform float uRowP; uniform float uGainS; uniform float uAOK; uniform float uStripe; uniform float uStripeT; uniform float uRowDk;
          float sh31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
          float svn3(vec3 p) {
            vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            float a = mix(mix(sh31(i), sh31(i + vec3(1,0,0)), f.x), mix(sh31(i + vec3(0,1,0)), sh31(i + vec3(1,1,0)), f.x), f.y);
            float b = mix(mix(sh31(i + vec3(0,0,1)), sh31(i + vec3(1,0,1)), f.x), mix(sh31(i + vec3(0,1,1)), sh31(i + vec3(1,1,1)), f.x), f.y);
            return mix(a, b, f.z);
          }
          float ribH(vec2 st, float ph) { float w = st.x * 62.0 + ph * 6.283 + sin(st.y * 7.0 + ph * 9.0) * 1.1; return 0.5 + 0.5 * sin(w) * (0.6 + 0.4 * sin(w * 0.37 + ph * 4.0)); }
          vec3 stPick(vec3 a, vec3 b, float mode, float split, float rnd, vec3 cen, float jit) {
            if (mode < 0.5) return a;
            if (mode < 1.5) {
              /* fil bicolore dans la longueur : la limite de couleur est PARALLÈLE au ruban (rayure bonbon), décalée au hasard d'une feuille à l'autre */
              if (uStripe > 0.5) { float w = vSt.x + (rnd - 0.5) * 0.9; return mix(a, b, smoothstep(uStripeT - 0.035, uStripeT + 0.035, w)); }
              float m = smoothstep(0.40, 0.60, mix(rnd, svn3(cen * 3.1), 0.35)); return mix(a, b, m);
            }
            float sp = split + jit;
            if (mode < 2.5) return mix(b, a, smoothstep(sp - 0.012, sp + 0.012, cen.y));
            return mix(a, b, smoothstep(sp - 0.012, sp + 0.012, cen.y));
          }
          vec3 pnArb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
            vec3 vSigmaX = normalize(dFdx(surf_pos.xyz)); vec3 vSigmaY = normalize(dFdy(surf_pos.xyz)); vec3 vN = surf_norm;
            vec3 R1 = cross(vSigmaY, vN); vec3 R2 = cross(vN, vSigmaX); float fDet = dot(vSigmaX, R1) * faceDirection;
            vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
            return normalize(abs(fDet) * surf_norm - vGrad);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float jitS = (vR.y - 0.5) * 2.0 * uSaw;
          vec3 yNew = stPick(uA, uB, uMode, uSplit + uSplitAdd, vR.x, vCen, jitS);
          vec3 yOld = stPick(uPA, uPB, uPMode, uPSplit + uSplitAdd, vR.x, vCen, jitS);
          float nyF = (vWP.y - uYR.x) / max(uYR.y - uYR.x, 0.001);
          float isOldF = smoothstep(uFill - 0.08, uFill + 0.08, nyF);
          vec3 ycS = pow(mix(yNew, yOld, isOldF), vec3(uGam)) * uTint * (1.0 + (vR.z - 0.5) * 0.24);
          float aoS = 1.0 - clamp(vAO * uAOK, 0.0, 0.95);
          if (vInst > 0.5) {
            float ribS = ribH(vSt, vR.w);
            float dyS = (vWP.y - vCen.y) / uRowP;
            aoS *= mix(uRowDk, 1.0, smoothstep(-0.75, 0.15, dyS)) * (0.85 + 0.15 * ribS);
          }
          vec3 deepS = ycS * uDeepK * (0.55 + 0.45 * ycS);
          vec3 colS = mix(deepS, ycS, smoothstep(0.10, 0.85, aoS)) * mix(0.50, 1.0, smoothstep(0.0, 0.65, aoS));
          colS = mix(colS, deepS * 0.9, uBackK); if (!gl_FrontFacing) colS *= 0.8;
          diffuseColor.rgb *= colS * uGainS * mix(1.0, 0.3, uBackK);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          if (vInst > 0.5) { float fwR = max(fwidth(vSt.x), 1e-5) * 62.0; float fadeR = 1.0 - smoothstep(0.35, 0.8, fwR);
            float h0 = ribH(vSt, vR.w), hx = ribH(vSt + dFdx(vSt), vR.w) - h0, hy = ribH(vSt + dFdy(vSt), vR.w) - h0;
            normal = pnArb(-vViewPosition, normal, vec2(hx, hy) * (0.9 * uRib * fadeR), faceDirection); }`);
    };
    return m;
  }
  /* ensemble d'instances réparties en variantes de géométrie (une InstancedMesh par variante) */
  function instSet(geos, mat, g, store, cast) {
    const E = geos.map(() => []), Rr = geos.map(() => []);
    return {
      push(v, e, r) { E[v].push(e); Rr[v].push(r); },
      build() {
        let tri = 0;
        geos.forEach((geo, v) => {
          const n = E[v].length; if (!n) return;
          const im = new T.InstancedMesh(geo, mat, n);
          E[v].forEach((e, k) => { for (let q = 0; q < 16; q++) im.instanceMatrix.array[k * 16 + q] = e[q]; });
          const ra = new Float32Array(n * 4); Rr[v].forEach((r, k) => ra.set(r, k * 4));
          geo.setAttribute('aR', new T.InstancedBufferAttribute(ra, 4)); im.instanceMatrix.needsUpdate = true;
          im.castShadow = cast !== false; im.receiveShadow = true; g.add(im); store.geos.push(geo); (store.inst = store.inst || []).push(im);
          tri += n * geo.index.count / 3;
        });
        store.tris = (store.tris || 0) + tri;
      }
    };
  }
  /* matrice d'instance : P = position, X = tangente, N = normale ; la maille est tournée de lean autour de N, puis mise à l'échelle (L, W, B) */
  function stitchMat(P, X, Y, N, lean, sL, sW, sB) {
    const cl = Math.cos(lean), sl = Math.sin(lean);
    return [(cl * X[0] + sl * Y[0]) * sL, (cl * X[1] + sl * Y[1]) * sL, (cl * X[2] + sl * Y[2]) * sL, 0,
      (-sl * X[0] + cl * Y[0]) * sW, (-sl * X[1] + cl * Y[1]) * sW, (-sl * X[2] + cl * Y[2]) * sW, 0,
      N[0] * sB, N[1] * sB, N[2] * sB, 0, P[0], P[1], P[2], 1];
  }

  /* ---------- Outils de géométrie ---------- */
  /* Points de contrôle -> polygone fermé lissé ; k points par segment, donc le point de contrôle i est à l'indice i*k */
  function ring(list, k, map, wrap) {
    const v = list.map(map);
    if (wrap) { const n = v.length; return new T.SplineCurve([v[n - 1]].concat(v, [v[0].clone(), v[1].clone()])).getPoints((n + 2) * k).slice(k, (n + 1) * k); }   /* wrap : angles arrondis aussi au point de départ */
    v.push(v[0].clone());
    return new T.SplineCurve(v).getPoints((list.length) * k).slice(0, -1);
  }
  function ringInfo(poly, x, y) {
    let best = 1e9, qx = 0, qy = 0, inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const ax = poly[j].x, ay = poly[j].y, bx = poly[i].x, by = poly[i].y;
      if (((ay > y) !== (by > y)) && (x < (bx - ax) * (y - ay) / (by - ay) + ax)) inside = !inside;
      const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
      let t = l2 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + t * ex, cy = ay + t * ey, d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 < best) { best = d2; qx = cx; qy = cy; }
    }
    return { d: Math.sqrt(best), inside, qx, qy };
  }
  const zProfile = (o, d, y) => { const t = Math.min(1, d / o.w); return o.ef(y) + o.Bf(y) * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))); };
  /* Deux panneaux gonflés (avant / arrière) découpés exactement à la silhouette : les points hors forme sont ramenés sur le contour. */
  function buildPanels(outer, slot, o) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    outer.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const nx = Math.ceil((maxX - minX) / o.step), ny = Math.ceil((maxY - minY) / o.step), cols = nx + 1, rows = ny + 1, N = cols * rows;
    const pos = new Float32Array(N * 2 * 3), isOut = new Uint8Array(N);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i; let x = minX + (maxX - minX) * i / nx, y = minY + (maxY - minY) * j / ny;
      const a = ringInfo(outer, x, y); let d = a.inside ? a.d : -a.d, qx = a.qx, qy = a.qy;
      if (slot) { const s = ringInfo(slot, x, y), ds = s.inside ? -s.d : s.d; if (ds < d) { d = ds; qx = s.qx; qy = s.qy; } }
      if (d <= 0) { x = qx; y = qy; d = 0; isOut[k] = 1; }
      const z = zProfile(o, d, y);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      pos[(N + k) * 3] = x; pos[(N + k) * 3 + 1] = y; pos[(N + k) * 3 + 2] = -z;
    }
    const idx = [];
    const tri = (a, b, c, flip) => { if (isOut[a] && isOut[b] && isOut[c]) return; if (flip) idx.push(N + a, N + c, N + b); else idx.push(a, b, c); };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      [false, true].forEach(f => { tri(a, b, d, f); tri(a, d, c, f); });
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  /* Bande entre l'avant et l'arrière le long d'un contour (flancs, fond), subdivisée en épaisseur pour porter le relief */
  function strip(pts, ef, closed) {
    const n = pts.length, pos = [], idx = [], RS = 8;
    pts.forEach(p => { const e = ef(p.y); for (let r = 0; r <= RS; r++) pos.push(p.x, p.y, -e + 2 * e * r / RS); });
    const m = closed ? n : n - 1, W = RS + 1;
    for (let i = 0; i < m; i++) for (let r = 0; r < RS; r++) {
      const a = i * W + r, b = ((i + 1) % n) * W + r;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /* UV d'un tube : tuiles autour de la section (entier : pas de couture) et le long du tube */
  function tubeUV(geo, tilesAlong, tilesAround, off) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const a = uv.getX(i), b = uv.getY(i); uv.setXY(i, b * tilesAround + (off || 0), a * tilesAlong); }
    uv.needsUpdate = true;
  }
  /* UV d'un ruban de chaîne : le V d'une maille doit faire face au spectateur (côté « visage » = extérieur du contour + un peu vers l'avant) */
  function faceUV(geo, curve, tilesAlong, zf) {
    const TS = geo.parameters.tubularSegments, RS = geo.parameters.radialSegments, pos = geo.attributes.position, uv = geo.attributes.uv;
    const P = new T.Vector3(), Tn = new T.Vector3(), Fp = new T.Vector3(), Bp = new T.Vector3(), d = new T.Vector3(), face = new T.Vector3(), TAU = Math.PI * 2;
    let prev = null;
    for (let i = 0; i <= TS; i++) {
      const a = i / TS; curve.getPointAt(a, P); curve.getTangentAt(a, Tn);
      face.set(Tn.y, -Tn.x, zf);
      Fp.copy(face).addScaledVector(Tn, -face.dot(Tn)).normalize(); Bp.crossVectors(Tn, Fp);
      const ph = j => { const k = i * (RS + 1) + j; d.set(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(P); return Math.atan2(d.dot(Bp), d.dot(Fp)); };
      let p0 = ph(0), st = ph(1) - p0; st -= TAU * Math.round(st / TAU);
      if (prev !== null) p0 -= TAU * Math.round((p0 - prev) / TAU); prev = p0;
      const dir = st >= 0 ? 1 : -1;
      for (let j = 0; j <= RS; j++) uv.setXY(i * (RS + 1) + j, .5 + p0 / TAU + dir * j / RS, a * tilesAlong);
    }
    uv.needsUpdate = true;
  }
  /* Corde du bord (point d'écrevisse) : tube aplati le long d'un contour, tuiles le long = 1 V par maille ;
     rib = true : ruban de chaîne (1 V par maille, tourné vers le spectateur) */
  function ropeTube(pts, zf, r, dens, flat, rib, zface) {
    const v = pts.filter((p, i) => i % 3 === 0 || (zf.length > 1 && i === pts.length - 1)).map(p => new T.Vector3(p.x, p.y, zf(p.y, p.x)));
    const c = new T.CatmullRomCurve3(v), t = new T.TubeGeometry(c, Math.max(48, v.length * 3), r, 10, false);
    if (rib) faceUV(t, c, Math.max(1, c.getLength() * dens), zface); else tubeUV(t, Math.max(1, c.getLength() * dens / 4), 1, 0);
    if (flat) t.scale(1, 1, flat);
    return t;
  }
  function closedTube(pts, r, dens, segs) {
    const c = new T.CatmullRomCurve3(pts, true), t = new T.TubeGeometry(c, segs, r, 12, true);
    tubeUV(t, Math.max(4, Math.round(c.getLength() * dens / 4)), 1); return t;
  }
  function rrShape(w, h, r) {
    const s = new T.Shape(), x = -w / 2;
    s.moveTo(x + r, 0); s.lineTo(x + w - r, 0); s.quadraticCurveTo(x + w, 0, x + w, r); s.lineTo(x + w, h - r);
    s.quadraticCurveTo(x + w, h, x + w - r, h); s.lineTo(x + r, h); s.quadraticCurveTo(x, h, x, h - r); s.lineTo(x, r); s.quadraticCurveTo(x, 0, x + r, 0);
    return s;
  }
  /* emblème générique du couvercle (médaillon rond poli), sans logo de marque : Ø .38 */
  function lidEmblem() { const s = new T.Shape(); s.absarc(0, 0, .19, 0, Math.PI * 2, false); return s; }
  const slab = (shape, depth, bevel) => { const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .85, bevelSegments: 7, curveSegments: 28 }); g.translate(0, 0, -depth / 2); return g; };
  function mergeGeos(list) {
    const pos = [], nor = [], idx = []; let off = 0;
    list.forEach(g => {
      const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
      off += p.count;
    });
    const m = new T.BufferGeometry(); m.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); m.setIndex(idx); return m;
  }
  /* Anneau « stade » (plaque ovale du fond) : tresse de boucles autour du pied d'un sac */
  function stadium(halfL, halfD, y, n) {
    const pts = [], r = halfD, L = halfL - r, per = 4 * L + 2 * Math.PI * r;
    for (let i = 0; i < n; i++) {
      let s = i / n * per, x, z;
      if (s < 2 * L) { x = -L + s; z = r; }
      else if ((s -= 2 * L) < Math.PI * r) { const a = s / r; x = L + Math.sin(a) * r; z = Math.cos(a) * r; }
      else if ((s -= Math.PI * r) < 2 * L) { x = L - s; z = -r; }
      else { s -= 2 * L; const a = s / r; x = -L - Math.sin(a) * r; z = -Math.cos(a) * r; }
      pts.push(new T.Vector3(x, y, z));
    }
    return pts;
  }

  /* ---------- Plan des paniers : « superellipse » |x/a|^n + |z/b|^n = 1 (ronds n = 2 ; ovale d'Oriana aux longs côtés droits n ≈ 2,8) ---------- */
  const sgn = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  /* N points à intervalles d'arc égaux (le premier devant, +z, puis vers +x) avec leur normale sortante ; per = périmètre */
  function superRing(a, b, n, N, phase) {
    const M = 1440, e = 2 / n, X = [], Z = [], cum = [0];
    for (let k = 0; k <= M; k++) { const f = k / M * Math.PI * 2; X.push(a * sgn(Math.sin(f), e)); Z.push(b * sgn(Math.cos(f), e)); if (k) cum.push(cum[k - 1] + Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1])); }
    const per = cum[M], pts = [];
    for (let i = 0; i < N; i++) {
      const s = (((i + (phase || 0)) / N) % 1) * per; let lo = 0, hi = M; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
      const f = (s - cum[lo]) / ((cum[lo + 1] - cum[lo]) || 1), x = X[lo] + (X[lo + 1] - X[lo]) * f, z = Z[lo] + (Z[lo + 1] - Z[lo]) * f;
      let nx = Math.sign(x) * Math.pow(Math.abs(x / a), n - 1) / a, nz = Math.sign(z) * Math.pow(Math.abs(z / b), n - 1) / b; const l = Math.hypot(nx, nz) || 1;
      pts.push({ x, z, nx: nx / l, nz: nz / l });
    }
    return { pts, per };
  }

  /* ---------- Panier : profil en tonneau (cf. photos), coin bas arrondi sur la plaque, intérieur creux ---------- */
  const PLATE_BOT = .03, PLATE_TOP = .07;   /* plateau de bois : dessous / dessus ; les boucles de ruban passent sous le plateau */
  /* c = { H, sx, n, tiles, rows, rad(t) : rayon extérieur du pied (t = 0) au bord (t = 1), hr : rayon de l'anneau de trous, ff : rayon du congé, thick : épaisseur au bord, rimR : hauteur de la tresse } */
  function basketGeo(c) {
    const p = [], push = (r, y) => p.push(new T.Vector2(r, y));
    const PY = PLATE_TOP, yb = PY + c.ff, yTop = c.H - c.rimR, rf = c.rad(0), rt = c.rad(1), e = 2 / c.n;
    /* pas de disque de fil au centre : le fond visible (dessus et dessous) est la plaque de bois percée */
    push(c.hr, PY); push(rf - c.ff, PY);
    for (let a = 1; a <= 6; a++) { const t = a / 6 * Math.PI / 2; push(rf - c.ff + Math.sin(t) * c.ff, PY + (1 - Math.cos(t)) * c.ff); }
    const n = 40; for (let i = 1; i <= n; i++) { const t = i / n; push(c.rad(t), yb + (yTop - yb) * t); }
    for (let a = 1; a <= 6; a++) { const t = a / 6 * Math.PI; push(rt - c.thick / 2 + Math.cos(t) * c.thick / 2, yTop + Math.sin(t) * .03); }
    for (let i = 1; i <= 26; i++) { const t = i / 26; push((rt - c.thick) + (c.hr - (rt - c.thick)) * t, yTop - (yTop - PY) * t); }   /* face interne : de l'anneau de trous au bord */
    const segs = c.segs || (c.sx > 1 || c.n > 2 ? 320 : 240), g = new T.LatheGeometry(p, segs);
    const cum = [0]; for (let j = 1; j < p.length; j++) cum.push(cum[j - 1] + p[j].distanceTo(p[j - 1]));
    const uv = g.attributes.uv, pos = g.attributes.position, nr = g.attributes.normal, L = p.length, rowDens = c.rows / c.H;   /* les rangs comptés sur ses photos incluent la tresse du haut et le pied */
    /* mailles réparties à intervalles d'arc égaux le long du plan (superellipse unitaire) */
    const ur = [0]; for (let i = 1; i <= segs; i++) { const f0 = (i - 1) / segs * Math.PI * 2, f1 = i / segs * Math.PI * 2; ur.push(ur[i - 1] + Math.hypot(c.sx * (sgn(Math.sin(f1), e) - sgn(Math.sin(f0), e)), sgn(Math.cos(f1), e) - sgn(Math.cos(f0), e))); }
    const P = (i, j, out) => { const f = i / segs * Math.PI * 2, r = p[j].x; return out.set(r * c.sx * sgn(Math.sin(f), e), p[j].y, r * sgn(Math.cos(f), e)); };
    const a = new T.Vector3(), b = new T.Vector3(), d1 = new T.Vector3(), d2 = new T.Vector3(), nn = new T.Vector3();
    for (let i = 0; i <= segs; i++) for (let j = 0; j < L; j++) {
      const k = i * L + j; uv.setXY(k, ur[i] / ur[segs] * c.tiles, cum[j] * rowDens / 4);
      P(i, j, a); pos.setXYZ(k, a.x, a.y, a.z);
      P((i + 1) % segs, j, b); P((i - 1 + segs) % segs, j, a); d1.copy(b).sub(a);                                                   /* tangente le long du plan */
      P(i, Math.min(L - 1, j + 1), b); P(i, Math.max(0, j - 1), a); d2.copy(b).sub(a);                                              /* tangente le long du profil */
      nn.crossVectors(d2, d1).normalize();
      if (nn.x * nr.getX(k) + nn.y * nr.getY(k) + nn.z * nr.getZ(k) < 0) nn.negate();                                              /* même sens que la normale d'origine (sortante / entrante) */
      nr.setXYZ(k, nn.x, nn.y, nn.z);
    }
    return g;
  }

  /* Silhouette réelle du sac d'Oriana (relevée sur sa photo, en pixels) */
  const BAG_S = 3.6 / 680;
  /* silhouette de face mesurée sur la planche « Des modèles qui vous donneront des idées » (rangée SACS, 4 sacs, hauteur du corps = 2,56) :
     corps presque carré, bord haut plat un peu plus étroit (demi-largeur 1,24) que le ventre (1,42, tout en bas), flancs droits qui s'évasent vers le bas,
     coins du fond arrondis ; petite anse en arche basse au centre (+0,29 au-dessus du bord, largeur 1,04 hors tout, corde fine) percée d'une fente en D de 0,8 × 0,33.
     Les 19 premiers points (épaule gauche, flanc, fond, flanc, épaule droite) donnent la demi-longueur a(y) ; les 13 derniers sont le bord haut, de droite à gauche. */
  const BAG_OUT = [[112, 606], [105, 712], [97, 807], [89, 901], [84, 977], [88, 1022], [104, 1052], [129, 1071], [169, 1087], [352, 1090], [535, 1087], [575, 1071], [600, 1052], [616, 1022], [620, 977], [615, 901], [607, 807], [599, 712], [592, 606],
    [560, 606], [502, 606], [459, 605], [442, 588], [418, 563], [384, 553], [352, 551], [320, 553], [286, 563], [262, 588], [245, 605], [202, 606], [144, 606]];
  /* fente en « D » : dôme dessous l'arche, fond plat (le dessus du fond = le bord arrière vu à travers) */
  const BAG_SLOT = [[277, 637], [274, 616], [282, 597], [304, 583], [328, 577], [352, 576], [376, 577], [400, 583], [422, 597], [430, 616], [427, 637], [389, 639], [352, 639], [315, 639]];
  /* épaisseur du sac : plus large au pied (fond plat), plus étroit en haut (photo de côté) */
  /* demi-épaisseur totale : .61 au pied (fond plat de 1,22), .80 au ventre (1,6), .68 au bord (1,36) ; ef = demi-épaisseur du flanc plat (épais au pied et au bord, effilé au ventre : bouts en demi-cercles) */
  const BAG_H = y => .60 + .06 * ss(0, .9, y) - .03 * ss(1.9, 2.7, y);   /* profondeur ≈ 0,5 × la largeur du haut : .60 au pied, .66 au ventre, .63 au bord */
  const BAG_PL = 1.08, BAG_PD = .53, BAG_NH = 46, BAG_PB = -.05, BAG_PT = -.02;   /* plaque entièrement sous le fil (le fil du fond ondule de ± .02) */   /* plaque du fond : demi-longueur, demi-largeur, trous, dessous, dessus */
  const px2v = p => new T.Vector2((p[0] - 352) * BAG_S, (1090 - p[1]) * BAG_S);
  const id2v = p => new T.Vector2(p[0], p[1]);

  /* ---------- Corps du sac, crocheté EN ROND : à chaque hauteur y la section est un « stade » (rectangle aux bouts en demi-cercles),
     demi-longueur a(y) lue sur la silhouette de face, demi-épaisseur b(y) mesurée sur la photo de côté ---------- */
  const BAG_YS = (1090 - 606) * BAG_S;   /* hauteur des épaules */
  const BAG_AP = (() => { const o = []; for (let k = 0; k <= 8; k++) { const L = BAG_OUT[k], R = BAG_OUT[18 - k]; o.push([(1090 - (L[1] + R[1]) / 2) * BAG_S, (R[0] - L[0]) / 2 * BAG_S]); } return o.sort((p, q) => p[0] - q[0]); })();
  function bagA(y) {   /* demi-longueur du corps à la hauteur y : interpolation de Hermite des points mesurés */
    const P = BAG_AP, n = P.length; if (y <= P[0][0]) return P[0][1]; if (y >= P[n - 1][0]) return P[n - 1][1];
    let i = 0; while (P[i + 1][0] < y) i++;
    const sl = k => { const k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1); return (P[k1][1] - P[k0][1]) / (P[k1][0] - P[k0][0]); };
    const h = P[i + 1][0] - P[i][0], t = (y - P[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * P[i][1] + (t3 - 2 * t2 + t) * h * sl(i) + (-2 * t3 + 3 * t2) * P[i + 1][1] + (t3 - t2) * h * sl(i + 1);
  }
  const bagB = y => BAG_H(Math.min(y, BAG_YS)) * (.88 + .12 * ss(0, .3, y));   /* le bas rentre sur la plaque (coin arrondi) */
  /* point du contour de la section : f dans [0,1[ : face avant (de gauche à droite), bout droit, face arrière, bout gauche ; normale sortante (nx, nz) */
  function bagRing(a, b, f) {
    const L = Math.max(0, a - b), per = 4 * L + 2 * Math.PI * b; let s = (((f % 1) + 1) % 1) * per, x, z, nx, nz;
    if (s < 2 * L) { x = -L + s; z = b; nx = 0; nz = 1; }
    else if ((s -= 2 * L) < Math.PI * b) { const t = s / b; x = L + Math.sin(t) * b; z = Math.cos(t) * b; nx = Math.sin(t); nz = Math.cos(t); }
    else if ((s -= Math.PI * b) < 2 * L) { x = L - s; z = -b; nx = 0; nz = -1; }
    else { s -= 2 * L; const t = s / b; x = -L - Math.sin(t) * b; z = -Math.cos(t) * b; nx = -Math.sin(t); nz = -Math.cos(t); }
    return { x, z, nx, nz, per, L };
  }
  /* coque sombre sous les mailles (le fond qu'on voit par les petits jours), découpée sous la fente de l'anse */
  function bagCore(inset, y0, y1, M, Nc, slot) {
    const pos = [], idx = [];
    for (let r = 0; r <= M; r++) { const y = y0 + (y1 - y0) * r / M, a = bagA(y) - inset, b = bagB(y) - inset; for (let c = 0; c <= Nc; c++) { const q = bagRing(a, b, c / Nc); pos.push(q.x, y, q.z); } }
    for (let r = 0; r < M; r++) for (let c = 0; c < Nc; c++) {
      const a = r * (Nc + 1) + c, b = a + 1, d = a + Nc + 1, e = d + 1;
      if (slot) { const cx = (pos[a * 3] + pos[e * 3]) / 2, cy = (pos[a * 3 + 1] + pos[e * 3 + 1]) / 2, cz = pos[a * 3 + 2]; if (Math.abs(cz) > .3 && cy > 1.9) { const s = ringInfo(slot, cx, cy); if (s.inside || s.d < .05) continue; } }
      idx.push(a, d, b, b, d, e);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const hh2 = (i, j, k) => { let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul((k | 0) + 7, 1597334677)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };   /* hasard propre à la maille (i, j) et à l'usage k */
  /* mode allégé (petits téléphones) : moins de facettes par maille, pas de petites feuilles ni de jours séparés */
  const LITE_DEF = (() => { try { return Math.min(window.screen.width, window.screen.height) <= 440 || (navigator.hardwareConcurrency || 8) <= 2; } catch (e) { return false; } })();
  const liteNow = () => TUNE.lite !== undefined ? TUNE.lite > 0 : LITE_DEF;

  /* ---------- Détails décoratifs : les accessoires d'Oriana (+3 €), aux tailles réelles de ses photos ----------
     marguerites : 2 écussons brodés lilas identiques (Ø .36) ; perles : 1 grappe de 4 ; breloques : 4 en or rosé à anneau,
     suspendues au bord ; bordures dorée / argentée : chaîne plate tressée (voir buildPiece). 1 unité ≈ 8 cm. */
  const ACC = 1.15;   /* tailles de ses photos (mailles de 1,7 à 1,9 cm), à peine agrandies pour rester lisibles dans un aperçu de 300 px */
  const ridge = (geo, freq, amp) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), k = 1 + amp * Math.cos(Math.atan2(z, x) * freq); p.setX(i, x * k); p.setZ(i, z * k); } geo.computeVertexNormals(); return geo; };
  /* matrice : +Z local = normale de la surface, +Y local ≈ vers le haut */
  function orient(n, roll) {
    const y = new T.Vector3(0, 1, 0).addScaledVector(n, -n.y); if (y.lengthSq() < 1e-4) y.set(1, 0, 0); y.normalize();
    const x = new T.Vector3().crossVectors(y, n).normalize(), m = new T.Matrix4().makeBasis(x, y, n);
    if (roll) m.multiply(new T.Matrix4().makeRotationZ(roll)); return m;
  }
  const lib = {};
  function daisy(D) {
    const R = D / 2.12; if (lib['d' + D]) return lib['d' + D];
    const petals = [];
    for (let i = 0; i < 8; i++) {
      const g = ridge(new T.SphereGeometry(1, 18, 12), 9, .09);
      g.scale(.2 * R, .5 * R, .04 * R); g.translate(0, .56 * R, .02 * R); g.rotateZ(i / 8 * Math.PI * 2 + .2); petals.push(g);
    }
    const c = new T.SphereGeometry(.24 * R, 18, 12); c.scale(1, .9, .6); c.translate(0, 0, .05 * R);
    return (lib['d' + D] = { petal: mergeGeos(petals), center: c });
  }
  const jump = R => new T.TorusGeometry(.085 * R, .02 * R, 8, 20);
  function charm(kind, W) {
    const gold = [], dark = [];
    const eye = y => { const r = new T.TorusGeometry(.17 * W, .04 * W, 8, 20); r.translate(0, y + .17 * W, 0); r.scale(1, 1, .8); return r; };
    if (kind === 'scallop') {
      /* coquille Saint-Jacques : socle plat + face à côtes (grille polaire) + rubans sombres dans les rainures */
      const H = W * .92, Wx = W * .605, A0 = 1.2, RIBS = 22, NA = 150, NR = 8, ew = a => 1 + .03 * Math.cos(a * RIBS);
      const s = new T.Shape(), n = 120; s.moveTo(0, 0);
      for (let i = 0; i <= n; i++) { const a = -A0 + 2 * A0 * i / n, w = ew(a); s.lineTo(Math.sin(a) * Wx * w, -Math.cos(a) * H * w); }
      s.lineTo(0, 0);
      gold.push(new T.ExtrudeGeometry(s, { depth: .02, bevelEnabled: true, bevelThickness: .012, bevelSize: .01, bevelSegments: 2, curveSegments: 1 }));
      const crest = a => .5 + .5 * Math.cos(a * RIBS);
      const zf = (a, f) => .036 + Math.sin(Math.PI * f) * (.014 + .014 * crest(a));
      const P = (a, f, lift) => { const w = ew(a); return [f * Math.sin(a) * Wx * w, -f * Math.cos(a) * H * w, zf(a, f) + lift]; };
      const patch = (cols, rows, at) => {
        const pos = [], idx = [];
        for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) pos.push(...at(i / cols, j / rows));
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const a = i * (rows + 1) + j, b = a + rows + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
      };
      gold.push(patch(NA, NR, (u, v) => P(-A0 + 2 * A0 * u, v, 0)));
      for (let k = -4; k < 4; k++) { const ak = (2 * k + 1) * Math.PI / RIBS; if (Math.abs(ak) > A0 - .08) continue; dark.push(patch(4, 14, (u, v) => P(ak + (u - .5) * .08, .14 + .83 * v, .004))); }
      gold.push(eye(0));
    } else if (kind === 'star') {
      const pts = [], n = 90, R = W / 2;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = R * (.2 + .8 * Math.pow(Math.abs(Math.cos(2.5 * a)), 3.4)); pts.push(new T.Vector2(Math.sin(a) * r, Math.cos(a) * r)); }
      const g = new T.ExtrudeGeometry(new T.Shape(pts), { depth: .02, bevelEnabled: true, bevelThickness: .012, bevelSize: .008, bevelSegments: 2, curveSegments: 1 });
      g.translate(0, -R * 1.02, -.012); gold.push(g);
      for (let i = 0; i < 5 && W > .2; i++) { const a = i / 5 * Math.PI * 2; for (let k = 0; k < (W > .25 ? 3 : 2); k++) { const b = new T.SphereGeometry(.05 * R, 6, 5); b.translate(Math.sin(a) * (.35 + .22 * k) * R, Math.cos(a) * (.35 + .22 * k) * R - R * 1.02, .03); dark.push(b); } }
      gold.push(eye(0));
    } else {
      const H = W * 1.3, e = new T.SphereGeometry(1, 20, 14); e.scale(.5 * W, .5 * H, .3 * W); e.translate(0, -.5 * H - .02, 0); gold.push(e);
      const s = new T.SphereGeometry(1, 12, 8); s.scale(.05 * W, .42 * H, .05 * W); s.translate(0, -.5 * H - .02, .27 * W); dark.push(s);
      gold.push(eye(0));
    }
    return { gold: mergeGeos(gold), dark: dark.length ? mergeGeos(dark) : null };
  }
  /* surface de l'avant d'un sac coussin : hauteur, normale, bord supérieur */
  function panelSurface(out, slot, o) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    out.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const zAt = (x, y) => {
      const a = ringInfo(out, x, y); if (!a.inside) return null; let d = a.d;
      if (slot) { const s = ringInfo(slot, x, y); if (s.inside) return null; d = Math.min(d, s.d); }
      return o.zfn ? o.zfn(x, y, d) : zProfile(o, d, y);
    };
    const pt = (x, y) => {
      const z = zAt(x, y); if (z === null) return null; const h = .04, g = (a, b) => (a === null || b === null ? 0 : (a - b) / (2 * h));
      const dx = g(zAt(x + h, y), zAt(x - h, y)), dy = g(zAt(x, y + h), zAt(x, y - h));
      return { p: new T.Vector3(x, y, z), n: new T.Vector3(-dx, -dy, 1).normalize() };
    };
    const X = fx => (minX + maxX) / 2 + fx * (maxX - minX) / 2 * .84;
    return {
      kind: 'panel', zAt,
      at: (fx, fy) => pt(X(fx), minY + fy * (maxY - minY)),
      atXY: (x, y) => pt(x, y),
      top: (fx, drop) => { const x = X(fx); for (let y = maxY; y > minY; y -= .02) { if (zAt(x, y) !== null) return pt(x, y - (drop === undefined ? .1 : drop)); } return null; }
    };
  }
  function basketSurface(c) {
    const y0 = PLATE_TOP + c.ff, y1 = c.H - c.rimR, e = 2 / c.n;
    const rad = y => c.rad(Math.min(1, Math.max(0, (y - y0) / (y1 - y0)))) + (c.prot === undefined ? .01 : c.prot);   /* prot : les mailles débordent de la paroi */
    const pt = (phi, y) => {
      const P = (f, yy) => new T.Vector3(sgn(Math.sin(f), e) * rad(yy) * c.sx, yy, sgn(Math.cos(f), e) * rad(yy));
      const p = P(phi, y), tf = P(phi + .01, y).sub(p), ty = P(phi, y + .01).sub(p);
      const n = new T.Vector3().crossVectors(tf, ty).normalize(); if (n.z < 0) n.negate(); return { p, n };
    };
    const lo = y0 + .1, hi = c.H - c.rimR - .08;
    return {
      kind: 'basket',
      at: (fx, fy) => pt(fx * .8, lo + fy * (hi - lo)),
      atXY: (x, y) => pt(Math.asin(Math.max(-1, Math.min(1, x / (rad(y) * c.sx)))), y),
      top: (fx, drop) => pt(fx * .8, c.H - (drop === undefined ? .12 : drop))
    };
  }
  /* matériau souple : suit les mouvements du fil (respiration, balancement) */
  function softMat(U, params) {
    const m = new T.MeshPhysicalMaterial(params);
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SOFT_DECL).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SOFT_BODY);
    };
    return m;
  }
  function decorate(finish, surf, U, store, g, type) {
    if (finish !== 'perles' && finish !== 'charms' && finish !== 'fleurs') return;
    if (type === 'sleeve') return;                         /* sur la pochette, seul le fil doré / argenté est justifié par ses photos */
    const G = { petal: [], center: [], pearl: [], gold: [], dark: [] };
    const place = (parts, spot, lift, roll) => {
      if (!spot) return; const m = orient(spot.n, roll); m.setPosition(spot.p.clone().addScaledVector(spot.n, lift));
      Object.keys(parts).forEach(k => { if (parts[k]) G[k].push(parts[k].clone().applyMatrix4(m)); });
    };
    const basket = surf.kind === 'basket';
    if (finish === 'fleurs') {
      /* 2 marguerites identiques, la seconde décalée en diagonale (cf. accessoires-fleurs.jpg) */
      const D = .36 * ACC, d = daisy(D), a = basket ? surf.at(.18, .52) : surf.at(.42, .42);
      place({ petal: d.petal, center: d.center }, a, .045, 0);
      place({ petal: d.petal, center: d.center }, basket ? surf.at(.36, .34) : (a && surf.atXY(a.p.x + .21 * ACC, a.p.y - .295 * ACC)), .045, .45);
    } else if (finish === 'perles') {
      /* 1 grappe de 4 perles ivoire, disposition mesurée sur la photo (unité = diamètre) */
      const Dp = .105 * ACC, r = Dp / 2, c = basket ? surf.at(.15, .55) : surf.at(.38, .48);
      [[0, 0, 0], [.95, -.4, .5], [.25, -.96, 0], [1.6, -.96, 0]].forEach(q => {
        const sp = new T.SphereGeometry(r, 20, 14); sp.scale(1, 1.08, 1); sp.translate(q[0] * Dp, q[1] * Dp, q[2] * Dp + r * .55); place({ pearl: sp }, c, .02, 0);
      });
    } else {
      /* 4 breloques en or rosé, accrochées au bord à droite de l'anse (sac) / devant (panier) */
      const bag = type === 'bag';
      const FX = bag ? [.55, .70, .85, .97] : [.40, .57, .74, .91];   /* sac : accrochées au bord plat, à droite de la petite anse (oreille jusqu'à x ≈ .5) ; cabas : inchangé */
      const set = [['star', .29, basket ? .3 : FX[0]], ['scallop', .2, basket ? .1 : FX[1]], ['cowrie', .14, basket ? -.1 : FX[2]], ['star', .14, basket ? -.3 : FX[3]]];
      set.forEach((s, i) => {
        const c = charm(s[0], s[1] * ACC), spot = surf.top(s[2], .02 + .045 * (i % 3)); if (!spot) return;
        let n = spot.n;
        if (bag) {   /* le bas de la breloque repose sur le bombé du coussin : on incline le plan, sinon le tricot l'avale */
          const L = s[1] * ACC * 1.3, zl = surf.zAt(spot.p.x, spot.p.y - L);
          if (zl !== null && zl > spot.p.z) n = new T.Vector3(0, zl - spot.p.z, L).normalize();
        }
        const m = orient(n, ((i * 53 % 7) - 3) * .05); m.setPosition(spot.p.clone().addScaledVector(n, .05));
        ['gold', 'dark'].forEach(k => { if (c[k]) G[k].push(c[k].clone().applyMatrix4(m)); });
        const jr = jump(s[1] * ACC * 1.3); jr.rotateY(Math.PI / 2); jr.translate(0, .005, 0); G.gold.push(jr.applyMatrix4(m));
      });
    }
    const gold = softMat(U, { color: '#9c7449', metalness: .8, roughness: .38, envMapIntensity: .9 });
    const dark = softMat(U, { color: '#3d2210', metalness: .7, roughness: .55, envMapIntensity: .6 });
    const pearl = softMat(U, { color: '#dcd0b0', roughness: .2, metalness: 0, clearcoat: .7, clearcoatRoughness: .12, sheen: .25, sheenColor: new T.Color('#ffe9c2'), iridescence: .15, iridescenceIOR: 1.3, envMapIntensity: .75 });
    const petal = softMat(U, { color: '#dcd8f0', roughness: .38, metalness: 0, sheen: 1, sheenRoughness: .3, sheenColor: new T.Color('#ffffff'), envMapIntensity: .7 });
    const center = softMat(U, { color: '#e9b520', roughness: .5, metalness: 0, sheen: .6, envMapIntensity: .6 });
    const mats = { petal, center, pearl, gold, dark };
    Object.keys(G).forEach(k => {
      if (!G[k].length) return; const geo = mergeGeos(G[k]); store.geos.push(geo); store.plain.push(mats[k]);
      const mesh = new T.Mesh(geo, mats[k]); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
    });
  }

  /* ---------- Socle en bois : plateau de bouleau clair à tranche de contreplaqué ---------- */
  let birchTex = null;
  function birchTexture() {
    if (birchTex) return birchTex;
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#efe2cc'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) { const y = hash(i, 11, 5) * 256, w = 1 + hash(i, 12, 6) * 5; g.strokeStyle = (i % 2 ? 'rgba(190,150,104,' : 'rgba(255,248,232,') + (.03 + hash(i, 13, 7) * .05) + ')'; g.lineWidth = w; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + (hash(i, 14, 8) - .5) * 14, 170, y + (hash(i, 15, 9) - .5) * 14, 256, y + (hash(i, 16, 3) - .5) * 8); g.stroke(); }
    birchTex = new T.CanvasTexture(c); birchTex.colorSpace = T.SRGBColorSpace; birchTex.wrapS = birchTex.wrapT = T.RepeatWrapping; birchTex.repeat.set(.45, .45);
    return birchTex;
  }
  let woodMat = null;
  function woodTexture() {
    if (woodMat) return woodMat;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#c98a50'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) { const y = hash(i, 3, 1) * 128; g.strokeStyle = (i % 3 ? 'rgba(110,64,28,' : 'rgba(250,200,150,') + (.08 + hash(i, 5, 2) * .12) + ')'; g.lineWidth = .6 + hash(i, 7, 3) * 1.6; g.beginPath(); g.moveTo(0, y); g.lineTo(128, y + (hash(i, 9, 4) - .5) * 3); g.stroke(); }
    woodMat = new T.CanvasTexture(c); woodMat.colorSpace = T.SRGBColorSpace; woodMat.wrapS = woodMat.wrapT = T.RepeatWrapping;
    return woodMat;
  }

  /* ---------- Fabrique d'une pièce ---------- */
  function buildPiece(type, finish, size, U, store, gauge) {
    const g = new T.Group(), mats = store.mats;
    const yarn = o => { const m = yarnMaterial(U, o); mats.push(m); return m; };
    const add = (geo, mat) => { const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); store.geos.push(geo); return m; };
    const plain = (color, rough, metal) => { const m = new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 1 }); store.plain.push(m); return m; };
    const metalRim = (finish === 'dore' || finish === 'argente') && type !== 'sleeve';
    const lurex = (finish === 'dore' || finish === 'argente') && type === 'sleeve' ? (finish === 'dore' ? '#dba64a' : '#d3d6dc') : null;
    /* bordure dorée / argentée : ruban plat tressé posé au bord (un V par maille), comme sur sa photo du panier doré */
    const chainMat = d => {
      const dore = finish === 'dore';
      const m = yarnMaterial(U, { fixed: dore ? '#e3cd86' : '#d5d5d8', fixed2: dore ? '#b9a35a' : '#9c9ca0', deepK: dore ? [.62, .58, .50] : [.60, .60, .62], dens: d, uv: true, tex: 'chain', disp: .04, bump: 1.7 });
      store.plain.push(m); return m;
    };
    let surf = null;
    /* sac / cabas / pochette : deux coussins reliés par les flancs et le fond, dessus ouvert, bord en corde */
    const pillow = (outline, k, gusN, slotList, o) => {
      const out = ring(outline.list, k, outline.map, outline.wrap), slot = slotList ? ring(slotList, k, outline.map) : null;
      if (!o.noBody) {   /* (le sac n'a plus de panneaux : son corps est fait de mailles instanciées) */
        const m = yarn(Object.assign({ dens: o.dens, disp: o.disp, tex: o.tex, rowK: o.rowK, shear: o.shear, crev: o.crev, bump: o.bump, env: o.env, warp: o.warp, lurex }, o.mat));
        add(buildPanels(out, slot, o), m);
        add(strip(out.slice(0, gusN * k + 1), o.ef, false), m);
      }
      const rm = metalRim ? chainMat(o.dens) : yarn(Object.assign({ dens: o.dens, uv: true, tex: 'plait', disp: .03, env: o.env, crev: o.rimCrev, cavLo: o.rimCrev ? .25 : undefined, cavDeep: o.rimCrev ? 1 : 0 }, o.mat));
      /* ropeTube aplatit en z APRÈS coup (flat) : on annule ce facteur sur le centre du ruban (doré, ou bande d'anse du sac) pour qu'il reste au bord du coussin */
      const fl = o.rflat || .8, rr = metalRim ? (o.rimM || o.rim * 1.75) : o.rim, zc = metalRim ? (o.noBody ? 0 : .05) : o.rflat ? 0 : -.01, zk = (metalRim || o.rflat) ? 1 / fl : 1;
      /* sac : le ruban du bord est UNE boucle : l'arc du dôme à l'avant, puis aux bouts il tourne en demi-cercle vers l'arrière (z -> 0), puis l'arc du dôme à l'arrière */
      const top0 = o.noBody ? out.slice((gusN + 1) * k, (out.length / k - 1) * k + 1) : out.slice(gusN * k).concat([out[0]]), dyR = o.ropeDy || 0;
      const top = dyR ? top0.map(p => ({ x: p.x, y: p.y - dyR })) : top0;   /* le haut du ruban affleure la silhouette */
      const rd = o.dens * (o.rimDens || 1);   /* densité de la tresse : feuilles plus longues que larges (épi) quand rimDens < 1 */
      const maxX = o.noBody ? Math.max.apply(null, top.map(p => Math.abs(p.x))) : 0, zEnd = (y, x) => { if (!o.noBody) return 1; const ze0 = o.ef(y) + zc, Lr = maxX - ze0, t = Math.max(0, (Math.abs(x) - Lr) / ze0); return Math.sqrt(Math.max(metalRim ? .0036 : 0, 1 - t * t)); };
      if (o.noBody && !metalRim) {
        /* boucle fermée : arc avant, demi-cercle au bout (z -> 0 -> -z), arc arrière, demi-cercle à l'autre bout */
        const F = top.filter((p, i) => i % 3 === 0 || i === top.length - 1).map(p => new T.Vector3(p.x, p.y, (o.ef(p.y) + zc) * zk * zEnd(p.y, p.x)));
        const n = F.length, loop = F.concat(F.slice(1, n - 1).reverse().map(v => new T.Vector3(v.x, v.y, -v.z)));
        const c = new T.CatmullRomCurve3(loop, true), t = new T.TubeGeometry(c, Math.max(160, loop.length * 3), rr, 10, true);
        tubeUV(t, Math.max(4, Math.round(c.getLength() * rd / 4)), 1, 0); t.scale(1, 1, fl); add(t, rm);
      } else [1, -1].forEach(sg => add(ropeTube(top, (y, x) => sg * (o.ef(y) + zc) * zk * zEnd(y, x), rr, rd, fl, metalRim, sg * .6), rm));
      /* o.slotU : la fente de l'anse n'a de corde que sur son fond (un U plat dont les bouts se perdent dans les pieds de l'arche, qui est déjà le haut de la fente) */
      if (slot) { const sp = o.slotU || slot.concat([slot[0]]);
        [1, -1].forEach(sg => add(ropeTube(sp, (y, x) => sg * (o.ef(y) + zc) * zk, rr * (o.slotR || (metalRim ? .7 : o.rflat ? .65 : .85)), rd, fl, metalRim, sg * .6), rm)); }
      /* bord fermé aux deux bouts : une corde transversale relie la tresse avant et la tresse arrière (anneau continu aux bouts arrondis) */
      if (!metalRim && o.rflat && !o.noBody) [out[0], out[gusN * k]].forEach((s, i) => {
        const dx = i ? 1 : -1, ze = (o.ef(s.y) + zc) * zk, b = o.endB || .05, sy = s.y - dyR;
        const cv = new T.CatmullRomCurve3(o.endB ? [0, 1, 2, 3, 4, 5, 6].map(q => { const t = q / 6 * Math.PI; return new T.Vector3(s.x - dx * b * .25 + dx * b * Math.sin(t) * 1.25, sy, ze * Math.cos(t)); })
          : [new T.Vector3(s.x, sy, -ze), new T.Vector3(s.x + dx * b * .7, sy, -ze * .55), new T.Vector3(s.x + dx * b, sy, 0), new T.Vector3(s.x + dx * b * .7, sy, ze * .55), new T.Vector3(s.x, sy, ze)]);
        const tt = new T.TubeGeometry(cv, 24, rr, 10, false); tubeUV(tt, Math.max(1, cv.getLength() * rd / 4), 1, 0); tt.scale(1, 1, fl); add(tt, rm);
      });
      surf = panelSurface(out, slot, o);
      return out;
    };

    if (type === 'bag') {
      const LITE = liteNow(), gros = gauge === 'gros';   /* sac bicolore : gros fil double (≈ 14 × 11 mailles), cf. sa photo bleu / blanc */
      /* gros fil : V de jersey (grosse feuille « \ » + petite « / », un trou noir par maille, rayure rouge / rose le long du ruban), 11 rangs, ≈ 40 mailles autour ; la bande d'anse et le bord sont des rubans plats */
      const bagEf = y => BAG_H(Math.min(y, BAG_YS)) - .02;   /* centre des rubans du bord : le ruban (rayon .10) dépasse un peu le tricot, on le voit tout autour du bord */
      /* fond de la fente de l'anse : U plat de -.478 à +.478 (les pieds de l'arche), fond à y = 2,383, relevé aux bouts jusqu'au bord (y = 2,503) */
      const slotU = []; for (let i = 0; i <= 24; i++) { const t = -1 + i / 12; slotU.push({ x: .478 * t, y: 2.383 + .12 * Math.pow(Math.abs(t), 3) }); }
      const o = gros
        ? { ef: bagEf, noBody: true, slotU, slotR: .9, ropeDy: .07, endB: .3, w: .8, rim: .07, rimM: .09, rflat: 1.07, tex: 'jersey', dens: 4.5, crev: .26, bump: 1.4, env: .25, rimCrev: .5, rimDens: 1.9, mat: { occ: 1, sheenK: .25 } }
        : { ef: bagEf, noBody: true, slotU, slotR: .9, ropeDy: .065, endB: .3, w: .8, rim: .065, rimM: .09, rflat: 1.07, tex: 'cushion', dens: 6.6, crev: .30, bump: 1.7, env: .25, rimCrev: .5, rimDens: 1.3, mat: { occ: 1, gain: 1.12 } };
      /* surface de l'avant (pour les finitions : breloques, perles, fleurs) : z du fil au-dessus du corps en stade */
      const prot = gros ? .075 : .055;
      o.zfn = (x, y) => { const yy = Math.min(y, BAG_YS), a = bagA(yy), b = bagB(yy), L = a - b, ax = Math.abs(x); return ax <= L ? b + prot : ax >= a ? null : Math.sqrt(Math.max(0, b * b - (ax - L) * (ax - L))) + prot; };
      const outB = pillow({ list: BAG_OUT, map: px2v }, 14, 18, BAG_SLOT, o);
      { /* ---------- le corps : mailles instanciées, rang après rang (en rond) ---------- */
        const NC = gros ? 32 : 49, nFull = gros ? 10 : 17, y0 = .10, yFull = 2.36, prow = (yFull - y0) / (nFull - 1), slotPoly = ring(BAG_SLOT, 14, px2v);
        const stM = op => { const m = stitchMaterial(U, op); mats.push(m); return m; };
        add(bagCore(.06, .04, BAG_YS - .1, 44, 168, slotPoly), stM({ back: .95, rib: 0, deepK: [.95, .78, .62], rowP: prow }));
        const base = { deepK: gros ? [1, .8, .68] : [1, .8, .64], rowP: prow, rib: tn('ribk', gros ? 1.6 : 2.0), aoK: tn('aoK', gros ? .8 : .65), rowDk: tn('rowDk', gros ? .85 : .78) };
        const nSv = LITE ? 6 : gros ? 10 : 8, nVv = LITE ? 4 : gros ? 6 : 5;
        const VAR = [[.16, .35, .72], [.14, -.3, .8], [-.16, .3, .7], [-.18, -.35, .78], [.0, .1, .75]];
        const mk = (g, kk) => VAR.map((v, i) => leafGeo(Object.assign({}, g, { kap: v[0] * (kk || 1), tau: v[1], skew: v[2], cv: (i % 2 ? -.12 : .14) })));
        const gM = { L: 1, W: 1, B: .25, nS: nSv, nV: nVv, crease: tn('cr', gros ? .9 : .6), tp: tn('tp', .5), w0: tn('w0', .05), arch: tn('arch', .7) };
        const mainSet = instSet(mk(gM, tn('kap', 1.3)), stM(Object.assign({ stripe: gros, stripeT: tn('sT', .6) }, base)), g, store);
        const smallSet = gros ? instSet(mk(Object.assign({}, gM, { nS: LITE ? 5 : 7, nV: LITE ? 3 : 4, crease: .3, tp: tn('stp', .4), w0: tn('sw0', .2) }), 1), stM(Object.assign({ stripe: true, stripeT: tn('sT', .6) }, base)), g, store) : null;
        const holes = [];
        /* paramètres de la maille (unités : pas horizontal p, hauteur de rang prow) */
        const P0 = gros
          ? { kL: tn('kL', 1.5), kW: tn('kW', 1.05), B: tn('B', .20), lean: tn('lean', -.61), lj: .1, cx: tn('cx', -.08), cy: tn('cy', .08), hx: tn('hx', .45), hy: tn('hy', -.32), hr: tn('hr', .10) }
          : { kL: tn('kL', 1.75), kW: tn('kW', 1.15), B: tn('B', .16), lean: tn('lean', -.30), lj: .10, cx: tn('cx', -.03), cy: tn('cy', .04), hx: tn('hx', .5), hy: tn('hy', -.5), hr: tn('hr', .14) };
                const Pt = (f, y) => { const q = bagRing(bagA(y), bagB(y), f); return [q.x, y, q.z]; };
        for (let j = 0; j <= nFull; j++) {
          for (let i = 0; i < NC; i++) {
            const h = k => hh2(i, j, k), fb = (i + .5 + (h(20) - .5) * .06) / NC;
            const y = y0 + j * prow + prow * (.07 * Math.sin(fb * Math.PI * 2 * 2.3 + j * 1.9) + (h(6) - .5) * .12);
            const q = bagRing(bagA(y), bagB(y), fb), e = .003;
            const Pa = Pt(fb + e / q.per, y), Pb = Pt(fb - e / q.per, y), Pc = Pt(fb, y + e), Pd = Pt(fb, y - e);
            const Tf = [Pa[0] - Pb[0], Pa[1] - Pb[1], Pa[2] - Pb[2]], Ty = [Pc[0] - Pd[0], Pc[1] - Pd[1], Pc[2] - Pd[2]];
            let N = [Tf[1] * Ty[2] - Tf[2] * Ty[1], Tf[2] * Ty[0] - Tf[0] * Ty[2], Tf[0] * Ty[1] - Tf[1] * Ty[0]]; const nl = Math.hypot(N[0], N[1], N[2]) || 1; N = [N[0] / nl, N[1] / nl, N[2] / nl];
            const tl = Math.hypot(Tf[0], Tf[1], Tf[2]) || 1; let X = [Tf[0] / tl, Tf[1] / tl, Tf[2] / tl]; const xd = X[0] * N[0] + X[1] * N[1] + X[2] * N[2]; X = [X[0] - N[0] * xd, X[1] - N[1] * xd, X[2] - N[2] * xd];
            const xl = Math.hypot(X[0], X[1], X[2]) || 1; X = [X[0] / xl, X[1] / xl, X[2] / xl];
            const Y = [N[1] * X[2] - N[2] * X[1], N[2] * X[0] - N[0] * X[2], N[0] * X[1] - N[1] * X[0]];
            /* appartient-il au tricot ? (les bouts s'arrêtent sous le bord ; l'avant et l'arrière laissent la place à la fente et au dôme) */
            const onEnd = Math.abs(q.nx) > .2;
            if (onEnd ? y > 2.40 : (() => { const s = ringInfo(slotPoly, q.x, y); if (s.inside || s.d < .06) return true; if (y > 2.2) { const a = ringInfo(outB, q.x, y); if (!a.inside || a.d < .12) return true; } return false; })()) continue;
            const p = q.per / NC, bot = j === 0;
            const sL = p * P0.kL * (.9 + .2 * h(2)), sW = prow * P0.kW * (.9 + .22 * h(3)) * (bot ? 1.1 : 1), sB = P0.B * (.8 + .4 * h(4));
            const P = q ? [q.x, y, q.z] : null, z0 = -.012 + (h(8) - .5) * .01;
            const mv = (dx, dy, z) => [P[0] + X[0] * dx * p + Y[0] * dy * prow + N[0] * z, P[1] + X[1] * dx * p + Y[1] * dy * prow + N[1] * z, P[2] + X[2] * dx * p + Y[2] * dy * prow + N[2] * z];
            const rr = [h(10), h(11), h(12), h(13)];
            mainSet.push(Math.floor(h(9) * 5) % 5, stitchMat(mv(P0.cx + (h(5) - .5) * .12, P0.cy + (h(7) - .5) * .12, z0), X, Y, N, P0.lean + (h(1) - .5) * 2 * P0.lj, sL, sW, sB), rr);
            if (smallSet) smallSet.push(Math.floor(h(14) * 5) % 5, stitchMat(mv(tn('scx', -.40) + (h(15) - .5) * .08, tn('scy', -.08) + (h(16) - .5) * .08, z0 - .012), X, Y, N, tn('slean', .96) + (h(17) - .5) * .3, sL * tn('sKL', .8), sW * tn('sKW', .62), sB * .8), [h(18), h(19), h(21), h(22)]);
            if (!LITE || !gros) holes.push(stitchMat(mv(P0.hx, P0.hy, -.034), X, Y, N, 0, P0.hr * p * (.85 + .3 * h(23)), P0.hr * prow * (.9 + .3 * h(24)), 1));
          }
        }
        mainSet.build(); if (smallSet) smallSet.build();
        if (holes.length) {
          const hm = new T.MeshBasicMaterial({ color: '#150a08', side: T.DoubleSide }); store.plain.push(hm);
          const him = new T.InstancedMesh(new T.CircleGeometry(1, 8), hm, holes.length); holes.forEach((e, k) => { for (let q = 0; q < 16; q++) him.instanceMatrix.array[k * 16 + q] = e[q]; });
          him.castShadow = false; him.receiveShadow = false; g.add(him); store.geos.push(him.geometry); (store.inst = store.inst || []).push(him); store.tris = (store.tris || 0) + holes.length * 8;
        }
        /* ---------- l'intérieur est aussi en laine : le dos du tricot (rangs de petites boucles couchées, même fil) et un fond crocheté ---------- */
        {
          const ins = .15, gI = { L: 1, W: 1, B: .22, nS: LITE ? 4 : 5, nV: LITE ? 3 : 4, crease: .35, tp: .55, w0: .08, arch: .6 };
          const inSet = instSet(mk(gI, 1), stM(Object.assign({}, base, { deepK: [1, .78, .62], gain: .88, aoK: 1.0, rowDk: .7, stripe: gros, stripeT: .6 })), g, store, false);
          const PtI = (f, y) => { const r = bagRing(bagA(y) - ins, bagB(y) - ins, f); return [r.x, y, r.z]; };
          for (let j = 0; j <= nFull; j++) for (let i = 0; i < NC; i++) {
            const h = k => hh2(i + 900, j + 31, k), fb = (i + .5 + (h(20) - .5) * .06) / NC;
            const y = y0 + j * prow + prow * (.06 * Math.sin(fb * 14.5 + j * 1.3) + (h(6) - .5) * .1);
            const q = bagRing(bagA(y) - ins, bagB(y) - ins, fb), e = .003;
            const Pa = PtI(fb + e / q.per, y), Pb = PtI(fb - e / q.per, y), Pc = PtI(fb, y + e), Pd = PtI(fb, y - e);
            const Tf = [Pa[0] - Pb[0], Pa[1] - Pb[1], Pa[2] - Pb[2]], Ty = [Pc[0] - Pd[0], Pc[1] - Pd[1], Pc[2] - Pd[2]];
            let N = [Tf[1] * Ty[2] - Tf[2] * Ty[1], Tf[2] * Ty[0] - Tf[0] * Ty[2], Tf[0] * Ty[1] - Tf[1] * Ty[0]]; const nl = Math.hypot(N[0], N[1], N[2]) || 1; N = [-N[0] / nl, -N[1] / nl, -N[2] / nl];   /* normale vers l'intérieur */
            const tl = Math.hypot(Tf[0], Tf[1], Tf[2]) || 1; let X = [-Tf[0] / tl, -Tf[1] / tl, -Tf[2] / tl]; const xd = X[0] * N[0] + X[1] * N[1] + X[2] * N[2]; X = [X[0] - N[0] * xd, X[1] - N[1] * xd, X[2] - N[2] * xd];
            const xl = Math.hypot(X[0], X[1], X[2]) || 1; X = [X[0] / xl, X[1] / xl, X[2] / xl];
            const Y = [N[1] * X[2] - N[2] * X[1], N[2] * X[0] - N[0] * X[2], N[0] * X[1] - N[1] * X[0]];
            const onEnd = Math.abs(q.nx) > .2;
            if (onEnd ? y > 2.34 : (() => { const s = ringInfo(slotPoly, q.x, y); if (s.inside || s.d < .06) return true; if (y > 2.2) { const a = ringInfo(outB, q.x, y); if (!a.inside || a.d < .12) return true; } return false; })()) continue;
            const p = q.per / NC, sL = p * 1.4 * (.9 + .2 * h(2)), sW = prow * 1.0 * (.9 + .2 * h(3)), sB = .15 * (.8 + .4 * h(4));
            const mv = (dx, dy, z) => [q.x + X[0] * dx * p + Y[0] * dy * prow + N[0] * z, y + X[1] * dx * p + Y[1] * dy * prow + N[1] * z, q.z + X[2] * dx * p + Y[2] * dy * prow + N[2] * z];
            inSet.push(Math.floor(h(9) * 5) % 5, stitchMat(mv((h(5) - .5) * .12, (h(7) - .5) * .12, 0), X, Y, N, .22 + (h(1) - .5) * .3, sL, sW, sB), [h(10), h(11), h(12), h(13)]);
          }
          inSet.build();
          /* fond : tricot à plat au-dessus de la plaque */
          const fa = bagA(.08) - .1, fb2 = bagB(.08) - .1, Lc = Math.max(0, fa - fb2), fsh = new T.Shape();
          fsh.moveTo(-Lc, -fb2); fsh.lineTo(Lc, -fb2); fsh.absarc(Lc, 0, fb2, -Math.PI / 2, Math.PI / 2, false); fsh.lineTo(-Lc, fb2); fsh.absarc(-Lc, 0, fb2, Math.PI / 2, Math.PI * 1.5, false);
          const fg = new T.ShapeGeometry(fsh, 24); fg.rotateX(-Math.PI / 2); fg.translate(0, .045, 0);
          { const fp = fg.attributes.position, fu = fg.attributes.uv, kd = o.dens / 4; for (let k = 0; k < fp.count; k++) fu.setXY(k, fp.getX(k) * kd, fp.getZ(k) * kd); fu.needsUpdate = true; }
          add(fg, yarn({ dens: o.dens, uv: true, tex: gros ? 'jersey' : 'cushion', disp: .03, crev: .5, bump: 1.3, env: .25 }));
        }
      }
      /* pied : 1er tour de boucles cousues sur la plaque ovale */
      add(closedTube(stadium(BAG_PL - .07, BAG_PD - .04, .03, gros ? 64 : 120), gros ? .045 : .035, o.dens, gros ? 200 : 360), yarn({ dens: o.dens, uv: true, tex: 'plait', disp: .025, env: .25, crev: .42, cavLo: .15, cavDeep: .4 }));
      /* fond : plaque blanche saffiano en forme de stade (rapport 2,5), 52 fentes noires à 0,035 du bord, un brin de ruban plat par fente, 4 rivets en laiton rosé (photo du dessous) */
      { const Lc = BAG_PL - BAG_PD, sh = new T.Shape();
        sh.moveTo(-Lc, -BAG_PD); sh.lineTo(Lc, -BAG_PD); sh.absarc(Lc, 0, BAG_PD, -Math.PI / 2, Math.PI / 2, false); sh.lineTo(-Lc, BAG_PD); sh.absarc(-Lc, 0, BAG_PD, Math.PI / 2, Math.PI * 1.5, false);
        const hp = stadium(BAG_PL - .035, BAG_PD - .035, 0, BAG_NH), strands = [], per = 4 * Lc + 2 * Math.PI * BAG_PD, sw = per / BAG_NH * .97;
        hp.forEach((p, i) => {
          const cx = Math.max(-Lc, Math.min(Lc, p.x)), nx = p.x - cx, nz = p.z, nl = Math.hypot(nx, nz) || 1, h = new T.Path();
          h.absellipse(p.x, p.z, .05, .03, 0, Math.PI * 2, true, Math.atan2(nz / nl, nx / nl) + Math.PI / 2); sh.holes.push(h);
          const b = new T.SphereGeometry(1, 14, 10); b.scale(sw / 2, .04, .08 + (hash(i, 2, 3) - .5) * .03);   /* boucle ronde : les voisines se touchent sans scintiller, la fente noire reste lisible */
          b.rotateY(Math.atan2(nx, nz)); b.translate(p.x + nx / nl * .06, BAG_PB - .01, p.z + nz / nl * .06); strands.push(b);
        });
        const bp = new T.ExtrudeGeometry(sh, { depth: BAG_PT - BAG_PB, bevelEnabled: false, curveSegments: 48 }); bp.rotateX(Math.PI / 2); bp.translate(0, BAG_PT, 0);
        add(bp, [plain('#f4efe6', .45, 0), plain('#e6e0d4', .6, 0)]);
        add(mergeGeos(strands), yarn({ dens: o.dens, uv: false, disp: .01, tex: 'rows', env: .25 }));
        const brass = plain('#e6c6a2', .32, .45);   /* laiton rosé clair (un métal très poli reflèterait le bas sombre du décor et virerait au brun) */
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(q => {
          const d = new T.CylinderGeometry(.07, .035, .07, 20); d.translate(q[0] * .80, BAG_PB - .035, q[1] * .30); add(d, brass);   /* plot conique : large côté plaque, étroit vers l'extérieur */
        });
      }
    } else if (type === 'tote') {
      /* Cabas : corps souple (fond épais, haut écrasé), encolure en U entre deux longues anses plates qui s'effilent */
      const body = [[-1.68, 3.08], [-1.76, 2.44], [-1.84, 1.62], [-1.90, .72], [-1.87, .38], [-1.70, .13], [-1.32, .02], [0, -.02], [1.32, .02], [1.70, .13], [1.87, .38], [1.90, .72], [1.84, 1.62], [1.76, 2.44], [1.68, 3.08],
        [1.36, 3.13], [1.02, 3.2], [.60, 3.22], [.52, 3.0], [.46, 2.74], [.30, 2.55], [0, 2.44], [-.30, 2.55], [-.46, 2.74], [-.52, 3.0], [-.60, 3.22], [-1.02, 3.2], [-1.36, 3.13]];
      /* ton de son cabas (photo) : brun très foncé et sable rosé, mat, sans voile blanc ; creux profonds, reflets coupés dans les creux */
      const o = { ef: y => .14 + .26 * (1 - ss(.6, 3.0, y)), Bf: y => .08 + .10 * (1 - ss(.6, 3.0, y)), w: .55, step: .022, disp: .045, rim: .052, tex: 'vcrochet', dens: 7.5, rowK: .877, shear: 0, crev: .3, bump: 1.6,
        mat: { rough: .92, sheenK: .2, sheenCol: '#b49a86', spec: .5, occ: 1 } };
      pillow({ list: body, map: id2v, wrap: true }, 14, 14, null, o);
      const sm = yarn({ dens: 7.5, uv: true, tex: 'tbraid', bump: 1.5, crev: .55, disp: .035, foot: true, rough: .92, sheenK: .2, sheenCol: '#b49a86' });
      [-1, 1].forEach(sx => {
        const axis = [[.71, 3.0], [.71, 3.35], [.53, 3.78], [.41, 4.25], [.27, 4.78], [.17, 5.22], [.14, 5.52]].map(v => new T.Vector3(sx * v[0], v[1], 0)), cur = new T.CatmullRomCurve3(axis);
        const M = 90, Rr = 16, pos = [], uv = [], idx = [], len = cur.getLength();
        for (let i = 0; i <= M; i++) {
          const t = i / M, c = cur.getPoint(t), tg = cur.getTangent(t), nx = -tg.y, ny = tg.x, nl = Math.hypot(nx, ny) || 1;
          /* la sangle s'évase au pied (elle est crochetée dans le corps) puis s'effile */
          const fl = 1 - ss(3.22, 3.80, c.y), w = .33 + .25 * fl - .10 * ss(.6, 1, t), th = .22 + .08 * fl - .05 * ss(.6, 1, t), ox = sx * .05 * fl;
          for (let j = 0; j <= Rr; j++) { const a = j / Rr * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); pos.push(c.x + ox + nx / nl * ca * w / 2, c.y + ny / nl * ca * w / 2, sa * th / 2); uv.push(j / Rr * 2, t * len * 5.9 / 4); }
        }
        for (let i = 0; i < M; i++) for (let j = 0; j < Rr; j++) { const a = i * (Rr + 1) + j, b = a + Rr + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
        const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals(); add(sg, sm);
      });
      /* crochet rond devant les anses, comme sur sa photo : petit disque métal biseauté */
      const hs = new T.Shape(); hs.absarc(0, 0, .225, 0, Math.PI * 2, false);
      const hook = slab(hs, .05, .03); hook.translate(0, 5.5, .17);
      add(hook, plain('#7b7468', .35, .6));
      /* crête du pied : un rang de brins plats couchés */
      const cr = []; for (let i = 0; i <= 40; i++) { const x = -1.82 + 3.64 * i / 40; cr.push(new T.Vector3(x, .27, surf.zAt(x, .27) + .015)); }
      for (let i = 1; i < 12; i++) { const a = i / 12 * Math.PI, ze = o.ef(.27) + .02; cr.push(new T.Vector3(1.84 + Math.sin(a) * .04, .27, Math.cos(a) * ze)); }
      for (let i = 40; i >= 0; i--) { const x = -1.82 + 3.64 * i / 40; cr.push(new T.Vector3(x, .27, -(surf.zAt(x, .27) + .015))); }
      for (let i = 1; i < 12; i++) { const a = i / 12 * Math.PI, ze = o.ef(.27) + .02; cr.push(new T.Vector3(-1.84 - Math.sin(a) * .04, .27, -Math.cos(a) * ze)); }
      add(closedTube(cr, .045, 6, 520), yarn({ dens: 6, uv: true, tex: 'plait', disp: .02 }));
    } else if (type === 'basketRound' || type === 'basketOval') {
      /* Dimensions mesurées sur ses photos : rond jaune (bas, en tonneau, 72 trous), petit panier vert et crème (évasé), ovale vert et crème (longs côtés droits).
         t : 0 au pied, 1 au bord ; ov : dépassement du ruban au-delà de la plaque ; d : distance trou - bord de la plaque */
      const oval = type === 'basketOval', KS = { S: .645, M: .79, L: 1 };
      let c;
      /* d'après ses photos : panier rond caramel à bordure dorée (paroi droite, quatre rangs de grosses mailles inclinées, tresse au bord, plateau de bois fin)
         et panier ovale rouille (mailles plus fines, sept rangs, tresse lisse au bord, jours clairs sur la paroi du fond) ; les mailles sont des objets 3D, comme sur le sac */
      if (!oval) { const k = size === 'S' ? .8 : 1; c = { H: size === 'S' ? 1.2 : 1.38, sx: 1, n: 2, tiles: 8, rows: 4, NH: Math.round(72 * k), ov: .035, d: .09, hole: .043, thick: .19, ff: .06, skew: .26, tex: 'ribbon', rad: t => 1.5 * k * (1 + .012 * t - .06 * (1 - ss(0, .4, t))), rimTube: .125, rimOff: -.05, vs: 1, saw: .06, strand: .8, style: 'gros', rowP: tn('bRow', .235), sp: tn('bSp', .31), segs: 120, prot: .09 }; }
      else { const k = KS[size] || 1; c = { H: 1.2 + .55 * k, sx: 2.5 / 1.5, n: 2.8, tiles: 12, rows: 6, NH: 4 * Math.round(15 * k), ov: .02, d: .13 * k, hole: .056 * k, thick: .15 * k, ff: .09 * k, skew: 0, tex: 'ovalvee', rad: t => 1.5 * k * (.93 + .07 * t), rimTube: .12, rimOff: -.035, vs: 1, saw: .09 * k, strand: 1.1, style: 'fin', rowP: tn('bRow', .225), sp: tn('bSp', .27), segs: 130, prot: .08 }; }
      c.rimR = c.rimTube * .8; c.hr = c.rad(0) - c.ov - c.d;
      const rf = c.rad(0), rp = rf - c.ov, mid = c.rad(.5), N = c.NH;
      const dens = 1 / c.sp;   /* mailles par unité de longueur : la tresse du bord a une boucle par maille */
      const gv = c.tex === 'ovalvee';   /* ovale : relief plus marqué, creux plus profonds, nœuds de ruban dodus (languettes du pied) */
      /* bordure dorée / argentée : ruban plat tressé, or franc (jaune chaud, creux brun doré) ou argent clair, brillant (cf. sa photo du panier rond doré) */
      const chainMatB = d => {
        const dore = finish === 'dore';
        const m = yarnMaterial(U, { fixed: dore ? '#f2c24e' : '#dcdde2', fixed2: dore ? '#b87d1c' : '#9d9ea6', deepK: dore ? [.7, .5, .26] : [.62, .62, .66], dens: d, uv: true, tex: 'chain', disp: .04, bump: 1.7 });
        m.metalness = dore ? .85 : .8; m.roughness = .3; m.clearcoat = .5; m.envMapIntensity = 1.6; store.plain.push(m); return m;
      };
      { /* ---------- paroi : mailles instanciées rang après rang (comme le sac), posées sur une coque sombre qui laisse voir les creux ---------- */
        const LITE = liteNow(), gros = c.style === 'gros', yb = PLATE_TOP + c.ff, yTop0 = c.H - c.rimR, yEnd = yTop0 - c.rimTube * tn('bEnd', .5);
        const R = Math.max(3, Math.round((yEnd - yb) / c.rowP)), prow = (yEnd - yb) / R;
        const rOut = y => c.rad(Math.min(1, Math.max(0, (y - yb) / (yTop0 - yb))));
        const rIn = y => { const f = Math.min(1, Math.max(0, (y - PLATE_TOP) / (yTop0 - PLATE_TOP))); return c.hr + ((c.rad(1) - c.thick) - c.hr) * f; };
        const NC = Math.max(14, Math.round(superRing(rOut((yb + yEnd) / 2) * c.sx, rOut((yb + yEnd) / 2), c.n, 4, 0).per / c.sp));
        const stM = op => { const m = stitchMaterial(U, op); mats.push(m); return m; };
        add(basketGeo(c), stM({ back: .95, rib: 0, deepK: [.95, .78, .62], rowP: prow }));   /* coque sombre : ce qu'on voit entre les mailles */
        const base = { deepK: gros ? [1, .8, .68] : [1, .8, .64], rowP: prow, rib: tn('bRib', gros ? 1.6 : 2.0), aoK: tn('bAO', gros ? 1.0 : .85), rowDk: tn('bRowDk', .65), saw: c.saw, stripe: true, stripeT: .6 };
        const VAR = [[.16, .35, .72], [.14, -.3, .8], [-.16, .3, .7], [-.18, -.35, .78], [.0, .1, .75]];
        const mk = (gg, kk) => VAR.map((v, i) => leafGeo(Object.assign({}, gg, { kap: v[0] * (kk || 1), tau: v[1], skew: v[2], cv: (i % 2 ? -.12 : .14) })));
        const gM = { L: 1, W: 1, B: .25, nS: LITE ? 6 : 8, nV: LITE ? 4 : 5, crease: tn('bcr', gros ? .6 : .5), tp: tn('btp', gros ? .3 : .35), w0: tn('bw0', gros ? .4 : .3), arch: tn('barch', .7) };
        const mainSet = instSet(mk(gM, tn('bKap', gros ? .8 : 1.0)), stM(base), g, store);
        const smallSet = gros ? instSet(mk(Object.assign({}, gM, { nS: LITE ? 5 : 7, nV: LITE ? 3 : 4, crease: .3, tp: tn('bstp', .4), w0: tn('bsw0', .2) }), 1), stM(base), g, store) : null;
        const P0 = gros
          ? { kL: tn('bkL', 1.35), kW: tn('bkW', 1.25), B: tn('bB', .26), lean: tn('blean', -.75), lj: .1, cx: -.08, cy: .08, hx: .45, hy: -.32, hr: .10 }
          : { kL: tn('bkL', 1.75), kW: tn('bkW', 1.3), B: tn('bB', .2), lean: tn('blean', -.55), lj: .10, cx: -.03, cy: .04, hx: .5, hy: -.5, hr: .14 };
        /* repère local de chaque maille : P position, X le long du rang, Y vers le haut, N vers l'extérieur (vers l'intérieur pour la face interne) */
        const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
        const frames = (radAt, y, n, ph, inward) => {
          const e = .004, ringAt = yy => superRing(radAt(yy) * c.sx, radAt(yy), c.n, n, ph), A = ringAt(y), Uu = ringAt(y + e).pts, Dd = ringAt(y - e).pts, list = [];
          for (let i = 0; i < n; i++) {
            const q = A.pts[i], a = A.pts[(i + 1) % n], b = A.pts[(i - 1 + n) % n];
            const Tf = [a.x - b.x, 0, a.z - b.z], Ty = [Uu[i].x - Dd[i].x, 2 * e, Uu[i].z - Dd[i].z];
            let Nn = unit(cross(Tf, Ty)); if (Nn[0] * q.nx + Nn[2] * q.nz < 0) Nn = Nn.map(v => -v);
            let X = unit(Tf); const d = X[0] * Nn[0] + X[1] * Nn[1] + X[2] * Nn[2]; X = unit([X[0] - Nn[0] * d, X[1] - Nn[1] * d, X[2] - Nn[2] * d]);
            if (inward) { Nn = Nn.map(v => -v); X = X.map(v => -v); }
            list.push({ P: [q.x, y, q.z], X, N: Nn, Y: cross(Nn, X) });
          }
          return { list, p: A.per / n };
        };
        const holes = [], holesIn = [], z0 = tn('bz0', .02);
        for (let j = 0; j < R; j++) {
          const y = yb + (j + .5) * prow, F = frames(rOut, y, NC, j * .11, false), p = F.p;
          F.list.forEach((f, i) => {
            const h = k => hh2(i, j, k), mv = (dx, dy, z) => [f.P[0] + f.X[0] * dx * p + f.Y[0] * dy * prow + f.N[0] * z, f.P[1] + f.X[1] * dx * p + f.Y[1] * dy * prow + f.N[1] * z, f.P[2] + f.X[2] * dx * p + f.Y[2] * dy * prow + f.N[2] * z];
            const sL = p * P0.kL * (.9 + .2 * h(2)), sW = prow * P0.kW * (.9 + .22 * h(3)), sB = P0.B * (.8 + .4 * h(4)), zz = z0 + (h(8) - .5) * .01;
            mainSet.push(Math.floor(h(9) * 5) % 5, stitchMat(mv(P0.cx + (h(5) - .5) * .12, P0.cy + (h(7) - .5) * .12, zz), f.X, f.Y, f.N, P0.lean + (h(1) - .5) * 2 * P0.lj, sL, sW, sB), [h(10), h(11), h(12), h(13)]);
            if (smallSet) smallSet.push(Math.floor(h(14) * 5) % 5, stitchMat(mv(tn('bscx', -.45) + (h(15) - .5) * .08, tn('bscy', -.10) + (h(16) - .5) * .08, zz - .012), f.X, f.Y, f.N, tn('bslean', 1.1) + (h(17) - .5) * .3, sL * tn('bsKL', 1), sW * tn('bsKW', .9), sB * .8), [h(18), h(19), h(21), h(22)]);
            if (!LITE || !gros) holes.push(stitchMat(mv(P0.hx, P0.hy, zz - .034), f.X, f.Y, f.N, 0, P0.hr * p * (.85 + .3 * h(23)), P0.hr * prow * (.9 + .3 * h(24)), 1));
          });
        }
        mainSet.build(); if (smallSet) smallSet.build();
        /* face interne : même fil vu de l'intérieur, plus petit ; petits jours clairs (le fond du décor se voit à travers) */
        const yi0 = PLATE_TOP + .05, yiEnd = yTop0 + c.rimTube * .1, Rin = Math.max(3, Math.round((yiEnd - yi0) / (c.rowP * .95))), prIn = (yiEnd - yi0) / Rin;
        const NCin = Math.max(12, Math.round(NC * rIn((yi0 + yiEnd) / 2) / rOut((yb + yEnd) / 2)));
        const inSet = instSet(mk({ L: 1, W: 1, B: .22, nS: LITE ? 3 : 4, nV: LITE ? 3 : 3, crease: .35, tp: .55, w0: .08, arch: .6 }, 1), stM(Object.assign({}, base, { deepK: [1, .78, .62], gain: .88, aoK: 1.0, rowDk: .7, rowP: prIn })), g, store, false);
        for (let j = 0; j < Rin; j++) {
          const y = yi0 + (j + .5) * prIn, F = frames(rIn, y, NCin, j * .11 + .3, true), p = F.p;
          F.list.forEach((f, i) => {
            const h = k => hh2(i + 900, j + 31, k), mv = (dx, dy, z) => [f.P[0] + f.X[0] * dx * p + f.Y[0] * dy * prIn + f.N[0] * z, f.P[1] + f.X[1] * dx * p + f.Y[1] * dy * prIn + f.N[1] * z, f.P[2] + f.X[2] * dx * p + f.Y[2] * dy * prIn + f.N[2] * z];
            inSet.push(Math.floor(h(9) * 5) % 5, stitchMat(mv((h(5) - .5) * .12, (h(7) - .5) * .12, 0), f.X, f.Y, f.N, .22 + (h(1) - .5) * .3, p * 1.4 * (.9 + .2 * h(2)), prIn * (.9 + .2 * h(3)), .15 * (.8 + .4 * h(4))), [h(10), h(11), h(12), h(13)]);
            if (!LITE) holesIn.push(stitchMat(mv(.5, -.5, -.02), f.X, f.Y, f.N, 0, .11 * p, .11 * prIn, 1));
          });
        }
        inSet.build();
        const mkHoles = (arr, color) => {
          if (!arr.length) return;
          const hm = new T.MeshBasicMaterial({ color, side: T.DoubleSide }); store.plain.push(hm);
          const him = new T.InstancedMesh(new T.CircleGeometry(1, 8), hm, arr.length); arr.forEach((e, k) => { for (let q = 0; q < 16; q++) him.instanceMatrix.array[k * 16 + q] = e[q]; });
          him.castShadow = false; him.receiveShadow = false; g.add(him); store.geos.push(him.geometry); (store.inst = store.inst || []).push(him); store.tris = (store.tris || 0) + arr.length * 8;
        };
        mkHoles(holes, '#150a08'); mkHoles(holesIn, '#f2e8d6');
      }
      /* plateau de bouleau percé : dessus et dessous clairs, un trou par languette sur une courbe parallèle au contour (écart constant) */
      const foot = superRing(rf * c.sx, rf, c.n, N, 0), pitch = foot.per / N;
      const psh = new T.Shape(); superRing(rp * c.sx, rp, c.n, 260, 0).pts.forEach((q, i) => i ? psh.lineTo(q.x, q.z) : psh.moveTo(q.x, q.z));
      foot.pts.forEach(q => { const hp = new T.Path(); hp.absarc(q.x - q.nx * (c.ov + c.d), q.z - q.nz * (c.ov + c.d), c.hole, 0, Math.PI * 2, true); psh.holes.push(hp); });
      const plate = new T.ExtrudeGeometry(psh, { depth: PLATE_TOP - PLATE_BOT, bevelEnabled: false, curveSegments: 24 });
      plate.rotateX(Math.PI / 2); plate.translate(0, PLATE_TOP, 0);   /* le dessus est à PLATE_TOP, le dessous à PLATE_BOT */
      const edge = plain('#e6d6bc', .65, 0);                           /* tranche : crème pâle (pas d'orange), couverte par le ruban */
      const cap = plain('#dcb98f', .78, 0); cap.map = birchTexture(); cap.envMapIntensity = .5; cap.emissive = new T.Color('#5a4d3a'); cap.emissiveIntensity = .3;   /* bouleau mat : ne doit pas « brûler » dessus */
      const capLow = plain('#c4b9a4', .78, 0); capLow.map = birchTexture(); capLow.envMapIntensity = .5; capLow.emissive = new T.Color('#a89473'); capLow.emissiveIntensity = .4;   /* … ni virer au gris dessous (une lumière douce venue du dessous complète) */
      if (plate.groups.length === 2) { const g0 = plate.groups[0], half = g0.count / 2, g1 = plate.groups[1]; plate.clearGroups(); plate.addGroup(0, half, 0); plate.addGroup(half, half, 2); plate.addGroup(g1.start, g1.count, 1); }   /* 1re moitié des faces plates = dessus, 2e = dessous */
      add(plate, [cap, edge, capLow]);
      /* trous : disques noirs à mi-épaisseur (on voit la nuit sous la plaque, comme sur ses photos) */
      const hd = []; foot.pts.forEach(q => { const g = new T.CircleGeometry(c.hole * .98, 14); g.rotateX(Math.PI / 2); g.translate(q.x - q.nx * (c.ov + c.d), (PLATE_BOT + PLATE_TOP) / 2, q.z - q.nz * (c.ov + c.d)); hd.push(g); });
      const holeDark = plain('#2a1a08', .95, 0); holeDark.side = T.DoubleSide; add(mergeGeos(hd), holeDark).castShadow = false;
      /* languettes de ruban : une par trou ; le ruban sort du trou, passe sur le bord de la plaque puis rejoint le pied de la paroi (boucles arrondies, jointives) */
      const gvt = c.strand > 1, tabs = [], uw = Math.max(.08, 2 * c.hole * (gvt ? 1 : .95)), ho = gvt ? c.hole : 0, Ls = c.ov + c.d - ho + (gvt ? .015 : .02);
      foot.pts.forEach((q, i) => {
        const ang = Math.atan2(q.nx, q.nz) + c.skew + (hash(i, 5, 7) - .5) * .1, w = pitch * (gvt ? 1.0 : c.strand) * (.92 + .16 * hash(i, 4, 6));
        const b = new T.SphereGeometry(1, 10, 8); b.scale(w * .55, .06, .034);                     /* boucle : ellipsoïde aplati (ni dents rectangulaires, ni jour de plaque) */
        b.rotateX(.14 + (hash(i, 1, 2) - .5) * .1); b.translate(0, PLATE_BOT + .055, -.005); b.rotateY(ang); b.translate(q.x, 0, q.z); tabs.push(b);
        const u = new T.BoxGeometry(gvt ? uw : w, .022, Ls);                                        /* brin plat sous la plaque : part du bord du trou et dépasse à peine le bord */
        u.translate(0, PLATE_BOT - .011, -((c.ov + c.d - ho) - Ls / 2)); u.rotateY(ang); u.translate(q.x, 0, q.z); tabs.push(u);
      });
      add(mergeGeos(tabs), yarn(Object.assign({ dens, uv: false, disp: .01, tex: c.tex, warm: 1 }, gvt ? { crev: .8, cavLo: .5, cavDeep: 1, gain: 1.15 } : {})));
      /* bord : tresse plate (point d'écrevisse) en retrait (rond jaune) ou légèrement saillante (ovale), ou ruban doré / argenté */
      const yTop = c.H - c.rimR, ro = c.rad(1) + c.rimOff;
      const rimPts = superRing(ro * c.sx, ro, c.n, 200, 0).pts.map(q => new T.Vector3(q.x, yTop, q.z));
      const curve = new T.CatmullRomCurve3(rimPts, true), t = new T.TubeGeometry(curve, 420, metalRim ? c.rimTube * tn('bRimM', 1.5) : c.rimTube * tn('bRimP', 1.12), 12, true);
      tubeUV(t, Math.max(4, Math.round(curve.getLength() * dens / (metalRim ? 1 : 4) * (metalRim ? 1 : c.vs))), 1, metalRim ? .25 : 0); t.translate(0, -yTop, 0); t.scale(1, .8, 1); t.translate(0, yTop, 0);
      add(t, metalRim ? chainMatB(dens) : yarn({ dens, uv: true, tex: 'plait', disp: .02, crev: .78, cavLo: .46, cavDeep: 1, bump: 1.2, warm: 1 }));   /* tresse lisse : creux doux, fines lignes sombres */
      surf = basketSurface(c);
      store.ref = oval ? new T.Vector3(2 * 2.5 + .3, 1.9, 3.3) : new T.Vector3(3.3, 1.55, 3.3);
    } else if (type === 'strap') {
      /* Chaîne de téléphone : ruban plat tressé en V, boucle suspendue au téléphone par un anneau (cf. ses photos) */
      const half = [[0, 0], [-.24, .6], [-.68, 1.55], [-1.02, 2.65], [-1.12, 3.75], [-.84, 4.75], [0, 5.25]].map(v => new T.Vector3(v[0], v[1], 0));
      const loop = half.slice().concat(half.slice(0, -1).reverse().map(v => new T.Vector3(-v.x, v.y, 0)));
      const curve = new T.CatmullRomCurve3(loop), len = curve.getLength();
      /* Rr = 28 : la face avant fait exactement 1 V de large ; coutures en arrière ; les deux brins ont leur pointe de V vers le téléphone */
      const M = 420, Rr = 28, pos = [], uv = [], idx = [], Wb = .36, pb = .165;
      for (let i = 0; i <= M; i++) {
        const t = i / M, c = curve.getPoint(t), tg = curve.getTangent(t), nx = -tg.y, ny = tg.x, nl = Math.hypot(nx, ny) || 1;
        const tt = t > .5 ? 1 - t : t, e = ss(0, .30, tt * len);                 /* 0 au V (ruban serré), 1 dans la bande (les 0,30 derniers) */
        const w = Wb * (.44 + .56 * e), th = .11 * (.73 + .27 * e);
        const zoff = (t < .5 ? .06 : -.06) * (1 - ss(0, .10, tt));
        const sec = [], cum = [0];
        for (let j = 0; j <= Rr; j++) {
          const a = Math.PI * 1.5 + j / Rr * Math.PI * 2, ca = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), .45), sa = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), .45);
          sec.push([ca * w / 2, sa * th / 2]);
          if (j) cum.push(cum[j - 1] + Math.hypot(sec[j][0] - sec[j - 1][0], sec[j][1] - sec[j - 1][1]));
        }
        for (let j = 0; j <= Rr; j++) { pos.push(c.x + nx / nl * sec[j][0], c.y + ny / nl * sec[j][0], zoff + sec[j][1]); uv.push(.125 + (cum[j] - cum[Rr / 2]) / (4 * Wb), Math.abs(t - .5) * len / (8 * pb)); }
      }
      for (let i = 0; i < M; i++) for (let j = 0; j < Rr; j++) { const a = i * (Rr + 1) + j, b = a + Rr + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals();
      /* ton : abricot lumineux (crêtes ≈ couleur nominale), creux seulement un peu plus sombres, mat sans voile laiteux */
      const tone = { crev: .55, cavLo: .30, gain: 1.3, gam: 1.0, rough: .96, sheenK: .4, sheenTint: 1.25 };
      add(sg, yarn(Object.assign({ dens: 5.5, uv: true, tex: 'braid', bump: 1.5, disp: .035 }, tone))).receiveShadow = false;
      /* nœud serré qui cache le départ des deux brins, rosette de ruban froissé, deux queues plates sous le V */
      const ymat = yarn(Object.assign({ dens: 5.5, uv: true, tex: 'plait', disp: .02 }, tone));
      { const neck = new T.CylinderGeometry(.075, .09, .2, 18); neck.scale(1, 1, .9); neck.translate(0, -.05, 0);
        const nuv = neck.attributes.uv; for (let i = 0; i < nuv.count; i++) nuv.setY(i, nuv.getY(i) * 1.25);
        add(neck, ymat); }
      for (let k = 0; k < 4; k++) {
        const r = new T.TorusGeometry(.12, .05, 8, 26, Math.PI * 1.5); r.scale(1, 1, .3);
        const q = r.attributes.position; for (let i = 0; i < q.count; i++) q.setZ(i, q.getZ(i) + .012 * Math.sin(Math.atan2(q.getY(i), q.getX(i)) * 4 + k));
        r.computeVertexNormals(); r.rotateZ(k * 1.7 + .3); r.rotateY((k % 2 ? -1 : 1) * .3); r.translate(0, -.27, .005 * k); add(r, ymat);
      }
      { const kn = new T.SphereGeometry(.08, 16, 12); kn.scale(1, 1.05, .7); kn.translate(0, -.27, .03); add(kn, ymat); }
      const lmat = yarn(Object.assign({ dens: 5.5, uv: true, tex: 'plait', disp: .02 }, tone)); lmat.color.setScalar(1.12);
      [-1, 1].forEach(s => {
        const tl = new T.PlaneGeometry(.12, .30, 3, 12), p = tl.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), v = (p.getY(i) + .15) / .30; p.setZ(i, .02 * Math.sin(v * 6 + s) + .03 * (x / .06) * (x / .06)); }
        tl.computeVertexNormals(); tl.rotateZ(s * .28); tl.translate(s * .075, -.31, .05); add(tl, lmat);
      });
      const metal = plain('#cfd0d6', .28, .8);
      const ringG = new T.TorusGeometry(.127, .0175, 12, 40); ringG.translate(0, -.34, 0); add(ringG, metal);
      const dr = new T.TorusGeometry(.05, .012, 10, 24); dr.translate(0, -.54, 0); add(dr, metal);
      const tab = new T.BoxGeometry(.13, .22, .015); tab.translate(0, -.7, 0); add(tab, plain('#2b2a2e', .5, .1));
      /* téléphone suspendu la tête en bas : étui clair à liseré doré, anneau MagSafe blanc, module photo en bas à droite */
      const ph = slab(rrShape(.95, 1.85, .17), .1, .05); ph.translate(0, -2.65, 0); add(ph, plain('#bfb8ab', .2, .1));
      const rim = slab(rrShape(1.0, 1.9, .19), .08, .05); rim.translate(0, -2.675, 0); add(rim, plain('#d8c8a0', .3, .6));
      const mag = new T.TorusGeometry(.32, .03, 10, 48); mag.translate(0, -1.73, .105); add(mag, plain('#f3f0e8', .5, 0));
      const cap = slab(rrShape(.10, .26, .05), .02, .01); cap.translate(0, -1.35, .105); add(cap, plain('#f7f5ee', .5, 0));
      const mod = slab(rrShape(.50, .52, .10), .03, .015); mod.translate(.155, -2.61, .125); add(mod, plain('#b9ad96', .3, .4));
      [[.255, -2.46], [.255, -2.23], [.055, -2.345]].forEach(q => { const c = new T.CylinderGeometry(.075, .075, .05, 24); c.rotateX(Math.PI / 2); c.translate(q[0], q[1], .16); add(c, plain('#08080b', .15, .7)); });
      { const c = new T.CylinderGeometry(.025, .025, .05, 16); c.rotateX(Math.PI / 2); c.translate(.055, -2.52, .16); add(c, plain('#f3efe0', .3, .2)); }
    } else if (type === 'sleeve') {
      /* Pochette : tube plat sans couture, ouvert en haut ; l'ordinateur y est enfoncé (35 % couvert, 65 % visible) */
      const body = [[-1.32, 3.63], [-1.32, 2.7], [-1.325, 1.6], [-1.32, .7], [-1.32, .36], [-1.214, .105], [-.96, 0], [-.5, -.02], [0, -.03], [.5, -.02], [.96, 0], [1.214, .105], [1.32, .36], [1.32, .7], [1.325, 1.6], [1.32, 2.7], [1.32, 3.63],
        [1.256, 3.786], [1.10, 3.85], [.55, 3.865], [0, 3.84], [-.55, 3.865], [-1.10, 3.85], [-1.256, 3.786]];
      /* mat : fil foncé qui garde sa teinte dans les creux, pas de reflet ni de voile dans les creux */
      const o = { ef: y => .14 + .03 * ss(2.85, 3.85, y), Bf: () => .05, w: .45, step: .02, disp: .07, rim: .066, tex: 'sleeve', dens: 4.55, rowK: 1, shear: 0, crev: .25, bump: 1.6,
        mat: { gam: .95, deep: .3, occ: 1, spec: .5 } };
      pillow({ list: body, map: id2v }, 14, 16, null, o);
      /* ordinateur : couvercle alu champagne, léger dégradé, bord vif, emblème sombre poli (sans marque) tourné d'un quart de tour */
      const lap = slab(rrShape(2.365, 3.344, .13), .124, .02); lap.translate(0, 2.68, 0);
      { const ps = lap.attributes.position, cl = new Float32Array(ps.count * 3);
        for (let i = 0; i < ps.count; i++) cl[3 * i] = cl[3 * i + 1] = cl[3 * i + 2] = .97 + .06 * (ps.getY(i) - 2.68) / 3.344;
        lap.setAttribute('color', new T.BufferAttribute(cl, 3)); }
      const lm = new T.MeshPhysicalMaterial({ color: '#dccfc6', roughness: .38, metalness: .6, envMapIntensity: 1.35, vertexColors: true }); store.plain.push(lm); add(lap, lm);
      lap.computeBoundingBox(); const zf = lap.boundingBox.max.z;
      const lg = new T.ExtrudeGeometry(lidEmblem(), { depth: .004, bevelEnabled: false, curveSegments: 24 });
      lg.rotateZ(Math.PI / 2); lg.translate(0, 2.68 + 3.344 / 2, zf - .0015);
      const lgm = plain('#77736f', .15, 1); lgm.envMapIntensity = 1.6; add(lg, lgm).castShadow = false;
      store.yarnBox = [0, 3.85];
    }
    if (surf) decorate(finish, surf, U, store, g, type);
    return g;
  }

  const fractions = { bag: { duo: .33, contrast: .74 }, tote: { duo: .28, contrast: .74 }, basketRound: { duo: .69, contrast: .66 }, basketOval: { duo: .69, contrast: .66 }, sleeve: { duo: .3, contrast: .7 }, strap: {} };
  const modes = { solid: 0, mix: 1, duo: 2, contrast: 3 };

  /* ---------- Environnement de studio (reflets doux, éclat du fil) ---------- */
  function makeEnv(renderer) {
    try {
      const sc = new T.Scene();
      sc.add(new T.Mesh(new T.SphereGeometry(20, 48, 24), new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y * 0.5 + 0.5; vec3 top = vec3(1.0, 0.99, 0.97); vec3 bot = vec3(0.84, 0.81, 0.77) * 0.72; gl_FragColor = vec4(mix(bot, top, smoothstep(0.1, 0.9, h)), 1.0); }'
      })));
      const box = (w, h, x, y, z, i) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(i, i, i * .96), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
      box(10, 7, 8, 10, 8, 5); box(7, 10, -13, 4, 3, 3); box(11, 4, 0, 7, -14, 3.5);
      const pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(sc, .04); pm.dispose();
      return rt.texture;
    } catch (e) { return null; }
  }

  /* ---------- Création d'un visualiseur dans un conteneur ---------- */
  function create(container, label) {
    if (!supported()) return null;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const cv = renderer.domElement; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab';
    container.classList.add('v3d'); container.setAttribute('role', 'img'); container.setAttribute('tabindex', '0');
    container.setAttribute('aria-label', label || 'Aperçu en trois dimensions de la pièce. Faites-la tourner dans tous les sens à la souris, au doigt ou avec les flèches du clavier ; double-clic pour la remettre droite.');
    container.appendChild(cv);

    const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, .1, 100);
    const env = makeEnv(renderer); if (env) scene.environment = env;
    scene.add(new T.HemisphereLight(0xffffff, 0xd9d6d0, env ? .6 : 1.5));
    const key = new T.DirectionalLight(0xffffff, env ? 2.1 : 2.5); key.position.set(3.5, 7, 3.5); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 26 }); key.shadow.bias = -.0004; key.shadow.normalBias = .05; key.shadow.radius = 4;
    scene.add(key);
    const fill = new T.DirectionalLight(0xfff8f0, env ? .38 : .9); fill.position.set(-6, 3, 4); scene.add(fill);
    const rimL = new T.DirectionalLight(0xffffff, env ? .9 : .8); rimL.position.set(-3, 4, -6); scene.add(rimL);
    const under = new T.DirectionalLight(0xfff4e0, 0); under.position.set(1, -6, 3); scene.add(under);   /* lumière douce venue du dessous (paniers : fond de bois et ruban visibles en le retournant) */
    const ground = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: .12 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    /* ombre de contact douce sous la pièce */
    const cc = document.createElement('canvas'); cc.width = cc.height = 128; const cg = cc.getContext('2d'), gr = cg.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(48,32,22,.55)'); gr.addColorStop(.55, 'rgba(48,32,22,.2)'); gr.addColorStop(1, 'rgba(48,32,22,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 128, 128);
    const contact = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cc), transparent: true, depthWrite: false })); contact.rotation.x = -Math.PI / 2; contact.position.y = .004; scene.add(contact);
    const wob = new T.Group(); scene.add(wob);          /* léger balancement au repos */
    const pivot = new T.Group(); wob.add(pivot);        /* orientation libre, donnée par la main */

    const U = {
      uA: { value: new T.Color(CREAM) }, uB: { value: new T.Color(CREAM) }, uPA: { value: new T.Color(CREAM) }, uPB: { value: new T.Color(CREAM) },
      uMode: { value: 0 }, uPMode: { value: 0 }, uSplit: { value: 0 }, uPSplit: { value: 0 }, uFill: { value: 2 }, uYR: { value: new T.Vector2(0, 1) },
      uTime: { value: 0 }, uSway: { value: 0 }, uSoft: { value: 1 }, uInv: { value: new T.Matrix4() }, uHold: { value: new T.Matrix4() }
    };
    const cur = { type: null, finish: null, size: null, gauge: 'fin', store: null, holder: null, yr: [0, 1] };

    function disposeStore(s) { if (!s) return; (s.inst || []).forEach(m => m.dispose()); s.geos.forEach(g => g.dispose()); s.mats.forEach(m => { m.dispose(); }); s.plain.forEach(m => m.dispose()); }
    function rebuild(type, finish, size, gauge) {
      const keepQ = cur.holder && cur.type === type ? pivot.quaternion.clone() : null;   /* même pièce (autre taille, finition ou fil) : on garde l'orientation donnée par la main */
      if (cur.holder) { pivot.remove(cur.holder); disposeStore(cur.store); }
      const store = { geos: [], mats: [], plain: [] };
      const tb0 = performance.now(), holder = new T.Group(); holder.add(buildPiece(type, finish, size, U, store, gauge)); cur.buildMs = performance.now() - tb0;
      pivot.position.set(0, 0, 0); pivot.quaternion.identity(); if (keepQ) pivot.quaternion.copy(keepQ); wob.rotation.set(0, 0, 0); pivot.add(holder); holder.position.set(0, 0, 0);
      scene.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(holder), c = box.getCenter(new T.Vector3()), size3 = box.getSize(new T.Vector3());
      holder.position.copy(c).negate();                  /* la pièce tourne autour de son centre */
      pivot.position.set(0, size3.y / 2, 0);             /* et repose sur le sol au départ */
      const yb = store.yarnBox || [box.min.y, box.max.y];  /* le remplissage suit le fil seul (pas l'ordinateur de la pochette) */
      Object.assign(cur, { type, finish, size, gauge, store, holder, yr: [yb[0], yb[1]] });
      U.uYR.value.set(yb[0], yb[1]);                     /* coordonnées de la pièce : le remplissage la suit quand elle tourne */
      U.uSoft.value = ({ bag: 1e-4, strap: .9, tote: .5, basketRound: .3, basketOval: .3, sleeve: .3 })[type] || .5;
      under.intensity = (type === 'basketRound' || type === 'basketOval') ? (env ? 1.0 : 1.2) : (type === 'bag' ? .6 : 0);   /* le fond du sac (plaque blanche, rivets) profite aussi d'un peu de lumière */
      { /* ombres portées des mailles : volume d'ombre resserré sur le panier et biais fin (les mailles font quelques centièmes d'épaisseur) */
        const bk = type === 'basketRound' || type === 'basketOval' || type === 'bag', hs = bk ? size3.length() / 2 + .5 : 7, sc = key.shadow.camera;
        sc.left = -hs; sc.right = hs; sc.top = hs; sc.bottom = -hs; sc.updateProjectionMatrix();
        key.shadow.bias = bk ? -.0005 : -.0004; key.shadow.normalBias = bk ? .012 : .05;
        if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
      }
      ground.position.y = -.002; ground.visible = type !== 'strap' && type !== 'sleeve';   /* pochette : pas de grande ombre portée de l'ordinateur, seulement l'ombre de contact douce */
      /* cadrage : on garde la taille de référence (la plus grande) pour que S, M, L se voient de leur vraie taille relative */
      const ref = store.ref || size3, R = ref.length() / 2, cy = ref.y / 2;
      contact.visible = type !== 'strap'; contact.scale.set(size3.x * 1.5, size3.z * 1.5 + 1.1, 1);
      const dist = R / Math.sin(T.MathUtils.degToRad(camera.fov / 2)) * (type === 'strap' ? 1.1 : 1.0);
      const lift = (type === 'basketRound' || type === 'basketOval') ? tn('bLift', 1.0) : type === 'bag' || type === 'tote' ? .22 : .3;
      camera.position.set(0, cy + R * lift, dist); camera.lookAt(0, cy - R * .08, 0);
      /* une nouvelle pièce repart du fil écru : la couleur la remplira ensuite */
      U.uA.value.set(CREAM); U.uB.value.set(CREAM); U.uPA.value.set(CREAM); U.uPB.value.set(CREAM);
      U.uMode.value = 0; U.uPMode.value = 0; U.uSplit.value = 0; U.uPSplit.value = 0; U.uFill.value = 2;
      resize();
    }

    function hexOf(id) { const c = window.MPC_COLOR[id]; return c ? c.hex : null; }
    function applyColors(o) {
      const a = hexOf(o.c1), b = hexOf(o.c2) || a;
      let assoc = o.c2 ? (o.assoc || 'mix') : 'solid';
      if (cur.type === 'strap' && (assoc === 'duo' || assoc === 'contrast')) assoc = 'mix';
      /* l'état courant devient l'état précédent */
      U.uPA.value.copy(U.uA.value); U.uPB.value.copy(U.uB.value); U.uPMode.value = U.uMode.value; U.uPSplit.value = U.uSplit.value;
      const empty = !a;
      U.uA.value.set(a || CREAM); U.uB.value.set(b || a || CREAM);
      U.uMode.value = modes[assoc] || 0;
      const fr = (fractions[cur.type] || {})[assoc];
      U.uSplit.value = cur.yr[0] + (fr || 0) * (cur.yr[1] - cur.yr[0]);
      const metal = [o.c1, o.c2].some(id => id && window.MPC_COLOR[id] && window.MPC_COLOR[id].metal);
      cur.store.mats.forEach(m => {
        const tn = m.userData.tone || {};
        m.metalness = metal ? .5 : 0; m.roughness = metal ? .4 : (tn.rough || .86); m.sheen = metal ? .3 : (tn.sheen === undefined ? .4 : tn.sheen);
        m.envMapIntensity = metal ? .55 : (tn.env === undefined ? .55 : tn.env);
        if (!metal && tn.tint) m.sheenColor.copy(U.uA.value).multiplyScalar(tn.tint); else if (!metal && tn.sheenCol) m.sheenColor.set(tn.sheenCol); else m.sheenColor.set('#f2f2f2');
      });
      if (empty) { U.uFill.value = 2; return; }
      if (reduce || !window.gsap) { U.uFill.value = 2; return; }
      U.uFill.value = -.1;
      window.gsap.to(U.uFill, { value: 1.12, duration: 1.5, ease: 'power2.inOut', overwrite: true });
    }

    function setPiece(type, o) {
      o = o || {};
      const fin = o.finish || 'aucune', size = o.size || 'M';
      /* sac bicolore « mélange » : gros fil double, mailles bien plus grosses (cf. sa photo bleu / blanc) */
      const gauge = (type === 'bag' && o.c2 && (o.assoc || 'mix') === 'mix') ? 'gros' : 'fin';
      if (type !== cur.type || fin !== cur.finish || gauge !== cur.gauge || ((type === 'basketRound' || type === 'basketOval') && size !== cur.size)) rebuild(type, fin, size, gauge);
      applyColors(o);
    }

    /* ---------- Orientation libre (souris, doigt, clavier), inertie, souplesse ---------- */
    const AX = new T.Vector3(1, 0, 0), AY = new T.Vector3(0, 1, 0), qa = new T.Quaternion(), qb = new T.Quaternion(), ID = new T.Quaternion();
    const spin = (a, b) => { qa.setFromAxisAngle(AY, a); qb.setFromAxisAngle(AX, b); pivot.quaternion.premultiply(qa).premultiply(qb); };
    let drag = false, lx = 0, ly = 0, vx = 0, vy = 0, resetting = false, autoAmt = 1, sway = 0, swayVel = 0, lastT = performance.now(), raf = 0, visible = false;
    const t0 = performance.now();
    cv.addEventListener('pointerdown', e => { drag = true; resetting = false; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; container.focus({ preventScroll: true }); });
    cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; spin(dx * .011, dy * .011); vx = dx * .011; vy = dy * .011; });
    const end = () => { drag = false; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => { resetting = true; vx = vy = 0; });
    container.addEventListener('keydown', e => {
      const s = .22;
      if (e.key === 'ArrowLeft') { spin(-s, 0); vx = -.02; } else if (e.key === 'ArrowRight') { spin(s, 0); vx = .02; }
      else if (e.key === 'ArrowUp') spin(0, -s); else if (e.key === 'ArrowDown') spin(0, s);
      else if (e.key === 'Escape' || e.key === '0') resetting = true; else return;
      e.preventDefault();
    });
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - lastT) / 1000 || .016); lastT = now; const t = (now - t0) / 1000;
      if (drag) { vx *= .85; vy *= .85; } else { vx *= .94; vy *= .94; if (Math.abs(vx) + Math.abs(vy) > 1e-4) spin(vx, vy); }
      if (resetting) { pivot.quaternion.slerp(ID, .1); if (pivot.quaternion.angleTo(ID) < .002) { pivot.quaternion.copy(ID); resetting = false; } }
      autoAmt += ((drag || reduce ? 0 : 1) - autoAmt) * .03;
      wob.rotation.y = Math.sin(t * .65) * .2 * autoAmt; wob.rotation.x = Math.sin(t * .5) * .04 * autoAmt;
      /* ressort : le haut de la pièce retarde sur la main puis rebondit, comme du fil souple */
      swayVel += (-55 * sway - 5 * swayVel - vx * 60) * dt; sway = Math.max(-.7, Math.min(.7, sway + swayVel * dt));
      U.uSway.value = reduce ? 0 : sway * .5 + Math.sin(t * 1.05) * .02;
      U.uTime.value = reduce ? 0 : t;
      scene.updateMatrixWorld(true);
      if (cur.holder) { U.uHold.value.copy(cur.holder.matrixWorld); U.uInv.value.copy(cur.holder.matrixWorld).invert(); }
      renderer.render(scene, camera);
    }
    function resize() {
      const w = container.clientWidth || 300, h = container.clientHeight || 300;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.render(scene, camera);
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(container); else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); else if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; } }).observe(container);
    else raf = requestAnimationFrame(frame);

    /* stats() : triangles et temps de construction de la dernière pièce (outil de test, sans effet sur l'API publique) */
    const stats = () => { let tri = 0, meshes = 0; scene.traverse(o => { if (o.isMesh && o !== ground && o !== contact) { const g = o.geometry; tri += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); meshes++; } }); return { tris: Math.round(tri), meshes, buildMs: Math.round(cur.buildMs || 0) }; };
    return { setPiece, resize, el: container, canvas: cv, camera, render: () => renderer.render(scene, camera), stats };
  }

  window.MPC3D = { supported, create, tune: TUNE };
})();











