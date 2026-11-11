/* ==========================================================================
   LIVRAISON EN POINT RELAIS OU LOCKER MONDIAL RELAY, choisi avec le sélecteur officiel Sendcloud.

   - En vrai : le sélecteur Sendcloud (carte + liste des points les plus proches du code postal) s'ouvre dans la commande,
     limité à Mondial Relay (points relais ET lockers). La cliente choisit, le site garde le point et l'ajoute au récapitulatif.
   - Clé : le sélecteur n'utilise que la clé PUBLIQUE de l'intégration « API Sendcloud » (js/config.js > sendcloud.publicKey).
     Cette clé est faite pour être vue dans une page web. La clé SECRÈTE de Sendcloud ne vient JAMAIS ici.
     Sans clé publique, l'option « Point relais » n'est pas proposée du tout.
   - Habillage : la fenêtre de Sendcloud (cadre, voile, bandeau) et la carte du point choisi sont aux couleurs du site (css/styles.css, shop.js) ;
     le contenu de la fenêtre de Sendcloud (liste, carte, boutons) est celui de Sendcloud et ne peut pas être modifié.
   - Démonstration : RETIRÉE le 11 novembre 2026 (la vraie carte fonctionne). La page relais-demo.html et ses fichiers sont archivés
     hors du dossier du site et ?relais=demo ne fait plus rien : DEMO ci-dessous reste à false, demoOpen n'est jamais appelée.
   - Sécurité : les données reçues du sélecteur sont revérifiées (type, longueur, pays, transporteur Mondial Relay) et nettoyées
     avant d'être gardées ou affichées ; rien d'autre que le code postal ne part chez Sendcloud ; le script Sendcloud n'est chargé
     que lorsque la cliente ouvre la carte.
   ========================================================================== */
