/* ==========================================================================
   ESPACE PRO D'ORIANA : l'écran qui lui permet de modifier son site
   JavaScript pur : aucune bibliothèque, aucun service extérieur, aucune requête vers un autre site que le serveur de l'espace pro
   (adresse dans pro-config.js). Le serveur (pro-worker.js) re-vérifie tout ce qui est enregistré ; cet écran vérifie aussi, pour guider Oriana.

   RÈGLES DE SÉCURITÉ DE CE FICHIER (à ne jamais contourner) :
   1. Aucune donnée venant du serveur, de ../index.html, d'un fichier envoyé ou saisie par Oriana n'entre jamais dans la page comme du HTML :
      jamais innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function, setAttribute('on…'), srcdoc ni style en ligne.
      Seulement createElement, createTextNode, textContent et setAttribute avec des valeurs contrôlées (voir h() et setAttr()).
   2. Une adresse d'image n'est acceptée que sous la forme assets/(img|uploads)/… (même expression que le serveur, sans « .. »)
      ou si c'est un blob: créé ici par la page elle-même (voir safeSrc()). Aucune autre adresse venue des données n'est jamais utilisée.
   3. Le mot de passe ne part jamais sur le réseau et n'est gardé nulle part : seule la clé dérivée dans le navigateur est envoyée.
   4. Le jeton de session reste dans sessionStorage (jamais localStorage, jamais dans une adresse, jamais dans la console).
   ========================================================================== */

/* Anti-intégration : cette page ne doit jamais s'afficher dans un cadre d'un autre site. */
if (window.top !== window.self) { window.top.location = window.location; }

