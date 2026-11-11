/* ==========================================================================
   MON PETIT CROCHET BY ORIANA : CONFIGURATION (à modifier ici uniquement)
   ========================================================================== */
/* ==========================================================================
   À REMPLIR : les clés et les infos qui manquent (cherchez « ◄◄◄ » dans ce fichier)
   --------------------------------------------------------------------------
   1. email                    : l'adresse e-mail d'Oriana (bouton « E-mail » du site et mentions légales).
   2. sendcloud > publicKey    : la clé PUBLIQUE Sendcloud (livraison en point relais ou locker Mondial Relay).
   3. sumup > checkoutEndpoint : PLUS TARD, l'adresse du mini-serveur de paiement par carte (une adresse, pas une clé).
   4. sumup > links            : facultatif, les liens de paiement SumUp (mode sans serveur).

   ⛔ CE FICHIER EST PUBLIC : il est publié avec le site, tout le monde peut le lire.
      Seules des clés PUBLIQUES et des adresses peuvent y figurer. Ne jamais y coller :
      - la clé SECRÈTE de Sendcloud ;
      - la clé API de SumUp (clé secrète : elle se saisit uniquement dans Cloudflare,
        voir paiement-serveur/LISEZ-MOI.md, jamais dans ce fichier).
   ========================================================================== */
window.MPC_CONFIG = {
  brand: 'Mon Petit Crochet by Oriana',

  /* Contact d'Oriana : Instagram et téléphone (ajouté le 9 nov. 2026). L'e-mail reste à renseigner.
     Renseignez email et/ou phone (format 0612345678) : les boutons SMS / e-mail apparaissent automatiquement. */
  instagram: 'mon_petit_crochet_by_oriana',
  email: '',   /* ◄◄◄ À REMPLIR : l'e-mail d'Oriana, entre les deux apostrophes */
  phone: '0650677950',

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
    /* MODE CLÉS API (paiement par carte directement dans le panier, avec un petit serveur gratuit : dossier paiement-serveur/) :
       checkoutEndpoint = adresse du mini-serveur une fois déployé, ex. 'https://mpc-sumup.xxxx.workers.dev'. Vide = mode liens ci-dessous.
       ⚠ Ce fichier est PUBLIC : n'y mettre AUCUNE clé API. La clé secrète SumUp va seulement dans les « secrets » du mini-serveur
       (voir paiement-serveur/LISEZ-MOI.md). Ici, uniquement l'adresse du serveur, qui n'est pas un secret. */
    checkoutEndpoint: '',   /* ◄◄◄ PLUS TARD : l'ADRESSE du mini-serveur de paiement (pas une clé). Laisser vide pour l'instant. */
    links: {
      // "15": "https://pay.sumup.com/b2c/XXXXXXXX",
      // "25": "https://pay.sumup.com/b2c/XXXXXXXX",
      // "40": "https://pay.sumup.com/b2c/XXXXXXXX",
    }
  },

  /* LIVRAISON EN POINT RELAIS OU LOCKER MONDIAL RELAY (sélecteur officiel Sendcloud, voir js/relais.js).
     publicKey = la clé PUBLIQUE de l'intégration « API Sendcloud » (Réglages > Boutiques connectées > API Sendcloud, case « Service Points » cochée).
     Cette clé est faite pour être visible dans une page web : elle ne permet que d'afficher la carte des points relais.
     ⚠ La clé SECRÈTE de Sendcloud ne se met JAMAIS dans ce fichier (il est public) : elle servirait à créer des étiquettes et n'a pas sa place ici.
     Vide = l'option « Point relais / locker » n'est pas proposée. Pour voir le rendu sans clé : ajouter ?relais=demo à l'adresse du site. */
  sendcloud: {
    /* ◄◄◄ À REMPLIR : collez la clé PUBLIQUE Sendcloud entre les deux apostrophes de la ligne juste en dessous. Rien d'autre à changer. */
    publicKey: 'a0c6f7b9-5997-472f-917f-a6ee3d59c161',
    carriers: 'mondial_relay',   /* code Sendcloud de Mondial Relay (plusieurs : séparés par des virgules) ; le site refuse de toute façon un autre transporteur */
    countries: ['fr'],           /* pays où l'on livre en point relais : 'fr', 'be', 'lu', 'es', 'pt', 'nl' */
    language: 'fr-fr'
  },

  /* Supplément « détails décoratifs » (perles, coquillages, bordure dorée ou argentée, marguerites) */
  finishSurcharge: 3,

  /* FRAIS DE LIVRAISON : un montant fixe par commande, quel que soit le poids (décision du 10 nov. 2026 : 5 €).
     fee   = montant en euros (0 = livraison offerte).
     modes = modes de remise qui paient la livraison : seulement 'relais' (livraison en point relais ou locker Mondial Relay).
             La livraison à domicile n'est pas proposée. « En main propre » ('main') est gratuit ;
             « On voit ensemble » ('ensemble') ne paie rien en ligne (à convenir avec Oriana).
     ⚠ Si vous changez ce montant ou cette liste, changez aussi SHIPPING_FEE et SHIPPING_MODES en haut de paiement-serveur/sumup-worker.js
       (le serveur de paiement recalcule le total lui-même et refuserait un montant différent). */
  shipping: { fee: 5, modes: ['relais'] }
};
