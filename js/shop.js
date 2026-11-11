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
  const PAGE = (document.body && document.body.dataset && document.body.dataset.page) || 'home';   /* « stock » sur en-stock.html : seulement les pièces en stock, le panier et la commande */

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
  /* finitions autorisées par pièce (règles de la gérante, voir MPC_FINISH_RULES dans data.js) */
  const finishIds = pid => (window.MPC_FINISH_RULES || {})[pid] || FINISHES.map(f => f.id);
  const hasFinish = p => !p.quote && finishIds(p.id).some(id => id !== 'aucune');
  /* chaînes de sac (40 cm) : elles ne se proposent que si elles vont avec les tons des coloris choisis (Oriana ne mélange pas les tons froids et chauds : MPC_TONES et MPC_chainOk, data.js) */
  const isChain = fid => { const f = FINISHES.find(x => x.id === fid); return !!(f && f.chain); };
  const chainOk = (fid, colors) => (window.MPC_chainOk ? window.MPC_chainOk(fid, colors) : true);

  /* ---------- Panier (localStorage) ---------- */
  const KEY = 'mpc-cart-v1';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { cart = []; }
  const saveCart = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
  /* Nouveautés et pièces disponibles ajoutées par Oriana (js/content-apply.js ; liste vide tant qu'elle n'en a pas ajouté) */
  const ARTS = Array.isArray(window.MPC_ARTICLES) ? window.MPC_ARTICLES : [];
  const artById = id => ARTS.find(a => a.id === id);
  const artMax = a => (a.kind === 'dispo' ? a.qty : 20);
  const artSold = a => a.kind === 'dispo' && a.qty < 1;
  const newArts = () => ARTS.filter(a => a.kind !== 'dispo');   /* nouveautés sur commande : elles s'affichent dans la grille de la boutique, à côté des pièces d'origine */
  /* Panier relu depuis le navigateur : remis d'équerre (prix modifiés par Oriana, pièces vendues, retirées ou masquées depuis) */
  let cartNote = '';
  cart = cart.filter(l => {
    if (!l || typeof l !== 'object' || !Number.isInteger(l.qty) || l.qty < 1) return false;
    if (l.article) {
      const a = artById(String(l.pid).slice(2));
      if (!a || artSold(a)) { cartNote = 'Une pièce de votre panier n’est plus disponible : elle a été retirée.'; return false; }
      l.unit = a.price; l.name = a.name; l.photo = a.photos[0] || ''; l.kind = a.kind; l.max = artMax(a); l.qty = Math.min(l.max, l.qty);
      return true;
    }
    const p = byId(l.pid);
    if (!p || p.hidden || p.quote) { cartNote = 'Une pièce de votre panier n’est plus proposée : elle a été retirée.'; return false; }
    if ((l.colors || []).some(c => !COLOR[c])) { cartNote = 'Une couleur de votre panier n’est plus proposée : la pièce a été retirée.'; return false; }   /* coloris retiré de la vente par Oriana */
    if (isChain(l.finish) && !chainOk(l.finish, l.colors)) {   /* chaîne qui ne va pas (ou plus) avec les tons des coloris : retirée plutôt que refusée au paiement */
      l.finish = 'aucune'; l.key = [p.id, l.model, l.size, (l.colors || []).join('+'), l.finish].join('|');
      cartNote = 'La chaîne d’un sac de votre panier ne va pas avec ses couleurs : elle a été retirée.';
    }
    l.unit = unitPrice(p, l);   /* le prix a pu changer depuis que la pièce a été ajoutée */
    return true;
  });
  saveCart();
  const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = () => cart.reduce((n, l) => n + l.unit * l.qty, 0);
  /* Frais de livraison, dus seulement pour les modes qui livrent (aujourd'hui : le point relais ou locker, la livraison à domicile n'existe plus ; la remise en main propre est gratuite).
     Chaque pièce a ses frais (ceux qu'Oriana fixe pour la pièce, sinon les frais par défaut CFG.shipping.fee). Une commande est un seul colis : elle paie le frais le plus ÉLEVÉ de
     ses pièces, une seule fois (comme avant : 5 € par commande tant qu'aucune pièce n'a son tarif) ; si Oriana allume « additionner » (CFG.shipping.sum), les frais de chaque pièce
     s'additionnent (× quantité). Le serveur de commandes calcule exactement pareil (paiement-serveur/commandes-worker.js, priceCart et shippingFor). */
  const SHIP = CFG.shipping || {}, shipBase = Math.max(0, Number(SHIP.fee) || 0), shipSum = SHIP.sum === true;
  const ownShip = o => (o && typeof o.ship === 'number' && o.ship >= 0 ? o.ship : shipBase);
  const lineShip = l => (l.article ? ownShip(artById(String(l.pid).slice(2))) : ownShip(byId(l.pid)));
  const shipTotal = lines => { const t = shipSum ? lines.reduce((n, l) => n + lineShip(l) * l.qty, 0) : lines.reduce((m, l) => Math.max(m, lineShip(l)), 0); return Math.round(t * 100) / 100; };
  const shipFee = (mode, lines) => ((SHIP.modes || []).includes(mode) ? shipTotal(lines || cart) : 0);
  const relayShipOn = () => (SHIP.modes || []).includes('relais') && !(CFG.modesOn && CFG.modesOn.relais === false);

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
    box.innerHTML = window.MPC_FILTERS.filter(f => f.id === 'all' || PRODUCTS.some(p => !p.hidden && p.cat === f.id) || newArts().some(a => a.cat === f.id)).map((f, i) => `<button class="chip-btn" type="button" data-f="${f.id}" aria-pressed="${i === 0}">${esc(f.name)}</button>`).join('');
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      $$('[data-f]', box).forEach(x => x.setAttribute('aria-pressed', x === b));
      const f = b.dataset.f;
      $$('.card').forEach(c => { c.hidden = !(f === 'all' || c.dataset.cat === f); });
      window.dispatchEvent(new Event('mpc:layout'));
    });
  }

  /* cadrage d'une vraie photo dans la carte carrée (voir MPC_FRAME dans data.js) */
  const frameAttr = name => { const f = (window.MPC_FRAME || {})[name]; return f ? ` style="--pos:${f.pos};--z:${f.zoom}"` : ''; };
  function cardHTML(p) {
    const from = fromPrice(p);
    const c0 = p.defaultColors[0], g0 = p.photosByColor[c0];
    const dots = p.defaultColors.map((c, i) => `<button class="dot" type="button" data-color="${c}" aria-pressed="${i === 0}" aria-label="Aperçu en ${esc(COLOR[c].name)}" title="${esc(COLOR[c].name)}" style="background:${swatchBg(c)}"></button>`).join('');
    const sizes = p.sizes ? `<div class="card__sizes" role="group" aria-label="Taille, ${esc(p.name)}">${p.sizes.map((z, i) => `<button type="button" class="csize" data-csize="${z.id}" aria-pressed="${i === 0}">${esc(z.id)}<small>${money(z.price)}</small></button>`).join('')}</div>` : '';
    const cta = p.quote
      ? `<button type="button" class="btn btn--fill magnetic" data-open="${p.id}"><span>Demander un devis</span></button>`
      : `<button type="button" class="btn btn--fill magnetic" data-add="${p.id}"><span>Ajouter au panier</span></button><button type="button" class="btn btn--ghost btn--more" data-open="${p.id}"><span>Plus de détails</span></button>`;
    return `<article class="card${g0 ? (g0.startsWith('gen/') ? ' is-gen' : ' is-real') : ''}" data-id="${p.id}" data-cat="${p.cat}" data-pick="${c0}"${p.sizes ? ` data-psize="${p.sizes[0].id}"` : ''}>
      <div class="card__media">
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
        <img class="card__photo" src="${g0 ? 'assets/img/' + g0 + '.jpg' : p.photo}" alt="${esc(p.photoAlt)}" loading="lazy" width="720" height="900" decoding="async"${frameAttr(g0)}>
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
    /* les pièces de la boutique, puis les nouveautés d'Oriana (articles « sur commande » de son espace pro), dans la même grille */
    grid.innerHTML = PRODUCTS.filter(p => !p.hidden).map(cardHTML).join('') + newArts().map(a => artCardHTML(a, false, true)).join('');
    bindArtGrid(grid);                                                   /* « Ajouter au panier », « Voir en détail » ou un clic sur la carte d'une nouveauté */
    grid.addEventListener('click', e => {
      const card = e.target.closest('.card'); if (!card || card.classList.contains('card--art')) return;
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
    if (pushLine(p, sel) === false) return;
    const d = describe(p, sel);
    toast(`Ajouté : ${p.name}${d.size ? ' · ' + d.size : ''} · ${d.colors[0]}`);
    const b = $('[data-add]', card); if (b) { b.classList.add('is-added'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('is-added'), 1400); }
  }

  function showCardColor(card, p, cid) {
    const photo = p.photosByColor[cid];
    const img = $('.card__photo', card), svg = $('.card__svg', card);
    $$('.dot[data-color]', card).forEach(d => d.setAttribute('aria-pressed', d.dataset.color === cid));
    card.dataset.pick = cid;
    if (photo) { img.src = 'assets/img/' + photo + '.jpg'; card.classList.remove('is-preview'); const gen = photo.startsWith('gen/'); card.classList.toggle('is-gen', gen); card.classList.toggle('is-real', !gen); const fr = (window.MPC_FRAME || {})[photo] || {}; img.style.setProperty('--pos', fr.pos || '50% 74%'); img.style.setProperty('--z', fr.zoom || 1); }
    else { openProduct(p.id, cid); }   /* pas de photo dans ce coloris : le configurateur 3D recolore la vraie pièce */
  }

  /* ---------- Nouveautés et pièces disponibles (articles ajoutés par Oriana dans son espace pro) ---------- */
  function artBadges(a, inShop) {
    const b = [];
    if (a.isNew) b.push(['new', 'Nouveau']);
    if (inShop && a.kind !== 'dispo') return b;                      /* dans la boutique tout est crocheté à la commande : il ne reste que la mention « Nouveau » */
    if (a.kind !== 'dispo') b.push(['order', 'Sur commande']);
    else if (a.qty < 1) b.push(['sold', 'Vendu']);
    else b.push([a.qty === 1 ? 'one' : 'stock', a.qty === 1 ? 'Pièce unique' : 'Disponible']);
    return b;
  }
  function artCardHTML(a, fast, inShop) {                       /* fast : carte de la page « En stock » (mention de l'expédition sous 24 à 48 h) ; inShop : carte dans la grille de la boutique (filtrée par type de pièce) */
    const sold = artSold(a), badges = artBadges(a, inShop);
    return `<article class="card card--art${sold ? ' is-sold' : ''}" data-art="${esc(a.id)}" data-cat="${esc(a.cat)}">
      <div class="card__media">${badges.length ? `<div class="badges">${badges.map(([k, t]) => `<span class="badge badge--${k}">${esc(t)}</span>`).join('')}</div>` : ''}${a.photos[0] ? `<img class="card__photo" src="${esc(a.photos[0])}" alt="${esc(a.name)}" loading="lazy" width="720" height="900" decoding="async">` : ''}</div>
      <div class="card__body">
        <div class="card__row"><h3>${esc(a.name)}</h3><span class="price">${money(a.price)}</span></div>
        ${a.details ? `<p class="card__tag">${esc(a.details)}</p>` : ''}
        ${fast && !sold ? '<p class="card__ship">Expédiée sous 24 à 48 h</p>' : ''}
        <div class="card__cta">${sold ? '<button type="button" class="btn btn--ghost" disabled><span>Vendu</span></button>' : `<button type="button" class="btn btn--fill magnetic" data-art-add="${esc(a.id)}"><span>Ajouter au panier</span></button>`}<button type="button" class="btn btn--ghost btn--more" data-art-open="${esc(a.id)}"><span>Voir en détail</span></button></div>
      </div>
    </article>`;
  }
  /* une grille de cartes : « Ajouter au panier », « Voir en détail », ou un clic sur la carte */
  function bindArtGrid(grid) {
    grid.addEventListener('click', e => {
      const add = e.target.closest('[data-art-add]'), open = e.target.closest('[data-art-open]'), card = e.target.closest('.card--art');
      if (add) { quickAddArticle(artById(add.dataset.artAdd), add); return; }
      if (open) { openArticle(open.dataset.artOpen); return; }
      if (card && !e.target.closest('button')) openArticle(card.dataset.art);           /* un clic sur la carte ouvre la fiche */
    });
  }
  /* Accueil : les nouveautés sur commande sont dans la grille de la boutique (renderGrid) ; les pièces en stock ont leur propre page (en-stock.html) et un bandeau sur l'accueil */

  /* ---------- Pièces en stock : prêtes à partir, expédiées sous 24 à 48 h (page en-stock.html, bandeau de l'accueil) ---------- */
  const STOCK_CATS = [['sacs', 'Sacs'], ['paniers', 'Paniers'], ['cordons', 'Chaînes de téléphone'], ['autres', 'Autres pièces']];
  const stockItems = () => ARTS.filter(a => a.kind === 'dispo' && !artSold(a));      /* les pièces vendues disparaissent de la page */
  function renderStockPage() {
    const grid = $('#stockGrid'); if (!grid) return;
    const all = stockItems(), box = $('#stockFilters'), count = $('#stockCount'), empty = $('#stockEmpty');
    let cat = 'all';
    if (!all.length) { grid.hidden = true; if (empty) empty.hidden = false; if (count) count.hidden = true; return; }
    const paint = () => {
      const list = all.filter(a => cat === 'all' || a.cat === cat);
      grid.innerHTML = list.map(a => artCardHTML(a, true)).join('');
      if (count) count.textContent = list.length + (list.length > 1 ? ' pièces prêtes à partir' : ' pièce prête à partir');
    };
    const present = STOCK_CATS.filter(([id]) => all.some(a => a.cat === id));
    if (box && present.length > 1) {                                                    /* des filtres seulement s'il y a plusieurs types de pièces */
      box.innerHTML = [['all', 'Tout voir']].concat(present).map(([id, t]) => `<button class="chip-btn" type="button" data-cat="${id}" aria-pressed="${id === 'all'}">${esc(t)}<small>${id === 'all' ? all.length : all.filter(a => a.cat === id).length}</small></button>`).join('');
      box.hidden = false;
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        cat = b.dataset.cat; $$('[data-cat]', box).forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint();
      });
    }
    bindArtGrid(grid);
    paint();
  }
  /* Accueil : bandeau « En stock » (seulement s'il y a des pièces) et liens vers la page */
  function renderStockTeaser() {
    const sec = $('#enStock'); if (!sec) return;
    const all = stockItems();
    if (!all.length) { sec.remove(); return; }
    const n = $('#enStockCount'), th = $('#enStockThumbs');
    if (n) n.textContent = all.length + (all.length > 1 ? ' pièces' : ' pièce');
    if (th) th.innerHTML = all.filter(a => a.photos[0]).slice(0, 4).map(a => `<img src="${esc(a.photos[0])}" alt="" loading="lazy" width="240" height="300" decoding="async">`).join('');
    sec.hidden = false;
    $$('.nav, #menu nav').forEach(nav => nav.insertAdjacentHTML('afterbegin', '<a href="en-stock.html">En stock</a>'));
  }
  /* ajoute une pièce au panier ; false si c'est impossible (commandes en pause, vendue, déjà toutes dans le panier) */
  function addArticleLine(a) {
    if (CFG.ordersPaused) { toast(CFG.ordersPaused.message); return false; }
    if (!a || artSold(a)) { toast('Cette pièce n’est plus disponible.'); return false; }
    const key = 'a:' + a.id, max = artMax(a), found = cart.find(l => l.key === key);
    if (found) {
      if (found.qty >= max) { toast(max === 1 ? 'Cette pièce unique est déjà dans votre panier.' : 'Vous avez pris toutes les pièces disponibles.'); return false; }
      found.qty++;
    } else cart.push({ key, pid: key, article: true, name: a.name, photo: a.photos[0] || '', kind: a.kind, model: null, size: null, colors: [], finish: '', qty: 1, unit: a.price, max });
    saveCart(); refreshBadges();
    return true;
  }
  function quickAddArticle(a, btn) {
    if (!addArticleLine(a)) return;
    toast('Ajouté : ' + a.name);
    if (btn) { btn.classList.add('is-added'); clearTimeout(btn._t); btn._t = setTimeout(() => btn.classList.remove('is-added'), 1400); }
  }
  const AM = { a: null, last: null };
  function openArticle(id) {
    const a = artById(id), el = $('#artModal'); if (!a || !el) return;
    AM.a = a; AM.last = document.activeElement;
    $('#amBadge').textContent = artBadges(a).map(b => b[1]).join(' · ') + (a.kind === 'dispo' && !artSold(a) ? ' · Expédiée sous 24 à 48 h' : '');
    $('#amTitle').textContent = a.name;
    $('#amDesc').textContent = a.desc;
    $('#amDetails').textContent = a.details;
    const amShip = $('#amShip');                                                                  /* frais de livraison de cette pièce (point relais) */
    if (amShip) { const f = relayShipOn() ? ownShip(a) : -1; amShip.textContent = f < 0 ? '' : (f > 0 ? 'Livraison en point relais : ' + money(f) + ' (gratuite en remise en main propre).' : 'Livraison en point relais offerte.'); amShip.hidden = f < 0; }
    $('#amPrice').textContent = money(a.price);
    $('#amMain').innerHTML = a.photos[0] ? `<img src="${esc(a.photos[0])}" alt="${esc(a.name)}">` : '';
    $('#amThumbs').innerHTML = a.photos.length > 1 ? a.photos.map((p, i) => `<button class="thumb" type="button" data-am-thumb="${esc(p)}" aria-pressed="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(p)}" alt="" loading="lazy"></button>`).join('') : '';
    const add = $('#amAdd'); add.disabled = artSold(a); $('span', add).textContent = artSold(a) ? 'Vendu' : 'Ajouter au panier';
    el.hidden = false; lock();
    requestAnimationFrame(() => el.classList.add('is-open'));
    setTimeout(() => $('.modal__close', el).focus(), 60);
  }
  function closeArticle() {
    const el = $('#artModal'); if (!el || el.hidden) return;
    el.classList.remove('is-open');
    setTimeout(() => { el.hidden = true; unlock(); AM.last && AM.last.focus && AM.last.focus(); }, 450);
  }
  function bindArticleModal() {
    const el = $('#artModal'); if (!el) return;
    el.addEventListener('click', e => {
      if (e.target.closest('[data-am-close]')) { closeArticle(); return; }
      const th = e.target.closest('[data-am-thumb]');
      if (th && AM.a) { $$('[data-am-thumb]', el).forEach(b => b.setAttribute('aria-pressed', b === th)); $('#amMain').innerHTML = `<img src="${esc(th.dataset.amThumb)}" alt="${esc(AM.a.name)}">`; }
    });
    $('#amAdd').addEventListener('click', () => { if (AM.a && addArticleLine(AM.a)) { closeArticle(); setTimeout(() => openDrawer('cart'), 380); toast('Ajouté au panier'); } });
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

  /* bloc « Détails décoratifs » : refait quand les coloris changent, car une chaîne de sac n'est proposée que si elle va avec leurs tons (une chaîne devenue impossible est retirée) */
  function finishBlockHTML(p, s) {
    const m = modelOf(p, s.model), cols = s.colors.slice(0, m.colors);
    const base = m.forceFinish ? FINISHES.filter(f => m.forceFinish.includes(f.id)) : FINISHES.filter(f => finishIds(p.id).includes(f.id));
    const list = base.filter(f => !f.chain || chainOk(f.id, cols));
    if (m.forceFinish && !m.forceFinish.includes(s.finish)) s.finish = m.forceFinish[0];
    else if (!list.some(f => f.id === s.finish)) s.finish = 'aucune';
    const chains = base.some(f => f.chain), fits = list.some(f => f.chain);
    const note = !chains ? '' : isChain(s.finish) ? 'La chaîne de 40 cm s’ajoute à la pièce pour la porter à l’épaule : elle n’apparaît pas dans l’aperçu.'
      : fits ? 'Chaîne de 40 cm pour porter le sac à l’épaule. ' + (window.MPC_CHAIN_RULE || '') : 'Pas de chaîne avec un mélange de tons chauds et froids.';
    return `<div class="opt"><div class="opt__title">Détails décoratifs<em>+${money(CFG.finishSurcharge)}</em></div><div class="pills pills--row" role="group" aria-label="Finition">` +
      list.map(f => `<button type="button" class="pill" data-finish="${f.id}" aria-pressed="${f.id === s.finish}"><b>${esc(f.name)}</b></button>`).join('') + `</div>` +
      (note ? `<p class="small" style="margin:.55rem 0 0">${esc(note)}</p>` : '') + `</div>`;
  }
  function syncFinishBox(refocus) {
    const box = $('#mFinishBox'); if (!box) return;
    box.innerHTML = finishBlockHTML(M.p, M.sel);
    if (refocus) { const b = $('[data-finish="' + M.sel.finish + '"]', box); if (b) b.focus(); }   /* le clavier garde sa place après la mise à jour du bloc */
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
    if (hasFinish(p)) h += `<div id="mFinishBox">${finishBlockHTML(p, s)}</div>`;
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
    /* la photo du coloris choisi et la même photo dans « Mes pièces déjà réalisées » (cas des vraies photos d'Oriana) : une seule vignette */
    $$('#mThumbs .thumb').forEach(b => { const t = b.dataset.thumb || ''; if (t.indexOf('assets/img/') === 0) b.hidden = !!photoKey && t === 'assets/img/' + photoKey + '.jpg'; });
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
      else if (sw) { const slot = +sw.closest('.swatch-grid').dataset.slot; s.colors[slot] = sw.dataset.c; syncFinishBox(); setThumbSvg(); }
      else if (fin) { s.finish = fin.dataset.finish; $$('[data-finish]').forEach(b => b.setAttribute('aria-pressed', b === fin)); syncFinishBox(true); setThumbSvg(); }
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
    if (CFG.ordersPaused) { toast(CFG.ordersPaused.message); return false; }   /* commandes en pause (réglage d'Oriana) */
    const m = modelOf(p, s.model);
    const colors = s.colors.slice(0, m.colors);
    const key = [p.id, s.model, s.size, colors.join('+'), s.finish].join('|');
    const unit = unitPrice(p, s);
    const found = cart.find(l => l.key === key);
    if (found) found.qty += s.qty;
    else cart.push({ key, pid: p.id, model: s.model, size: s.size, colors, finish: s.finish, qty: s.qty, unit });
    saveCart(); refreshBadges();
    return true;
  }

  function addToCart() {
    const p = M.p, s = M.sel;
    if (pushLine(p, s) === false) return;
    closeModal();
    setTimeout(() => openDrawer('cart'), 380);
    toast('Ajouté au panier');
  }

  /* ---------- Panier / commande ---------- */
  let view = 'cart', order = null, lastFocus = null;
  let relay = null, relayCountry = null;   /* point relais ou locker Mondial Relay choisi (js/relais.js) */
  try { localStorage.removeItem('mpc-last-order'); } catch (_) {}   /* ancienne sauvegarde de la dernière commande (nom, téléphone, adresse), qui n'était jamais relue : supprimée par respect de la vie privée */
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
    if (l.article) return l.photo ? `<img src="${esc(l.photo)}" alt="" loading="lazy">` : '';
    const p = byId(l.pid);
    const photo = l.colors.length === 1 && p.photosByColor[l.colors[0]];
    if (photo) return `<img src="assets/img/${photo}.jpg" alt="" loading="lazy">`;
    return `<img src="${p.photo}" alt="" loading="lazy">`;
  }

  function lineHTML(l, i) {
    if (l.article) {
      return `<div class="oline" data-i="${i}">
      <div class="oline__img">${lineThumb(l)}</div>
      <div>
        <h3>${esc(l.name)}</h3>
        <p class="oline__meta">${l.kind === 'dispo' ? (l.max === 1 ? 'Pièce unique, prête à partir' : 'Pièce disponible, prête à partir') : 'Nouveauté, crochetée pour vous'}</p>
        <div class="oline__row">
          ${l.max > 1 ? `<div class="qty qty--sm" role="group" aria-label="Quantité"><button type="button" data-dec aria-label="Moins">−</button><output>${l.qty}</output><button type="button" data-inc aria-label="Plus">+</button></div>` : '<span></span>'}
          <strong>${money(l.unit * l.qty)}</strong>
        </div>
        <button type="button" class="rm" data-rm>Retirer</button>
      </div>
    </div>`;
    }
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

  /* Récapitulatif des montants. mode = mode de remise choisi (étape « commande »).
     La livraison n'existe qu'en point relais ou locker Mondial Relay : sans cette option, aucune ligne « Livraison ».
     Sans mode (étape « panier »), elle est annoncée au tarif normal : au pire le total baisse (remise en main propre). */
  function summaryHTML(mode) {
    const sub = cartTotal(), n = cartCount(), row = (l, v) => `<div><span>${l}</span><span>${v}</span></div>`;
    let ship = '', total = sub;
    if (relayOn()) {
      const all = shipTotal(cart), fee = all ? money(all) : 'offerte';                        /* frais de toutes les pièces du panier (plafonnés), voir shipTotal */
      if (!mode) { ship = row('Livraison en point relais<small>offerte en main propre</small>', fee); total = sub + all; }
      else if (shipFee(mode)) { ship = row('Livraison en point relais', fee); total = sub + all; }
      else if (mode === 'main') ship = row('Remise en main propre', 'gratuite');
      else ship = row(`Livraison<small>${all ? money(all) + ' en point relais' : 'offerte en point relais'}</small>`, 'à convenir');
    }
    return `<div class="sum">${row(`Sous-total (${n} article${n > 1 ? 's' : ''})`, money(sub))}${ship}<div class="big"><span>Total</span><span>${money(total)}</span></div></div>`;
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
      if (l.article) return `• ${l.qty} × ${l.name} (${l.kind === 'dispo' ? 'pièce disponible' : 'nouveauté, sur commande'}) → ${money(l.unit * l.qty)}`;
      const p = byId(l.pid), d = describe(p, l);
      return `• ${l.qty} × ${p.name} : ${d.model}${d.size ? ', ' + d.size : ''}, couleur${d.colors.length > 1 ? 's' : ''} ${d.colors.join(' + ')}${d.finish ? ', ' + d.finish + ' (+' + money(CFG.finishSurcharge) + ')' : ''} → ${money(l.unit * l.qty)}`;
    }).join('\n');
    const modes = { relais: 'Livraison en point relais ou locker Mondial Relay', main: 'Remise en main propre', ensemble: 'À convenir ensemble' };
    const rl = o.mode === 'relais' && o.relay && window.MPC_RELAY ? '\n' + window.MPC_RELAY.recap(o.relay) + (window.MPC_RELAY.demo ? '\n⚠ DÉMONSTRATION : point relais d’exemple, aucun envoi réel.' : '') : '';
    return `Bonjour Oriana, voici ma commande ${o.ref} :\n\n${lines}\n\n${o.shipping > 0 ? 'Sous-total : ' + money(o.subtotal) + '\nLivraison : ' + money(o.shipping) + '\n' : ''}Total : ${money(o.total)}\nMode de remise : ${modes[o.mode] || ''}${rl}\n\nPrénom / nom : ${o.first} ${o.last}\nContact : ${o.phone}${o.email ? ' · ' + o.email : ''}${o.note ? '\nMessage : ' + o.note : ''}${o.paid ? '\n\nPaiement de ' + money(o.total) + ' réglé par carte via SumUp.' : ''}\n\nMerci de me confirmer les coloris.${o.paid ? '' : ' Je règle par SumUp.'}`;
  }

  /* ---------- Paiement SumUp : liens (sans serveur) ou carte directement dans le panier (mode clés API : paiement-serveur/) ---------- */
  /* Le site demande au serveur de commandes « êtes-vous prêt ? » (adresse sumup.checkoutEndpoint ; réponse oui ou non, jamais une clé) : il n'active le paiement par carte
     dans le panier (pay) et les commandes automatiques (auto : e-mails, bordereau, suivi) que si le serveur répond oui, c'est-à-dire quand toutes les clés sont posées chez Cloudflare.
     Tant que ce n'est pas le cas, ou si le serveur ne répond pas, le site garde son fonctionnement habituel (récapitulatif à envoyer à Oriana + lien de paiement).
     sumup.detect = false : on ne pose aucune question au serveur et on suit seulement sumup.autoOrders (réglage à la main). */
  const SUMUP = CFG.sumup || {}, payEndpoint = String(SUMUP.checkoutEndpoint || '').replace(/\/+$/, ''), detect = !!payEndpoint && SUMUP.detect !== false;
  const live = { pay: false, auto: false };
  if (detect) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
    fetch(payEndpoint + '/', { cache: 'no-store', signal: ctl.signal }).then(r => (r.ok ? r.json() : {})).then(d => { live.pay = !!d && d.pay === true; live.auto = live.pay && d.auto === true; }).catch(() => { /* pas de réponse : mode habituel */ }).finally(() => clearTimeout(timer));
  }
  const payApi = () => (payEndpoint && (!detect || live.pay) ? payEndpoint : '');
  /* « commandes automatiques » : le serveur de commandes envoie tout seul la commande à Oriana (avec le bordereau) et les e-mails à la cliente. Activé dans js/config.js (sumup.autoOrders) seulement quand ce serveur est complètement réglé. */
  const autoOrders = () => !!(payApi() && (detect ? live.auto : SUMUP.autoOrders));
  function payHTML(link) {
    if (order.paid && autoOrders()) return `<div class="paid"><b>Paiement reçu, merci !</b><p class="small" style="margin:0">${money(order.total)} réglés par carte via SumUp. Oriana a bien reçu votre commande. Une confirmation arrive par e-mail à ${esc(order.email)} (pensez à regarder vos courriers indésirables si vous ne la voyez pas), puis le numéro de suivi quand votre colis part.</p></div>`;
    if (order.paid) return `<div class="paid"><b>Paiement reçu, merci !</b><p class="small" style="margin:0">${money(order.total)} réglés par carte via SumUp. Envoyez-moi le récapitulatif ci-dessus : c’est lui qui me dit ce que vous avez choisi.</p></div>`;
    if (payApi()) return `<p class="small" style="margin:0">Paiement sécurisé par carte, au montant exact de votre commande, directement ici (SumUp).</p>
      <button class="btn btn--sumup" type="button" data-pay-card><span>Payer ${money(order.total)} par carte</span></button>
      <div class="paycard" id="payCard" hidden><p class="small paycard__st" id="payStatus" role="status" aria-live="polite"></p><div id="sumup-card"></div></div>
      ${link ? `<p class="small" style="margin:0">Vous préférez la page SumUp ? <a class="link" href="${esc(link)}" target="_blank" rel="noopener">Payer ${money(order.total)} sur SumUp</a>.</p>` : ''}`;
    return link
      ? `<p class="small" style="margin:0">Paiement sécurisé par carte, au montant exact de votre commande.</p><a class="btn btn--sumup" href="${esc(link)}" target="_blank" rel="noopener"><span>Payer ${money(order.total)} avec SumUp</span></a>`
      : `<p class="small" style="margin:0">Je vous envoie un lien de paiement SumUp de <b>${money(order.total)}</b> après avoir confirmé vos coloris. Vous réglez par carte, en toute sécurité.</p>`;
  }

  /* ---------- Livraison en point relais ou locker Mondial Relay (sélecteur Sendcloud, js/relais.js) ---------- */
  const RL = window.MPC_RELAY, relayOn = () => !!(RL && RL.enabled()) && !(CFG.modesOn && CFG.modesOn.relais === false);   /* Oriana peut retirer ce mode depuis son espace pro */
  function relayFieldHTML() {
    const cs = RL.countries;
    return `<div class="field relay" id="relayField" hidden>
      <span class="label">Votre point relais ou locker <small>Mondial Relay</small></span>
      ${RL.demo ? `<p class="relay__demo" role="note">Démonstration : points d’exemple, aucun envoi réel.</p>` : ''}
      <p class="small" style="margin:0">Je vous livre dans le point relais ou le locker Mondial Relay de votre choix, parmi les plus proches de chez vous. ${shipFee('relais') ? 'Livraison : ' + money(shipFee('relais')) + ' pour cette commande.' : 'La livraison est offerte.'}</p>
      ${cs.length > 1 ? `<div class="pills pills--row" role="group" aria-label="Pays de livraison">${cs.map(c => `<button type="button" class="pill" data-relay-country="${c}" aria-pressed="${c === relayCountry}"><b>${esc(RL.countryName(c))}</b></button>`).join('')}</div>` : ''}
      <div class="relay__search">
        <input id="oPostal" name="postal" inputmode="text" autocomplete="postal-code" maxlength="10" placeholder="Votre code postal" aria-label="Votre code postal" aria-describedby="relayErr">
        <button type="button" class="btn btn--fill" data-relay-open><span>${relay ? 'Changer de point' : 'Voir les points les plus proches'}</span></button>
      </div>
      <div class="relay__chosen" id="relayChosen" aria-live="polite" hidden></div>
      <input type="hidden" name="relay" id="oRelay" value="${relay ? relay.id : ''}">
      <span class="err" id="relayErr" role="alert" data-err="relay"></span>
    </div>`;
  }
  /* épingles de la carte « point choisi » : ronde pour un point relais, carrée pour un locker (mêmes formes que sur les cartes) */
  const RELAY_PINS = {
    relais: '<svg viewBox="0 0 34 44" width="34" height="44" aria-hidden="true" focusable="false"><path d="M17 43S3 28 3 16a14 14 0 0 1 28 0c0 12-14 27-14 27Z" fill="#B0522E" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M10.5 16.5l4.2 4.2 8.3-8.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    locker: '<svg viewBox="0 0 34 44" width="34" height="44" aria-hidden="true" focusable="false"><path d="M7 2h20a5 5 0 0 1 5 5v18a5 5 0 0 1-5 5h-6l-4 13-4-13H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z" fill="#33241F" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M10.5 16.5l4.2 4.2 8.3-8.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function renderRelayChosen(fresh) {
    const box = $('#relayChosen'), inp = $('#oRelay'), row = $('.relay__search'); if (!box) return;
    if (row) row.hidden = !!relay;                                   /* une fois le point choisi, la carte ci-dessous remplace la recherche (elle a son bouton « Changer de point ») */
    box.classList.remove('is-new');
    if (!relay) { box.hidden = true; box.innerHTML = ''; delete box.dataset.type; if (inp) inp.value = ''; return; }
    const type = relay.type === 'locker' ? 'locker' : 'relais';
    const chips = [RL.distanceText(relay), RL.hoursToday(relay)].filter(Boolean).map(t => `<span class="rc__chip">${esc(t)}</span>`).join('');
    box.dataset.type = type;
    box.innerHTML = `<span class="rc__pin" aria-hidden="true">${RELAY_PINS[type]}</span><div class="rc__body"><span class="rc__kick"><span class="rp__badge rp__badge--${type}">${esc(RL.typeLabel(relay))}</span><span class="rc__ok"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false"><path d="M3 8.4l3.2 3.1L13 4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Choisi</span></span><b class="rc__name">${esc(relay.name)}</b><span class="rc__addr">${esc(RL.addressLine(relay))}</span>${chips ? `<span class="rc__chips">${chips}</span>` : ''}<button type="button" class="rm" data-relay-open>Changer de point</button></div>`;
    box.hidden = false;
    if (fresh) { void box.offsetWidth; box.classList.add('is-new'); }   /* l'animation d'arrivée ne joue qu'au moment où la cliente vient de choisir */
    if (inp) inp.value = relay.id;
    const b = $('.relay__search [data-relay-open] span'); if (b) b.textContent = 'Changer de point';
    const e = $('[data-err="relay"]'); if (e) e.textContent = '';
  }
  function openRelay() {
    const f = $('#checkoutForm'); if (!f || !relayOn()) return;
    const inp = f.elements.postal, typed = inp.value.trim(), err = $('[data-err="relay"]');
    if ((typed || !relay) && !RL.postalOk(relayCountry, typed)) {          /* sans point déjà choisi, il faut un code postal ; s'il est saisi, il doit avoir la bonne forme */
      const h = RL.postalHelp(relayCountry);
      if (err) err.textContent = (typed ? 'Code postal incorrect' : 'Indiquez d’abord votre code postal') + (h ? ' (' + h + ')' : '') + '.';
      inp.setAttribute('aria-invalid', 'true'); inp.focus(); return;
    }
    inp.removeAttribute('aria-invalid');
    if (err) err.textContent = '';
    RL.open({ country: relayCountry, postalCode: typed || (relay ? relay.postal : ''), current: relay,
      onPick: r => { relay = r; renderRelayChosen(true); toast(r.type === 'locker' ? 'Locker choisi' : 'Point relais choisi'); },
      onError: msg => { const e = $('[data-err="relay"]'); if (e) e.textContent = msg; } });
  }

  function renderDrawer() {
    const body = $('#dBody'), title = $('#dTitle');
    if (view === 'cart') {
      title.textContent = 'Votre panier';
      if (!cart.length) { body.innerHTML = `<div class="empty"><p>Votre panier est vide.</p><button class="btn btn--fill" type="button" data-close-drawer><span>Découvrir la boutique</span></button></div>`; return; }
      body.innerHTML = cart.map(lineHTML).join('') + summaryHTML() + (CFG.ordersPaused
        ? `<p class="paused" role="note">${esc(CFG.ordersPaused.message)}</p>`
        : `<button class="btn btn--fill magnetic" type="button" data-checkout><span>Passer la commande</span></button>
         <p class="small" style="margin:0;text-align:center">Aucun paiement à cette étape.</p>`);
    } else if (view === 'checkout') {
      title.textContent = 'Votre commande';
      const rOn = relayOn(); if (rOn && !relayCountry) relayCountry = RL.countries[0];
      const mOn = CFG.modesOn || {}, offerMain = mOn.main !== false, offerEns = mOn.ensemble !== false || (!rOn && !offerMain);   /* modes proposés (réglage d'Oriana) ; au moins un reste toujours disponible */
      const dflt = offerEns ? 'ensemble' : (offerMain ? 'main' : 'relais'), api = !!payApi();
      body.innerHTML = `<button class="rm" type="button" data-back style="text-align:left">← Retour au panier</button><div id="sumBox">${summaryHTML(dflt)}</div>
        <form class="cform" id="checkoutForm" novalidate>
          <div class="field two"><div><label for="oFirst">Prénom</label><input id="oFirst" name="first" autocomplete="given-name" required><span class="err" data-err="first"></span></div>
          <div><label for="oLast">Nom</label><input id="oLast" name="last" autocomplete="family-name" required><span class="err" data-err="last"></span></div></div>
          <div class="field"><label for="oPhone">Téléphone</label><input id="oPhone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required><span class="err" data-err="phone"></span></div>
          <div class="field"><label for="oMail">E-mail <small>${api ? '(pour la confirmation et le suivi du colis)' : '(facultatif)'}</small></label><input id="oMail" name="email" type="email" autocomplete="email"${api ? ' required' : ''}><span class="err" data-err="email"></span></div>
          <div class="field"><span class="label">Remise de la pièce</span>
            <div class="mode${rOn ? ' mode--relay' : ''}" role="radiogroup" aria-label="Remise de la pièce">
              ${rOn ? `<label><input type="radio" name="mode" value="relais"${dflt === 'relais' ? ' checked' : ''}><span>Livraison en point relais</span></label>` : ''}
              ${offerMain ? `<label><input type="radio" name="mode" value="main"${dflt === 'main' ? ' checked' : ''}><span>En main propre</span></label>` : ''}
              ${offerEns ? `<label><input type="radio" name="mode" value="ensemble"${dflt === 'ensemble' ? ' checked' : ''}><span>On voit ensemble</span></label>` : ''}
            </div></div>          ${rOn ? relayFieldHTML() : ''}
          <div class="field"><label for="oNote">Un mot pour moi <small>(facultatif)</small></label><textarea id="oNote" name="note" rows="3" placeholder="Une précision sur un coloris, une date souhaitée…"></textarea></div>
          ${api ? '<p class="small" style="margin:0">Vous recevrez par e-mail la confirmation de votre commande, le numéro de suivi du colis, puis une seule demande d’avis après réception.</p>' : ''}
          <button type="submit" class="btn btn--fill magnetic"><span>Valider ma commande</span></button>
        </form>`;
      const f = $('#checkoutForm');
      const syncMode = () => {
        const m = f.elements.mode.value, rf = $('#relayField');
        if (rf) rf.hidden = m !== 'relais';
        $('#sumBox').innerHTML = summaryHTML(m);                                           /* les frais de livraison suivent le mode choisi */
      };
      f.addEventListener('change', e => { if (e.target.name === 'mode') syncMode(); });
      if (rOn) {
        f.elements.relay._ui = $('.relay__search [data-relay-open]');                      /* pour que validate() signale et cible le bouton, pas le champ caché */
        f.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'oPostal') { e.preventDefault(); openRelay(); } });   /* Entrée dans le code postal ouvre la carte au lieu de valider la commande */
        if (relay) f.elements.mode.value = 'relais';                                       /* point déjà choisi (retour au panier puis à la commande) */
        renderRelayChosen();
      }
      syncMode();
      f.addEventListener('submit', onCheckout);
    } else if (view === 'done') {
      title.textContent = 'Commande prête';
      const link = sumupLink(order.total), text = orderText(order);
      const ig = `https://ig.me/m/${CFG.instagram}`;
      const sms = CFG.phone ? `sms:${CFG.phone.replace(/\s/g, '')}?&body=${encodeURIComponent(text)}` : '';
      const mail = CFG.email ? `mailto:${CFG.email}?subject=${encodeURIComponent('Commande ' + order.ref)}&body=${encodeURIComponent(text)}` : '';
      const recapBlock = `<textarea class="recap" readonly aria-label="Récapitulatif de la commande">${esc(text)}</textarea>
          <div class="row">
            <button type="button" class="btn btn--fill" data-send="ig"><span>Envoyer par Instagram</span></button>
            ${sms ? `<a class="btn btn--ghost" href="${sms}"><span>Par SMS</span></a>` : ''}
            ${mail ? `<a class="btn btn--ghost" href="${mail}"><span>Par e-mail</span></a>` : ''}
            <button type="button" class="btn btn--ghost" data-copy><span>Copier</span></button>
          </div>`;
      body.innerHTML = autoOrders()
        /* commandes automatiques : la cliente règle, et tout le reste (message à Oriana, bordereau, e-mails) part tout seul ; le récapitulatif ne sert qu'en cas de souci de paiement */
        ? `<p class="orderref">Commande ${esc(order.ref)} · ${money(order.total)}</p>
        <div class="steps-pay"><h4>Réglez votre commande</h4>
          <p class="small" style="margin:0">${order.paid ? '' : 'Dès le paiement, Oriana reçoit votre commande et vous recevez la confirmation par e-mail (' + esc(order.email) + '), puis le numéro de suivi de votre colis.'}</p>
          ${payHTML(link)}
        </div>
        ${order.paid ? '' : `<details class="steps-pay"><summary>Un souci avec le paiement par carte ?</summary>
          <p class="small" style="margin:.6rem 0">Envoyez-moi votre commande par message : je vous enverrai un lien de paiement.</p>${recapBlock}</details>`}
        <button class="rm" type="button" data-clear style="text-align:center">Vider le panier et fermer</button>`
        : `<p class="orderref">Commande ${esc(order.ref)} · ${money(order.total)}</p>
        <div class="steps-pay"><h4>1. Envoyez-moi le récapitulatif</h4>
          <p class="small" style="margin:0">Ce message me transmet votre commande : elle est prise en compte dès que je le reçois.</p>
          ${recapBlock}</div>
        <div class="steps-pay"><h4>2. Réglez avec SumUp</h4>
          ${payHTML(link)}
        </div>
        <button class="rm" type="button" data-clear style="text-align:center">Vider le panier et fermer</button>`;
      body._ig = ig;
    } else if (view === 'sumup') {
      title.textContent = 'Montants SumUp';
      const amounts = sumupAmounts(2);
      const have = Object.keys((CFG.sumup && CFG.sumup.links) || {}).map(Number);
      body.innerHTML = `<p class="small" style="margin:0">À créer dans SumUp (Liens de paiement, montant fixe) puis à coller dans <code>js/config.js</code>. Un lien par montant : le site propose automatiquement le bon lien selon le total de la commande (1 ou 2 articles couverts, avec ou sans les frais de livraison).</p>
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
    if (shipBase) [...sums].forEach(v => sums.add(Math.round((v + shipBase) * 100) / 100));   /* + les frais de livraison (point relais) */
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
    if (CFG.ordersPaused) { toast(CFG.ordersPaused.message); return; }
    const f = e.target;
    const rules = {
      first: v => v ? '' : 'Votre prénom, s’il vous plaît.',
      last: v => v ? '' : 'Votre nom, s’il vous plaît.',
      phone: (v, form) => form.elements.mode.value === 'relais'
        ? (/^(?:(?:\+|00)33[\s.\-]?|0)[67](?:[\s.\-]?\d{2}){4}$/.test(v) ? '' : 'Un numéro de mobile (06 ou 07) est nécessaire : Mondial Relay vous y envoie le message de retrait.')
        : (/^[+\d][\d\s.\-()]{7,}$/.test(v) ? '' : 'Un numéro valide pour vous joindre.'),
      email: v => (!v && payApi()) ? 'Votre e-mail, pour recevoir la confirmation et le suivi.' : (!v || /^\S+@\S+\.\S+$/.test(v) ? '' : 'Adresse e-mail incomplète.')
    };
    if (f.elements.relay) rules.relay = (v, form) => form.elements.mode.value === 'relais' && !relay ? 'Choisissez votre point relais ou locker sur la carte.' : '';
    if (!validate(f, rules)) return;
    const fd = new FormData(f), mode = fd.get('mode'), subtotal = cartTotal(), shipping = shipFee(mode);
    order = { ref: orderRef(), lines: cart.map(l => ({ ...l })), subtotal, shipping, total: Math.round((subtotal + shipping) * 100) / 100, first: fd.get('first').trim(), last: fd.get('last').trim(), phone: fd.get('phone').trim(), email: (fd.get('email') || '').trim(), mode,
      relay: mode === 'relais' ? relay : null, note: (fd.get('note') || '').trim() };
    view = 'done'; renderDrawer(); $('#dBody').scrollTop = 0;
  }

  /* formulaire de carte SumUp (Payment Widget) : chargé seulement quand la cliente clique sur « Payer par carte ».
     Le serveur (paiement-serveur/sumup-worker.js) recalcule le total et crée le paiement ; le navigateur ne voit jamais la clé API. */
  let sumupSdk = null, sumupCard = null;
  const loadSumUp = () => sumupSdk || (sumupSdk = new Promise((resolve, reject) => {
    if (window.SumUpCard) { resolve(); return; }
    const s = document.createElement('script'); s.src = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js'; s.async = true;
    s.onload = () => (window.SumUpCard ? resolve() : reject(new Error('sdk')));
    s.onerror = () => { sumupSdk = null; reject(new Error('sdk')); };
    document.head.appendChild(s);
  }));
  /* ce que le serveur de commandes reçoit : le panier (il recalcule tout), le mode de remise, et de quoi préparer le colis et écrire à la cliente
     (prénom, nom, téléphone, e-mail, point relais choisi, petit mot). Aucune donnée de carte : elle est saisie chez SumUp. */
  function checkoutBody(lines) {
    const r = order.relay, relayBody = order.mode === 'relais' && r ? { id: r.id, code: r.code || '', name: r.name, street: r.streetName || '', house: r.houseNumber || '', postal: r.postal, city: r.city, country: r.country, type: r.type } : null;
    return { ref: order.ref, lines, mode: order.mode, customer: { first: order.first, last: order.last, phone: order.phone, email: order.email }, relay: relayBody, note: order.note || '' };
  }
  async function startCardPayment() {
    const api = payApi(), box = $('#payCard'), st = $('#payStatus'), btn = $('[data-pay-card]');
    if (!api || !box || !order || order.paid) return;
    const say = (msg, kind) => { st.textContent = msg; st.dataset.kind = kind || ''; };
    const fail = msg => { say(msg, 'error'); btn.disabled = false; btn.removeAttribute('aria-busy'); };
    box.hidden = false; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    try {
      say('Préparation du paiement sécurisé…');
      const lines = order.lines.map(l => l.article ? { pid: l.pid, qty: l.qty } : { pid: l.pid, model: l.model, size: l.size, colors: l.colors, finish: l.finish, qty: l.qty });
      const [, res] = await Promise.all([loadSumUp(), fetch(api + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checkoutBody(lines)) })]);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutId) { const e = new Error('serveur'); e.detail = res.status < 500 && typeof data.error === 'string' ? data.error : ''; throw e; }   /* message français du serveur pour les refus clairs (prix changé, mode retiré, pièce vendue...) */
      if (Math.abs(Number(data.amount) - order.total) > 0.005) throw new Error('montant');   /* le serveur recalcule le total : s'il diffère du panier affiché, on s'arrête */
      say('Saisissez votre carte : ' + money(order.total) + ' seront débités.');
      if (sumupCard && sumupCard.unmount) { try { sumupCard.unmount(); } catch (_) { /* déjà retiré */ } }
      sumupCard = window.SumUpCard.mount({
        id: 'sumup-card', checkoutId: data.checkoutId, locale: 'fr-FR', country: 'FR',
        onResponse: async type => {
          if (type === 'sent') say('Paiement en cours…');
          else if (type === 'auth-screen') say('Votre banque vous demande de valider le paiement…');
          else if (type === 'error' || type === 'fail') fail('Le paiement n’a pas abouti. Vérifiez votre carte ou réessayez.');
          else if (type === 'success') {   /* « success » ne prouve pas le paiement : on demande à SumUp, via le serveur */
            say('Vérification du paiement…');
            try {
              const r = await fetch(api + '/status?id=' + encodeURIComponent(data.checkoutId)), s = await r.json();
              if (s.paid && Math.abs(Number(s.amount) - order.total) < 0.005) onPaid();
              else fail('Le paiement n’a pas abouti. Vous pouvez réessayer, ou m’envoyer la commande : je vous enverrai un lien.');
            } catch (_) { fail('Impossible de vérifier le paiement pour le moment. Écrivez-moi avec le récapitulatif : je vérifierai de mon côté.'); }
          }
        }
      });
    } catch (err) {
      fail(err && err.message === 'montant' ? 'Le montant a changé : rouvrez le panier et recommencez.' : err && err.detail ? err.detail : 'Le paiement par carte est momentanément indisponible. Envoyez-moi le récapitulatif ci-dessus : je vous enverrai un lien de paiement SumUp.');
    }
  }
  function onPaid() {
    if (sumupCard && sumupCard.unmount) { try { sumupCard.unmount(); } catch (_) { /* déjà retiré */ } }
    sumupCard = null;
    order.paid = true; order.paidAt = Date.now();
    cart = []; saveCart(); refreshBadges(); renderDrawer(); $('#dBody').scrollTop = 0;
    toast('Paiement reçu, merci !');
  }

  function bindDrawer() {
    const d = $('#drawer');
    d.addEventListener('click', async e => {
      if (e.target.closest('[data-pay-card]')) { startCardPayment(); return; }
      if (e.target.closest('[data-relay-open]')) { openRelay(); return; }
      const rc = e.target.closest('[data-relay-country]');
      if (rc) {                                                    /* autre pays de livraison : le point choisi n'est plus valable */
        relayCountry = rc.dataset.relayCountry;
        if (relay && relay.country.toLowerCase() !== relayCountry) { relay = null; renderRelayChosen(); const b = $('.relay__search [data-relay-open] span'); if (b) b.textContent = 'Voir les points les plus proches'; }
        $$('[data-relay-country]').forEach(b => b.setAttribute('aria-pressed', String(b === rc)));
        return;
      }
      if (e.target.closest('[data-close-drawer]')) { closeDrawer(); return; }
      if (e.target.closest('[data-checkout]')) { view = 'checkout'; renderDrawer(); $('#dBody').scrollTop = 0; return; }
      if (e.target.closest('[data-back]')) { view = 'cart'; renderDrawer(); return; }
      const line = e.target.closest('.oline');
      if (line) {
        const i = +line.dataset.i;
        if (e.target.closest('[data-inc]')) cart[i].qty = Math.min(cart[i].max || 20, cart[i].qty + 1);
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
  /* Finitions proposées selon la pièce demandée : mêmes règles que la boutique (MPC_FINISH_RULES).
     Pochette : bordures seulement ; sac cabas et chaîne de téléphone : couleurs seulement (le champ disparaît) ; sacs : pas de bordure. */
  const CUSTOM_PRODUCT = { 'Pochette d’ordinateur / iPad': 'pochette', 'Sac cabas': 'cabas', 'Sac personnalisé': 'sac', 'Panier (format sur mesure)': 'panier-rond', 'Chaîne de téléphone': 'cordon', 'Autre idée': 'sac' };
  function applyFinishRules() {
    const sel = $('#cFinish'), field = sel.closest('.field');
    const type = $('#cType').value, pid = CUSTOM_PRODUCT[type];         /* aucune pièce choisie pour l'instant : tout est proposé (sauf les chaînes) */
    const allowed = pid ? finishIds(pid) : FINISHES.map(f => f.id);
    const idByName = Object.fromEntries(FINISHES.map(f => [f.name, f.id]));
    const bag = type === 'Sac personnalisé';                             /* la chaîne de 40 cm ne se propose que pour un sac (ni « Autre idée », ni aucun type choisi), et seulement si elle va avec les tons des coloris choisis */
    [...sel.options].forEach(o => { const id = idByName[o.text], ok = allowed.includes(id) && (!isChain(id) || (bag && chainOk(id, custom.colors))); o.hidden = !ok; o.disabled = !ok; });
    if (sel.options[sel.selectedIndex].disabled) sel.selectedIndex = 0;  /* la finition choisie n'existe plus pour cette pièce ou ces coloris : retour à « Sans détail » */
    field.hidden = !allowed.some(id => id !== 'aucune');
    const note = $('#cChainNote');
    if (note) {
      const some = [...sel.options].some(o => !o.disabled && isChain(idByName[o.text]));
      note.hidden = !bag; note.textContent = !bag ? '' : some ? 'Chaîne de 40 cm pour porter le sac à l’épaule. ' + (window.MPC_CHAIN_RULE || '') : 'Pas de chaîne avec un mélange de tons chauds et froids.';
    }
    if (sel._rebuild) sel._rebuild();
  }
  let customViewer = null;
  function updateCustomViewer() {
    const type = CUSTOM_TYPES[$('#cType').value] || 'bag';
    const fin = ({ 'Bordure dorée': 'dore', 'Bordure argentée': 'argente', 'Perles': 'perles', 'Coquillages & étoiles dorés': 'charms', 'Marguerites brodées': 'fleurs', 'Chaîne dorée (40 cm)': 'chaine-doree', 'Chaîne argentée (40 cm)': 'chaine-argentee' })[$('#cFinish').value] || 'aucune';
    const c1 = custom.colors[0] || null, c2 = custom.colors[1] || null;
    if (customViewer) customViewer.setPiece(type, { c1, c2, assoc: custom.assoc, finish: fin });
    else {
      const svgType = type === 'tote' ? 'bag' : type;
      const model = !c2 ? 'm1' : svgType === 'bag' ? ({ mix: 'm2', duo: 'm3', contrast: 'm4' })[custom.assoc] : ({ mix: 'm3', duo: 'm4', contrast: 'm4' })[custom.assoc];
      $('#customFallback').innerHTML = window.mpcPreview(svgType, { c1: c1 || 'beige', c2, model, finish: fin });
    }
    $('#customCaption').textContent = c1
      ? custom.colors.map(c => COLOR[c].name).join(' + ') + (c2 ? ' · ' + ASSOC_LABEL[custom.assoc] : '') + (isChain(fin) ? ' · ' + $('#cFinish').value + ', non dessinée' : '')
      : 'Choisissez une couleur : la pièce se remplit du fil.';
  }
  function initCustomViewer() {
    const stage = $('#customViewer');
    customViewer = (window.MPC3D && window.MPC3D.create(stage)) || null;
    if (!customViewer) { stage.hidden = true; $('#customFallback').hidden = false; }
    $('#cType').addEventListener('change', () => { applyFinishRules(); updateCustomViewer(); });
    applyFinishRules();
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
    applyFinishRules();                                  /* une chaîne n'est proposée que si elle va avec les tons des coloris choisis */
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
      const text = `Bonjour Oriana, j’aimerais une demande personnalisée :\n\n• Pièce : ${v('type')}\n${v('dims') ? '• Dimensions / appareil : ' + v('dims') + '\n' : ''}• Couleurs : ${custom.colors.length ? custom.colors.map(c => COLOR[c].name).join(' + ') + (custom.colors.length > 1 ? ' (' + ASSOC_LABEL[custom.assoc] + ')' : '') : 'à définir ensemble'}\n${f.elements.finish.closest('.field').hidden ? '' : '• Finition : ' + v('finish') + '\n'}${v('msg') ? '• Mon idée : ' + v('msg') + '\n' : ''}\nPrénom : ${v('name')}\nContact : ${v('contact')}\n\nMerci beaucoup !`;
      const sent = $('#customSent');
      const sms = CFG.phone ? `sms:${CFG.phone.replace(/\s/g, '')}?&body=${encodeURIComponent(text)}` : '';
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
  /* listes d'origine dans data.js (MPC_GALLERY_DEFAULT, MPC_REVIEWS_DEFAULT) ; celles d'Oriana (espace pro : MPC_GALLERY, MPC_REVIEWS) les remplacent dès qu'elle les a enregistrées */
  function renderGallery() {
    const shown = window.MPC_GALLERY || window.MPC_GALLERY_DEFAULT || [];
    $('#gal').innerHTML = shown.map(g => `<figure class="gal__item" data-tilt><img src="${esc(g.src)}" alt="${esc(g.caption)}" loading="lazy" width="720" height="1280" decoding="async"><figcaption>${esc(g.caption)}</figcaption></figure>`).join('');
  }
  function renderReviews() {
    const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8L12 3.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    const realList = (window.MPC_REVIEWS || window.MPC_REVIEWS_DEFAULT || []).map(r => [r.src, r.caption]);
    const real = realList.map(([src, t]) => `<article class="rcard" role="listitem"><figure><img src="${esc(src)}" alt="${esc(t)}" loading="lazy" width="720" height="1280"></figure><p>${esc(t)}</p></article>`);
    const empty = (window.MPC_REVIEWS ? [] : [1, 2, 3]).map(() => `<article class="rcard rcard--empty" role="listitem" data-todo="avis-client"><div><div class="stars" aria-hidden="true">${star.repeat(5)}</div><b>Votre avis ici</b><span>Emplacement réservé à un avis client.</span></div></article>`);
    $('#rev').innerHTML = real.concat(empty).join('');
  }

  /* ---------- Contact ---------- */
  function setupContact() {
    if (CFG.phone) { $('#coordPhone').hidden = false; const a = $('#phoneLink'); a.href = 'tel:' + CFG.phone.replace(/\s/g, ''); a.textContent = /^\d{10}$/.test(CFG.phone) ? CFG.phone.replace(/(\d{2})(?=\d)/g, '$1 ') : CFG.phone; }   /* 0650677950 s'affiche 06 50 67 79 50 */
    if (CFG.email) { $('#coordMail').hidden = false; const a = $('#mailLink'); a.href = 'mailto:' + CFG.email; a.textContent = CFG.email; const b = $('#mailBtn'); b.href = 'mailto:' + CFG.email; b.hidden = false; }   /* adresse sous le téléphone + bouton « M’écrire par e-mail » à côté de celui d'Instagram */
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
    const modal = $('#modal'), drawer = $('#drawer'), am = $('#artModal'), amOpen = !!am && !am.hidden;
    if (e.key === 'Escape') { if (amOpen) closeArticle(); else if (!modal.hidden) closeModal(); else if (!drawer.hidden) closeDrawer(); }
    if (amOpen) trapTab(e, $('#artPanel')); else if (!modal.hidden) trapTab(e, $('#modalPanel')); else if (!drawer.hidden) trapTab(e, $('.drawer__panel'));
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
    function build() {                                      /* (re)construit la liste ; les options masquées (o.hidden) n'y figurent pas */
      list.textContent = ''; items.length = 0;
      opts.forEach((o, i) => {
        if (o.hidden || (o.value === '' && i === 0)) return;   /* le « Choisir… » sert de texte indicatif, pas d'option */
        const li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = `${id}-o${i}`; li.dataset.i = i;
        if (o.dataset.swatch) { const d = document.createElement('i'); d.className = 'cselect__sw'; d.style.background = o.dataset.swatch; li.appendChild(d); }
        li.appendChild(document.createTextNode(o.text)); list.appendChild(li); items.push(li);
      });
    }
    build();
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
    sel._rebuild = () => { build(); sync(); };               /* à rappeler après avoir masqué ou réaffiché des options */
    sync();
  }

  /* ---------- Init ---------- */
  if (PAGE === 'stock') {                                          /* page en-stock.html : les pièces en stock, la fiche d'une pièce, le panier et la commande */
    renderStockPage();
    bindArticleModal(); bindDrawer(); refreshBadges();
  } else {
    renderFilters(); renderGrid(); renderStockTeaser(); renderColorWall(); renderCustomSwatches(); renderGallery(); renderReviews(); setupContact();
    $$('select').forEach(enhanceSelect);
    initCustomViewer();
    bindModal(); bindArticleModal(); bindDrawer(); bindCustom(); refreshBadges();
  }
  if (cartNote) setTimeout(() => toast(cartNote), 1400);
  const onClick = (sel, fn) => { const el = $(sel); if (el) el.addEventListener('click', fn); };
  onClick('#cartOpen', () => openDrawer('cart'));
  onClick('#fab', () => openDrawer('cart'));
  onClick('#sumupHelp', () => openDrawer('sumup'));
  $$('[data-ship-note]').forEach(el => { el.hidden = !relayShipOn(); });   /* phrase « livraison en point relais : frais indiqués sur chaque pièce » : seulement si ce mode de remise existe */
  window.addEventListener('resize', refreshBadges);

  window.MPC = {
    montantsSumUp() { const a = sumupAmounts(2); console.table(a.map(x => ({ 'montant (€)': x }))); return a; },
    open: openProduct, cart: () => cart.slice()
  };
})();