(function () {
  'use strict';
  if (window.top !== window.self) { return; }   /* si la sortie du cadre est refusée, on n'affiche rien */

  /* ======================================================================
     1. RÉGLAGES FIXES : limites (les mêmes que le serveur), libellés français
     ====================================================================== */
  var API = String(window.PRO_API || '').replace(/\/+$/, '');
  var API_OK = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~\/-]*)?$/.test(API);   /* https seulement : le jeton ne voyage jamais en clair */
  var SESSION_KEY = 'mpc-pro-session';
  var IDLE_MS = 30 * 60 * 1000;                 /* déconnexion automatique après 30 minutes sans action */
  var POLL_MS = 10000, POLL_MAX_MS = 12 * 60 * 1000;
  var NB = '\xA0';                              /* espace insécable (typographie française) */
  var COLON = NB + ': ';
  var FILES = ['settings', 'articles', 'catalog', 'texts', 'photos'];
  var VIEWS = ['articles', 'boutique', 'textes', 'photos', 'livraison', 'historique'];
  var IMG_RE = /^assets\/(img|uploads)\/[A-Za-z0-9_\-\/.]{1,120}\.(jpe?g|png|webp)$/;
  var UPLOAD_RE = /^assets\/uploads\/[0-9]{6}\/[0-9a-f]{12}\.(jpg|png|webp)$/;
  var TEXT_KEY = /^[a-z0-9-]{1,40}\.[A-Za-z0-9-]{1,40}$/;
  var SHA_RE = /^[0-9a-f]{40}$/;
  var MAX_ARTICLES = 60, MAX_ARTICLE_PHOTOS = 8, MAX_LIST_PHOTOS = 40, MAX_UPLOADS = 40;
  var MAX_JPEG = 1600000;                       /* octets : au-delà, la photo est réduite encore (le serveur refuse plus de 2,3 Mo de corps) */
  var MAX_SOURCE = 400 * 1000 * 1000;           /* photo d'origine : 400 Mo au maximum (simple garde-fou : une photo d'iPhone, même en 48 millions de pixels ou en Apple ProRAW, reste très en dessous) */
  var MAX_PIXELS = 300 * 1000 * 1000;           /* 300 millions de pixels au maximum (un iPhone en fait 48 millions au plus) */
  /* Le sélecteur de photos propose tout ce qui ressemble à une image, y compris les photos d'iPhone (HEIC) : le format réel est reconnu d'après le contenu, jamais d'après le nom ou le type annoncé */
  var PHOTO_ACCEPT = 'image/*,.heic,.heif,.avif,.webp,.tif,.tiff,.bmp,.gif,.jfif';
  var UNREADABLE = 'Cette photo n’est pas lisible. Essayez une capture d’écran ou une autre photo.';
  var HEIC_HELP = 'Cette photo est au format HEIC (celui de l’iPhone) et ce navigateur ne sait pas la lire. Ouvrez l’espace pro depuis Safari (sur l’iPhone ou sur un Mac), ou, sur l’iPhone, choisissez Réglages > Appareil photo > Formats > « Le plus compatible » puis reprenez la photo.';
  var VIDEO_HELP = 'Ce fichier est une vidéo, pas une photo. Choisissez une photo.';
  var CATS = [['sacs', 'Sacs'], ['paniers', 'Paniers'], ['cordons', 'Chaînes de téléphone'], ['autres', 'Autres']];

  var SECTIONS = {
    header: 'En-tête', menu: 'Menu du téléphone', hero: 'Accueil', enstock: 'Bandeau « En stock » de l’accueil', stock: 'Page « En stock »', disponibles: 'Nouveautés de l’accueil', boutique: 'La boutique',
    couleurs: 'La palette de couleurs', instagram: 'Instagram', modeles: 'Les modèles', atelier: 'L’atelier', numbers: 'Chiffres clés',
    accessoires: 'Détails décoratifs', 'sur-mesure': 'Demande personnalisée', galerie: 'Galerie', avis: 'Retours clientes',
    infos: 'Questions fréquentes', contact: 'Nous trouver', footer: 'Pied de page'
  };
  var SLOT_LABELS = {
    'hero.img1': 'Accueil' + COLON + 'photo de fond',
    'instagram.img1': 'Instagram' + COLON + 'vignette 1', 'instagram.img2': 'Instagram' + COLON + 'vignette 2',
    'instagram.img3': 'Instagram' + COLON + 'vignette 3', 'instagram.img4': 'Instagram' + COLON + 'vignette 4',
    'modeles.img1': 'Les modèles' + COLON + 'photo 1', 'modeles.img2': 'Les modèles' + COLON + 'photo 2',
    'modeles.img3': 'Les modèles' + COLON + 'photo 3', 'modeles.img4': 'Les modèles' + COLON + 'photo 4',
    'atelier.img1': 'L’atelier' + COLON + 'photo de fond', 'atelier.img2': 'L’atelier' + COLON + 'diaporama 1',
    'atelier.img3': 'L’atelier' + COLON + 'diaporama 2', 'atelier.img4': 'L’atelier' + COLON + 'diaporama 3',
    'atelier.img5': 'L’atelier' + COLON + 'diaporama 4',
    'accessoires.img1': 'Détails décoratifs' + COLON + 'photo A', 'accessoires.img2': 'Détails décoratifs' + COLON + 'photo B'
  };
  var TAG_LABELS = {
    h1: 'Titre principal', h2: 'Titre', h3: 'Sous-titre', p: 'Paragraphe', a: 'Lien', li: 'Élément de liste', summary: 'Question', dt: 'Intitulé',
    dd: 'Détail', label: 'Intitulé de champ', legend: 'Légende', span: 'Texte', b: 'Texte', strong: 'Texte', small: 'Petit texte'
  };

  /* ======================================================================
     2. PETITS OUTILS
     ====================================================================== */
  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }
  var COMBINING = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36F) + ']', 'g');   /* accents « décomposés » (U+0300 à U+036F) */
  function norm(s) { return String(s).normalize('NFD').replace(COMBINING, '').toLowerCase(); }   /* recherche : sans accents ni majuscules */
  var uidN = 0;
  function uid(prefix) { uidN += 1; return (prefix || 'f') + uidN; }

  /* égalité de deux valeurs JSON (l'ordre des clés d'un objet ne compte pas) */
  function deepEqual(a, b) {
    var i, ka, kb;
    if (a === b) { return true; }
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) { return false; }
      for (i = 0; i < a.length; i++) { if (!deepEqual(a[i], b[i])) { return false; } }
      return true;
    }
    if (isObj(a)) {
      if (!isObj(b)) { return false; }
      ka = Object.keys(a); kb = Object.keys(b);
      if (ka.length !== kb.length) { return false; }
      for (i = 0; i < ka.length; i++) { if (!hasOwn(b, ka[i]) || !deepEqual(a[ka[i]], b[ka[i]])) { return false; } }
      return true;
    }
    return false;
  }

  /* 45 -> « 45 € », 12.5 -> « 12,50 € » */
  function fmtPrice(n) { return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + NB + '€'; }

  /* « mardi 11 novembre à 14 h 32 » (heure de l'appareil) */
  function fmtDate(iso) {
    var d = new Date(iso), now = new Date(), opt = { weekday: 'long', day: 'numeric', month: 'long' };
    if (isNaN(d.getTime())) { return 'Date inconnue'; }
    if (d.getFullYear() !== now.getFullYear()) { opt.year = 'numeric'; }
    return new Intl.DateTimeFormat('fr-FR', opt).format(d) + ' à ' + d.getHours() + NB + 'h' + NB + pad2(d.getMinutes());
  }

  /* même nettoyage que le serveur (fonction text() de pro-worker.js) : retours à la ligne unifiés, caractères de contrôle retirés, bords rognés */
  var LINE_SEPARATORS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');   /* les deux séparateurs de ligne Unicode, retirés eux aussi */
  function cleanText(v, multiline) {
    return String(v).replace(/\r\n?/g, '\n').replace(LINE_SEPARATORS, '')
      .replace(multiline ? /[\x00-\x09\x0B-\x1F\x7F]/g : /[\x00-\x1F\x7F]/g, '').trim();
  }

  /* nombre saisi à la française : « 12,50 », « 12.5 », « 45 € » -> nombre, ou null si ce n'est pas un nombre */
  function parseMoney(raw) {
    var s = String(raw).replace(/[\s€]/g, '').replace(',', '.');   /* \s couvre aussi l'espace insécable */
    return /^[0-9]+(\.[0-9]+)?$/.test(s) ? Number(s) : null;
  }

  /* identifiant d'un nouvel article : « a- » + base 36 de l'heure + « - » + 3 caractères au hasard (ex. a-lz4k2x9-f3q) */
  function newArticleId(list) {
    var id, a, s, i;
    do {
      a = new Uint8Array(3); crypto.getRandomValues(a); s = '';
      for (i = 0; i < 3; i++) { s += (a[i] % 36).toString(36); }
      id = 'a-' + Date.now().toString(36) + '-' + s;
    } while (list.some(function (x) { return x.id === id; }));
    return id;
  }

  /* ======================================================================
     3. FABRIQUE D'ÉLÉMENTS : LA SEULE PORTE D'ENTRÉE DES TEXTES DANS LA PAGE
     Les textes passent par textContent / createTextNode, les valeurs de champs par la propriété value,
     et seuls les attributs de la liste blanche ci-dessous peuvent être posés.
     ====================================================================== */
  var ATTRS = /^(id|for|type|name|placeholder|role|alt|src|decoding|min|max|step|maxlength|rows|inputmode|autocomplete|autocapitalize|autocorrect|spellcheck|accept|tabindex|title|enterkeyhint|aria-[a-z]+)$/;
  var SVGNS = 'http://www.w3.org/2000/svg';

  var state = {
    session: null,            /* { token, exp, last } */
    params: null,             /* réponse de /auth/params : { salt, iterations, totp } */
    loaded: false,            /* le contenu du site a été lu */
    busy: false,              /* une publication, un retour en arrière ou un rechargement est en cours */
    pending: 0,               /* nombre de photos en cours d'envoi */
    files: null,              /* version du serveur (dernier GET /content) */
    shas: {},                 /* empreintes de cette version */
    work: null,               /* copie de travail : ce que modifie Oriana */
    corrupt: [],              /* fichiers illisibles côté serveur */
    uploads: [],              /* photos envoyées mais pas encore publiées : [{ path, sha }] */
    blobs: new Map(),         /* chemin d'une photo envoyée -> blob: local pour l'afficher tout de suite */
    ownBlobs: new Set(),      /* tous les blob: créés par cette page (seuls autorisés comme adresse d'image) */
    errors: new Map(),        /* champs invalides de l'écran affiché : bloquent la publication */
    view: 'articles',
    page: null,               /* textes et photos modifiables, lus dans ../index.html */
    renderId: 0,              /* repère de l'affichage en cours (pour ignorer les réponses tardives) */
    poll: null,               /* suivi de la mise en ligne */
    formDirty: null,          /* fonction : le formulaire d'article ouvert contient-il des changements ? */
    openSections: new Set(),  /* sections repliables ouvertes dans l'onglet Textes */
    query: ''                 /* recherche en cours dans l'onglet Textes */
  };

  /* adresse d'image affichable : un blob: créé ici, ou « ../ » + un chemin assets/(img|uploads)/… valide ; sinon chaîne vide */
  function isValidImagePath(p) { return typeof p === 'string' && IMG_RE.test(p) && p.indexOf('..') === -1; }
  function safeSrc(v) {
    if (typeof v !== 'string') { return ''; }
    if (state.ownBlobs.has(v)) { return v; }
    return v.slice(0, 3) === '../' && isValidImagePath(v.slice(3)) ? v : '';
  }
  function imageUrl(path) { return state.blobs.has(path) ? state.blobs.get(path) : (isValidImagePath(path) ? '../' + path : ''); }

  function setAttr(el, name, value) {
    var v = String(value);
    if (!ATTRS.test(name)) { throw new Error('attribut non autorisé'); }
    if (name === 'src') { v = safeSrc(v); if (!v) { return; } }
    el.setAttribute(name, v);
  }

  /* h('div', { class, text, on: { click: fn }, value, disabled, ...attributs autorisés }, [enfants]) ; un enfant « string » devient un nœud texte */
  function h(tag, props, kids) {
    var el = document.createElement(tag), p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v === undefined || v === null || v === false || k === 'value') { return; }
      if (k === 'class') { el.className = v; }
      else if (k === 'text') { el.textContent = v; }
      else if (k === 'on') { Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); }); }
      else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'multiple') { el[k] = true; }
      else { setAttr(el, k, v === true ? '' : v); }
    });
    if (p.value !== undefined && p.value !== null) { el.value = p.value; }
    (kids || []).forEach(function (c) { if (c) { el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); } });
    return el;
  }
  function clear(el) { while (el.firstChild) { el.removeChild(el.firstChild); } }
  function byId(id) { return document.getElementById(id); }

  /* icônes : tracés fixes écrits ici, jamais issus de données */
  var ICONS = {
    plus: ['M12 5v14', 'M5 12h14'],
    x: ['M18 6L6 18', 'M6 6l12 12'],
    check: ['M20 6L9 17l-5-5'],
    sold: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'],
    up: ['M12 19V5', 'M5 12l7-7 7 7'],
    down: ['M12 5v14', 'M19 12l-7 7-7-7'],
    edit: ['M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'],
    trash: ['M3 6h18', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
    eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    eyeoff: ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94', 'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19', 'M14.12 14.12a3 3 0 1 1-4.24-4.24', 'M1 1l22 22'],
    copy: ['M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
    image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8.5 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', 'M21 15l-5-5L5 21'],
    camera: ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
    star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
    undo: ['M1 4v6h6', 'M3.51 15a9 9 0 1 0 2.13-9.36L1 10']
  };
  function icon(name) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'icon'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    ICONS[name].forEach(function (d) { var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); s.appendChild(p); });
    return s;
  }
  /* bouton avec icône facultative */
  function button(label, cls, onClick, iconName, extra) {
    var kids = [];
    if (iconName) { kids.push(icon(iconName)); }
    kids.push(h('span', { text: label }));
    return h('button', Object.assign({ type: 'button', class: cls, on: { click: onClick } }, extra || {}), kids);
  }
  /* image d'un chemin du site ou d'un blob: de la page ; masquée si elle ne se charge pas (par exemple pas encore en ligne) */
  function picture(srcOrPath, alt) {
    var img = h('img', { alt: alt || '', decoding: 'async' });
    var url = state.ownBlobs.has(srcOrPath) ? srcOrPath : imageUrl(srcOrPath);
    if (url) { setAttr(img, 'src', url); }
    img.addEventListener('error', function () { img.className = 'is-broken'; });
    return img;
  }

  /* ======================================================================
     4. MESSAGES : petites bulles, état de la mise en ligne
     ====================================================================== */
  var toastsEl = byId('toasts');
  function toast(message, opts) {
    var o = opts || {}, item, timer;
    function remove() { clearTimeout(timer); if (item.parentNode) { item.parentNode.removeChild(item); } }
    item = h('div', { class: 'toast' + (o.error ? ' toast--err' : '') }, [h('span', { text: message })]);
    if (o.action) { item.appendChild(h('button', { type: 'button', class: 'toast__btn', text: o.action.label, on: { click: function () { remove(); o.action.run(); } } })); }
    item.appendChild(h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Fermer ce message', on: { click: remove } }, [icon('x')]));
    while (toastsEl.children.length >= 3) { toastsEl.removeChild(toastsEl.firstChild); }
    toastsEl.appendChild(item);
    timer = setTimeout(remove, o.error ? 14000 : 8000);
  }
  function messageOf(e) { return e && typeof e.userMessage === 'string' ? e.userMessage : 'Une erreur est survenue. Réessayez dans un instant.'; }

  var banner = { box: byId('banner'), head: byId('bannerHead'), body: byId('bannerBody'), link: byId('bannerLink'), live: byId('live') };
  function showBanner(head, body, opts) {
    var o = opts || {};
    banner.head.textContent = head; banner.body.textContent = body;
    banner.live.textContent = head + ' ' + body;               /* zone cachée lue par les lecteurs d'écran à chaque changement d'état */
    banner.link.hidden = !o.link;
    banner.box.className = 'banner' + (o.warn ? ' banner--warn' : '');
    banner.box.hidden = false;
  }
  function hideBanner() { banner.box.hidden = true; }

  /* ======================================================================
     5. SERVEUR : demandes, erreurs, session
     ====================================================================== */
  class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; this.userMessage = message; }
  }
  class UserError extends Error {
    constructor(message) { super(message); this.userMessage = message; }
  }
  var GENERIC = { 401: 'Votre session a pris fin. Reconnectez-vous.', 403: 'Accès refusé.', 413: 'Ce fichier est trop lourd.', 415: 'Ce format n’est pas accepté.',
    429: 'Trop d’essais. Réessayez dans quelques minutes.' };
  /* seul le message français renvoyé par le serveur ({ "error": "…" }) ou un message générique est montré : jamais de détail technique */
  function apiMessage(status, data) {
    if (isObj(data) && typeof data.error === 'string' && data.error.trim()) { return data.error.trim().slice(0, 300); }
    if (GENERIC[status]) { return GENERIC[status]; }
    return status >= 500 ? 'Le serveur ne répond pas pour le moment. Réessayez dans un instant.' : 'Une erreur est survenue. Réessayez dans un instant.';
  }

  /* une demande au serveur de l'espace pro ; body = objet (envoyé en JSON) ou texte JSON déjà prêt */
  async function request(method, path, body, auth, timeout) {
    var headers = { Accept: 'application/json' }, res, data = {}, ctrl, timer;
    if (!API_OK) { throw new ApiError(0, 'L’espace pro n’est pas encore relié à son serveur.'); }
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; }
    if (auth) {
      if (!state.session) { throw new ApiError(401, GENERIC[401]); }
      headers.Authorization = 'Bearer ' + state.session.token;
    }
    ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout || 30000) : 0;
    try {
      res = await fetch(API + path, {
        method: method, headers: headers, cache: 'no-store', credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer',
        body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), signal: ctrl ? ctrl.signal : undefined
      });
      data = await res.json().catch(function () { return {}; });
    } catch (e) {
      throw new ApiError(0, ctrl && ctrl.signal.aborted ? 'Le serveur met trop de temps à répondre. Réessayez dans un instant.'
        : 'Impossible de joindre le serveur. Vérifiez votre connexion à internet, puis réessayez.');
    } finally { clearTimeout(timer); }
    if (!res.ok) { throw new ApiError(res.status, apiMessage(res.status, data)); }
    return data;
  }

  /* demande avec session : si le serveur répond 401, on revient à l'écran de connexion SANS rien perdre, puis on recommence */
  async function authed(method, path, body, timeout) {
    for (var attempt = 0; ; attempt++) {
      if (!state.session) { await askLogin('expired'); }
      try { return await request(method, path, body, true, timeout); }
      catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401 || attempt >= 1) { throw e; }
        dropSession(); await askLogin('expired');
      }
    }
  }

  function readSession() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!isObj(s) || typeof s.token !== 'string' || !/^[A-Za-z0-9._\-]{20,1500}$/.test(s.token) || typeof s.exp !== 'number' || typeof s.last !== 'number') { return null; }
      if (Date.now() - s.last > IDLE_MS || Date.now() / 1000 >= s.exp - 5) { return null; }
      return { token: s.token, exp: s.exp, last: s.last };
    } catch (e) { return null; }
  }
  function saveSession() {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: state.session.token, exp: state.session.exp, last: state.session.last })); } catch (e) { /* stockage indisponible : la session ne survivra pas à un rechargement */ }
  }
  function dropSession() {
    state.session = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* rien à faire */ }
  }

  /* ======================================================================
     6. FENÊTRES (formulaire, confirmations, attente) : une pile ; tout ce qui est dessous devient inerte
     ====================================================================== */
  var appEl = byId('app'), loginEl = byId('login'), overlaysEl = byId('overlays'), mainEl = byId('main'), tabsEl = byId('tabs');
  var stack = [];

  function loginVisible() { return !loginEl.hidden; }
  function refreshInert() {
    var login = loginVisible();
    appEl.toggleAttribute('inert', login || stack.length > 0);
    overlaysEl.toggleAttribute('inert', login);
    stack.forEach(function (layer, i) { layer.root.toggleAttribute('inert', i < stack.length - 1); });
    document.body.classList.toggle('is-locked', login || stack.length > 0);
  }
  function firstFocusable(root) {
    return root.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || root;
  }
  function openLayer(root, o) {
    var layer = { root: root, onEscape: o.onEscape || null, opener: document.activeElement };
    overlaysEl.appendChild(root); stack.push(layer); refreshInert();
    (o.focus || firstFocusable(root)).focus();
    return layer;
  }
  function closeLayer(layer) {
    var i = stack.indexOf(layer);
    if (i < 0) { return; }
    stack.splice(i, 1);
    if (layer.root.parentNode) { layer.root.parentNode.removeChild(layer.root); }
    refreshInert();
    if (layer.opener && document.contains(layer.opener) && typeof layer.opener.focus === 'function') { layer.opener.focus(); }
  }
  document.addEventListener('keydown', function (e) {
    var top = stack[stack.length - 1];
    if (e.key === 'Escape' && top && top.onEscape && !loginVisible()) { e.preventDefault(); top.onEscape(); }
  });
  /* pour les navigateurs sans « inert » : le focus ne sort pas de la fenêtre ouverte */
  document.addEventListener('focusin', function (e) {
    var top = stack[stack.length - 1];
    if (top && !loginVisible() && !top.root.contains(e.target)) { firstFocusable(top.root).focus(); }
  });

  /* demande de confirmation : renvoie une promesse (true = « oui ») ; pour une action grave, le focus est sur « non » ;
     no: null = simple message avec un seul bouton */
  function confirmBox(o) {
    return new Promise(function (resolve) {
      var layer, yes, no, tid = uid('t'), did = uid('d');
      function done(v) { closeLayer(layer); resolve(v); }
      yes = button(o.yes, 'btn ' + (o.danger ? 'btn--danger' : 'btn--primary'), function () { done(true); });
      no = o.no === null ? null : button(o.no || 'Annuler', 'btn btn--ghost', function () { done(false); });
      layer = openLayer(h('div', { class: 'overlay overlay--dialog', tabindex: '-1' }, [
        h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': tid, 'aria-describedby': did }, [
          h('h2', { class: 'dialog__title', id: tid, text: o.title }),
          h('p', { class: 'dialog__text', id: did, text: o.text }),
          h('div', { class: 'dialog__btns' }, no ? [no, yes] : [yes])
        ])
      ]), { onEscape: function () { done(false); }, focus: o.danger && no ? no : yes });
    });
  }
  /* écran d'attente pendant une opération qui ne doit pas être interrompue (publication, retour en arrière) */
  async function withBusy(message, fn) {
    var layer = openLayer(h('div', { class: 'overlay overlay--busy', tabindex: '-1' }, [
      h('div', { class: 'busy', role: 'status' }, [h('span', { class: 'spinner' }), h('span', { text: message })])
    ]), {});
    state.busy = true; refreshBar();
    try { return await fn(); } finally { state.busy = false; closeLayer(layer); refreshBar(); }
  }

  /* ======================================================================
     7. CONNEXION : identifiant + mot de passe (+ code à 6 chiffres), clé calculée dans le navigateur
     ====================================================================== */
  var loginEls = { form: byId('loginForm'), user: byId('loginUser'), pass: byId('loginPass'), code: byId('loginCode'), codeField: byId('codeField'),
    msg: byId('loginMsg'), btn: byId('loginBtn'), note: byId('loginNote') };
  var loginWaiters = [], loginBusy = false;
  var LOGIN_NOTES = {
    expired: 'Votre session a pris fin. Reconnectez-vous',
    idle: 'Vous avez été déconnectée après 30 minutes sans action. Reconnectez-vous'
  };

  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2), i;
    for (i = 0; i < out.length; i++) { out[i] = parseInt(hex.substr(i * 2, 2), 16); }
    return out;
  }
  function bytesToHex(bytes) { return Array.prototype.map.call(bytes, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(''); }

  /* clé = PBKDF2-HMAC-SHA-256 (mot de passe NFKC en UTF-8, sel, tours reçus, 32 octets) en hexadécimal : le mot de passe, lui, ne part jamais */
  async function deriveKey(password, saltHex, iterations) {
    if (!window.crypto || !crypto.subtle) { throw new UserError('Ce navigateur ne permet pas la connexion sécurisée. Utilisez un navigateur récent (Safari, Chrome, Firefox ou Edge).'); }
    var material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: iterations }, material, 256);
    return bytesToHex(new Uint8Array(bits));
  }

  /* message affiché sur l'écran de connexion : un 503 (serveur pas prêt) devient une phrase simple ; sinon le message français du serveur (429 : trop d'essais, 401 : identifiants…) */
  function loginMessage(e) {
    return e instanceof ApiError && e.status === 503 ? 'Connexion momentanément indisponible, réessayez dans quelques minutes.' : messageOf(e);
  }
  /* paramètres de connexion : sel, nombre de tours, code à 6 chiffres demandé ou non (contrôlés : un serveur qui répond n'importe quoi est refusé) ;
     le champ du code est montré dès que le serveur l'exige (totp vrai) */
  async function loadParams() {
    if (!state.params) {
      try {
        var d = await request('GET', '/auth/params', undefined, false);
        if (!isObj(d) || typeof d.salt !== 'string' || !/^[0-9a-f]{32}$/.test(d.salt) || !Number.isInteger(d.iterations) || d.iterations < 100000 || d.iterations > 2000000) {
          throw new UserError('Le serveur a répondu de façon inattendue. Réessayez dans un instant.');
        }
        state.params = { salt: d.salt, iterations: d.iterations, totp: d.totp === true };
      } catch (e) { loginEls.msg.textContent = loginMessage(e); return; }
    }
    loginEls.codeField.hidden = !state.params.totp;
  }

  function showLogin(reason) {
    loginEls.note.textContent = LOGIN_NOTES[reason] ? LOGIN_NOTES[reason] + (isDirty() ? COLON + 'vos modifications sont toujours là.' : '.') : '';
    loginEls.note.hidden = !LOGIN_NOTES[reason];
    loginEls.msg.textContent = ''; loginEls.pass.value = ''; loginEls.code.value = '';
    loginEl.hidden = false; refreshInert();
    if (!API_OK) {
      loginEls.msg.textContent = 'L’espace pro n’est pas encore relié à son serveur. Revenez un peu plus tard.';
      loginEls.btn.disabled = true;
      return;
    }
    loadParams();
    (loginEls.user.value ? loginEls.pass : loginEls.user).focus();
  }
  /* revient à l'écran de connexion et attend la reconnexion (les modifications en cours restent en mémoire) */
  function askLogin(reason) {
    return new Promise(function (resolve) {
      loginWaiters.push(resolve);
      if (!loginVisible()) { showLogin(reason); }
    });
  }
  function onLoggedIn() {
    var waiters = loginWaiters;
    loginWaiters = []; loginEl.hidden = true; refreshInert();
    noteActivity();
    if (state.loaded || waiters.length) { toast('Vous êtes de nouveau connectée.' + (isDirty() ? ' Vos modifications sont toujours là.' : '')); } else { enterApp(); }
    waiters.forEach(function (resume) { resume(); });
  }

  async function submitLogin(ev) {
    var user = loginEls.user.value.trim(), pass = loginEls.pass.value, code = loginEls.code.value.replace(/\s+/g, ''), key, r, keepPass = false;
    ev.preventDefault();
    if (loginBusy || !API_OK) { return; }
    loginEls.msg.textContent = '';
    if (!user || !pass) { loginEls.msg.textContent = 'Écrivez votre identifiant et votre mot de passe.'; return; }
    loginBusy = true; loginEls.btn.disabled = true; loginEls.btn.textContent = 'Vérification…'; loginEls.btn.setAttribute('aria-busy', 'true');
    try {
      if (!state.params) { await loadParams(); }
      if (!state.params) { return; }
      if (state.params.totp && !/^[0-9]{6}$/.test(code)) {
        loginEls.msg.textContent = 'Écrivez les 6 chiffres du code affiché sur votre téléphone.';
        keepPass = true; loginEls.code.focus();            /* rien n'a été envoyé : on lui évite de retaper son mot de passe */
        return;
      }
      key = await deriveKey(pass, state.params.salt, state.params.iterations);
      r = await request('POST', '/auth/login', state.params.totp ? { user: user, key: key, code: code } : { user: user, key: key }, false);
      if (!isObj(r) || typeof r.token !== 'string' || !/^[A-Za-z0-9._\-]{20,1500}$/.test(r.token) || typeof r.exp !== 'number' || !isFinite(r.exp)) {
        throw new UserError('Le serveur a répondu de façon inattendue. Réessayez dans un instant.');
      }
      state.session = { token: r.token, exp: r.exp, last: Date.now() };
      saveSession();
      onLoggedIn();
    } catch (e) {
      loginEls.msg.textContent = loginMessage(e);
    } finally {
      pass = ''; key = '';
      if (!keepPass) { loginEls.pass.value = ''; loginEls.code.value = ''; }      /* après un essai, le mot de passe ne reste nulle part */
      loginBusy = false; loginEls.btn.disabled = false; loginEls.btn.textContent = 'Se connecter'; loginEls.btn.removeAttribute('aria-busy');
    }
  }

  /* ---------- déconnexion automatique après 30 minutes sans action, ou quand la session du serveur se termine ---------- */
  var lastAct = Date.now(), lastSaved = 0;
  function noteActivity() {
    lastAct = Date.now();
    if (state.session && lastAct - lastSaved > 15000) { state.session.last = lastAct; lastSaved = lastAct; saveSession(); }
  }
  function expireSession(reason) { dropSession(); showLogin(reason); }
  function checkIdle() {
    if (!state.session) { return; }
    if (Date.now() - lastAct > IDLE_MS) { expireSession('idle'); }
    else if (Date.now() / 1000 >= state.session.exp - 5) { expireSession('expired'); }
  }
  ['pointerdown', 'keydown', 'touchstart', 'scroll', 'input'].forEach(function (ev) { document.addEventListener(ev, noteActivity, { capture: true, passive: true }); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { checkIdle(); } });
  setInterval(checkIdle, 15000);

  /* « Se déconnecter » efface tout : session, contenu en mémoire, photos locales, fenêtres ouvertes */
  function wipeAll() {
    stopPolling(); hideBanner(); dropSession();
    state.ownBlobs.forEach(function (url) { URL.revokeObjectURL(url); });
    state.ownBlobs.clear(); state.blobs.clear();
    state.files = null; state.work = null; state.shas = {}; state.uploads = []; state.corrupt = []; state.page = null;
    state.loaded = false; state.pending = 0; state.formDirty = null; state.query = ''; state.errors.clear(); state.openSections.clear();
    stack.slice().forEach(closeLayer);
    clear(mainEl); appEl.hidden = true;
  }
  async function logout() {
    var n = countChanges(), ok = true;
    if (n > 0 || state.pending > 0) {
      ok = await confirmBox({ title: 'Vous déconnecter\xA0?', yes: 'Oui, me déconnecter', no: 'Non, rester', danger: true,
        text: n === 0 ? 'Une photo est encore en cours d’envoi. En vous déconnectant, vous la perdrez.'
          : 'Vous avez ' + plural(n, 'modification non publiée', 'modifications non publiées') + '. En vous déconnectant, vous ' + (n === 1 ? 'la' : 'les') + ' perdrez.' });
    }
    if (!ok) { return; }
    wipeAll(); loginEls.user.value = '';
    showLogin('');
  }

  /* ======================================================================
     8. DONNÉES : lecture du serveur, valeurs d'origine, copie de travail, comptage des modifications
     ====================================================================== */
  function emptyFiles() { return { settings: {}, articles: [], catalog: {}, texts: {}, photos: {} }; }

  /* un article propre (mêmes règles que le serveur), ou null s'il est inutilisable */
  function normalizeArticle(a) {
    var id, name, price, kind, out, q;
    if (!isObj(a)) { return null; }
    id = typeof a.id === 'string' ? a.id : '';
    name = cleanText(a.name === undefined ? '' : a.name, false);
    price = Math.round(Number(a.price) * 100) / 100;
    if (!/^[a-z0-9-]{3,40}$/.test(id) || !name || !(price >= 0.5 && price <= 2000)) { return null; }
    kind = a.kind === 'commande' ? 'commande' : 'dispo';
    out = {
      id: id, name: name, price: price, kind: kind, desc: cleanText(a.desc === undefined ? '' : a.desc, true), details: cleanText(a.details === undefined ? '' : a.details, false),
      photos: (Array.isArray(a.photos) ? a.photos : []).filter(isValidImagePath).slice(0, MAX_ARTICLE_PHOTOS),
      isNew: a.isNew === true, hidden: a.hidden === true, cat: CATS.some(function (c) { return c[0] === a.cat; }) ? a.cat : 'autres'
    };
    if (kind === 'dispo') { q = Math.floor(Number(a.qty)); out.qty = q >= 0 && q <= 99 ? q : 0; }
    return out;
  }
  /* le fichier « photos » remis en forme : repères { src, alt }, listes de { src, caption } (une adresse invalide est gardée telle quelle : l'écran ne l'affiche jamais) */
  function cleanPhotos(p) {
    var out = {};
    if (isObj(p.slots)) {
      out.slots = {};
      Object.keys(p.slots).forEach(function (k) {
        var s = p.slots[k];
        if (TEXT_KEY.test(k) && isObj(s) && typeof s.src === 'string') { out.slots[k] = { src: s.src, alt: typeof s.alt === 'string' ? s.alt : '' }; }
      });
    }
    ['gallery', 'reviews'].forEach(function (n) {
      if (Array.isArray(p[n])) {
        out[n] = p[n].filter(isObj).map(function (x) { return { src: typeof x.src === 'string' ? x.src : '', caption: typeof x.caption === 'string' ? x.caption : '' }; });
      }
    });
    return out;
  }
  /* ce que le serveur a envoyé, remis en forme (les valeurs inattendues sont écartées) */
  function cleanFiles(raw) {
    var f = isObj(raw) ? raw : {}, out = emptyFiles();
    if (isObj(f.settings)) { out.settings = clone(f.settings); }
    if (Array.isArray(f.articles)) { out.articles = f.articles.slice(0, MAX_ARTICLES).map(normalizeArticle).filter(Boolean); }
    if (isObj(f.catalog)) { out.catalog = clone(f.catalog); }
    if (isObj(f.texts)) { Object.keys(f.texts).forEach(function (k) { if (TEXT_KEY.test(k) && typeof f.texts[k] === 'string') { out.texts[k] = f.texts[k]; } }); }
    if (isObj(f.photos)) { out.photos = cleanPhotos(f.photos); }
    return out;
  }
  /* GET /content */
  async function loadContent() {
    var d = await authed('GET', '/content'), shas = {};
    if (!isObj(d) || !isObj(d.files)) { throw new UserError('Je n’ai pas pu lire le contenu de votre site. Réessayez dans un instant.'); }
    if (isObj(d.shas)) { FILES.forEach(function (n) { if (typeof d.shas[n] === 'string' && SHA_RE.test(d.shas[n])) { shas[n] = d.shas[n]; } }); }
    return { files: cleanFiles(d.files), shas: shas, corrupt: Array.isArray(d.corrupt) ? d.corrupt.filter(function (n) { return FILES.indexOf(n) >= 0; }) : [] };
  }
  function applyLoaded(pkg) { state.files = pkg.files; state.shas = pkg.shas; state.corrupt = pkg.corrupt; state.work = clone(pkg.files); }

  /* valeurs d'origine du code du site (js/config.js et js/data.js) */
  function productList() { return Array.isArray(window.MPC_PRODUCTS) ? window.MPC_PRODUCTS : []; }
  function originSettings() {
    var c = isObj(window.MPC_CONFIG) ? window.MPC_CONFIG : {}, ship = isObj(c.shipping) ? c.shipping : {};
    return { phone: String(c.phone || ''), email: String(c.email || ''), instagram: String(c.instagram || ''),
      fee: typeof ship.fee === 'number' ? ship.fee : 0, surcharge: typeof c.finishSurcharge === 'number' ? c.finishSurcharge : 0 };
  }
  function priceItems(p) { return Array.isArray(p.sizes) ? p.sizes : (Array.isArray(p.models) ? p.models : []); }

  /* réglages : lecture et écriture dans la copie de travail (une valeur revenue à l'origine est retirée : le fichier ne garde que les changements) */
  function group(name) { var g = state.work.settings[name]; return isObj(g) ? g : {}; }
  function setSetting(groupName, key, value, original) {
    var s = state.work.settings;
    if (value === undefined || value === original) {
      if (isObj(s[groupName])) { delete s[groupName][key]; if (!Object.keys(s[groupName]).length) { delete s[groupName]; } }
    } else {
      if (!isObj(s[groupName])) { s[groupName] = {}; }
      s[groupName][key] = value;
    }
  }
  /* boutique : entrée d'une pièce dans la copie de travail */
  function prodEntry(id) { var P = state.work.catalog.products; return isObj(P) && isObj(P[id]) ? P[id] : {}; }
  function setProd(id, mutate) {
    var c = state.work.catalog, e;
    if (!isObj(c.products)) { c.products = {}; }
    e = isObj(c.products[id]) ? c.products[id] : (c.products[id] = {});
    mutate(e);
    if (isObj(e.prices) && !Object.keys(e.prices).length) { delete e.prices; }
    if (!Object.keys(e).length) { delete c.products[id]; }
    if (!Object.keys(c.products).length) { delete c.products; }
  }

  /* ---------- combien de modifications non publiées ---------- */
  function countKeys(a, b) {
    var n = 0;
    new Set(Object.keys(a).concat(Object.keys(b))).forEach(function (k) { if (!deepEqual(a[k], b[k])) { n++; } });
    return n;
  }
  function countArticles(a, b) {
    var inB = {}, inA = {}, n = 0, orderA, orderB;
    b.forEach(function (x) { inB[x.id] = x; }); a.forEach(function (x) { inA[x.id] = true; });
    a.forEach(function (x) { if (!hasOwn(inB, x.id) || !deepEqual(x, inB[x.id])) { n++; } });
    b.forEach(function (x) { if (!hasOwn(inA, x.id)) { n++; } });
    orderA = a.filter(function (x) { return hasOwn(inB, x.id); }).map(function (x) { return x.id; }).join();
    orderB = b.filter(function (x) { return hasOwn(inA, x.id); }).map(function (x) { return x.id; }).join();
    return n + (orderA === orderB ? 0 : 1);
  }
  /* à plat : contact.phone, shipping.fee… ; l'annonce et la pause comptent chacune pour une modification */
  function flatSettings(s) {
    var o = {};
    Object.keys(s).forEach(function (k) {
      if (k === 'announcement' || k === 'ordersPaused' || !isObj(s[k])) { o[k] = s[k]; }
      else { Object.keys(s[k]).forEach(function (j) { o[k + '.' + j] = s[k][j]; }); }
    });
    return o;
  }
  function fileChanges(name) {
    var w = state.work[name], s = state.files[name];
    if (name === 'articles') { return countArticles(w, s); }
    if (name === 'texts') { return countKeys(w, s); }
    if (name === 'catalog') { return countKeys(isObj(w.products) ? w.products : {}, isObj(s.products) ? s.products : {}); }
    if (name === 'settings') { return countKeys(flatSettings(w), flatSettings(s)); }
    return countKeys(isObj(w.slots) ? w.slots : {}, isObj(s.slots) ? s.slots : {}) + (deepEqual(w.gallery, s.gallery) ? 0 : 1) + (deepEqual(w.reviews, s.reviews) ? 0 : 1);
  }
  function countChanges() { return state.work ? FILES.reduce(function (n, f) { return n + fileChanges(f); }, 0) : 0; }
  function changedFiles() { return FILES.filter(function (f) { return fileChanges(f) > 0; }); }
  function isDirty() { return countChanges() > 0 || state.pending > 0 || (state.formDirty !== null && state.formDirty()); }

  /* ---------- remettre mes modifications sur une version plus récente du serveur (après une réponse 409) ---------- */
  /* fusion à trois : « base » = ce que j'avais ouvert, « mine » = ma version, « theirs » = la version actuelle du serveur */
  function merge3(base, mine, theirs) {
    var b = base === undefined ? {} : base, out = {};
    if (deepEqual(mine, base)) { return clone(theirs); }                         /* je n'y ai pas touché : version du serveur */
    if (deepEqual(theirs, base) || deepEqual(mine, theirs)) { return clone(mine); } /* personne d'autre n'y a touché : ma version */
    if (isObj(b) && isObj(mine) && isObj(theirs)) {                              /* objets : clé par clé */
      new Set(Object.keys(b).concat(Object.keys(mine), Object.keys(theirs))).forEach(function (k) {
        var v;
        if (k === '__proto__') { return; }
        v = merge3(b[k], mine[k], theirs[k]);
        if (v !== undefined) { out[k] = v; }
      });
      return out;
    }
    return clone(mine);                                                           /* même valeur changée des deux côtés : la mienne l'emporte */
  }
  function mergeArticles(base, mine, theirs) {
    function byIdMap(list) { var m = {}; list.forEach(function (a) { m[a.id] = a; }); return m; }
    function ids(list) { return list.map(function (a) { return a.id; }); }
    var merged = merge3(byIdMap(base), byIdMap(mine), byIdMap(theirs)), order = merge3(ids(base), ids(mine), ids(theirs)), out = [];
    order.forEach(function (id) { if (hasOwn(merged, id)) { out.push(merged[id]); } });
    return ids(theirs).filter(function (id) { return order.indexOf(id) < 0 && hasOwn(merged, id); }).map(function (id) { return merged[id]; }).concat(out);
  }
  function mergeWork(theirs) {
    var out = {};
    FILES.forEach(function (n) {
      out[n] = n === 'articles' ? mergeArticles(state.files[n], state.work[n], theirs[n]) : merge3(state.files[n], state.work[n], theirs[n]);
    });
    return out;
  }

  /* ======================================================================
     9. STRUCTURE DE L'ÉCRAN : onglets, adresse (#/boutique…), barre « Publier »
     ====================================================================== */
  var pubCount = byId('pubCount'), publishBtn = byId('publishBtn'), cancelBtn = byId('cancelBtn');
  var RENDERERS = {};      /* une fonction d'affichage par onglet (remplie plus bas) */

  function viewFromHash() {
    var v = location.hash.replace(/^#\/?/, '');
    return VIEWS.indexOf(v) >= 0 ? v : 'articles';
  }
  /* affiche l'onglet courant sans remonter en haut de page (après une action) */
  function renderCurrent(toTop) {
    var id = ++state.renderId, title;
    state.errors.clear();
    clear(mainEl);
    RENDERERS[state.view](mainEl, id);
    if (toTop) {
      window.scrollTo(0, 0);
      title = mainEl.querySelector('.viewtitle');
      if (title) { title.focus({ preventScroll: true }); }
    }
  }
  function showView(name) {
    state.view = name;
    Array.prototype.forEach.call(tabsEl.querySelectorAll('.tab'), function (b) {
      if (b.getAttribute('data-view') === name) { b.setAttribute('aria-current', 'page'); } else { b.removeAttribute('aria-current'); }
    });
    renderCurrent(true);
  }
  /* « N modification(s) non publiée(s) », bouton Publier, bouton Annuler mes changements */
  function refreshBar() {
    var n = countChanges();
    pubCount.textContent = n ? plural(n, 'modification non publiée', 'modifications non publiées') : 'Aucune modification à publier';
    publishBtn.disabled = !n || state.busy;
    cancelBtn.hidden = !n;
  }
  /* après toute modification des données : met à jour la barre */
  function changed() { refreshBar(); }

  /* ======================================================================
     10. CHAMPS RÉUTILISABLES : saisie contrôlée, aide « À l'origine », « Rétablir l'original », interrupteurs
     ====================================================================== */
  var RESTORE = 'Rétablir l’original';
  function guill(s) { return '«' + NB + s + NB + '»'; }
  function excerpt(s, n) { s = String(s); return s.length > n ? s.slice(0, n).trim() + '…' : s; }

  /* un texte sur une seule ligne : les retours à la ligne collés ou tapés deviennent des espaces (le serveur les supprimerait sans espace) */
  function fixNewlines(input) {
    var pos;
    if (/[\r\n]/.test(input.value)) { pos = input.selectionStart; input.value = input.value.replace(/[\r\n]+/g, ' '); input.setSelectionRange(pos, pos); }
  }

  /* lecture d'un montant en euros : renvoie { value } ou { error } ; msg = { empty, range } */
  function moneyParser(min, max, msg) {
    return function (raw) {
      var s = String(raw).trim(), n;
      if (!s) { return { error: msg.empty }; }
      n = parseMoney(s);
      if (n === null) { return { error: 'Écrivez un nombre, par exemple 45 ou 12,50.' }; }
      if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) { return { error: 'Deux chiffres après la virgule au maximum.' }; }
      if (n < min || n > max) { return { error: msg.range }; }
      return { value: Math.round(n * 100) / 100 };
    };
  }
  var parseArticlePrice = moneyParser(0.5, 2000, { empty: 'Écrivez le prix, par exemple 45 ou 12,50.', range: 'Le prix doit être compris entre 0,50' + NB + '€ et 2' + NB + '000' + NB + '€.' });
  var parseShopPrice = moneyParser(0.5, 2000, { empty: 'Écrivez un prix, ou rétablissez l’original.', range: 'Le prix doit être compris entre 0,50' + NB + '€ et 2' + NB + '000' + NB + '€.' });

  /* Champ de saisie complet. Options :
       label ; hint (aide fixe) ; original (texte remis par « Rétablir l'original ») et originalLabel (texte de l'aide « À l'origine ») ;
       value (texte affiché) ; max (limite de caractères) ; counter (afficher « n / max ») ; area (zone de texte) ; short (zone basse) ;
       oneLine (zone de texte sur une seule ligne) ; money (montant en euros) ; blankIsOriginal (vide = valeur d'origine) ;
       inputmode ; noCaps (ni majuscule automatique ni correcteur) ; restoreLabel (texte du bouton de retour) ;
       changed() : le champ diffère-t-il de l'origine ? ; parse(texte) -> { value } ou { error } ; commit(valeur) ; reset() ; onCheck() après chaque contrôle.
     Renvoie { el, input, check, reveal } ; check() recontrôle la valeur saisie, reveal() recontrôle et montre l'erreur tout de suite. */
  function field(o) {
    var id = uid('c'), touched = false, describedBy = [], input, hint, orig, err, counter, restore, foot, control;
    err = h('p', { class: 'field__err', id: id + 'e', role: 'alert' });
    hint = o.hint ? h('p', { class: 'field__hint', id: id + 'h', text: o.hint }) : null;
    orig = o.original !== undefined && o.original !== '' ? h('p', { class: 'field__hint', id: id + 'o', text: 'À l’origine' + COLON + excerpt(o.originalLabel === undefined ? o.original : o.originalLabel, 140) }) : null;
    if (hint) { describedBy.push(id + 'h'); }
    if (orig) { describedBy.push(id + 'o'); }
    describedBy.push(id + 'e');
    input = h(o.area ? 'textarea' : 'input', {
      id: id, class: 'input' + (o.short ? ' input--short' : ''), type: o.area ? undefined : 'text', value: o.value, maxlength: o.max, rows: o.area ? (o.short ? '2' : '5') : undefined,
      inputmode: o.money ? 'decimal' : o.inputmode, autocomplete: 'off', autocapitalize: o.noCaps ? 'none' : undefined, spellcheck: o.noCaps ? 'false' : undefined,
      'aria-describedby': describedBy.join(' ')
    });
    counter = o.counter ? h('span', { class: 'counter', 'aria-hidden': 'true' }) : null;
    restore = h('button', { type: 'button', class: 'linkbtn linkbtn--accent', text: o.restoreLabel || RESTORE, hidden: true });
    foot = h('div', { class: 'field__foot' }, [restore, counter]);
    control = o.money ? h('div', { class: 'money' }, [input, h('span', { class: 'money__sign', 'aria-hidden': 'true', text: '€' })]) : input;

    function paintError(msg) {
      err.textContent = msg || '';
      if (msg) { input.setAttribute('aria-invalid', 'true'); } else { input.removeAttribute('aria-invalid'); }
    }
    function refresh() {
      restore.hidden = !o.changed();
      if (counter) { counter.textContent = input.value.length + ' / ' + o.max; }
    }
    function check() {
      var r = o.parse(input.value);
      if (r.error) {
        state.errors.set(id, { input: input, show: function () { touched = true; paintError(r.error); } });
        if (touched) { paintError(r.error); }
      } else {
        state.errors.delete(id); paintError(''); o.commit(r.value);
      }
      refresh(); changed();
      if (o.onCheck) { o.onCheck(); }
    }
    input.addEventListener('input', function () { if (o.oneLine) { fixNewlines(input); } check(); });
    input.addEventListener('change', function () {
      touched = true;
      if (o.blankIsOriginal && !input.value.trim()) { input.value = o.original === undefined ? '' : o.original; }
      check();
    });
    restore.addEventListener('click', function () {
      o.reset(); state.errors.delete(id); touched = false; paintError(''); input.value = o.original === undefined ? '' : o.original;
      refresh(); changed();
      if (o.onCheck) { o.onCheck(); }
      input.focus();
    });
    refresh();
    return {
      input: input, check: check, reveal: function () { touched = true; check(); },
      el: h('div', { class: 'field' }, [h('label', { class: 'field__label', for: id, text: o.label }), hint, orig, control, err, foot])
    };
  }

  /* interrupteur (vraie case à cocher, habillée) */
  function switchRow(label, hint, checked, onChange) {
    var input = h('input', { type: 'checkbox', class: 'sr-only', role: 'switch', checked: checked });
    input.addEventListener('change', function () { onChange(input.checked); });
    return { input: input, el: h('label', { class: 'switch' }, [input, h('span', { class: 'switch__track' }),
      h('span', { class: 'switch__text' }, [h('span', { class: 'switch__label', text: label }), hint ? h('span', { class: 'switch__hint', text: hint }) : null])]) };
  }

  /* ======================================================================
     11. ARTICLES : l'écran d'accueil (nouveautés et pièces disponibles)
     ====================================================================== */
  var cardRefs = {};   /* boutons de chaque carte, pour redonner le focus après une action */
  var CORRUPT_NAMES = { settings: 'les réglages', articles: 'les articles', catalog: 'la boutique', texts: 'les textes', photos: 'les photos' };

  function articleIndex(id) { return state.work.articles.findIndex(function (a) { return a.id === id; }); }
  /* l'article est-il nouveau ou modifié depuis la dernière publication ? */
  function articleChange(a) {
    var s = state.files.articles.find(function (x) { return x.id === a.id; });
    return !s ? 'new' : (deepEqual(a, s) ? '' : 'changed');
  }
  function articlePills(a) {
    var pills = [];
    if (a.kind === 'commande') { pills.push(['order', 'Sur commande']); }
    else if (a.qty === 0) { pills.push(['sold', 'Vendu']); }
    else if (a.qty === 1) { pills.push(['unique', 'Pièce unique']); }
    else { pills.push(['ok', 'Disponible' + NB + '×' + NB + a.qty]); }
    if (a.hidden) { pills.push(['hidden', 'Masqué']); }
    if (a.isNew) { pills.push(['new', 'Nouveau']); }
    if (articleChange(a)) { pills.push(['todo', 'À publier']); }
    return pills;
  }
  /* après une action sur une carte : met à jour l'écran et redonne le focus au bouton utilisé (ou à son voisin s'il est devenu inactif) */
  function afterArticleChange(id, act) {
    var refs, el;
    changed(); renderCurrent(false);
    refs = cardRefs[id];
    if (!refs) { return; }
    el = refs[act];
    if (!el || el.disabled) { el = refs[act === 'up' ? 'down' : (act === 'down' ? 'up' : 'edit')]; }
    if (el && !el.disabled) { el.focus(); }
  }
  function moveArticle(id, delta) {
    var list = state.work.articles, i = articleIndex(id), j = i + delta, tmp;
    if (i < 0 || j < 0 || j >= list.length) { return; }
    tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    afterArticleChange(id, delta < 0 ? 'up' : 'down');
  }
  function toggleHidden(id) {
    var a = state.work.articles[articleIndex(id)];
    if (!a) { return; }
    a.hidden = !a.hidden;
    afterArticleChange(id, 'hide');
    toast(guill(a.name) + (a.hidden ? ' est masqué du site à la prochaine publication.' : ' sera de nouveau visible sur le site.'));
  }
  function markSold(id) {
    var a = state.work.articles[articleIndex(id)], before;
    if (!a || a.kind !== 'dispo') { return; }
    before = a.qty; a.qty = 0;
    afterArticleChange(id, 'edit');
    toast(guill(a.name) + ' est marqué vendu.', { action: { label: 'Annuler', run: function () {
      var b = state.work.articles[articleIndex(id)];
      if (b) { b.qty = before; afterArticleChange(id, 'edit'); }
    } } });
  }
  async function deleteArticle(id) {
    var i = articleIndex(id), a = state.work.articles[i], ok;
    if (!a) { return; }
    ok = await confirmBox({ title: 'Supprimer cet article\xA0?', yes: 'Oui, supprimer', no: 'Non, le garder', danger: true,
      text: guill(a.name) + ' sera retiré de votre site à la prochaine publication. Pour le cacher sans le perdre, choisissez plutôt ' + guill('Masquer') + '.' });
    if (!ok) { return; }
    i = articleIndex(id);
    if (i >= 0) { state.work.articles.splice(i, 1); }
    changed(); renderCurrent(false);
    toast(guill(a.name) + ' sera retiré du site à la prochaine publication.');
  }

  /* bouton d'action sous une carte ; le nom de l'article est ajouté au nom accessible (« Monter « Sac bleu-gris » ») pour les lecteurs d'écran */
  function toolButton(label, iconName, onClick, o) {
    return h('button', { type: 'button', class: 'tool' + (o.danger ? ' tool--danger' : ''), disabled: !!o.disabled, 'aria-label': label + ' ' + o.who, on: { click: onClick } },
      [icon(iconName), h('span', { text: label })]);
  }
  function articleCard(a, i, n) {
    var id = a.id, refs = {}, main = [], tools, who = guill(a.name);
    cardRefs[id] = refs;
    refs.edit = button('Modifier', 'btn btn--ghost', function () { openArticleForm(id, null); }, 'edit', { 'aria-label': 'Modifier ' + who });
    main.push(refs.edit);
    if (a.kind === 'dispo' && a.qty > 0) {
      refs.sold = button('Marquer vendu', 'btn btn--ghost', function () { markSold(id); }, 'sold', { 'aria-label': 'Marquer vendu ' + who });
      main.push(refs.sold);
    }
    refs.up = toolButton('Monter', 'up', function () { moveArticle(id, -1); }, { disabled: i === 0, who: who });
    refs.down = toolButton('Descendre', 'down', function () { moveArticle(id, 1); }, { disabled: i === n - 1, who: who });
    refs.hide = toolButton(a.hidden ? 'Afficher' : 'Masquer', a.hidden ? 'eye' : 'eyeoff', function () { toggleHidden(id); }, { who: who });
    refs.copy = toolButton('Dupliquer', 'copy', function () { openArticleForm(null, a); }, { who: who });
    refs.del = toolButton('Supprimer', 'trash', function () { deleteArticle(id); }, { danger: true, who: who });
    tools = [refs.up, refs.down, refs.hide, refs.copy, refs.del];
    return h('article', { class: 'card art' + (a.hidden ? ' is-hidden' : '') }, [
      h('div', { class: 'art__top' }, [
        h('div', { class: 'art__img' }, [a.photos.length ? picture(a.photos[0], '') : icon('image')]),
        h('div', { class: 'art__info' }, [
          h('h2', { class: 'art__name', text: a.name }),
          h('p', { class: 'art__price', text: fmtPrice(a.price) }),
          h('div', { class: 'pills' }, articlePills(a).map(function (p) { return h('span', { class: 'pill pill--' + p[0], text: p[1] }); }))
        ])
      ]),
      h('div', { class: 'art__main' }, main),
      h('div', { class: 'art__tools' }, tools)
    ]);
  }

  RENDERERS.articles = function (root) {
    var list = state.work.articles, cards;
    cardRefs = {};
    root.appendChild(h('div', { class: 'viewhead' }, [
      h('h1', { class: 'viewtitle', tabindex: '-1', text: 'Mes articles' }),
      h('p', { class: 'lead', text: 'Vos pièces en stock (page «\xA0En stock\xA0», expédiées sous 24 à 48\xA0h) et vos nouveautés sur commande (page d’accueil).' })
    ]));
    if (state.corrupt.length) {
      root.appendChild(h('p', { class: 'notice notice--warn', text: 'Certaines informations du site n’ont pas pu être lues (' + state.corrupt.map(function (n) { return CORRUPT_NAMES[n]; }).join(', ') + '). Elles seront remplacées si vous les modifiez.' }));
    }
    root.appendChild(button('Ajouter un article', 'btn btn--primary btn--big btn--block', function () { openArticleForm(null, null); }, 'plus'));
    if (!list.length) {
      root.appendChild(h('div', { class: 'card empty cards' }, [
        h('p', { class: 'empty__title', text: 'Vous n’avez pas encore d’article.' }),
        h('p', { class: 'empty__txt', text: 'Ajoutez votre première pièce\xA0: elle apparaîtra tout en haut de votre site.' })
      ]));
      return;
    }
    cards = h('div', { class: 'cards cards--2' });
    list.forEach(function (a, i) { cards.appendChild(articleCard(a, i, list.length)); });
    root.appendChild(cards);
  };

  /* ---------- le formulaire d'un article (plein écran sur téléphone) ---------- */
  /* editId : article à modifier ; copyOf : article à dupliquer ; aucun des deux : nouvel article */
  function openArticleForm(editId, copyOf) {
    var list = state.work.articles, existing = editId ? list.find(function (a) { return a.id === editId; }) : null, src = existing || copyOf || null;
    var d, layer, sheet, initial, sending = 0;
    var nameIn, nameErr, priceIn, priceErr, qtyIn, qtyErr, qtyField, descIn, detIn, catSel, grid, photoErr, addBtn, fileInput, kindBoxes = [], formMsg, saveBtn;

    if (!existing && list.length >= MAX_ARTICLES) { toast('Vous avez déjà ' + MAX_ARTICLES + ' articles\xA0: c’est le maximum. Supprimez-en un avant d’en ajouter.', { error: true }); return; }
    d = {
      kind: src ? src.kind : 'dispo', isNew: src ? src.isNew : true, visible: src ? !src.hidden : true,
      photos: src ? src.photos.map(function (p) { return { key: uid('p'), path: p, url: null, status: 'ok', msg: '' }; }) : []
    };

    function snap() {
      return JSON.stringify([nameIn.value, priceIn.value, qtyIn.value, d.kind, d.isNew, d.visible, catSel.value, descIn.value, detIn.value, d.photos.map(function (p) { return p.path || p.key; })]);
    }
    function setErr(input, errEl, msg) {
      errEl.textContent = msg || '';
      if (msg) { input.setAttribute('aria-invalid', 'true'); } else { input.removeAttribute('aria-invalid'); }
      return msg ? input : null;
    }
    function textCounter(input, max) {
      var c = h('span', { class: 'counter', 'aria-hidden': 'true' });
      function paint() { c.textContent = input.value.length + ' / ' + max; }
      input.addEventListener('input', paint); paint();
      return c;
    }

    /* --- photos --- */
    function drawPhotos() {
      clear(grid);
      d.photos.forEach(function (p, i) {
        var kids = [], btns = [], src2 = p.url || p.path;
        kids.push(h('div', { class: 'ph__img' }, [src2 ? picture(src2, 'Photo ' + (i + 1)) : icon('image')]));
        if (i === 0) { kids[0].appendChild(h('span', { class: 'ph__badge', text: 'Couverture' })); }
        if (p.status === 'sending') { kids[0].appendChild(h('span', { class: 'ph__state' }, [h('span', { class: 'spinner' }), h('span', { text: 'Envoi…' })])); }
        if (p.status === 'error') { kids[0].appendChild(h('span', { class: 'ph__state ph__state--err', text: p.msg })); }
        if (i > 0 && p.status === 'ok') {
          btns.push(button('Mettre en première', 'ph__btn', function () { d.photos.splice(d.photos.indexOf(p), 1); d.photos.unshift(p); drawPhotos(); }, 'star'));
        }
        btns.push(button('Retirer', 'ph__btn ph__btn--danger', function () {
          var j = d.photos.indexOf(p);
          if (j >= 0) { d.photos.splice(j, 1); }
          photoErr.textContent = ''; drawPhotos(); addBtn.focus();
        }, 'trash', { 'aria-label': 'Retirer la photo ' + (i + 1) }));
        kids.push(h('div', { class: 'ph__btns' }, btns));
        grid.appendChild(h('li', { class: 'ph' + (i === 0 ? ' ph--first' : '') }, kids));
      });
      addBtn.disabled = d.photos.length >= MAX_ARTICLE_PHOTOS;
    }
    async function addFiles(fileList) {
      var files = Array.prototype.slice.call(fileList), room = MAX_ARTICLE_PHOTOS - d.photos.length, i, item;
      photoErr.textContent = '';
      if (files.length > room) {
        photoErr.textContent = MAX_ARTICLE_PHOTOS + ' photos au maximum par article\xA0: les photos en trop n’ont pas été ajoutées.';
        files = files.slice(0, Math.max(0, room));
      }
      for (i = 0; i < files.length; i++) {
        item = { key: uid('p'), path: null, url: null, status: 'sending', msg: '' };
        d.photos.push(item); sending += 1; drawPhotos();
        try {
          item.path = await processPhotoFile(files[i], function (url) { item.url = url; drawPhotos(); });
          item.status = 'ok';
        } catch (e) { item.status = 'error'; item.msg = messageOf(e); }
        sending -= 1; drawPhotos();
      }
    }

    /* --- champs --- */
    nameErr = h('p', { class: 'field__err', id: uid('e'), role: 'alert' });
    nameIn = h('input', { id: uid('f'), class: 'input', type: 'text', value: src ? (copyOf ? (src.name + ' (copie)').slice(0, 80) : src.name) : '', maxlength: '80', autocomplete: 'off', placeholder: 'Ex. Sac bleu-gris', 'aria-describedby': nameErr.id });
    priceErr = h('p', { class: 'field__err', id: uid('e'), role: 'alert' });
    priceIn = h('input', { id: uid('f'), class: 'input', type: 'text', inputmode: 'decimal', value: src ? String(src.price).replace('.', ',') : '', autocomplete: 'off', placeholder: 'Ex. 45', 'aria-describedby': priceErr.id });
    qtyErr = h('p', { class: 'field__err', id: uid('e'), role: 'alert' });
    qtyIn = h('input', { id: uid('f'), class: 'input', type: 'text', inputmode: 'numeric', value: String(src && src.kind === 'dispo' ? src.qty : 1), maxlength: '2', autocomplete: 'off', 'aria-describedby': qtyErr.id });
    catSel = h('select', { id: uid('f'), class: 'input' }, CATS.map(function (c) { return h('option', { value: c[0], text: c[1] }); }));
    catSel.value = src ? src.cat : 'sacs';
    descIn = h('textarea', { id: uid('f'), class: 'input', rows: '5', maxlength: '700', value: src ? src.desc : '' });
    detIn = h('input', { id: uid('f'), class: 'input', type: 'text', value: src ? src.details : '', maxlength: '200', autocomplete: 'off', placeholder: 'Ex. 30 x 28 cm, bleu et gris' });
    nameIn.addEventListener('input', function () { if (nameErr.textContent) { setErr(nameIn, nameErr, cleanText(nameIn.value, false) ? '' : 'Écrivez le nom de l’article.'); } });
    priceIn.addEventListener('input', function () { if (priceErr.textContent) { setErr(priceIn, priceErr, parseArticlePrice(priceIn.value).error); } });
    qtyIn.addEventListener('input', function () { if (qtyErr.textContent) { setErr(qtyIn, qtyErr, readQty() === null ? 'La quantité doit être un nombre entre 0 et 99.' : ''); } });
    nameIn.addEventListener('change', function () { setErr(nameIn, nameErr, cleanText(nameIn.value, false) ? '' : 'Écrivez le nom de l’article.'); });
    priceIn.addEventListener('change', function () { setErr(priceIn, priceErr, parseArticlePrice(priceIn.value).error); });

    function readQty() { var s = qtyIn.value.trim(); return /^[0-9]{1,2}$/.test(s) ? Number(s) : null; }
    function stepQty(delta) {
      var n = readQty();
      n = Math.min(99, Math.max(0, (n === null ? 0 : n) + delta));
      qtyIn.value = String(n); setErr(qtyIn, qtyErr, '');
    }
    function paintKind() {
      kindBoxes.forEach(function (b) { b.box.className = 'choice' + (d.kind === b.value ? ' is-on' : ''); });
      qtyField.hidden = d.kind !== 'dispo';
    }
    function choice(value, title, sub) {
      var input = h('input', { type: 'radio', name: 'kind', class: 'sr-only', value: value, checked: d.kind === value }), box;
      box = h('label', { class: 'choice' }, [input, h('span', { class: 'choice__dot' }), h('span', {}, [h('span', { class: 'choice__title', text: title }), h('span', { class: 'choice__sub', text: sub })])]);
      input.addEventListener('change', function () { d.kind = value; paintKind(); });
      kindBoxes.push({ box: box, value: value });
      return box;
    }

    grid = h('ul', { class: 'photos' });
    photoErr = h('p', { class: 'field__err', role: 'alert' });
    fileInput = h('input', { type: 'file', class: 'sr-only', accept: PHOTO_ACCEPT, multiple: true, tabindex: '-1', 'aria-hidden': 'true' });
    fileInput.addEventListener('change', function () { var files = Array.prototype.slice.call(fileInput.files); fileInput.value = ''; addFiles(files); });
    addBtn = button('Ajouter des photos', 'btn btn--ghost btn--block', function () { fileInput.click(); }, 'camera');

    qtyField = h('div', { class: 'field' }, [
      h('label', { class: 'field__label', for: qtyIn.id, text: 'Quantité en stock' }),
      h('div', { class: 'stepper' }, [
        h('button', { type: 'button', class: 'stepper__btn', 'aria-label': 'Une pièce de moins', text: '−', on: { click: function () { stepQty(-1); } } }),
        qtyIn,
        h('button', { type: 'button', class: 'stepper__btn', 'aria-label': 'Une pièce de plus', text: '+', on: { click: function () { stepQty(1); } } })
      ]),
      h('p', { class: 'field__hint', text: 'Mettez 0 si la pièce est vendue.' }), qtyErr
    ]);
    var newSw = switchRow('Afficher le badge ' + guill('Nouveau'), 'Une petite étiquette ' + guill('Nouveau') + ' sur la photo, pour mettre la pièce en avant.', d.isNew, function (v) { d.isNew = v; });
    var visSw = switchRow('Visible sur le site', 'Éteignez pour garder l’article en brouillon, sans le montrer à vos clientes.', d.visible, function (v) { d.visible = v; });

    formMsg = h('p', { class: 'field__err sheet__msg', role: 'alert' });
    saveBtn = button('Enregistrer l’article', 'btn btn--primary', save, 'check');

    /* --- enregistrement --- */
    function save() {
      var name = cleanText(nameIn.value, false), pr = parseArticlePrice(priceIn.value), q = d.kind === 'dispo' ? readQty() : 0, art, idx, at;
      /* tous les champs sont contrôlés (chaque message s'affiche à côté de son champ) ; le focus va au premier champ en erreur */
      var badName = setErr(nameIn, nameErr, name ? '' : 'Écrivez le nom de l’article.');
      var badPrice = setErr(priceIn, priceErr, pr.error || '');
      var badQty = d.kind === 'dispo' ? setErr(qtyIn, qtyErr, q === null ? 'La quantité doit être un nombre entre 0 et 99.' : '') : null;
      var first = badName || badPrice || badQty;
      formMsg.textContent = '';
      if (d.photos.some(function (p) { return p.status === 'sending'; })) { formMsg.textContent = 'Une photo est encore en cours d’envoi\xA0: patientez un instant, puis enregistrez.'; return; }
      if (d.photos.some(function (p) { return p.status === 'error'; })) { formMsg.textContent = 'Une photo n’a pas pu être envoyée\xA0: retirez-la (ou ajoutez-la de nouveau), puis enregistrez.'; return; }
      if (first) { first.focus(); return; }
      art = normalizeArticle({
        id: existing ? existing.id : newArticleId(list), name: name, price: pr.value, kind: d.kind, qty: q, desc: descIn.value, details: detIn.value,
        photos: d.photos.map(function (p) { return p.path; }), isNew: d.isNew, hidden: !d.visible, cat: catSel.value
      });
      if (!art) { formMsg.textContent = 'Cet article n’a pas pu être enregistré\xA0: vérifiez le nom et le prix.'; return; }
      if (existing) { list[articleIndex(existing.id)] = art; }
      else {
        idx = copyOf ? articleIndex(copyOf.id) : -1;
        at = idx >= 0 ? idx + 1 : 0;                      /* une copie se place sous l'original, un nouvel article en tête de liste */
        list.splice(at, 0, art);
      }
      state.formDirty = null; closeLayer(layer);
      changed(); renderCurrent(false);
      if (!existing && !copyOf) { window.scrollTo(0, 0); }
      if (cardRefs[art.id] && cardRefs[art.id].edit) { cardRefs[art.id].edit.focus(); }
      toast('Article enregistré. Appuyez sur ' + guill('Publier') + ' pour le mettre en ligne.');
    }
    async function tryClose() {
      var ok = true;
      if (snap() !== initial) {
        ok = await confirmBox({ title: 'Fermer sans enregistrer\xA0?', text: 'Les changements faits sur cet article seront perdus.', yes: 'Oui, fermer', no: 'Continuer à modifier', danger: true });
      }
      if (ok) { state.formDirty = null; closeLayer(layer); }
    }

    /* --- assemblage --- */
    var body = h('div', { class: 'sheet__body' }, [
      h('div', { class: 'field' }, [
        h('p', { class: 'field__label', text: 'Photos' }),
        h('p', { class: 'field__hint', text: 'La première photo est la photo de couverture\xA0: c’est celle que vos clientes voient en premier. Vous pouvez en ajouter jusqu’à ' + MAX_ARTICLE_PHOTOS + '.' }),
        grid, addBtn, fileInput, photoErr
      ]),
      h('div', { class: 'field' }, [h('label', { class: 'field__label', for: nameIn.id, text: 'Nom de l’article' }), nameIn, nameErr]),
      h('div', { class: 'field' }, [h('label', { class: 'field__label', for: priceIn.id, text: 'Prix' }),
        h('div', { class: 'money' }, [priceIn, h('span', { class: 'money__sign', 'aria-hidden': 'true', text: '€' })]),
        h('p', { class: 'field__hint', text: 'En euros. Exemple\xA0: 45 ou 12,50.' }), priceErr]),
      h('fieldset', { class: 'fieldset' }, [
        h('legend', { class: 'legend', text: 'Type d’article' }),
        h('div', { class: 'choices' }, [
          choice('dispo', 'Pièce en stock (prête à partir)', 'Déjà crochetée\xA0: elle apparaît sur la page «\xA0En stock\xA0» et part sous 24 à 48\xA0h.'),
          choice('commande', 'Nouveauté, je la crochète à la commande', 'Je la crochète quand une cliente la commande\xA0: elle apparaît sur la page d’accueil.')
        ])
      ]),
      qtyField,
      h('div', { class: 'field' }, [newSw.el]),
      h('div', { class: 'field' }, [h('label', { class: 'field__label', for: catSel.id, text: 'Catégorie' }), catSel]),
      h('div', { class: 'field' }, [h('label', { class: 'field__label', for: descIn.id, text: 'Description' }),
        h('p', { class: 'field__hint', text: 'Racontez la pièce en quelques lignes\xA0: matière, usage, ce qui la rend unique.' }), descIn,
        h('div', { class: 'field__foot' }, [textCounter(descIn, 700)])]),
      h('div', { class: 'field' }, [h('label', { class: 'field__label', for: detIn.id, text: 'Précisions (dimensions, coloris…)' }), detIn,
        h('div', { class: 'field__foot' }, [textCounter(detIn, 200)])]),
      h('div', { class: 'field' }, [visSw.el])
    ]);
    paintKind(); drawPhotos();
    sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'formTitle', tabindex: '-1' }, [
      h('div', { class: 'sheet__head' }, [
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Fermer', on: { click: tryClose } }, [icon('x')]),
        h('h2', { class: 'sheet__title', id: 'formTitle', text: existing ? 'Modifier l’article' : (copyOf ? 'Nouvel article (copie)' : 'Nouvel article') })
      ]),
      body, formMsg,
      h('div', { class: 'sheet__foot' }, [button('Annuler', 'btn btn--ghost', tryClose), saveBtn])
    ]);
    /* avec une souris, le curseur va dans le nom ; sur téléphone on évite d'ouvrir le clavier d'emblée (il cacherait les photos) */
    layer = openLayer(h('div', { class: 'overlay overlay--sheet' }, [sheet]),
      { onEscape: tryClose, focus: window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches ? nameIn : sheet });
    initial = snap();
    state.formDirty = function () { return snap() !== initial || sending > 0; };
  }

  /* ======================================================================
     12. PHOTOS : lecture, réduction et ré-encodage dans le navigateur (cela retire aussi la position GPS), envoi au serveur
     ====================================================================== */
  function releaseBlob(url) { state.ownBlobs.delete(url); URL.revokeObjectURL(url); }

  /* décode une image à partir d'un blob: créé ici (les navigateurs récents la remettent à l'endroit d'après l'orientation de l'appareil photo : photos d'iPhone prises à la verticale) */
  function loadImage(url) {
    return new Promise(function (ok, ko) {
      var img = new Image();
      img.addEventListener('load', function () { ok(img); });
      img.addEventListener('error', function () { ko(new Error('decode')); });
      setAttr(img, 'src', url);
    });
  }
  /* reconnaît le format d'après les premiers octets : le nom et le type annoncés par le téléphone ne sont pas fiables (un « .HEIC » peut contenir du JPEG, un fichier peut n'avoir aucun type) */
  async function sniffKind(file) {
    var b, s, brand;
    try { b = new Uint8Array(await file.slice(0, 32).arrayBuffer()); } catch (e) { return ''; }
    s = String.fromCharCode.apply(null, Array.prototype.slice.call(b));
    if (b[0] === 255 && b[1] === 216) { return 'jpeg'; }
    if (s.slice(1, 4) === 'PNG') { return 'png'; }
    if (s.slice(0, 4) === 'RIFF' && s.slice(8, 12) === 'WEBP') { return 'webp'; }
    if (s.slice(0, 3) === 'GIF') { return 'gif'; }
    if (s.slice(0, 2) === 'BM') { return 'bmp'; }
    if (s.slice(4, 8) === 'ftyp') {
      brand = s.slice(8, 12);
      if (/^(heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1)$/.test(brand)) { return 'heic'; }
      return /^avi[fs]$/.test(brand) ? 'avif' : 'video';
    }
    return '';
  }
  /* redessine l'image dans un <canvas> (côté le plus long limité à maxSide) et l'encode en JPEG */
  function toJpeg(img, w, hgt, maxSide, quality) {
    var k = Math.min(1, maxSide / Math.max(w, hgt)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(hgt * k));
    var canvas = document.createElement('canvas'), ctx;
    canvas.width = cw; canvas.height = ch;
    ctx = canvas.getContext('2d');
    if (!ctx) { return Promise.resolve(null); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);          /* un JPEG n'a pas de transparence : fond blanc */
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) { ctx.imageSmoothingQuality = 'high'; }   /* grande photo réduite : pas d'escaliers */
    ctx.drawImage(img, 0, 0, cw, ch);
    return new Promise(function (ok) { canvas.toBlob(function (b) { canvas.width = 0; canvas.height = 0; ok(b); }, 'image/jpeg', quality); });
  }
  /* 1600 px et qualité 0,82 ; si c'est trop lourd : qualité 0,72 puis 0,62, puis des tailles plus petites : aucune photo n'est refusée pour son poids */
  async function shrink(file) {
    var srcUrl = URL.createObjectURL(file), steps = [[1600, 0.82], [1600, 0.72], [1600, 0.62], [1200, 0.62], [1000, 0.55], [800, 0.5], [600, 0.45]], img, blob, i, kind;
    state.ownBlobs.add(srcUrl);
    try {
      try { img = await loadImage(srcUrl); }
      catch (e) {
        kind = await sniffKind(file);
        throw new UserError(kind === 'heic' ? HEIC_HELP : kind === 'video' ? VIDEO_HELP : UNREADABLE);
      }
      if (!img.naturalWidth || !img.naturalHeight) { throw new UserError(UNREADABLE); }
      if (img.naturalWidth * img.naturalHeight > MAX_PIXELS) { throw new UserError('Cette image est gigantesque (plus de 300 millions de pixels) : ce n’est sans doute pas une photo de téléphone. Essayez une autre photo.'); }
      for (i = 0; i < steps.length; i++) {
        blob = await toJpeg(img, img.naturalWidth, img.naturalHeight, steps[i][0], steps[i][1]);
        if (!blob) { throw new UserError(UNREADABLE); }
        if (blob.size <= MAX_JPEG) { return blob; }
      }
      throw new UserError('Cette photo est trop chargée en détails pour être envoyée. Essayez une autre photo.');
    } finally { releaseBlob(srcUrl); }
  }
  /* les photos sont préparées une à la fois : une photo de 48 millions de pixels occupe plusieurs centaines de Mo de mémoire pendant son décodage */
  var shrinkChain = Promise.resolve();
  function shrinkQueued(file) {
    var p = shrinkChain.then(function () { return shrink(file); });
    shrinkChain = p.catch(function () { /* l'erreur est rendue à l'appelant ; la file continue */ });
    return p;
  }
  function blobToBase64(blob) {
    return new Promise(function (ok, ko) {
      var reader = new FileReader();
      reader.addEventListener('load', function () { var s = String(reader.result), i = s.indexOf(','); ok(i >= 0 ? s.slice(i + 1) : ''); });
      reader.addEventListener('error', function () { ko(new UserError(UNREADABLE)); });
      reader.readAsDataURL(blob);
    });
  }
  /* Prépare puis envoie une photo ; renvoie son chemin sur le site. onPreview(blob:) est appelé dès que l'aperçu local est prêt.
     La photo est gardée dans la liste des envois (state.uploads) : elle ne sera publiée que si elle est encore utilisée. */
  async function processPhotoFile(file, onPreview) {
    var blob, url, data, r;
    if (!file || typeof file.size !== 'number' || file.size === 0) { throw new UserError(UNREADABLE); }
    if (file.size > MAX_SOURCE) { throw new UserError('Ce fichier fait plus de 400 Mo : ce n’est sans doute pas une photo de téléphone. Choisissez une photo.'); }
    state.pending += 1;
    try {
      blob = await shrinkQueued(file);                                  /* n'importe quel format que le navigateur sait lire (JPEG, PNG, WebP, HEIC sur Safari, AVIF, GIF, BMP…) : toujours renvoyé en JPEG */
      url = URL.createObjectURL(blob); state.ownBlobs.add(url);
      try {
        if (onPreview) { onPreview(url); }
        data = await blobToBase64(blob);
        r = await authed('POST', '/upload', JSON.stringify({ mime: 'image/jpeg', data: data }), 90000);
        if (!isObj(r) || typeof r.path !== 'string' || !UPLOAD_RE.test(r.path) || typeof r.sha !== 'string' || !SHA_RE.test(r.sha)) {
          throw new UserError('Cette photo n’a pas pu être envoyée. Réessayez.');
        }
      } catch (e) { releaseBlob(url); throw e; }
      state.blobs.set(r.path, url);
      state.uploads.push({ path: r.path, sha: r.sha });
      return r.path;
    } finally { state.pending -= 1; }
  }
  /* oublie les photos envoyées mais jamais publiées (après « Annuler mes changements » ou un retour en arrière) */
  function discardUploads() {
    state.uploads.forEach(function (u) { var url = state.blobs.get(u.path); if (url) { releaseBlob(url); state.blobs.delete(u.path); } });
    state.uploads = [];
  }

  /* ======================================================================
     13. BOUTIQUE : prix et textes des pièces
     ====================================================================== */
  function curSurcharge() { var v = group('pricing').finishSurcharge; return typeof v === 'number' ? v : originSettings().surcharge; }
  function moneyText(n) { return String(n).replace('.', ','); }

  function priceField(id, it) {
    var origin = it.price;
    return field({
      label: it.name, money: true, original: moneyText(origin), originalLabel: fmtPrice(origin), blankIsOriginal: true,
      value: moneyText(isObj(prodEntry(id).prices) && typeof prodEntry(id).prices[it.id] === 'number' ? prodEntry(id).prices[it.id] : origin),
      changed: function () { var pr = prodEntry(id).prices; return isObj(pr) && hasOwn(pr, it.id); },
      parse: parseShopPrice,
      commit: function (v) { setProd(id, function (e) { if (!isObj(e.prices)) { e.prices = {}; } if (v === origin) { delete e.prices[it.id]; } else { e.prices[it.id] = v; } }); },
      reset: function () { setProd(id, function (e) { if (isObj(e.prices)) { delete e.prices[it.id]; } }); }
    });
  }
  function productTextField(p, key, label, hint, max, area) {
    var id = p.id, origin = String(p[key] || '');
    return field({
      label: label, hint: hint, original: origin, max: max, counter: true, area: area, oneLine: !area, blankIsOriginal: key !== 'badge',
      value: typeof prodEntry(id)[key] === 'string' ? prodEntry(id)[key] : origin,
      changed: function () { return hasOwn(prodEntry(id), key); },
      parse: function (raw) { var v = cleanText(raw, area); return { value: key !== 'badge' && v === '' ? undefined : v }; },
      commit: function (v) { setProd(id, function (e) { if (v === undefined || v === origin) { delete e[key]; } else { e[key] = v; } }); },
      reset: function () { setProd(id, function (e) { delete e[key]; }); }
    });
  }
  function productCard(p) {
    var id = p.id, tid = uid('t'), vis, kids;
    vis = switchRow('Visible sur le site', 'Éteignez pour cacher cette pièce de votre boutique.', prodEntry(id).hidden !== true, function (v) {
      setProd(id, function (e) { if (v) { delete e.hidden; } else { e.hidden = true; } });
      changed();
    });
    kids = [h('h2', { class: 'card__title', id: tid, text: p.name }), vis.el];
    if (p.quote !== true) {
      kids.push(h('p', { class: 'card__sub', text: Array.isArray(p.sizes) ? 'Prix selon la taille' : 'Prix selon le modèle' }));
      priceItems(p).forEach(function (it) { kids.push(priceField(id, it).el); });
    }
    kids.push(productTextField(p, 'tagline', 'Accroche', 'La phrase courte sous le nom de la pièce.', 160, false).el);
    kids.push(productTextField(p, 'desc', 'Description', '', 700, true).el);
    kids.push(productTextField(p, 'badge', 'Étiquette', 'Le petit mot posé sur la photo, par exemple ' + guill('Nouveau') + '. Laissez vide pour ne rien afficher.', 40, false).el);
    return h('section', { class: 'card', 'aria-labelledby': tid }, kids);
  }
  RENDERERS.boutique = function (root) {
    var products = productList(), origin = originSettings().surcharge, reminder, sur;
    function paintReminder() { reminder.textContent = 'Les textes qui parlent de ' + fmtPrice(curSurcharge()) + ' (questions fréquentes, atelier) se changent dans l’onglet Textes.'; }
    reminder = h('p', { class: 'field__hint' });
    sur = field({
      label: 'Supplément ' + guill('détail décoratif'), money: true, hint: 'S’ajoute au prix quand une cliente choisit des perles, des coquillages, des marguerites, une bordure ou une chaîne de sac.',
      original: moneyText(origin), originalLabel: fmtPrice(origin), blankIsOriginal: true, value: moneyText(curSurcharge()),
      changed: function () { return hasOwn(group('pricing'), 'finishSurcharge'); },
      parse: moneyParser(0, 50, { empty: 'Écrivez le supplément (0 si vous n’en voulez pas).', range: 'Le supplément doit être compris entre 0 et 50' + NB + '€.' }),
      commit: function (v) { setSetting('pricing', 'finishSurcharge', v, origin); },
      reset: function () { setSetting('pricing', 'finishSurcharge', undefined); },
      onCheck: paintReminder
    });
    paintReminder();
    root.appendChild(h('div', { class: 'viewhead' }, [
      h('h1', { class: 'viewtitle', tabindex: '-1', text: 'La boutique' }),
      h('p', { class: 'lead', text: 'Les prix et les textes des pièces que vos clientes peuvent commander. Un champ laissé tel quel garde la valeur d’origine.' })
    ]));
    root.appendChild(h('div', { class: 'stack' }, [h('section', { class: 'card' }, [sur.el, reminder])]
      .concat(products.filter(function (p) { return p.quote !== true; }).map(productCard))));
    root.appendChild(h('h2', { class: 'sectitle', text: 'Pièces sur devis' }));
    root.appendChild(h('p', { class: 'lead lead--tight', text: 'Ces pièces se commandent sur devis\xA0: il n’y a pas de prix à modifier, seulement la visibilité et les textes.' }));
    root.appendChild(h('div', { class: 'stack' }, products.filter(function (p) { return p.quote === true; }).map(productCard)));
  };

  /* ======================================================================
     14. TEXTES : tous les textes modifiables de la page d'accueil, lus dans ../index.html
     ====================================================================== */
  var pagePromise = null;
  /* texte d'origine d'un élément : son texte, avec les mots en gras entourés de ** ; les espaces de mise en page sont réduits à une seule espace */
  function originalText(el) {
    var out = '';
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) { out += n.textContent; }
      else if (n.nodeType === 1 && (n.nodeName === 'STRONG' || n.nodeName === 'B')) { out += '**' + n.textContent + '**'; }
    });
    return out.replace(/[ \t\r\n\f]+/g, ' ').trim();
  }
  /* lit la page publique dans un document inerte (DOMParser : aucun script ne s'exécute, rien n'est inséré dans cet écran) */
  async function readPage() {
    var res, doc, texts = [], slots = [], seenT = new Set(), seenS = new Set(), problem = 'Je n’arrive pas à lire la page de votre site. Vérifiez votre connexion, puis réessayez.', pages = ['../index.html', '../en-stock.html'], i;
    for (i = 0; i < pages.length; i++) {                         /* l'accueil (obligatoire) puis la page « En stock » (facultative : ignorée si elle n'est pas là) */
      try { res = await fetch(pages[i], { cache: 'no-store', credentials: 'same-origin' }); } catch (e) { if (i === 0) { throw new UserError(problem); } continue; }
      if (!res.ok) { if (i === 0) { throw new UserError(problem); } continue; }
      doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      Array.prototype.forEach.call(doc.querySelectorAll('[data-t]'), function (el) {
        var key = el.getAttribute('data-t');
        if (!TEXT_KEY.test(key) || seenT.has(key)) { return; }
        seenT.add(key);
        texts.push({ key: key, section: key.split('.')[0], tag: el.nodeName.toLowerCase(), original: originalText(el) });
      });
      Array.prototype.forEach.call(doc.querySelectorAll('img[data-img]'), function (img) {
        var key = img.getAttribute('data-img'), src = img.getAttribute('src') || '';
        if (!TEXT_KEY.test(key) || seenS.has(key)) { return; }
        seenS.add(key);
        slots.push({ key: key, src: isValidImagePath(src) ? src : '', alt: img.getAttribute('alt') || '' });
      });
    }
    return { texts: texts, slots: slots };
  }
  function ensurePage() {
    if (state.page) { return Promise.resolve(state.page); }
    if (!pagePromise) { pagePromise = readPage().then(function (p) { state.page = p; return p; }).finally(function () { pagePromise = null; }); }
    return pagePromise;
  }
  function loadingBox(message) { return h('div', { class: 'loading' }, [h('span', { class: 'spinner' }), h('span', { text: message })]); }
  function showLoadError(holder, e, retry) {
    clear(holder); holder.className = 'notice notice--err';
    holder.appendChild(h('p', { text: messageOf(e) }));
    holder.appendChild(button('Réessayer', 'btn btn--ghost btn--sm', retry));
  }

  function drawTexts(root, page) {
    var sections = [], byKey = new Map(), searchId = uid('s'), searchIn, list, none;
    function paintCount(s) {
      var n = Object.keys(state.work.texts).filter(function (k) { return k.split('.')[0] === s.key; }).length;
      s.count.textContent = n ? plural(n, 'modifié', 'modifiés') : '';
    }
    /* recherche : cache les champs qui ne contiennent pas le mot (dans l'original ou dans le texte actuel) ; sections ouvertes pendant la recherche */
    function applyFilter() {
      var q = norm(state.query.trim()), any = false;
      sections.forEach(function (s) {
        var shown = 0;
        s.items.forEach(function (it) {
          var match = !q || norm(it.t.original + ' ' + (state.work.texts[it.t.key] || '')).indexOf(q) >= 0;
          it.wrap.hidden = !match;
          if (match) { shown += 1; }
        });
        s.box.hidden = shown === 0;
        s.box.open = q ? shown > 0 : state.openSections.has(s.key);
        any = any || shown > 0;
      });
      none.hidden = any;
    }
    page.texts.forEach(function (t) {
      var s = byKey.get(t.section);
      if (!s) { s = { key: t.section, items: [] }; byKey.set(t.section, s); sections.push(s); }
      s.items.push({ t: t });
    });
    searchIn = h('input', { id: searchId, class: 'input', type: 'search', value: state.query, placeholder: 'Ex. livraison', autocomplete: 'off', enterkeyhint: 'search' });
    searchIn.addEventListener('input', function () { state.query = searchIn.value; applyFilter(); });
    root.appendChild(h('div', { class: 'search field' }, [h('label', { class: 'field__label', for: searchId, text: 'Chercher un mot dans les textes' }), searchIn]));
    list = h('div', { class: 'sections' });
    sections.forEach(function (s) {
      var body = h('div', { class: 'sec__body' }), sum;
      s.count = h('span', { class: 'sec__count' });
      s.items.forEach(function (it) {
        var t = it.t, f = field({
          label: TAG_LABELS[t.tag] || 'Texte', original: t.original, value: state.work.texts[t.key] === undefined ? t.original : state.work.texts[t.key],
          max: 600, counter: true, area: true, oneLine: true, blankIsOriginal: true,
          changed: function () { return hasOwn(state.work.texts, t.key); },
          parse: function (raw) { var v = cleanText(raw, false); return { value: v === '' || v === t.original ? undefined : v }; },
          commit: function (v) { if (v === undefined) { delete state.work.texts[t.key]; } else { state.work.texts[t.key] = v; } },
          reset: function () { delete state.work.texts[t.key]; },
          onCheck: function () { paintCount(s); }
        });
        it.wrap = h('div', { class: 'tfield' }, [f.el]);
        body.appendChild(it.wrap);
      });
      sum = h('summary', { class: 'sec__sum' }, [h('span', { text: SECTIONS[s.key] || s.key }), s.count]);
      /* on retient seulement les ouvertures et fermetures faites par Oriana (pas celles de la recherche) */
      sum.addEventListener('click', function () { if (s.box.open) { state.openSections.delete(s.key); } else { state.openSections.add(s.key); } });
      s.box = h('details', { class: 'sec' }, [sum, body]);
      list.appendChild(s.box);
      paintCount(s);
    });
    none = h('p', { class: 'notice', text: 'Aucun texte ne contient ce mot.', hidden: true });
    root.appendChild(none); root.appendChild(list);
    applyFilter();
  }
  RENDERERS.textes = function (root, id) {
    var holder = loadingBox('Je lis la page de votre site…');
    root.appendChild(h('div', { class: 'viewhead' }, [
      h('h1', { class: 'viewtitle', tabindex: '-1', text: 'Textes du site' }),
      h('p', { class: 'lead', text: 'Changez les phrases de votre page d’accueil. Pour mettre un mot en gras, entourez-le de deux étoiles\xA0: **mot**.' })
    ]));
    root.appendChild(holder);
    ensurePage().then(function (page) { if (id === state.renderId) { root.removeChild(holder); drawTexts(root, page); } })
      .catch(function (e) { if (id === state.renderId) { showLoadError(holder, e, function () { renderCurrent(false); }); } });
  };

  /* ======================================================================
     15. PHOTOS : les photos de la page, la galerie, les retours clientes
     ====================================================================== */
  function slotLabel(key) { return SLOT_LABELS[key] || (SECTIONS[key.split('.')[0]] || key.split('.')[0]) + COLON + 'photo'; }

  /* une photo de la page (repère data-img) : photo actuelle, changer, texte alternatif */
  function slotCard(slot) {
    var key = slot.key, imgBox = h('div', { class: 'slot__img' }), status = h('p', { class: 'field__err', role: 'alert' }), fileIn, changeBtn, backBtn, altField;
    function cur() {
      var s = isObj(state.work.photos.slots) ? state.work.photos.slots[key] : null;
      return isObj(s) ? { src: s.src, alt: typeof s.alt === 'string' ? s.alt : '' } : { src: slot.src, alt: slot.alt };
    }
    /* enregistre la photo et son texte ; si les deux sont revenus à l'origine, le repère est retiré du fichier */
    function setSlot(src, alt) {
      var P = state.work.photos;
      if (src === slot.src && alt === slot.alt) {
        if (isObj(P.slots)) { delete P.slots[key]; if (!Object.keys(P.slots).length) { delete P.slots; } }
      } else {
        if (!isObj(P.slots)) { P.slots = {}; }
        P.slots[key] = { src: src, alt: alt };
      }
    }
    function drawImg(previewUrl) {
      clear(imgBox);
      imgBox.appendChild(previewUrl || cur().src ? picture(previewUrl || cur().src, '') : icon('image'));
      backBtn.hidden = cur().src === slot.src;
    }
    fileIn = h('input', { type: 'file', class: 'sr-only', accept: PHOTO_ACCEPT, tabindex: '-1', 'aria-hidden': 'true' });
    changeBtn = button('Changer la photo', 'btn btn--ghost btn--sm', function () { fileIn.click(); }, 'camera');
    backBtn = button('Rétablir la photo d’origine', 'linkbtn linkbtn--accent', function () { setSlot(slot.src, cur().alt); drawImg(); changed(); });
    fileIn.addEventListener('change', async function () {
      var file = fileIn.files[0], path;
      fileIn.value = '';
      if (!file) { return; }
      status.textContent = ''; changeBtn.disabled = true; changeBtn.lastChild.textContent = 'Envoi…';
      try {
        path = await processPhotoFile(file, function (url) { drawImg(url); });
        setSlot(path, cur().alt); changed();
      } catch (e) { status.textContent = messageOf(e); }
      changeBtn.disabled = false; changeBtn.lastChild.textContent = 'Changer la photo';
      drawImg();
    });
    altField = field({
      label: 'Description de la photo', hint: 'Lue à voix haute aux personnes qui ne voient pas l’image.', original: slot.alt, originalLabel: slot.alt || 'aucune (photo décorative)',
      value: cur().alt, max: 200, counter: true,
      changed: function () { return cur().alt !== slot.alt; },
      parse: function (raw) { return { value: cleanText(raw, false) }; },
      commit: function (v) { setSlot(cur().src, v); },
      reset: function () { setSlot(cur().src, slot.alt); }
    });
    drawImg();
    return h('section', { class: 'card slot' }, [
      h('h3', { class: 'slot__title', text: slotLabel(key) }), imgBox,
      h('div', { class: 'toolbar' }, [changeBtn, backBtn, fileIn]), status, altField.el
    ]);
  }

  /* une liste de photos ordonnée (galerie ou retours clientes) : ajouter, retirer, monter, descendre, légende.
     Tant qu'Oriana n'y touche pas, la liste d'origine du code du site est utilisée ; à la première modification elle est copiée dans le fichier. */
  function listEditor(name, title, intro, origin) {
    var status = h('p', { class: 'field__err', role: 'alert' }), listEl = h('div', { class: 'list' }), countEl = h('p', { class: 'field__hint' }), refs = [], pending = [];
    var fileIn = h('input', { type: 'file', class: 'sr-only', accept: PHOTO_ACCEPT, multiple: true, tabindex: '-1', 'aria-hidden': 'true' });
    var addBtn = button('Ajouter des photos', 'btn btn--ghost btn--sm', function () { fileIn.click(); }, 'camera');
    var resetBtn = button('Rétablir la liste d’origine', 'linkbtn linkbtn--accent', resetList);
    function cur() { return Array.isArray(state.work.photos[name]) ? state.work.photos[name] : origin; }
    /* applique une modification à la liste ; focus = undefined : pas de nouvel affichage ; sinon réaffiche (focus : { i, act } ou null) */
    function mutate(fn, focus) {
      var P = state.work.photos, list = Array.isArray(P[name]) ? P[name] : clone(origin);
      fn(list);
      if (deepEqual(list, origin)) { delete P[name]; } else { P[name] = list; }
      changed();
      if (focus !== undefined) { draw(focus); }
    }
    function listButton(label, iconName, i, cls, onClick, disabled) {
      return h('button', { type: 'button', class: 'item__btn' + cls, disabled: disabled, 'aria-label': label + ' la photo ' + (i + 1), on: { click: onClick } }, [icon(iconName), h('span', { text: label })]);
    }
    function draw(focus) {
      var list = cur(), n = list.length, r, el;
      clear(listEl); refs = [];
      list.forEach(function (it, i) {
        var cap = h('input', { id: uid('g'), class: 'input', type: 'text', value: it.caption, maxlength: '160', placeholder: 'Légende (facultative)', autocomplete: 'off', 'aria-label': 'Légende de la photo ' + (i + 1) });
        var up = listButton('Monter', 'up', i, '', function () { mutate(function (l) { var t = l[i]; l[i] = l[i - 1]; l[i - 1] = t; }, { i: i - 1, act: 'up' }); }, i === 0);
        var down = listButton('Descendre', 'down', i, '', function () { mutate(function (l) { var t = l[i]; l[i] = l[i + 1]; l[i + 1] = t; }, { i: i + 1, act: 'down' }); }, i === n - 1);
        var del = listButton('Retirer', 'trash', i, ' item__btn--danger', function () { mutate(function (l) { l.splice(i, 1); }, { i: Math.min(i, n - 2), act: 'cap' }); }, false);
        cap.addEventListener('input', function () { mutate(function (l) { l[i].caption = cleanText(cap.value, false); }); });
        refs.push({ cap: cap, up: up, down: down, del: del });
        listEl.appendChild(h('div', { class: 'item' }, [
          h('div', { class: 'item__img' }, [picture(it.src, '')]),
          h('div', { class: 'item__body' }, [cap, h('div', { class: 'item__btns' }, [up, down, del])])
        ]));
      });
      pending.forEach(function (p) {
        listEl.appendChild(h('div', { class: 'item' }, [
          h('div', { class: 'item__img' }, [p.url ? picture(p.url, '') : icon('image')]),
          h('div', { class: 'item__body' }, [h('p', { class: 'loading' }, [h('span', { class: 'spinner' }), h('span', { text: 'Envoi de la photo…' })])])
        ]));
      });
      countEl.textContent = plural(n, 'photo', 'photos') + ' sur ' + MAX_LIST_PHOTOS + ' au maximum.';
      addBtn.disabled = n + pending.length >= MAX_LIST_PHOTOS;
      resetBtn.hidden = !Array.isArray(state.work.photos[name]);
      if (focus) {
        r = refs[focus.i]; el = r ? r[focus.act] : null;
        if (r && (!el || el.disabled)) { el = !r.up.disabled ? r.up : (!r.down.disabled ? r.down : r.cap); }
        (el || addBtn).focus();
      } else if (focus === null && !refs.length) { addBtn.focus(); }
    }
    async function addFiles(files) {
      var room = MAX_LIST_PHOTOS - cur().length - pending.length, i, p, path;
      status.textContent = '';
      if (files.length > room) {
        status.textContent = MAX_LIST_PHOTOS + ' photos au maximum dans cette liste\xA0: les photos en trop n’ont pas été ajoutées.';
        files = files.slice(0, Math.max(0, room));
      }
      for (i = 0; i < files.length; i++) {
        p = { url: null }; pending.push(p); draw();
        try {
          path = await processPhotoFile(files[i], function (url) { p.url = url; draw(); });
          pending.splice(pending.indexOf(p), 1);
          mutate(function (l) { l.push({ src: path, caption: '' }); }, null);
        } catch (e) { pending.splice(pending.indexOf(p), 1); status.textContent = messageOf(e); draw(); }
      }
    }
    async function resetList() {
      var ok = await confirmBox({ title: 'Rétablir la liste d’origine\xA0?', text: 'Vos ajouts, retraits et changements de légende dans cette liste seront annulés.', yes: 'Oui, rétablir', no: 'Non, garder', danger: true });
      if (!ok) { return; }
      delete state.work.photos[name]; changed(); draw(null);
    }
    fileIn.addEventListener('change', function () { var files = Array.prototype.slice.call(fileIn.files); fileIn.value = ''; addFiles(files); });
    draw();
    return h('section', { class: 'card' }, [
      h('h2', { class: 'card__title', text: title }), h('p', { class: 'field__hint', text: intro }), countEl,
      h('div', { class: 'toolbar' }, [addBtn, resetBtn, fileIn]), status, listEl
    ]);
  }
  /* liste d'origine du code du site (js/data.js), remise en forme */
  function originList(a) {
    return (Array.isArray(a) ? a : []).filter(function (x) { return isObj(x) && isValidImagePath(x.src); })
      .map(function (x) { return { src: x.src, caption: typeof x.caption === 'string' ? x.caption : '' }; });
  }

  RENDERERS.photos = function (root, id) {
    var holder = loadingBox('Je lis la page de votre site…');
    root.appendChild(h('div', { class: 'viewhead' }, [
      h('h1', { class: 'viewtitle', tabindex: '-1', text: 'Photos du site' }),
      h('p', { class: 'lead', text: 'Changez les photos de votre page d’accueil, votre galerie et les retours de vos clientes.' })
    ]));
    root.appendChild(holder);
    ensurePage().then(function (page) {
      if (id !== state.renderId) { return; }
      root.removeChild(holder);
      root.appendChild(h('h2', { class: 'sectitle', text: 'Les photos de la page' }));
      root.appendChild(h('div', { class: 'slots' }, page.slots.map(slotCard)));
      root.appendChild(h('h2', { class: 'sectitle', text: 'Galerie et retours clientes' }));
      root.appendChild(h('div', { class: 'stack' }, [
        listEditor('gallery', 'Galerie', 'Les photos de la galerie de votre page d’accueil, dans l’ordre où elles s’affichent.', originList(window.MPC_GALLERY_DEFAULT)),
        listEditor('reviews', 'Retours clientes', 'Les photos que vos clientes vous ont envoyées, dans l’ordre où elles s’affichent.', originList(window.MPC_REVIEWS_DEFAULT))
      ]));
    }).catch(function (e) { if (id === state.renderId) { showLoadError(holder, e, function () { renderCurrent(false); }); } });
  };

  /* ======================================================================
     16. LIVRAISON ET CONTACT
     ====================================================================== */
  var PHONE_RE = /^[0-9+ .()-]{6,20}$/, EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/, INSTA_RE = /^[A-Za-z0-9._]{1,30}$/;

  /* champ de contact (téléphone, e-mail, compte Instagram) : vide = valeur d'origine */
  function contactField(o, key, label, hint, max, test, problem, opts) {
    var origin = o[key];
    return field({
      label: label, hint: hint, original: origin, value: typeof group('contact')[key] === 'string' ? group('contact')[key] : origin, max: max, blankIsOriginal: true,
      inputmode: opts.inputmode, noCaps: opts.noCaps,
      changed: function () { return hasOwn(group('contact'), key); },
      parse: function (raw) {
        var v = cleanText(raw, false);
        if (key === 'instagram') { v = v.replace(/^@/, ''); }
        if (!v) { return { value: undefined }; }
        return test.test(v) ? { value: v } : { error: problem };
      },
      commit: function (v) { setSetting('contact', key, v, origin); },
      reset: function () { setSetting('contact', key, undefined); }
    });
  }
  /* un interrupteur suivi d'un texte (annonce, pause des commandes) : key = « announcement » ou « ordersPaused », textKey = « text » ou « message » */
  function switchedText(key, textKey, o) {
    var f;
    function cur() { var v = state.work.settings[key]; return isObj(v) ? { active: v.active === true, text: typeof v[textKey] === 'string' ? v[textKey] : '' } : { active: false, text: '' }; }
    function store(active, text) {
      if (!active && !text) { delete state.work.settings[key]; return; }
      state.work.settings[key] = { active: active };
      state.work.settings[key][textKey] = text;
    }
    var sw = switchRow(o.switchLabel, o.switchHint, cur().active, function (v) { store(v, cur().text); changed(); f.check(); });
    f = field({
      label: o.label, hint: o.hint, value: cur().text, max: 200, counter: true, area: true, short: true, oneLine: true, restoreLabel: o.restoreLabel,
      changed: function () { return cur().text !== ''; },
      parse: function (raw) {
        var v = cleanText(raw, false);
        return o.required && cur().active && !v ? { error: o.required } : { value: v };
      },
      commit: function (v) { store(cur().active, v); },
      reset: function () { store(cur().active, ''); }
    });
    if (o.required && cur().active && !cur().text) { f.reveal(); }
    return h('section', { class: 'card' }, [h('h2', { class: 'card__title', text: o.title }), sw.el, f.el]);
  }

  RENDERERS.livraison = function (root) {
    var o = originSettings(), fee, modesErr, switches, modes = [['relais', 'Livraison en point relais'], ['main', 'Remise en main propre'], ['ensemble', 'On voit ensemble']], review;
    function modeOn(k) { return group('shipping')[k] !== false; }
    function checkModes() {
      var ok = modes.some(function (m) { return modeOn(m[0]); });
      modesErr.textContent = ok ? '' : 'Gardez au moins un mode de remise, sinon personne ne pourra recevoir sa commande.';
      if (ok) { state.errors.delete('modes'); } else { state.errors.set('modes', { input: switches[0].input, show: function () { /* le message est déjà affiché */ } }); }
    }
    fee = field({
      label: 'Frais de livraison en point relais', money: true, hint: 'Un montant fixe par commande. Mettez 0 pour offrir la livraison.', original: moneyText(o.fee), originalLabel: fmtPrice(o.fee), blankIsOriginal: true,
      value: moneyText(typeof group('shipping').fee === 'number' ? group('shipping').fee : o.fee),
      changed: function () { return hasOwn(group('shipping'), 'fee'); },
      parse: moneyParser(0, 50, { empty: 'Écrivez le montant des frais (0 pour offrir la livraison).', range: 'Les frais doivent être compris entre 0 et 50' + NB + '€.' }),
      commit: function (v) { setSetting('shipping', 'fee', v, o.fee); },
      reset: function () { setSetting('shipping', 'fee', undefined); }
    });
    modesErr = h('p', { class: 'field__err', role: 'alert' });
    switches = modes.map(function (m) {
      return switchRow(m[1], undefined, modeOn(m[0]), function (v) { setSetting('shipping', m[0], v, true); changed(); checkModes(); });
    });
    review = field({
      label: 'Lien pour laisser un avis (facultatif)', hint: 'Si vous en mettez un, vos clientes pourront vous laisser un avis. L’adresse commence par https://', max: 300, noCaps: true, inputmode: 'url',
      value: typeof state.work.settings.reviewUrl === 'string' ? state.work.settings.reviewUrl : '', restoreLabel: 'Effacer le lien',
      changed: function () { return typeof state.work.settings.reviewUrl === 'string'; },
      parse: function (raw) {
        var v = cleanText(raw, false);
        if (!v) { return { value: undefined }; }
        return /^https:\/\/[^\s"'<>]+$/.test(v) ? { value: v } : { error: 'Écrivez une adresse qui commence par https://, sans espace.' };
      },
      commit: function (v) { if (v === undefined) { delete state.work.settings.reviewUrl; } else { state.work.settings.reviewUrl = v; } },
      reset: function () { delete state.work.settings.reviewUrl; }
    });
    root.appendChild(h('div', { class: 'viewhead' }, [
      h('h1', { class: 'viewtitle', tabindex: '-1', text: 'Livraison et contact' }),
      h('p', { class: 'lead', text: 'Les frais de livraison, vos coordonnées, une annonce sur votre site et la pause des commandes.' })
    ]));
    root.appendChild(h('div', { class: 'stack' }, [
      h('section', { class: 'card' }, [
        h('h2', { class: 'card__title', text: 'Livraison' }), fee.el,
        h('fieldset', { class: 'fieldset' }, [h('legend', { class: 'legend', text: 'Modes de remise proposés' })].concat(switches.map(function (s) { return s.el; }), [modesErr]))
      ]),
      h('section', { class: 'card' }, [
        h('h2', { class: 'card__title', text: 'Mes coordonnées' }),
        contactField(o, 'phone', 'Téléphone', 'Le numéro affiché sur votre site, qui sert aux SMS.', 20, PHONE_RE, 'Écrivez un numéro de 6 à 20 caractères\xA0: chiffres, espaces et + . ( ) - seulement.', { inputmode: 'tel' }).el,
        contactField(o, 'email', 'Adresse e-mail', '', 80, EMAIL_RE, 'Cette adresse e-mail semble incomplète. Exemple\xA0: prenom@exemple.fr', { inputmode: 'email', noCaps: true }).el,
        contactField(o, 'instagram', 'Compte Instagram', 'Le nom du compte, sans le ' + guill('@') + '.', 30, INSTA_RE, 'Écrivez le nom du compte, sans espace ni @ (lettres, chiffres, point et tiret bas).', { noCaps: true }).el
      ]),
      switchedText('announcement', 'text', {
        title: 'Annonce sur le site', switchLabel: 'Afficher un bandeau d’annonce', switchHint: 'Un message tout en haut de votre page d’accueil, par exemple pour des congés ou un marché.',
        label: 'Texte de l’annonce', hint: '', restoreLabel: 'Effacer le texte', required: 'Écrivez le texte de l’annonce, ou éteignez l’interrupteur.'
      }),
      switchedText('ordersPaused', 'message', {
        title: 'Pause des commandes', switchLabel: 'Mettre mes commandes en pause', switchHint: 'Vos clientes peuvent encore regarder, mais plus commander.',
        label: 'Message affiché aux clients', hint: 'Si vous ne mettez rien, ils verront' + COLON + guill('Les commandes sont momentanément en pause.'), restoreLabel: 'Effacer le message'
      }),
      h('section', { class: 'card' }, [h('h2', { class: 'card__title', text: 'Avis des clientes' }), review.el])
    ]));
    checkModes();
  };

  /* ======================================================================
     17. HISTORIQUE : les versions précédentes du site
     ====================================================================== */
  function historyLabel(msg) {
    return String(msg).replace(/^Espace pro\s*:\s*/, '').replace(/\s*\([0-9a-f]{7}\)\s*$/, '').slice(0, 120) || 'Mise à jour du contenu';
  }
  async function restoreVersion(sha) {
    var ok = await confirmBox({ title: 'Revenir à cette version\xA0?', text: 'Le contenu du site reviendra à cet état. Vos modifications non publiées seront perdues.', yes: 'Revenir à cette version', no: 'Annuler', danger: true });
    var rev = 0;
    if (!ok) { return; }
    try {
      rev = await withBusy('Retour à la version choisie…', async function () {
        var r = await authed('POST', '/restore', { sha: sha });
        return isObj(r) && typeof r.rev === 'number' ? r.rev : 0;
      });
    } catch (e) { toast(messageOf(e), { error: true }); return; }
    try {
      await withBusy('Je relis votre site…', async function () { applyLoaded(await loadContent()); discardUploads(); });
    } catch (e) { toast('Le retour a bien eu lieu, mais je n’ai pas pu relire le site\xA0: rechargez la page.', { error: true }); return; }
    startPolling(rev); renderCurrent(false); refreshBar();
  }
  RENDERERS.historique = function (root, id) {
    var holder = loadingBox('Je cherche les versions de votre site…'), list = h('div', { class: 'hist' });
    root.appendChild(h('div', { class: 'viewhead' }, [
      h('h1', { class: 'viewtitle', tabindex: '-1', text: 'Historique' }),
      h('p', { class: 'lead', text: 'Les versions précédentes de votre site. Vous pouvez revenir à l’une d’elles.' })
    ]));
    root.appendChild(holder);
    authed('GET', '/history').then(function (d) {
      var items = isObj(d) && Array.isArray(d.items) ? d.items.filter(function (x) { return isObj(x) && typeof x.sha === 'string' && SHA_RE.test(x.sha); }) : [];
      if (id !== state.renderId) { return; }
      root.removeChild(holder);
      if (!items.length) { root.appendChild(h('p', { class: 'notice', text: 'Aucune version précédente pour le moment.' })); return; }
      items.forEach(function (x, i) {
        list.appendChild(h('div', { class: 'card hist__item' }, [
          h('div', {}, [h('p', { class: 'hist__date', text: fmtDate(x.date) }), h('p', { class: 'hist__msg', text: historyLabel(x.message) })]),
          i === 0 ? h('span', { class: 'pill pill--ok', text: 'Version actuelle' }) : button('Revenir à cette version', 'btn btn--ghost btn--sm', function () { restoreVersion(x.sha); }, 'undo')
        ]));
      });
      root.appendChild(list);
    }).catch(function (e) { if (id === state.renderId) { showLoadError(holder, e, function () { renderCurrent(false); }); } });
  };

  /* ======================================================================
     18. PUBLICATION, ANNULATION, SUIVI DE LA MISE EN LIGNE
     ====================================================================== */
  /* chemins de toutes les photos utilisées dans la copie de travail */
  function usedPaths() {
    var used = new Set(), W = state.work, P = W.photos;
    W.articles.forEach(function (a) { a.photos.forEach(function (p) { used.add(p); }); });
    if (isObj(P.slots)) { Object.keys(P.slots).forEach(function (k) { if (isObj(P.slots[k])) { used.add(P.slots[k].src); } }); }
    ['gallery', 'reviews'].forEach(function (n) { if (Array.isArray(P[n])) { P[n].forEach(function (x) { if (isObj(x)) { used.add(x.src); } }); } });
    return used;
  }
  /* photos envoyées et encore utilisées : seules celles-là partent avec la publication (une photo retirée est simplement oubliée) */
  function uploadsToSend() {
    var used = usedPaths();
    return state.uploads.filter(function (u) { return used.has(u.path); });
  }
  /* résumé court en français pour l'historique (80 caractères au plus) */
  function publishNote() {
    var names = changedFiles(), parts = [], arts;
    if (names.indexOf('articles') >= 0) {
      arts = state.work.articles.filter(articleChange).map(function (a) { return a.name; });
      parts.push('Articles' + (arts.length ? ' : ' + arts.slice(0, 2).join(', ') + (arts.length > 2 ? '…' : '') : ''));
    }
    if (names.indexOf('catalog') >= 0) { parts.push('Boutique'); }
    if (names.indexOf('texts') >= 0) { parts.push('Textes'); }
    if (names.indexOf('photos') >= 0) { parts.push('Photos'); }
    if (names.indexOf('settings') >= 0) { parts.push('Livraison et contact'); }
    return parts.join(', ').slice(0, 80);
  }
  /* contrôles avant l'envoi (le serveur les refait) : renvoie { view, message } s'il y a un problème */
  function problemBeforePublish() {
    var sh = group('shipping'), ann = state.work.settings.announcement;
    if (sh.relais === false && sh.main === false && sh.ensemble === false) {
      return { view: 'livraison', message: 'Gardez au moins un mode de remise, sinon personne ne pourra recevoir sa commande.' };
    }
    if (isObj(ann) && ann.active === true && !String(ann.text || '').trim()) {
      return { view: 'livraison', message: 'Le bandeau d’annonce est allumé mais vide\xA0: écrivez son texte, ou éteignez-le.' };
    }
    if (uploadsToSend().length > MAX_UPLOADS) {
      return { view: null, message: 'Vous avez ajouté plus de ' + MAX_UPLOADS + ' photos d’un coup. Publiez par étapes\xA0: retirez-en quelques-unes, publiez, puis ajoutez les autres.' };
    }
    return null;
  }

  async function publish() {
    var names, problem, first, files = {}, shas = {}, payload, up, rev;
    if (state.busy) { return; }
    if (state.pending > 0) { toast('Une photo est encore en cours d’envoi\xA0: patientez un instant, puis publiez.', { error: true }); return; }
    if (state.errors.size) {
      first = state.errors.values().next().value;
      first.show(); first.input.focus();
      toast('Corrigez d’abord le champ signalé en rouge.', { error: true });
      return;
    }
    names = changedFiles();
    if (!names.length) { return; }
    problem = problemBeforePublish();
    if (problem) {
      if (problem.view && state.view !== problem.view) { location.hash = '#/' + problem.view; }
      toast(problem.message, { error: true });
      return;
    }
    names.forEach(function (n) { files[n] = state.work[n]; if (state.shas[n]) { shas[n] = state.shas[n]; } });
    up = uploadsToSend();
    payload = { files: files, shas: shas, note: publishNote() };
    if (up.length) { payload.uploads = up; }
    try {
      rev = await withBusy('Publication en cours…', async function () {
        var r = await authed('PUT', '/content', payload, 90000);
        try { applyLoaded(await loadContent()); }
        catch (e) { names.forEach(function (n) { state.files[n] = clone(state.work[n]); }); }   /* publié, mais relecture impossible : les empreintes seront mises à jour au prochain chargement */
        return isObj(r) && typeof r.rev === 'number' ? r.rev : 0;
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) { await onConflict(); return; }
      await confirmBox({ title: 'La publication n’a pas pu se faire', text: messageOf(e), yes: 'D’accord', no: null });
      return;
    }
    state.uploads = [];
    startPolling(rev); renderCurrent(false); refreshBar();
  }

  /* le site a changé ailleurs (par exemple une pièce vendue) : on relit la dernière version et on y remet les modifications de la page */
  async function onConflict() {
    var go = await confirmBox({ title: 'Le site a changé entre-temps', yes: 'Recharger', no: 'Plus tard',
      text: 'Une vente ou une autre modification a eu lieu pendant que vous travailliez. Je relis la dernière version du site et j’y remets vos modifications\xA0: rien n’est perdu. Vous pourrez ensuite les vérifier, puis publier de nouveau.' });
    if (!go) { return; }
    try {
      await withBusy('Je relis votre site…', async function () {
        var theirs = await loadContent();
        state.work = mergeWork(theirs.files);
        state.files = theirs.files; state.shas = theirs.shas; state.corrupt = theirs.corrupt;
      });
    } catch (e) { toast(messageOf(e), { error: true }); return; }
    renderCurrent(false); refreshBar();
    toast('J’ai relu le site et remis vos modifications dessus. Vérifiez-les, puis publiez de nouveau.');
  }

  async function cancelAll() {
    var n = countChanges(), ok;
    if (!n) { return; }
    ok = await confirmBox({ title: 'Annuler tous vos changements\xA0?', yes: 'Oui, tout annuler', no: 'Non, les garder', danger: true,
      text: 'Votre site reste tel qu’il est en ligne. ' + (n === 1 ? 'La modification non publiée sera effacée' : 'Les ' + n + ' modifications non publiées seront effacées') + ', ainsi que les photos ajoutées depuis.' });
    if (!ok) { return; }
    state.work = clone(state.files); discardUploads();
    renderCurrent(false); refreshBar();
    toast('Vos changements ont été annulés.');
  }

  /* ---------- « Publié ✓ » puis « En ligne ✓ » : toutes les 10 secondes (12 minutes au plus) on cherche le numéro de version dans js/content.js ---------- */
  function stopPolling() { if (state.poll) { clearTimeout(state.poll.timer); state.poll = null; } }
  function startPolling(rev) {
    stopPolling();
    showBanner('Publié ✓', 'Votre site se met à jour' + COLON + 'les changements seront visibles dans quelques minutes (parfois jusqu’à 10 minutes).');
    state.poll = { rev: rev, started: Date.now(), timer: 0 };
    state.poll.timer = setTimeout(pollOnce, POLL_MS);
  }
  async function pollOnce() {
    var p = state.poll, res, m, online = false;
    if (!p) { return; }
    try {
      res = await fetch('../js/content.js?t=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
      if (res.ok) { m = /"rev"\s*:\s*([0-9]+)/.exec(await res.text()); online = !!m && Number(m[1]) >= p.rev; }
    } catch (e) { /* pas de réponse : on réessaie au prochain passage */ }
    if (state.poll !== p) { return; }
    if (online) {
      stopPolling();
      showBanner('En ligne ✓', 'Vos changements sont visibles sur votre site.', { link: true });
    } else if (Date.now() - p.started > POLL_MAX_MS) {
      stopPolling();
      showBanner('Encore un peu de patience.', 'La mise en ligne est plus longue que d’habitude. Vos changements sont bien enregistrés\xA0: ils apparaîtront bientôt. Si rien ne change au bout d’un moment, rechargez votre site.', { warn: true, link: true });
    } else {
      p.timer = setTimeout(pollOnce, POLL_MS);
    }
  }

  /* ======================================================================
     19. DÉMARRAGE
     ====================================================================== */
  /* après la connexion : lit le contenu du site puis affiche l'onglet demandé */
  async function enterApp() {
    var holder;
    appEl.hidden = false; refreshInert();
    clear(mainEl); mainEl.appendChild(loadingBox('Je lis le contenu de votre site…'));
    try { applyLoaded(await loadContent()); }
    catch (e) {
      clear(mainEl); holder = h('div', {}); mainEl.appendChild(holder);
      showLoadError(holder, e, enterApp);
      return;
    }
    state.loaded = true; refreshBar();
    showView(viewFromHash());
  }

  tabsEl.addEventListener('click', function (ev) {
    var b = ev.target.closest('.tab'), view;
    if (!b || !state.loaded) { return; }
    view = b.getAttribute('data-view');
    if (location.hash === '#/' + view) { showView(view); } else { location.hash = '#/' + view; }
  });
  window.addEventListener('hashchange', function () { if (state.loaded && !loginVisible()) { showView(viewFromHash()); } });
  publishBtn.addEventListener('click', publish);
  cancelBtn.addEventListener('click', cancelAll);
  byId('logoutBtn').addEventListener('click', logout);
  byId('bannerClose').addEventListener('click', function () { stopPolling(); hideBanner(); });
  loginEls.form.addEventListener('submit', submitLogin);
  /* prévient avant de quitter la page si des modifications ne sont pas publiées */
  window.addEventListener('beforeunload', function (ev) { if (state.loaded && isDirty()) { ev.preventDefault(); ev.returnValue = ''; } });
  /* une erreur imprévue n'affiche jamais de détail technique */
  window.addEventListener('unhandledrejection', function (ev) { ev.preventDefault(); toast(messageOf(ev.reason), { error: true }); });
  /* la hauteur du bas d'écran (messages + barre « Publier ») sert à garder le contenu visible au-dessus */
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(function () { document.documentElement.style.setProperty('--dock-h', byId('dock').offsetHeight + 'px'); }).observe(byId('dock'));
  }

  state.session = API_OK ? readSession() : null;      /* sans adresse de serveur, une ancienne session ne sert à rien */
  if (state.session) { loginEl.hidden = true; refreshInert(); enterApp(); } else { showLogin(''); }
})();
