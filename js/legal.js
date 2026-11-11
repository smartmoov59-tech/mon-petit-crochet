/* Mentions légales : n'affiche que les lignes qui dépendent de js/config.js (e-mail, paiement dans le panier, livraison en point relais, frais de livraison).
   Ce code est dans un fichier à part (et non dans la page) pour que la politique de sécurité du navigateur puisse interdire les scripts « en ligne ». */
(function () {
  var c = window.MPC_CONFIG || {};
  var show = function (name, on) { var el = document.querySelector('[data-cfg="' + name + '"]'); if (el) el.hidden = !on; return el; };
  var row = show('email', !!c.email);
  if (c.email && row) { var a = row.querySelector('a'); a.href = 'mailto:' + c.email; a.textContent = c.email; }
  show('payapi', !!(c.sumup && c.sumup.checkoutEndpoint));                                        /* paragraphe sur le service de paiement : seulement si le mode clés API est activé */
  var relayOn = !!(c.sendcloud && String(c.sendcloud.publicKey || '').trim());
  show('relay', relayOn);                                                                         /* paragraphe sur Sendcloud et Mondial Relay : seulement si les points relais sont activés */
  var fee = Number(c.shipping && c.shipping.fee) || 0, ship = show('shipping', relayOn && fee > 0);   /* paragraphe sur les frais de livraison (livraison en point relais seulement) */
  if (ship && relayOn && fee > 0) { var out = ship.querySelector('[data-fee]'); if (out) out.textContent = fee.toLocaleString('fr-FR', { minimumFractionDigits: fee % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
})();
