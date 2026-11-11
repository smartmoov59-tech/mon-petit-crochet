/* Mentions légales : n'affiche que les lignes qui dépendent de js/config.js et de js/content.js (e-mail, paiement dans le panier, livraison en point relais, frais de livraison).
   Ce code est dans un fichier à part (et non dans la page) pour que la politique de sécurité du navigateur puisse interdire les scripts « en ligne ».
   Trois états pour le paiement, selon js/config.js : sans mini-serveur (sumup.checkoutEndpoint vide) ; mini-serveur seul (paiement) ; mini-serveur avec e-mails et bordereaux (sumup.autoOrders = true). */
(function () {
  var c = window.MPC_CONFIG || {};
  var show = function (name, on) { var els = document.querySelectorAll('[data-cfg="' + name + '"]'); for (var i = 0; i < els.length; i++) els[i].hidden = !on; return els[0] || null; };
  var ph = document.getElementById('legalPhone');                                                 /* téléphone : suit celui que renseigne Oriana (espace pro) */
  if (ph && c.phone) { ph.href = 'tel:' + String(c.phone).replace(/\s/g, ''); ph.textContent = /^\d{10}$/.test(c.phone) ? c.phone.replace(/(\d{2})(?=\d)/g, '$1 ') : c.phone; }
  var row = show('email', !!c.email);
  if (c.email && row) { var a = row.querySelector('a'); a.href = 'mailto:' + c.email; a.textContent = c.email; }
  /* États du paiement : « payold » (mini-serveur de paiement seul : il ne reçoit que le panier), « payapi » (mini-serveur avec e-mails et bordereaux : il reçoit les coordonnées),
     « noauto » (textes « aucune coordonnée n'est envoyée à un serveur »). Si l'adresse du mini-serveur est renseignée, on lui demande s'il est prêt (comme le fait le panier) :
     en attendant sa réponse, ou s'il ne répond pas, c'est le texte « sans serveur ». sumup.detect = false : on suit seulement sumup.autoOrders. */
  var sc = c.sumup || {}, endpoint = String(sc.checkoutEndpoint || '').replace(/\/+$/, '');
  var paint = function (pay, auto) { show('payold', pay && !auto); show('payapi', auto); show('noauto', !auto); };
  if (endpoint && sc.detect !== false) {
    paint(false, false);
    fetch(endpoint + '/', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) { var pay = !!d && d.pay === true; paint(pay, pay && d.auto === true); }).catch(function () { /* pas de réponse : texte « sans serveur » */ });
  } else { paint(!!endpoint, !!endpoint && !!sc.autoOrders); }
  var relayOn = !!(c.sendcloud && String(c.sendcloud.publicKey || '').trim());
  show('relay', relayOn);                                                                         /* paragraphe sur Sendcloud et Mondial Relay : seulement si les points relais sont activés */
  var fee = Number(c.shipping && c.shipping.fee) || 0, ship = show('shipping', relayOn && fee > 0);   /* paragraphe sur les frais de livraison (livraison en point relais seulement) */
  if (ship && relayOn && fee > 0) { var out = ship.querySelector('[data-fee]'); if (out) out.textContent = fee.toLocaleString('fr-FR', { minimumFractionDigits: fee % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
})();
