/* ==========================================================================
   MON PETIT CROCHET BY ORIANA : CONFIGURATION (à modifier ici uniquement)
   ========================================================================== */
/* ==========================================================================
   À REMPLIR : les clés et les infos qui manquent (cherchez « ◄◄◄ » dans ce fichier)
   --------------------------------------------------------------------------
   1. email                    : FAIT (11 nov. 2026), l'adresse e-mail d'Oriana (rubrique « Nous trouver », bouton « Par e-mail » et mentions légales).
   2. sendcloud > publicKey    : FAIT, la clé PUBLIQUE Sendcloud (livraison en point relais ou locker Mondial Relay).
   3. sumup > checkoutEndpoint : FAIT (11 nov. 2026), l'adresse du serveur des commandes chez Cloudflare (une adresse, pas une clé). Le site lui demande s'il est prêt :
                                 le paiement par carte dans le panier et les commandes automatiques s'activent TOUT SEULS dès que les clés sont posées chez Cloudflare (voir paiement-serveur/LISEZ-MOI.md).
   4. sumup > links            : facultatif, les liens de paiement SumUp (mode sans serveur).

   ⛔ CE FICHIER EST PUBLIC : il est publié avec le site, tout le monde peut le lire.
      Seules des clés PUBLIQUES et des adresses peuvent y figurer. Ne jamais y coller :
      - la clé SECRÈTE de Sendcloud ;
      - la clé API de SumUp (clé secrète : elle se saisit uniquement dans Cloudflare,
        voir paiement-serveur/LISEZ-MOI.md, jamais dans ce fichier).
   ========================================================================== */
window.MPC_CONFIG = {
  brand: 'Mon Petit Crochet by Oriana',

  /* Contact d'Oriana : Instagram, téléphone (ajouté le 9 nov. 2026) et e-mail (ajouté le 11 nov. 2026).
     Renseignez email et/ou phone (format 0612345678) : les boutons SMS / e-mail apparaissent automatiquement
     (rubrique « Nous trouver », récapitulatif de commande, demande personnalisée, mentions légales). */
  instagram: 'mon_petit_crochet_by_oriana',
  email: 'monpetitcrochetbyoriana@gmail.com',
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
    checkoutEndpoint: 'https://mpc-commandes.smartmoov59.workers.dev',   /* l'ADRESSE du serveur des commandes (Cloudflare Workers) : une adresse publique, pas une clé */
    /* DÉTECTION AUTOMATIQUE : le site demande au serveur « êtes-vous prêt ? » (réponse oui/non). Tant que les clés (SumUp, Brevo...) ne sont pas posées chez Cloudflare,
       la réponse est non et le site garde son fonctionnement habituel (récapitulatif + lien de paiement) ; dès qu'elles le sont, le paiement par carte dans le panier
       et les commandes automatiques (e-mails, bordereau, suivi) s'activent tout seuls, sans rien changer ici. detect: false = pas de question au serveur : seul autoOrders décide. */
    detect: true,
    /* Réglage à la main, utilisé SEULEMENT si detect vaut false : true = commandes automatiques (le serveur de commandes doit alors être complètement réglé). */
    autoOrders: false,
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

  /* Supplément « détails décoratifs » (perles, coquillages, bordure dorée ou argentée, marguerites, et la chaîne de sac de 40 cm : même supplément pour tous) */
  finishSurcharge: 3,

  /* FRAIS DE LIVRAISON (point relais ou locker seulement). Décision du 10 nov. 2026 : 5 € ; depuis le 11 nov. 2026 chaque pièce peut avoir SES frais.
     fee   = frais PAR DÉFAUT, en euros (0 = livraison offerte), pour toute pièce qui n'a pas ses propres frais (pièces de la boutique et articles d'Oriana : réglés dans son espace pro).
             Une commande est un seul colis : elle paie le frais le plus élevé de ses pièces, une seule fois (donc 5 € par commande tant qu'aucune pièce n'a son tarif) ;
             si Oriana allume « additionner » dans son espace pro (sum), les frais de chaque pièce s'additionnent (× quantité).
     modes = modes de remise qui paient la livraison : seulement 'relais' (livraison en point relais ou locker Mondial Relay).
             La livraison à domicile n'est pas proposée. « En main propre » ('main') est gratuit ;
             « On voit ensemble » ('ensemble') ne paie rien en ligne (à convenir avec Oriana).
     Oriana peut changer ces montants (et les modes proposés) dans son espace pro : le site et le serveur des commandes suivent tout seuls.
     ⚠ Pour changer la valeur d'ORIGINE ici, changez aussi SHIPPING_FEE en haut de paiement-serveur/commandes-worker.js
       (le serveur recalcule le total lui-même et refuserait un montant différent). */
  shipping: { fee: 5, modes: ['relais'] }
};
