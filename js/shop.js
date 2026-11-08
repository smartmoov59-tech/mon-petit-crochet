/* ==========================================================================
   BOUTIQUE : cartes produits, configurateur, panier, commande, SumUp, demande personnalisée
   Site 100 % statique : aucun serveur, aucun abonnement. La commande est préparée ici puis
   envoyée à Oriana (Instagram / SMS / e-mail) ; le règlement se fait par lien SumUp.
   ========================================================================== */
(function () {
  'use strict';
  const CFG = window.MPC_CONFIG, COLORS = window.MPC_COLORS, COLOR = window.MPC_COLOR;
  const PRODUCTS = window.MPC_PRODUCTS, FINISHES = window.MPC_FINISHES;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) + ' €';
  const byId = id => PRODUCTS.find(p => p.id === id);

  /* ---------- Couleurs : style d'une pastille ---------- */
  function swatchBg(id) {
    const c = COLOR[id];
    if (!c) return '#ccc';
    if (c.id === 'dore') return 'linear-gradient(135deg,#f3e2b3 0%,#c9ab6e 35%,#f6ebc8 55%,#a98a4e 100%)';
    if (c.id === 'argente') return 'linear-gradient(135deg,#f4f4f6 0%,#b9b9bc 35%,#ffffff 55%,#8e8e93 100%)';
    return c.hex;
  }
  const mixHex = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

  /* ---------- Verrouillage du scroll (modale / panier) ---------- */
  let lockCount = 0;
  function lock() { if (lockCount++ === 0) { document.documentElement.style.overflow = 'hidden'; window.__lenis && window.__lenis.stop(); } }
  function unlock() { if (--lockCount <= 0) { lockCount = 0; document.documentElement.style.overflow = ''; window.__lenis && window.__lenis.start(); } }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('is-on'), 3200);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} ta.remove(); return ok;
    }
  }

  /* ---------- Tarification ---------- */
  function modelOf(p, id) { return p.models.find(m => m.id === id) || p.models[0]; }
  function finishPaid(fid) { const f = FINISHES.find(x => x.id === fid); return !!(f && f.paid); }
  function unitPrice(p, sel) {
    const m = modelOf(p, sel.model);
    let base = m.price || 0;
    if (p.sizes) { const s = p.sizes.find(x => x.id === sel.size) || p.sizes[0]; base = s.price; }
    return base + (finishPaid(sel.finish) ? CFG.finishSurcharge : 0);
  }
  function fromPrice(p) {
    if (p.quote) return null;
    const prices = [];
    if (p.sizes) p.sizes.forEach(s => prices.push(s.price)); else p.models.forEach(m => prices.push(m.price));
    return Math.min(...prices);
  }
  const hasFinish = p => p.type !== 'strap' && !p.quote;

  /* ---------- Panier (localStorage) ---------- */
  const KEY = 'mpc-cart-v1';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { cart = []; }
  const saveCart = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
  const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = () => cart.reduce((n, l) => n + l.unit * l.qty, 0);

  function refreshBadges() {
    const n = cartCount();
    $('#cartCount').textContent = n;
    $('#fabText').textContent = n ? `Panier · ${n} · ${money(cartTotal())}` : 'Panier';
    $('#fab').classList.toggle('is-on', n > 0 && window.innerWidth < 900);
    window.dispatchEvent(new CustomEvent('mpc:cart', { detail: { n } }));
  }

  /* ---------- Grille produits ---------- */
  function renderFilters() {
    const box = $('#filters');
    box.innerHTML = window.MPC_FILTERS.map((f, i) => `<button class="chip-btn" type="button" data-f="${f.id}" aria-pressed="${i === 0}">${esc(f.name)}</button>`).join('');
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      $$('[data-f]', box).forEach(x => x.setAttribute('aria-pressed', x === b));
      const f = b.dataset.f;
      $$('.card').forEach(c => { c.hidden = !(f === 'all' || c.dataset.cat === f); });
      window.dispatchEvent(new Event('mpc:layout'));
    });
  }

  function cardHTML(p) {
    const from = fromPrice(p);
    const c0 = p.defaultColors[0], g0 = p.photosByColor[c0];
    const dots = p.defaultColors.map((c, i) => `<button class="dot" type="button" data-color="${c}" aria-pressed="${i === 0}" aria-label="Aperçu en ${esc(COLOR[c].name)}" title="${esc(COLOR[c].name)}" style="background:${swatchBg(c)}"></button>`).join('');
    const sizes = p.sizes ? `<div class="card__sizes" role="group" aria-label="Taille, ${esc(p.name)}">${p.sizes.map((z, i) => `<button type="button" class="csize" data-csize="${z.id}" aria-pressed="${i === 0}">${esc(z.id)}<small>${money(z.price)}</small></button>`).join('')}</div>` : '';
    const cta = p.quote
      ? `<button type="button" class="btn btn--fill magnetic" data-open="${p.id}"><span>Demander un devis</span></button>`
      : `<button type="button" class="btn btn--fill magnetic" data-add="${p.id}"><span>Ajouter au panier</span></button><button type="button" class="btn btn--ghost btn--more" data-open="${p.id}"><span>Plus de détails</span></button>`;
    return `<article class="card${g0 ? ' is-gen' : ''}" data-id="${p.id}" data-cat="${p.cat}" data-pick="${c0}"${p.sizes ? ` data-psize="${p.sizes[0].id}"` : ''}>
      <div class="card__media">
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
        <img class="card__photo" src="${g0 ? 'assets/img/' + g0 + '.jpg' : p.photo}" alt="${esc(p.photoAlt)}" loading="lazy" width="720" height="900" decoding="async">
        <div class="card__svg" aria-hidden="true"></div>
      </div>
      <div class="card__body">
        <div class="card__row"><h3>${esc(p.name)}</h3><span class="price">${from ? (p.sizes ? money(p.sizes[0].price) : 'dès ' + money(from)) : 'Sur devis'}</span></div>
        <p class="card__tag">${esc(p.tagline)}</p>
        <div class="dots" role="group" aria-label="Aperçu des couleurs, ${esc(p.name)}">${dots}<button class="dot dot--more" type="button" data-more aria-label="Voir les ${COLORS.length} coloris">+${COLORS.length - p.defaultColors.length}</button></div>
        ${sizes}
        <div class="card__cta">${cta}</div>
      </div>
    </article>`;
  }

  function renderGrid() {
    const grid = $('#productGrid');
    grid.innerHTML = PRODUCTS.map(cardHTML).join('');
    grid.addEventListener('click', e => {
      const card = e.target.closest('.card'); if (!card) return;
      const p = byId(card.dataset.id);
      const dot = e.target.closest('.dot[data-color]');
      if (dot) { showCardColor(card, p, dot.dataset.color); return; }
      const cs = e.target.closest('[data-csize]');
      if (cs) {
        card.dataset.psize = cs.dataset.csize;
        $$('[data-csize]', card).forEach(b => b.setAttribute('aria-pressed', b === cs));
        $('.price', card).textContent = money(p.sizes.find(z => z.id === cs.dataset.csize).price);
        return;
      }
      if (e.target.closest('[data-add]')) { quickAdd(p, card); return; }
      if (e.target.closest('[data-more]') || e.target.closest('[data-open]')) openProduct(p.id, card.dataset.pick, card.dataset.psize);
    });
  }

  /* « Ajouter au panier » depuis la carte : coloris et taille choisis sur la carte, modèle simple (1 couleur) */
  function quickAdd(p, card) {
    const sel = { model: p.models[0].id, size: p.sizes ? (card.dataset.psize || p.sizes[0].id) : null, colors: [card.dataset.pick || p.defaultColors[0]], finish: 'aucune', qty: 1 };
    pushLine(p, sel);
    const d = describe(p, sel);
    toast(`Ajouté : ${p.name}${d.size ? ' · ' + d.size : ''} · ${d.colors[0]}`);
    const b = $('[data-add]', card); if (b) { b.classList.add('is-added'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('is-added'), 1400); }
  }

  function showCardColor(card, p, cid) {
    const photo = p.photosByColor[cid];
    const img = $('.card__photo', card), svg = $('.card__svg', card);
    $$('.dot[data-color]', card).forEach(d => d.setAttribute('aria-pressed', d.dataset.color === cid));
    card.dataset.pick = cid;
    if (photo) { img.src = 'assets/img/' + photo + '.jpg'; card.classList.remove('is-preview'); card.classList.toggle('is-gen', photo.startsWith('gen/')); }
    else { openProduct(p.id, cid); }   /* pas de photo dans ce coloris : le configurateur 3D recolore la vraie pièce */
  }

  /* ---------- Configurateur ---------- */
  const M = { el: null, p: null, sel: null, last: null };
  function defaultSel(p, pre, preSize) {
    const m = p.models[0];
    const size = p.sizes ? (p.sizes.find(z => z.id === preSize) || p.sizes[0]).id : null;
    return { model: m ? m.id : null, size, colors: [pre || p.defaultColors[0], null], finish: 'aucune', qty: 1 };
  }

  function openProduct(id, preColor, preSize) {
    const p = byId(id);
    if (p.quote) { goCustom(p, preColor); return; }
    M.p = p; M.sel = defaultSel(p, preColor, preSize); M.last = document.activeElement;
    const el = M.el = $('#modal');
    $('#mBadge').textContent = p.badge || 'Fait main';
    $('#mTitle').textContent = p.name;
    $('#mDesc').textContent = p.desc;
    $('#mThumbs').innerHTML = [`<button class="thumb" type="button" data-thumb="svg" aria-pressed="true" aria-label="Aperçu de mes couleurs"><span style="display:grid;place-items:center;width:100%;height:100%;background:var(--ivory);font-size:.7rem;font-weight:600;text-align:center;line-height:1.1">Mes<br>couleurs</span></button>`]
      .concat(p.gallery.map((g, i) => `<button class="thumb" type="button" data-thumb="${g}" aria-pressed="false" aria-label="Photo réalisée ${i + 1}"><img src="${g}" alt="" loading="lazy"></button>`)).join('');
    $('#mThumbs .thumb').insertAdjacentHTML('afterend', '<button class="thumb thumb--color" type="button" data-thumb="colorphoto" aria-pressed="false" aria-label="Photo de ce coloris" hidden><img src="" alt="" loading="lazy"></button>');
    buildOptions();
    refreshModal();
    el.hidden = false; lock();
    requestAnimationFrame(() => el.classList.add('is-open'));
    setTimeout(() => $('.modal__close', el).focus(), 60);
  }

  function closeModal() {
    const el = $('#modal'); if (el.hidden) return;
    el.classList.remove('is-open');
    setTimeout(() => { el.hidden = true; unlock(); M.last && M.last.focus && M.last.focus(); }, 450);
  }

  function buildOptions() {
    const p = M.p, s = M.sel, box = $('#mOptions'); let h = '', hc = '';
    if (p.models.length > 1) {
      h += `<div class="opt"><div class="opt__title">Modèle</div><div class="pills" role="group" aria-label="Modèle">` +
        p.models.map(m => `<button type="button" class="pill" data-model="${m.id}" aria-pressed="${m.id === s.model}"><b>${esc(m.name)}</b><small>${esc(m.sub)}${m.price && !p.sizes ? ' · ' + money(m.price) : ''}</small></button>`).join('') + `</div></div>`;
    }
    if (p.sizes) {
      /* silhouettes à l'échelle (même échelle pour toutes les tailles) : on voit tout de suite laquelle est la plus grande */
      const maxW = Math.max(...p.sizes.map(z => z.shape[0])), maxH = Math.max(...p.sizes.map(z => z.shape[1]));
      const k = Math.min(104 / maxW, 58 / maxH), round = p.type === 'basketRound';
      const shape = z => { const w = z.shape[0] * k, h = z.shape[1] * k; return round ? `<ellipse class="sh" cx="60" cy="32" rx="${(w / 2).toFixed(1)}" ry="${(h / 2).toFixed(1)}"/>` : `<rect class="sh" x="${(60 - w / 2).toFixed(1)}" y="${(32 - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(h / 2).toFixed(1)}"/>`; };
      h += `<div class="opt"><div class="opt__title">Taille<em>dessins à l’échelle</em></div><div class="sizes" role="group" aria-label="Taille">` +
        p.sizes.map(z => `<button type="button" class="size" data-size="${z.id}" aria-pressed="${z.id === s.size}" aria-label="${esc(z.name)}, ${money(z.price)}"><svg viewBox="0 0 120 64" aria-hidden="true">${shape(z)}</svg><b>${esc(z.id)}</b><span>${money(z.price)}</span>${z.cm ? `<small>${esc(z.cm)}</small>` : ''}</button>`).join('') + `</div><p class="sizes__note">Plus la lettre est grande, plus le ${round ? 'panier est large' : 'panier est long'}. Les trois tailles sont dessinées à la même échelle.</p></div>`;
    }
    const m = modelOf(p, s.model);
    /* les couleurs vivent sous l'aperçu 3D (colonne de gauche) : on choisit et on voit la pièce changer sans défiler */
    for (let i = 0; i < m.colors; i++) {
      hc += `<div class="opt"><div class="opt__title">${esc(m.labels[i] || 'Couleur')}<em data-cname="${i}"></em></div>
        <div class="swatch-grid" role="group" aria-label="${esc(m.labels[i] || 'Couleur')}" data-slot="${i}">` +
        COLORS.map(c => `<button type="button" class="swatch" data-c="${c.id}" aria-pressed="${s.colors[i] === c.id}" aria-label="${esc(c.name)}" title="${esc(c.name)}" style="background:${swatchBg(c.id)}"></button>`).join('') +
        `</div></div>`;
    }
    $('#mColors').innerHTML = hc;
    if (hasFinish(p)) {
      const list = m.forceFinish ? FINISHES.filter(f => m.forceFinish.includes(f.id)) : FINISHES;
      if (m.forceFinish && !m.forceFinish.includes(s.finish)) s.finish = m.forceFinish[0];
      h += `<div class="opt"><div class="opt__title">Détails décoratifs<em>+${money(CFG.finishSurcharge)}</em></div><div class="pills pills--row" role="group" aria-label="Finition">` +
        list.map(f => `<button type="button" class="pill" data-finish="${f.id}" aria-pressed="${f.id === s.finish}"><b>${esc(f.name)}</b></button>`).join('') + `</div></div>`;
    }
    h += `<p class="small" style="margin-top:0">Coloris selon arrivage : je le confirme avant de commencer. Les photos « Mes pièces déjà réalisées » sont sous l’aperçu.</p>`;
    box.innerHTML = h;
  }

  function refreshModal() {
    const p = M.p, s = M.sel, m = modelOf(p, s.model);
    $$('[data-cname]').forEach(el => {
      const i = +el.dataset.cname, c = COLOR[s.colors[i]];
      el.innerHTML = c ? `<b>${esc(c.name)}</b>` : 'Choisissez une couleur';
    });
    $$('.swatch-grid').forEach(g => $$('.swatch', g).forEach(b => b.setAttribute('aria-pressed', b.dataset.c === s.colors[+g.dataset.slot])));
    /* photo réelle (générée à partir de la sienne) dans le coloris choisi, pour les modèles à une couleur */
    const cph = $('[data-thumb="colorphoto"]'), photoKey = m.colors === 1 && p.photosByColor[s.colors[0]];
    if (cph) {
      cph.hidden = !photoKey;
      if (photoKey) { const src = 'assets/img/' + photoKey + '.jpg'; $('img', cph).src = src; cph.dataset.src = src; }
      else if (cph.getAttribute('aria-pressed') === 'true') { cph.setAttribute('aria-pressed', 'false'); }
    }
    const active = $('.thumb[aria-pressed="true"]');
    if (active && active.dataset.thumb === 'colorphoto' && photoKey) $('#mPreview').innerHTML = `<img src="assets/img/${photoKey}.jpg" alt="Photo du modèle dans ce coloris">`;
    else if (!active || active.dataset.thumb === 'svg' || active.dataset.thumb === 'colorphoto') { if (active && active.dataset.thumb === 'colorphoto') setThumbSvg(); else showSvgPreview(); }
    const price = unitPrice(p, s), total = price * s.qty;
    $('#mTotal').textContent = money(total);
    $('#qVal').textContent = s.qty;
    $('#mAdd').disabled = !s.colors.slice(0, m.colors).every(Boolean);
  }

  /* Aperçu vivant : pièce en 3D qui se remplit de couleur (repli SVG si WebGL indisponible) */
  const vtype = p => (p.id === 'cabas' ? 'tote' : p.type);
  function viewerOpts(p, s, m) {
    const c1 = s.colors[0], c2 = m.colors > 1 ? (s.colors[1] || s.colors[0]) : null;
    let assoc = 'solid';
    if (c2) {
      if (p.type === 'bag') assoc = ({ m2: 'mix', m3: 'duo', m4: 'contrast' })[s.model] || 'mix';
      else if (p.type === 'strap') assoc = 'mix';
      else assoc = ({ m3: 'mix', m4: 'duo' })[s.model] || 'mix';
    }
    return { c1, c2, assoc, finish: s.finish, size: s.size };
  }
  let modalViewer = null, modalBox = null;
  function showSvgPreview() {
    const p = M.p, s = M.sel, m = modelOf(p, s.model);
    const box = $('#mPreview');
    if (modalViewer === null) {
      modalBox = document.createElement('div'); modalBox.className = 'preview__3d';
      modalViewer = (window.MPC3D && window.MPC3D.create(modalBox, 'Aperçu en trois dimensions de votre pièce. Flèches gauche et droite pour la faire tourner.')) || false;
    }
    if (modalViewer) {
      if (modalBox.parentNode !== box) { box.innerHTML = ''; box.appendChild(modalBox); }
      modalViewer.setPiece(vtype(p), viewerOpts(p, s, m)); modalViewer.resize();
    } else {
      box.innerHTML = window.mpcPreview(p.type, { c1: s.colors[0], c2: m.colors > 1 ? s.colors[1] || s.colors[0] : null, model: s.model, finish: s.finish });
    }
  }

  function bindModal() {
    const modal = $('#modal');
    modal.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { closeModal(); return; }
      const p = M.p, s = M.sel; if (!p) return;
      const model = e.target.closest('[data-model]'), size = e.target.closest('[data-size]'), sw = e.target.closest('.swatch'), fin = e.target.closest('[data-finish]'), th = e.target.closest('[data-thumb]');
      if (model) { s.model = model.dataset.model; const m = modelOf(p, s.model); if (m.colors > 1 && !s.colors[1]) s.colors[1] = p.defaultColors[1]; buildOptions(); setThumbSvg(); }
      else if (size) { s.size = size.dataset.size; $$('[data-size]').forEach(b => b.setAttribute('aria-pressed', b === size)); setThumbSvg(); }
      else if (sw) { const slot = +sw.closest('.swatch-grid').dataset.slot; s.colors[slot] = sw.dataset.c; setThumbSvg(); }
      else if (fin) { s.finish = fin.dataset.finish; $$('[data-finish]').forEach(b => b.setAttribute('aria-pressed', b === fin)); setThumbSvg(); }
      else if (th) {
        $$('.thumb').forEach(b => b.setAttribute('aria-pressed', b === th));
        if (th.dataset.thumb === 'svg') showSvgPreview();
        else if (th.dataset.thumb === 'colorphoto') $('#mPreview').innerHTML = `<img src="${th.dataset.src}" alt="Photo du modèle dans ce coloris">`;
        else $('#mPreview').innerHTML = `<img src="${th.dataset.thumb}" alt="Pièce que j’ai réalisée">`;
      }
      refreshModal();
    });
    $('#qMinus').addEventListener('click', () => { if (M.sel.qty > 1) { M.sel.qty--; refreshModal(); } });
    $('#qPlus').addEventListener('click', () => { if (M.sel.qty < 20) { M.sel.qty++; refreshModal(); } });
    $('#mAdd').addEventListener('click', addToCart);
  }
  function setThumbSvg() { $$('.thumb').forEach(b => b.setAttribute('aria-pressed', b.dataset.thumb === 'svg')); showSvgPreview(); }

  function describe(p, s) {
    const m = modelOf(p, s.model);
    const colors = s.colors.slice(0, m.colors).filter(Boolean).map(id => COLOR[id].name);
    const size = p.sizes ? (p.sizes.find(z => z.id === s.size) || p.sizes[0]).name : '';
    const fin = FINISHES.find(f => f.id === s.finish);
    return { model: m.name, size, colors, finish: fin && fin.id !== 'aucune' ? fin.name : '' };
  }

  function pushLine(p, s) {
    const m = modelOf(p, s.model);
    const colors = s.colors.slice(0, m.colors);
    const key = [p.id, s.model, s.size, colors.join('+'), s.finish].join('|');
    const unit = unitPrice(p, s);
    const found = cart.find(l => l.key === key);
    if (found) found.qty += s.qty;
    else cart.push({ key, pid: p.id, model: s.model, size: s.size, colors, finish: s.finish, qty: s.qty, unit });
    saveCart(); refreshBadges();
  }

  function addToCart() {
    const p = M.p, s = M.sel;
    pushLine(p, s);
    closeModal();
    setTimeout(() => openDrawer('cart'), 380);
    toast('Ajouté au panier');
  }

  /* ---------- Panier / commande ---------- */
  let view = 'cart', order = null, lastFocus = null;
  function openDrawer(v) {
    view = v || 'cart'; lastFocus = document.activeElement;
    const d = $('#drawer'); renderDrawer(); d.hidden = false; lock();
    requestAnimationFrame(() => d.classList.add('is-open'));
    setTimeout(() => $('.drawer__head .modal__close').focus(), 60);
  }
  function closeDrawer() {
    const d = $('#drawer'); if (d.hidden) return;
    d.classList.remove('is-open');
    setTimeout(() => { d.hidden = true; unlock(); lastFocus && lastFocus.focus && lastFocus.focus(); }, 650);
  }

  function lineThumb(l) {
    const p = byId(l.pid);
    const photo = l.colors.length === 1 && p.photosByColor[l.colors[0]];
    if (photo) return `<img src="assets/img/${photo}.jpg" alt="" loading="lazy">`;
    return `<img src="${p.photo}" alt="" loading="lazy">`;
  }

  function lineHTML(l, i) {
    const p = byId(l.pid), d = describe(p, { model: l.model, size: l.size, colors: l.colors, finish: l.finish });
    const chips = l.colors.map(c => `<i style="background:${swatchBg(c)}"></i>`).join('');
    return `<div class="oline" data-i="${i}">
      <div class="oline__img">${lineThumb(l)}</div>
      <div>
        <h3>${esc(p.name)}</h3>
        <p class="oline__meta">${esc(d.model)}${d.size ? ' · ' + esc(d.size) : ''}</p>
        <p class="oline__meta"><span class="oline__chips">${chips}</span>${esc(d.colors.join(' + '))}${d.finish ? ' · ' + esc(d.finish) : ''}</p>
        <div class="oline__row">
          <div class="qty qty--sm" role="group" aria-label="Quantité"><button type="button" data-dec aria-label="Moins">−</button><output>${l.qty}</output><button type="button" data-inc aria-label="Plus">+</button></div>
          <strong>${money(l.unit * l.qty)}</strong>
        </div>
        <button type="button" class="rm" data-rm>Retirer</button>
      </div>
    </div>`;
  }

  function summaryHTML() {
    return `<div class="sum"><div><span>Sous-total (${cartCount()} article${cartCount() > 1 ? 's' : ''})</span><span>${money(cartTotal())}</span></div>
      <div><span>Livraison</span><span>à confirmer</span></div>
      <div class="big"><span>Total</span><span>${money(cartTotal())}</span></div></div>`;
  }

  function sumupLink(total) {
    const links = (CFG.sumup && CFG.sumup.links) || {};
    for (const k of Object.keys(links)) if (Math.abs(Number(String(k).replace(',', '.')) - total) < 0.005 && links[k]) return links[k];
    return '';
  }

  function orderRef() {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    return `MPC-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function orderText(o) {
    const lines = o.lines.map(l => {
      const p = byId(l.pid), d = describe(p, l);
      return `• ${l.qty} × ${p.name} : ${d.model}${d.size ? ', ' + d.size : ''}, couleur${d.colors.length > 1 ? 's' : ''} ${d.colors.join(' + ')}${d.finish ? ', ' + d.finish + ' (+' + money(CFG.finishSurcharge) + ')' : ''} → ${money(l.unit * l.qty)}`;
    }).join('\n');
    const modes = { livraison: 'Livraison', main: 'Remise en main propre', ensemble: 'À convenir ensemble' };
    return `Bonjour Oriana, voici ma commande ${o.ref} :\n\n${lines}\n\nTotal : ${money(o.total)}\nMode de remise : ${modes[o.mode] || ''}${o.mode === 'livraison' && o.address ? '\nAdresse : ' + o.address : ''}\n\nPrénom / nom : ${o.first} ${o.last}\nContact : ${o.phone}${o.email ? ' · ' + o.email : ''}${o.note ? '\nMessage : ' + o.note : ''}\n\nMerci de me confirmer les coloris. Je règle par SumUp.`;
  }

  function renderDrawer() {
    const body = $('#dBody'), title = $('#dTitle');
    if (view === 'cart') {
      title.textContent = 'Votre panier';
      if (!cart.length) { body.innerHTML = `<div class="empty"><p>Votre panier est vide.</p><button class="btn btn--fill" type="button" data-close-drawer><span>Découvrir la boutique</span></button></div>`; return; }
      body.innerHTML = cart.map(lineHTML).join('') + summaryHTML() +
        `<button class="btn btn--fill magnetic" type="button" data-checkout><span>Passer la commande</span></button>
         <p class="small" style="margin:0;text-align:center">Aucun paiement à cette étape.</p>`;
    } else if (view === 'checkout') {
      title.textContent = 'Votre commande';
      body.innerHTML = `<button class="rm" type="button" data-back style="text-align:left">← Retour au panier</button>${summaryHTML()}
        <form class="cform" id="checkoutForm" novalidate>
          <div class="field two"><div><label for="oFirst">Prénom</label><input id="oFirst" name="first" autocomplete="given-name" required><span class="err" data-err="first"></span></div>
          <div><label for="oLast">Nom</label><input id="oLast" name="last" autocomplete="family-name" required><span class="err" data-err="last"></span></div></div>
          <div class="field"><label for="oPhone">Téléphone</label><input id="oPhone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required><span class="err" data-err="phone"></span></div>
          <div class="field"><label for="oMail">E-mail <small>(facultatif)</small></label><input id="oMail" name="email" type="email" autocomplete="email"><span class="err" data-err="email"></span></div>
          <div class="field"><span class="label">Remise de la pièce</span>
            <div class="mode" role="radiogroup" aria-label="Remise de la pièce">
              <label><input type="radio" name="mode" value="livraison"><span>Livraison</span></label>
              <label><input type="radio" name="mode" value="main"><span>En main propre</span></label>
              <label><input type="radio" name="mode" value="ensemble" checked><span>On voit ensemble</span></label>
            </div></div>
          <div class="field" id="addrField" hidden><label for="oAddr">Adresse de livraison</label><textarea id="oAddr" name="address" rows="3" autocomplete="street-address"></textarea><span class="err" data-err="address"></span></div>
          <div class="field"><label for="oNote">Un mot pour moi <small>(facultatif)</small></label><textarea id="oNote" name="note" rows="3" placeholder="Une précision sur un coloris, une date souhaitée…"></textarea></div>
          <button type="submit" class="btn btn--fill magnetic"><span>Valider ma commande</span></button>
        </form>`;
      const f = $('#checkoutForm');
      f.addEventListener('change', e => { if (e.target.name === 'mode') { $('#addrField').hidden = e.target.value !== 'livraison'; } });
      f.addEventListener('submit', onCheckout);
    } else if (view === 'done') {
      title.textContent = 'Commande prête';
      const link = sumupLink(order.total), text = orderText(order);
      const ig = `https://ig.me/m/${CFG.instagram}`;
      const sms = CFG.phone ? `sms:${CFG.phone}?&body=${encodeURIComponent(text)}` : '';
      const mail = CFG.email ? `mailto:${CFG.email}?subject=${encodeURIComponent('Commande ' + order.ref)}&body=${encodeURIComponent(text)}` : '';
      body.innerHTML = `<p class="orderref">Commande ${esc(order.ref)} · ${money(order.total)}</p>
        <div class="steps-pay"><h4>1. Envoyez-moi le récapitulatif</h4>
          <p class="small" style="margin:0">Ce message me transmet votre commande : elle est prise en compte dès que je le reçois.</p>
          <textarea class="recap" readonly aria-label="Récapitulatif de la commande">${esc(text)}</textarea>
          <div class="row">
            <button type="button" class="btn btn--fill" data-send="ig"><span>Envoyer par Instagram</span></button>
            ${sms ? `<a class="btn btn--ghost" href="${sms}"><span>Par SMS</span></a>` : ''}
            ${mail ? `<a class="btn btn--ghost" href="${mail}"><span>Par e-mail</span></a>` : ''}
            <button type="button" class="btn btn--ghost" data-copy><span>Copier</span></button>
          </div></div>
        <div class="steps-pay"><h4>2. Réglez avec SumUp</h4>
          ${link
            ? `<p class="small" style="margin:0">Paiement sécurisé par carte, au montant exact de votre commande.</p><a class="btn btn--sumup" href="${esc(link)}" target="_blank" rel="noopener"><span>Payer ${money(order.total)} avec SumUp</span></a>`
            : `<p class="small" style="margin:0">Je vous envoie un lien de paiement SumUp de <b>${money(order.total)}</b> après avoir confirmé vos coloris. Vous réglez par carte, en toute sécurité.</p>`}
        </div>
        <button class="rm" type="button" data-clear style="text-align:center">Vider le panier et fermer</button>`;
      body._ig = ig;
    } else if (view === 'sumup') {
      title.textContent = 'Montants SumUp';
      const amounts = sumupAmounts(2);
      const have = Object.keys((CFG.sumup && CFG.sumup.links) || {}).map(Number);
      body.innerHTML = `<p class="small" style="margin:0">À créer dans SumUp (Liens de paiement, montant fixe) puis à coller dans <code>js/config.js</code>. Un lien par montant : le site propose automatiquement le bon lien selon le total du panier (1 ou 2 articles couverts).</p>
        <div class="chips" style="margin:0">${amounts.map(a => `<li style="${have.includes(a) ? 'background:#eef1e0' : ''}">${money(a)}</li>`).join('')}</div>
        <p class="small" style="margin:0">En vert : lien déjà configuré.</p>`;
    }
  }

  function sumupAmounts(maxItems) {
    const units = new Set();
    PRODUCTS.filter(p => !p.quote).forEach(p => {
      const bases = p.sizes ? p.sizes.map(s => s.price) : p.models.map(m => m.price);
      bases.forEach(b => { units.add(b); if (hasFinish(p)) units.add(b + CFG.finishSurcharge); });
    });
    let sums = new Set(units); let cur = new Set(units);
    for (let k = 2; k <= maxItems; k++) { const next = new Set(); cur.forEach(a => units.forEach(b => next.add(a + b))); next.forEach(v => sums.add(v)); cur = next; }
    return [...sums].sort((a, b) => a - b);
  }

  function validate(form, rules) {
    let ok = true; let first = null;
    $$('.err', form).forEach(e => e.textContent = '');
    $$('.invalid', form).forEach(e => e.classList.remove('invalid'));
    Object.entries(rules).forEach(([name, fn]) => {
      const input = form.elements[name]; const msg = fn(input.value.trim(), form);
      const ui = input._ui || input;
      if (msg) { ok = false; const e = $(`[data-err="${name}"]`, form); if (e) e.textContent = msg; ui.classList.add('invalid'); ui.setAttribute('aria-invalid', 'true'); first = first || ui; }
      else ui.removeAttribute('aria-invalid');
    });
    if (first) first.focus();
    return ok;
  }

  function onCheckout(e) {
    e.preventDefault();
    const f = e.target;
    const ok = validate(f, {
      first: v => v ? '' : 'Votre prénom, s’il vous plaît.',
      last: v => v ? '' : 'Votre nom, s’il vous plaît.',
      phone: v => /^[+\d][\d\s.\-()]{7,}$/.test(v) ? '' : 'Un numéro valide pour vous joindre.',
      email: v => !v || /^\S+@\S+\.\S+$/.test(v) ? '' : 'Adresse e-mail incomplète.',
      address: (v, form) => form.elements.mode.value === 'livraison' && !v ? 'Indiquez l’adresse de livraison.' : ''
    });
    if (!ok) return;
    const fd = new FormData(f);
    order = { ref: orderRef(), lines: cart.map(l => ({ ...l })), total: cartTotal(), first: fd.get('first').trim(), last: fd.get('last').trim(), phone: fd.get('phone').trim(), email: (fd.get('email') || '').trim(), mode: fd.get('mode'), address: (fd.get('address') || '').trim(), note: (fd.get('note') || '').trim() };
    try { localStorage.setItem('mpc-last-order', JSON.stringify(order)); } catch (_) {}
    view = 'done'; renderDrawer(); $('#dBody').scrollTop = 0;
  }

  function bindDrawer() {
    const d = $('#drawer');
    d.addEventListener('click', async e => {
      if (e.target.closest('[data-close-drawer]')) { closeDrawer(); return; }
      if (e.target.closest('[data-checkout]')) { view = 'checkout'; renderDrawer(); $('#dBody').scrollTop = 0; return; }
      if (e.target.closest('[data-back]')) { view = 'cart'; renderDrawer(); return; }
      const line = e.target.closest('.oline');
      if (line) {
        const i = +line.dataset.i;
        if (e.target.closest('[data-inc]')) cart[i].qty = Math.min(20, cart[i].qty + 1);
        else if (e.target.closest('[data-dec]')) cart[i].qty = Math.max(1, cart[i].qty - 1);
        else if (e.target.closest('[data-rm]')) cart.splice(i, 1);
        else return;
        saveCart(); refreshBadges(); renderDrawer(); return;
      }
      if (e.target.closest('[data-copy]')) { toast((await copyText(orderText(order))) ? 'Récapitulatif copié' : 'Copie impossible : sélectionnez le texte'); return; }
      if (e.target.closest('[data-send]')) {
        const ok = await copyText(orderText(order));
        toast(ok ? 'Récapitulatif copié : collez-le dans la conversation' : 'Ouvrez la conversation et collez votre commande');
        window.open(`https://ig.me/m/${CFG.instagram}`, '_blank', 'noopener'); return;
      }
      if (e.target.closest('[data-clear]')) { cart = []; saveCart(); refreshBadges(); closeDrawer(); }
    });
  }

  /* ---------- Demande personnalisée ---------- */
  const custom = { colors: [], assoc: 'mix' };
  const CUSTOM_TYPES = { 'Pochette d’ordinateur / iPad': 'sleeve', 'Sac cabas': 'tote', 'Sac personnalisé': 'bag', 'Panier (format sur mesure)': 'basketRound', 'Chaîne de téléphone': 'strap', 'Autre idée': 'bag' };
  const ASSOC_LABEL = { mix: 'mélangées', duo: 'haut et bas', contrast: 'en contraste' };
  let customViewer = null;
  function updateCustomViewer() {
    const type = CUSTOM_TYPES[$('#cType').value] || 'bag';
    const fin = ({ 'Bordure dorée': 'dore', 'Bordure argentée': 'argente', 'Perles': 'perles', 'Coquillages & étoiles dorés': 'charms', 'Marguerites brodées': 'fleurs' })[$('#cFinish').value] || 'aucune';
    const c1 = custom.colors[0] || null, c2 = custom.colors[1] || null;
    if (customViewer) customViewer.setPiece(type, { c1, c2, assoc: custom.assoc, finish: fin });
    else {
      const svgType = type === 'tote' ? 'bag' : type;
      const model = !c2 ? 'm1' : svgType === 'bag' ? ({ mix: 'm2', duo: 'm3', contrast: 'm4' })[custom.assoc] : ({ mix: 'm3', duo: 'm4', contrast: 'm4' })[custom.assoc];
      $('#customFallback').innerHTML = window.mpcPreview(svgType, { c1: c1 || 'beige', c2, model, finish: fin });
    }
    $('#customCaption').textContent = c1
      ? custom.colors.map(c => COLOR[c].name).join(' + ') + (c2 ? ' · ' + ASSOC_LABEL[custom.assoc] : '')
      : 'Choisissez une couleur : la pièce se remplit du fil.';
  }
  function initCustomViewer() {
    const stage = $('#customViewer');
    customViewer = (window.MPC3D && window.MPC3D.create(stage)) || null;
    if (!customViewer) { stage.hidden = true; $('#customFallback').hidden = false; }
    $('#cType').addEventListener('change', updateCustomViewer);
    $('#cFinish').addEventListener('change', updateCustomViewer);
    $('#assocPills').addEventListener('click', e => {
      const b = e.target.closest('[data-assoc]'); if (!b) return;
      custom.assoc = b.dataset.assoc;
      $$('#assocPills .pill').forEach(x => x.setAttribute('aria-pressed', x === b));
      updateCustomViewer();
    });
    updateCustomViewer();
  }
  function renderCustomSwatches() {
    const box = $('#customSwatches');
    box.innerHTML = COLORS.map(c => `<button type="button" class="swatch" data-c="${c.id}" aria-pressed="false" aria-label="${esc(c.name)}" title="${esc(c.name)}" style="background:${swatchBg(c.id)}"></button>`).join('');
    box.addEventListener('click', e => {
      const b = e.target.closest('.swatch'); if (!b) return;
      const id = b.dataset.c, i = custom.colors.indexOf(id);
      if (i >= 0) custom.colors.splice(i, 1); else { if (custom.colors.length >= 2) custom.colors.shift(); custom.colors.push(id); }
      paintCustom();
    });
  }
  function paintCustom() {
    $$('#customSwatches .swatch').forEach(b => b.setAttribute('aria-pressed', custom.colors.includes(b.dataset.c)));
    $('#customPicked').textContent = custom.colors.length ? 'Couleurs : ' + custom.colors.map(c => COLOR[c].name).join(' + ') : 'Aucune couleur choisie';
    $('#assocField').hidden = custom.colors.length < 2;
    updateCustomViewer();
  }
  function goCustom(p, color) {
    const sel = $('#cType'); const opt = [...sel.options].find(o => o.text === p.quoteType);
    if (opt) { sel.value = opt.value || opt.text; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    if (color) { custom.colors = [color]; paintCustom(); }
    const t = $('#sur-mesure');
    if (window.__lenis) window.__lenis.scrollTo(t, { offset: -20, duration: 1.6 }); else t.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => $('#cDims').focus({ preventScroll: true }), 1700);
  }
  function bindCustom() {
    const f = $('#customForm');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const ok = validate(f, {
        type: v => v ? '' : 'Choisissez un type de pièce.',
        name: v => v ? '' : 'Votre prénom, s’il vous plaît.',
        contact: v => v.length >= 5 ? '' : 'Un téléphone, une adresse e-mail ou votre @Instagram.'
      });
      if (!ok) return;
      const v = n => f.elements[n].value.trim();
      const text = `Bonjour Oriana, j’aimerais une demande personnalisée :\n\n• Pièce : ${v('type')}\n${v('dims') ? '• Dimensions / appareil : ' + v('dims') + '\n' : ''}• Couleurs : ${custom.colors.length ? custom.colors.map(c => COLOR[c].name).join(' + ') + (custom.colors.length > 1 ? ' (' + ASSOC_LABEL[custom.assoc] + ')' : '') : 'à définir ensemble'}\n• Finition : ${v('finish')}\n${v('msg') ? '• Mon idée : ' + v('msg') + '\n' : ''}\nPrénom : ${v('name')}\nContact : ${v('contact')}\n\nMerci beaucoup !`;
      const sent = $('#customSent');
      const sms = CFG.phone ? `sms:${CFG.phone}?&body=${encodeURIComponent(text)}` : '';
      const mail = CFG.email ? `mailto:${CFG.email}?subject=${encodeURIComponent('Demande personnalisée')}&body=${encodeURIComponent(text)}` : '';
      sent.innerHTML = `<strong>Votre demande est prête.</strong><textarea class="recap" readonly aria-label="Récapitulatif de la demande">${esc(text)}</textarea>
        <div class="row"><button type="button" class="btn btn--fill" data-csend><span>Envoyer par Instagram</span></button>${sms ? `<a class="btn btn--ghost" href="${sms}"><span>Par SMS</span></a>` : ''}${mail ? `<a class="btn btn--ghost" href="${mail}"><span>Par e-mail</span></a>` : ''}<button type="button" class="btn btn--ghost" data-ccopy><span>Copier</span></button></div>`;
      sent.hidden = false;
      sent.querySelector('[data-csend]').addEventListener('click', async () => { const ok = await copyText(text); toast(ok ? 'Demande copiée : collez-la dans la conversation' : 'Ouvrez la conversation et collez votre demande'); window.open(`https://ig.me/m/${CFG.instagram}`, '_blank', 'noopener'); });
      sent.querySelector('[data-ccopy]').addEventListener('click', async () => toast((await copyText(text)) ? 'Demande copiée' : 'Copie impossible'));
      sent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const alt = [CFG.phone && 'SMS', CFG.email && 'e-mail'].filter(Boolean);
    if (alt.length) $('#customAlt').textContent = ', ' + alt.join(', ');
  }

  /* ---------- Couleurs : mur de pastilles ---------- */
  function renderColorWall() {
    const wall = $('#colorWall');
    wall.innerHTML = COLORS.map(c => `<div class="sw" role="listitem"><button class="sw__ball" type="button" data-c="${c.id}" aria-pressed="false" aria-label="${esc(c.name)} : teinter le fond de la section" style="background:${swatchBg(c.id)}"></button><span>${esc(c.name)}</span></div>`).join('');
    const sec = $('#couleurs');
    wall.addEventListener('click', e => {
      const b = e.target.closest('.sw__ball'); if (!b) return;
      const c = COLOR[b.dataset.c];
      $$('.sw__ball', wall).forEach(x => x.setAttribute('aria-pressed', x === b));
      const base = c.metal ? (c.id === 'dore' ? '#E7D3A4' : '#D7D7DA') : c.hex;
      sec.style.backgroundColor = mixHex(base, '#F7F2EA', c.id === 'noir' || c.id === 'marron-fonce' || c.id === 'gris-fonce' || c.id === 'vert-kaki' ? .86 : .74);
    });
  }

  /* ---------- Galerie & retours ---------- */
  const I = 'assets/img/';
  function renderGallery() {
    const items = [
      ['panier-jaune', 'Panier jaune sur rondelle de bois', 720, 1280], ['sac-bleu-gris', 'Sac bleu-gris sur bois', 720, 1280], ['atelier-vert', 'Un sac vert en cours de création', 720, 1280],
      ['sac-rouge', 'Sac rouge et rose', 720, 1280], ['pause-cafe', 'Petit panier rose, pause café', 720, 1280], ['sac-blanc-bois', 'Sac blanc cassé', 720, 1280],
      ['marche', 'Le stand au marché nocturne', 720, 1280], ['paniers-duo-rose', 'Duo de paniers pour la table de salon', 720, 1280], ['sac-noir-main', 'Sac noir, anse à la main', 720, 1280],
      ['accessoires-fleurs', 'Marguerites brodées et perles', 719, 1280], ['panier-dore', 'Panier à bordure dorée', 720, 1280], ['sac-gris-main', 'Sac mélange gris et noir', 720, 1280]
    ];
    $('#gal').innerHTML = items.map(([n, c, w, h]) => `<figure class="gal__item" data-tilt><img src="${I + n}.jpg" alt="${esc(c)}" loading="lazy" width="${w}" height="${h}" decoding="async"><figcaption>${esc(c)}</figcaption></figure>`).join('');
  }
  function renderReviews() {
    const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8L12 3.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    const real = [['retour-porquerolles', 'Retour d’une cliente, en direct de Porquerolles'], ['retour-marseille', 'Sac personnalisé, à Marseille'], ['trio-sacs', 'Une grosse commande de sacs. Merci !']]
      .map(([n, t]) => `<article class="rcard" role="listitem"><figure><img src="${I + n}.jpg" alt="${esc(t)}" loading="lazy" width="720" height="1280"></figure><p>${esc(t)}</p></article>`);
    const empty = [1, 2, 3].map(() => `<article class="rcard rcard--empty" role="listitem" data-todo="avis-client"><div><div class="stars" aria-hidden="true">${star.repeat(5)}</div><b>Votre avis ici</b><span>Emplacement réservé à un avis client.</span></div></article>`);
    $('#rev').innerHTML = real.concat(empty).join('');
  }

  /* ---------- Contact ---------- */
  function setupContact() {
    if (CFG.phone) { $('#coordPhone').hidden = false; const a = $('#phoneLink'); a.href = 'tel:' + CFG.phone.replace(/\s/g, ''); a.textContent = CFG.phone; }
    if (CFG.email) { $('#coordMail').hidden = false; const a = $('#mailLink'); a.href = 'mailto:' + CFG.email; a.textContent = CFG.email; }
    $('#dmBtn').href = `https://ig.me/m/${CFG.instagram}`;
  }

  /* ---------- Focus / clavier ---------- */
  function trapTab(e, root) {
    if (e.key !== 'Tab') return;
    const f = $$('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])', root).filter(x => !x.closest('[hidden]') && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', e => {
    const modal = $('#modal'), drawer = $('#drawer');
    if (e.key === 'Escape') { if (!modal.hidden) closeModal(); else if (!drawer.hidden) closeDrawer(); }
    if (!modal.hidden) trapTab(e, $('#modalPanel')); else if (!drawer.hidden) trapTab(e, $('.drawer__panel'));
  });

  /* ---------- Listes déroulantes sur mesure (remplacent les <select> natifs, non stylables) ---------- */
  function enhanceSelect(sel) {
    if (sel._ui) return;
    const id = sel.id || ('sel' + Math.random().toString(36).slice(2, 7)); sel.id = id;
    const wrap = document.createElement('div'); wrap.className = 'cselect';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cselect__btn'; btn.id = id + '-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<i class="cselect__dot" aria-hidden="true"></i><span class="cselect__val"></span><svg class="cselect__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const list = document.createElement('ul'); list.className = 'cselect__list'; list.id = id + '-list'; list.tabIndex = -1; list.setAttribute('role', 'listbox');
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) { label.id = label.id || id + '-label'; list.setAttribute('aria-labelledby', label.id); btn.setAttribute('aria-labelledby', label.id + ' ' + btn.id); }
    btn.setAttribute('aria-controls', list.id);
    const opts = [...sel.options];
    const items = [];
    opts.forEach((o, i) => {
      if (o.value === '' && i === 0) return;               /* le « Choisir… » sert de texte indicatif, pas d'option */
      const li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = `${id}-o${i}`; li.dataset.i = i;
      if (o.dataset.swatch) { const d = document.createElement('i'); d.className = 'cselect__sw'; d.style.background = o.dataset.swatch; li.appendChild(d); }
      li.appendChild(document.createTextNode(o.text)); list.appendChild(li); items.push(li);
    });
    sel.classList.add('native-hidden'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    wrap.append(btn, list); sel.after(wrap); sel._ui = btn;
    if (label) label.addEventListener('click', e => { e.preventDefault(); btn.focus(); });

    const val = $('.cselect__val', btn), dot = $('.cselect__dot', btn);
    let active = -1;
    function sync() {
      const o = opts[sel.selectedIndex]; const placeholder = o && o.value === '' && sel.selectedIndex === 0;
      val.textContent = o ? o.text : ''; val.classList.toggle('is-placeholder', !!placeholder);
      const sw = o && o.dataset.swatch; dot.style.display = sw ? 'inline-block' : 'none'; dot.style.background = sw || '';
      items.forEach(li => li.setAttribute('aria-selected', +li.dataset.i === sel.selectedIndex));
    }
    const isOpen = () => wrap.classList.contains('is-open');
    function setActive(k) {
      active = Math.max(0, Math.min(items.length - 1, k));
      items.forEach((li, n) => li.classList.toggle('is-active', n === active));
      btn.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    }
    function open() {
      if (isOpen()) return;
      const r = btn.getBoundingClientRect(); wrap.classList.toggle('is-up', innerHeight - r.bottom < 300 && r.top > innerHeight - r.bottom);
      wrap.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true');
      const cur = items.findIndex(li => +li.dataset.i === sel.selectedIndex); setActive(cur >= 0 ? cur : 0);
      setTimeout(() => document.addEventListener('pointerdown', outside), 0);
    }
    function close(focus) {
      wrap.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); btn.removeAttribute('aria-activedescendant');
      document.removeEventListener('pointerdown', outside); if (focus) btn.focus();
    }
    function outside(e) { if (!wrap.contains(e.target)) close(false); }
    function choose(k) { sel.selectedIndex = +items[k].dataset.i; sel.dispatchEvent(new Event('change', { bubbles: true })); close(true); }

    btn.addEventListener('click', () => (isOpen() ? close(false) : open()));
    btn.addEventListener('keydown', e => {
      const k = e.key;
      if (!isOpen()) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) { e.preventDefault(); open(); } return; }
      if (k === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (k === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (k === 'Home') { e.preventDefault(); setActive(0); }
      else if (k === 'End') { e.preventDefault(); setActive(items.length - 1); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (k === 'Tab') close(false);
      else if (k.length === 1) { const n = items.findIndex((li, i) => i > active && li.textContent.trim().toLowerCase().startsWith(k.toLowerCase())); if (n >= 0) setActive(n); }
    });
    list.addEventListener('pointermove', e => { const li = e.target.closest('li'); if (li) { const n = items.indexOf(li); if (n !== active) setActive(n); } });
    list.addEventListener('click', e => { const li = e.target.closest('li'); if (li) choose(items.indexOf(li)); });
    list.addEventListener('mousedown', e => e.preventDefault());
    sel.addEventListener('change', sync);
    sync();
  }

  /* ---------- Init ---------- */
  renderFilters(); renderGrid(); renderColorWall(); renderCustomSwatches(); renderGallery(); renderReviews(); setupContact();
  $$('select').forEach(enhanceSelect);
  initCustomViewer();
  bindModal(); bindDrawer(); bindCustom(); refreshBadges();
  $('#cartOpen').addEventListener('click', () => openDrawer('cart'));
  $('#fab').addEventListener('click', () => openDrawer('cart'));
  $('#sumupHelp').addEventListener('click', () => openDrawer('sumup'));
  window.addEventListener('resize', refreshBadges);

  window.MPC = {
    montantsSumUp() { const a = sumupAmounts(2); console.table(a.map(x => ({ 'montant (€)': x }))); return a; },
    open: openProduct, cart: () => cart.slice()
  };
})();