(() => {
  'use strict';
  const CFG = window.MPC_CONFIG || {}, SC = CFG.sendcloud || {};
  const DEMO = false;   /* démonstration retirée (voir l'en-tête) : ne la remettre à true qu'avec relais-demo.html republié à côté */
  const KEY = String(SC.publicKey || '').trim();
  const KEY_OK = /^[A-Za-z0-9_-]{16,80}$/.test(KEY);
  if (KEY && !KEY_OK && window.console) console.warn('[relais] sendcloud.publicKey a une forme inattendue : option point relais désactivée.');
  const COUNTRIES = (Array.isArray(SC.countries) && SC.countries.length ? SC.countries : ['fr']).map(c => String(c).toLowerCase()).filter(c => /^[a-z]{2}$/.test(c));
  const CARRIERS = /^[a-z_,]{3,80}$/.test(String(SC.carriers || '')) ? String(SC.carriers) : 'mondial_relay';
  const LANG = ['de-de', 'en-gb', 'en-us', 'es-es', 'fr-fr', 'it-it', 'nl-nl'].includes(SC.language) ? SC.language : 'fr-fr';
  const SDK = 'https://embed.sendcloud.sc/spp/1.0.0/api.min.js';
  const NAMES = { fr: 'France', be: 'Belgique', lu: 'Luxembourg', es: 'Espagne', pt: 'Portugal', nl: 'Pays-Bas' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enabled = () => (DEMO || KEY_OK) && COUNTRIES.length > 0;
  /* forme du code postal attendue selon le pays (simple contrôle de saisie : le sélecteur Sendcloud fait la vraie recherche) */
  const POSTAL = { fr: /^\d{5}$/, be: /^\d{4}$/, lu: /^\d{4}$/, es: /^\d{5}$/, pt: /^\d{4}(-?\d{3})?$/, nl: /^\d{4}\s?[A-Za-z]{2}$/ };
  const POSTAL_HELP = { fr: '5 chiffres', be: '4 chiffres', lu: '4 chiffres', es: '5 chiffres', pt: 'ex. 1000-001', nl: 'ex. 1011 AB' };
  const postalOk = (c, v) => (POSTAL[c] || /^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/).test(String(v == null ? '' : v).trim());
  const postalHelp = c => POSTAL_HELP[c] || '';

  /* ---------- Nettoyage : ce que le sélecteur renvoie n'est jamais cru sur parole ---------- */
  const txt = (v, max) => String(v == null ? '' : v).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const HOUR = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/;
  function hoursOf(sp) {
    const o = sp && typeof sp.formatted_opening_times === 'object' ? sp.formatted_opening_times : null, out = [];
    for (let d = 0; d < 7; d++) {
      const a = o && Array.isArray(o[d]) ? o[d] : (o && Array.isArray(o[String(d)]) ? o[String(d)] : []);
      out.push(a.map(s => txt(s, 20)).filter(s => HOUR.test(s)).slice(0, 4));
    }
    return out;
  }
  /* renvoie le point relais nettoyé, ou null s'il n'est pas valable (autre transporteur, pays non prévu, champs manquants) */
  function clean(sp, post) {
    if (!sp || typeof sp !== 'object') return null;
    const id = Number(sp.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (!/mondial/i.test(String(sp.carrier || ''))) return null;                 /* seul Mondial Relay est accepté */
    const country = txt(sp.country, 2).toLowerCase();
    if (!COUNTRIES.includes(country)) return null;
    const name = txt(sp.name, 120), city = txt(sp.city, 80), postal = txt(sp.postal_code, 12);
    if (!name || !city || !postal) return null;
    const num = txt(sp.house_number, 30), st = txt(sp.street, 120);
    const plain = /^\d{1,4}\s?(?:bis|ter|quater|[A-Za-z])?$/i.test(num);              /* « 12 », « 12 bis », « 12B » : le numéro passe devant la rue (ordre français : « 12 rue des Lilas ») ; sinon (« 1172 BOULEVARD » dans le champ numéro), on garde l'ordre de Sendcloud */
    const street = (num && st ? (plain ? num + ' ' + st : st + ' ' + num) : st || num).slice(0, 140);
    const d = Number(sp.distance);
    return {
      id, code: txt(sp.code, 40), name, street, postal, city, country: country.toUpperCase(), carrier: 'mondial_relay',
      type: sp.general_shop_type === 'locker' ? 'locker' : 'relais',
      hours: hoursOf(sp), distance: Number.isFinite(d) && d >= 0 && d < 500000 ? Math.round(d) : null,
      postNumber: txt(post, 20)
    };
  }

  /* ---------- Affichage ---------- */
  const typeLabel = r => (r.type === 'locker' ? 'Locker' : 'Point relais');
  const distanceText = r => (r.distance == null ? '' : r.distance < 1000 ? 'à ' + r.distance + ' m' : 'à ' + (r.distance / 1000).toFixed(1).replace('.', ',') + ' km');
  function hoursToday(r) {
    if (!r.hours || !r.hours.some(a => a.length)) return '';
    const h = r.hours[(new Date().getDay() + 6) % 7];
    return h.length ? 'aujourd’hui ' + h.join(' · ') : 'fermé aujourd’hui';
  }
  const addressLine = r => (r.street ? r.street + ', ' : '') + r.postal + ' ' + r.city;
  /* lignes ajoutées au récapitulatif envoyé à Oriana : de quoi créer l'étiquette Sendcloud sans rien ressaisir */
  function recap(r) {
    return 'Point de retrait : ' + r.name + ', ' + addressLine(r) + ' (' + r.country + ')\n' +
      'Mondial Relay · ' + typeLabel(r).toLowerCase() + ' · ID Sendcloud ' + r.id + (r.code ? ' · code ' + r.code : '') + (r.postNumber ? ' · n° de retrait ' + r.postNumber : '');
  }

  /* ---------- Chargement du script Sendcloud, seulement quand la cliente ouvre la carte ---------- */
  let sdk = null;
  const loadSdk = () => sdk || (sdk = new Promise((resolve, reject) => {
    if (window.sendcloud && window.sendcloud.servicePoints) { resolve(); return; }
    const s = document.createElement('script'), t = setTimeout(() => { sdk = null; reject(new Error('delai')); }, 12000);
    s.src = SDK; s.async = true;
    s.onload = () => { clearTimeout(t); (window.sendcloud && window.sendcloud.servicePoints) ? resolve() : (sdk = null, reject(new Error('sdk'))); };
    s.onerror = () => { clearTimeout(t); sdk = null; reject(new Error('reseau')); };
    document.head.appendChild(s);
  }));

  /* ---------- Démonstration : la page relais-demo.html s'ouvre dans une fenêtre (jamais proposée sans le paramètre de démonstration) ----------
     La page de démonstration vit à part, avec sa propre politique de sécurité : seule elle peut joindre OpenStreetMap (fond de carte)
     et l'API Géo de l'État (communes). Elle dialogue avec le site par postMessage, comme le fait le sélecteur Sendcloud,
     et ce qu'elle renvoie passe par clean() comme n'importe quelle réponse de Sendcloud. */
  function demoOpen(opts) {
    const root = document.createElement('div');
    root.className = 'rpick'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Choix du point relais ou locker (démonstration)');
    const prev = document.activeElement, q = new URLSearchParams({ c: opts.country });
    if (opts.postalCode) q.set('cp', opts.postalCode);
    root.innerHTML = '<div class="rpick__backdrop"></div><div class="rpick__panel"><iframe class="rpick__frame" title="Choix du point relais ou locker (démonstration)"></iframe></div>';
    const frame = root.querySelector('iframe');
    let closed = false;
    const finish = fn => { if (closed) return; closed = true; shut(); fn(); };
    const onMsg = e => {                                     /* on n'écoute que notre propre page de démonstration */
      const d = e.data;
      if (e.origin !== location.origin || e.source !== frame.contentWindow || !d || d.rpick !== 1) return;
      if (d.type === 'pick') finish(() => opts.onPick(d.sp, typeof d.post === 'string' ? d.post : ''));
      else if (d.type === 'close') finish(() => opts.onFail(['Closed']));
    };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); finish(() => opts.onFail(['Closed'])); } };
    function shut() {
      window.removeEventListener('message', onMsg); document.removeEventListener('keydown', onKey, true);
      root.classList.remove('is-open'); setTimeout(() => root.remove(), 350);
      if (prev && prev.focus) prev.focus({ preventScroll: true });
    }
    root.querySelector('.rpick__backdrop').addEventListener('click', () => finish(() => opts.onFail(['Closed'])));
    frame.addEventListener('load', () => { try { frame.contentWindow.focus(); } catch (_) { /* cadre non joignable */ } });
    window.addEventListener('message', onMsg); document.addEventListener('keydown', onKey, true);
    frame.src = 'relais-demo.html?' + q;
    document.body.appendChild(root);
    void root.offsetWidth;                                   /* force le calcul de style : la fenêtre apparaît en fondu même si le navigateur est en arrière-plan */
    root.classList.add('is-open');
  }

  /* ---------- Ouverture du sélecteur ---------- */
  /* opts : { country, postalCode, current (point déjà choisi), onPick(pointNettoyé), onError(message) } */
  async function open(opts) {
    const country = COUNTRIES.includes(String(opts.country || '').toLowerCase()) ? String(opts.country).toLowerCase() : COUNTRIES[0];
    const postal = txt(opts.postalCode, 12);
    const pick = (sp, post) => { const r = clean(sp, post); if (r) opts.onPick(r); else opts.onError('Ce point n’est pas un point relais ou un locker Mondial Relay : choisissez-en un autre.'); };
    const fail = errs => { if (Array.isArray(errs) && errs.length === 1 && errs[0] === 'Closed') return; if (window.console) console.warn('[relais]', errs); opts.onError('La carte des points relais n’a pas pu s’ouvrir. Réessayez dans un instant, ou choisissez « On voit ensemble ».'); };
    if (DEMO) { demoOpen({ country, postalCode: postal, onPick: pick, onFail: fail }); return; }
    if (!KEY_OK) { opts.onError('La livraison en point relais n’est pas encore disponible.'); return; }
    try { await loadSdk(); } catch (e) { fail(['sdk']); return; }
    const cfg = { apiKey: KEY, country: country.toUpperCase(), language: LANG, carriers: CARRIERS };
    if (postal) cfg.postalCode = postal;
    if (opts.current && Number.isInteger(opts.current.id) && !DEMO) cfg.servicePointId = opts.current.id;
    try { window.sendcloud.servicePoints.open(cfg, pick, fail); } catch (e) { fail(['open']); }
  }

  window.MPC_RELAY = { demo: DEMO, enabled, countries: COUNTRIES, countryName: c => NAMES[c] || c.toUpperCase(), open, clean, recap, typeLabel, distanceText, hoursToday, addressLine, postalOk, postalHelp, esc };
})();
