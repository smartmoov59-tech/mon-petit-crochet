/* ==========================================================================
   CONTENU MODIFIABLE PAR ORIANA : applique ce que contient js/content.js (écrit par l'espace pro)
   Chargé APRÈS config.js et data.js, AVANT shop.js, motion.js et noel.js (voir index.html).

   Règle de sécurité : ce fichier ne fait confiance à rien. Chaque valeur est contrôlée (type, longueur, forme)
   et n'est jamais écrite comme du HTML : seulement comme TEXTE (textContent) ou comme adresse d'image
   limitée aux dossiers assets/img et assets/uploads. Une valeur incorrecte est ignorée : le site garde
   alors son texte d'origine.

   Ce qui est modifiable (et seulement cela) :
     texts     : un texte par repère data-t="..." de index.html (deux étoiles autour d'un mot = gras)
     photos    : slots (repère data-img="..."), galerie, retours clientes
     settings  : contact, frais de livraison et modes proposés, supplément finition, annonce, pause des commandes
     catalog   : prix, texte d'accroche, description, badge, masquage des pièces de la boutique
     articles  : nouveautés et pièces disponibles (section « Prêtes à partir »)
   ========================================================================== */
(function () {
  'use strict';
  var C = window.MPC_CONTENT;
  if (!C || typeof C !== 'object') return;
  var CFG = window.MPC_CONFIG || (window.MPC_CONFIG = {});

  var isObj = function (o) { return !!o && typeof o === 'object' && !Array.isArray(o); };
  var hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var str = function (v, max) { return typeof v === 'string' && v.length <= max ? v : null; };
  var num = function (v, min, max) { return typeof v === 'number' && isFinite(v) && v >= min && v <= max ? v : null; };
  var IMG = /^assets\/(img|uploads)\/[A-Za-z0-9_\-\/.]{1,120}\.(jpe?g|png|webp)$/;
  var img = function (v) { return typeof v === 'string' && IMG.test(v) && v.indexOf('..') === -1 ? v : null; };
  var KEY = /^[a-z0-9-]{1,40}\.[A-Za-z0-9-]{1,40}$/;

  /* ---------- 1. Réglages ---------- */
  var S = isObj(C.settings) ? C.settings : {};
  if (isObj(S.contact)) {
    var ph = str(S.contact.phone, 20); if (ph && /^[0-9+ .()-]{6,20}$/.test(ph)) CFG.phone = ph;
    var em = str(S.contact.email, 80); if (em && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(em)) CFG.email = em;
    var ig = str(S.contact.instagram, 30); if (ig && /^[A-Za-z0-9._]{1,30}$/.test(ig)) CFG.instagram = ig;
  }
  if (isObj(S.shipping)) {
    var fee = num(S.shipping.fee, 0, 50);
    var ship = isObj(CFG.shipping) ? CFG.shipping : (CFG.shipping = { fee: 0, modes: [] });
    if (fee !== null) ship.fee = fee;
    var on = {};
    ['relais', 'main', 'ensemble'].forEach(function (m) { if (typeof S.shipping[m] === 'boolean') on[m] = S.shipping[m]; });
    CFG.modesOn = on;                               /* modes de remise proposés (absent = proposé) : relire dans shop.js */
    if (on.relais === false) ship.modes = (ship.modes || []).filter(function (m) { return m !== 'relais'; });
  }
  if (isObj(S.pricing)) {
    var fs = num(S.pricing.finishSurcharge, 0, 50); if (fs !== null) CFG.finishSurcharge = fs;
  }
  if (isObj(S.ordersPaused) && S.ordersPaused.active === true) {
    CFG.ordersPaused = { message: str(S.ordersPaused.message, 200) || 'Les commandes sont momentanément en pause.' };
  }
  var rv = str(S.reviewUrl, 300); if (rv && /^https:\/\/[^\s"'<>]+$/.test(rv)) CFG.reviewUrl = rv;

  /* ---------- 2. Boutique : prix, textes d'accroche, masquage ---------- */
  var K = isObj(C.catalog) && isObj(C.catalog.products) ? C.catalog.products : {};
  (window.MPC_PRODUCTS || []).forEach(function (p) {
    var o = hasOwn(K, p.id) ? K[p.id] : null; if (!isObj(o)) return;
    if (typeof o.hidden === 'boolean') p.hidden = o.hidden;
    var t = str(o.tagline, 160); if (t) p.tagline = t;
    var d = str(o.desc, 700); if (d) p.desc = d;
    if (typeof o.badge === 'string' && o.badge.length <= 40) p.badge = o.badge;
    if (isObj(o.prices)) {
      (p.sizes || []).forEach(function (s) { var v = num(o.prices[s.id], 0.5, 2000); if (v !== null) s.price = v; });
      if (!p.sizes) (p.models || []).forEach(function (m) { var v = num(o.prices[m.id], 0.5, 2000); if (v !== null) m.price = v; });
    }
  });

  /* ---------- 3. Articles : nouveautés et pièces disponibles ---------- */
  var CATS = ['sacs', 'paniers', 'cordons', 'autres'];
  var list = Array.isArray(C.articles) ? C.articles : [];
  window.MPC_ARTICLES = list.slice(0, 60).map(function (a) {
    if (!isObj(a)) return null;
    var id = str(a.id, 40), name = str(a.name, 80), price = num(a.price, 0.5, 2000);
    if (!id || !/^[a-z0-9-]{3,40}$/.test(id) || !name || price === null) return null;
    var photos = (Array.isArray(a.photos) ? a.photos : []).map(img).filter(Boolean).slice(0, 8);
    var kind = a.kind === 'commande' ? 'commande' : 'dispo';
    var qty = kind === 'dispo' ? Math.max(0, Math.min(99, Math.floor(Number(a.qty) || 0))) : null;
    return {
      id: id, name: name, price: price, photos: photos, kind: kind, qty: qty,
      desc: str(a.desc, 700) || '', details: str(a.details, 200) || '',
      isNew: a.isNew === true, hidden: a.hidden === true,
      cat: CATS.indexOf(a.cat) >= 0 ? a.cat : 'autres'
    };
  }).filter(function (a) { return a && !a.hidden; });

  /* ---------- 4. Galerie et retours clientes ---------- */
  var P = isObj(C.photos) ? C.photos : {};
  var pics = function (arr) {
    return arr.slice(0, 40).map(function (x) {
      var s = isObj(x) ? img(x.src) : null; if (!s) return null;
      return { src: s, caption: str(x.caption, 160) || '' };
    }).filter(Boolean);
  };
  if (Array.isArray(P.gallery)) window.MPC_GALLERY = pics(P.gallery);
  if (Array.isArray(P.reviews)) window.MPC_REVIEWS = pics(P.reviews);

  /* ---------- 5. Textes et photos de la page (repères data-t / data-img) ---------- */
  function setText(el, v) {
    if (v.indexOf('**') === -1) { el.textContent = v; return; }
    el.textContent = '';
    v.split('**').forEach(function (part, i) {
      if (!part) return;
      if (i % 2) { var b = document.createElement('strong'); b.textContent = part; el.appendChild(b); }
      else el.appendChild(document.createTextNode(part));
    });
  }
  function applyPage() {
    var T = isObj(C.texts) ? C.texts : {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-t]'), function (el) {
      var k = el.getAttribute('data-t');
      if (!KEY.test(k) || !hasOwn(T, k)) return;
      var v = str(T[k], 600); if (v === null || !v.trim()) return;
      setText(el, v);
    });
    var slots = isObj(P.slots) ? P.slots : {};
    Array.prototype.forEach.call(document.querySelectorAll('img[data-img]'), function (im) {
      var k = im.getAttribute('data-img');
      if (!KEY.test(k) || !hasOwn(slots, k) || !isObj(slots[k])) return;
      var s = img(slots[k].src); if (s) im.setAttribute('src', s);
      var a = str(slots[k].alt, 200); if (a !== null) im.setAttribute('alt', a);
    });
    /* annonce (bandeau de texte dans l'en-tête de l'accueil) */
    var A = isObj(S.announcement) ? S.announcement : null;
    var host = document.querySelector('.hero__content');
    if (A && A.active === true && host && str(A.text, 200) && A.text.trim()) {
      var p = document.createElement('p'); p.className = 'announce'; p.setAttribute('role', 'status'); p.textContent = A.text.trim();
      host.insertBefore(p, host.querySelector('.hero__cta') || null);
    }
  }
  applyPage();   /* le DOM est déjà construit (scripts en fin de page) et motion.js n'a pas encore découpé les titres */

  window.MPC_CONTENT_REV = typeof C.rev === 'number' ? C.rev : 0;
})();
