/* ==========================================================================
   MON PETIT CROCHET BY ORIANA : CONFIGURATION (à modifier ici uniquement)
   ========================================================================== */
window.MPC_CONFIG = {
  brand: 'Mon Petit Crochet by Oriana',

  /* Contact d'Oriana. Seul Instagram est public aujourd'hui.
     Renseignez email et/ou phone (format 0612345678) : les boutons SMS / e-mail apparaissent automatiquement. */
  instagram: 'mon_petit_crochet_by_oriana',
  email: '',
  phone: '',

  /* ------------------------------------------------------------------
     PAIEMENT SUMUP (sans serveur, sans abonnement)
     1) Dans votre compte SumUp : « Liens de paiement » > Créer un lien > montant fixe.
     2) Collez ci-dessous chaque lien, avec comme clé le montant en euros.
     La liste des montants utiles est affichée par le bouton « montants » du pied de page
     ou en tapant  MPC.montantsSumUp()  dans la console du navigateur.
     Si le total du panier n'a pas de lien, le site propose l'envoi de la commande à Oriana,
     qui répond avec un lien SumUp au montant exact.
     ------------------------------------------------------------------ */
  sumup: {
    links: {
      // "15": "https://pay.sumup.com/b2c/XXXXXXXX",
      // "25": "https://pay.sumup.com/b2c/XXXXXXXX",
      // "40": "https://pay.sumup.com/b2c/XXXXXXXX",
    }
  },

  /* Supplément « détails décoratifs » (perles, coquillages, bordure dorée ou argentée, marguerites) */
  finishSurcharge: 3
};
