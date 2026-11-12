/* ==========================================================================
   DONNÉES : coloris de fil, produits, prix (source : stories Instagram TARIFS / PALETTES / INFORMATIONS)
   ========================================================================== */
window.MPC_COLORS = [
  { id: 'blanc',           name: 'Blanc',           hex: '#F3F1EC' },
  { id: 'beige',           name: 'Beige',           hex: '#DEC9AE' },
  { id: 'gris-clair',      name: 'Gris clair',      hex: '#B3AFB0' },
  { id: 'gris-fonce',      name: 'Gris foncé',      hex: '#4A4A4D' },
  { id: 'noir',            name: 'Noir',            hex: '#1F1E1C' },
  { id: 'marron-clair',    name: 'Marron clair',    hex: '#80594A' },
  { id: 'marron-fonce',    name: 'Marron foncé',    hex: '#3B2A27' },
  { id: 'vert-kaki',       name: 'Vert kaki',       hex: '#3F4632' },
  { id: 'vert-olive',      name: 'Vert olive',      hex: '#8E9A4F' },
  { id: 'vert-feuille',    name: 'Vert feuille',    hex: '#5B9A3C', noPhoto: true },   /* ajouté le 9 nov. 2026 (en remplacement de « Vert anis », retiré) : pas de photo recolorée, l'aperçu 3D recolore la pièce */
  { id: 'bleu-clair',      name: 'Bleu clair',      hex: '#BFD7E3' },
  { id: 'bleu-ciel',       name: 'Bleu ciel',       hex: '#8FA9E6' },
  { id: 'bleu-lac',        name: 'Bleu lac',        hex: '#4E9188' },
  { id: 'bleu-electrique', name: 'Bleu électrique', hex: '#2E43B0' },
  { id: 'lavande',         name: 'Lavande',         hex: '#B8A5DE' },
  { id: 'violet-parme',    name: 'Violet parme',    hex: '#CFA5DD', noPhoto: true },
  { id: 'rose-clair',      name: 'Rose clair',      hex: '#F4C2C4' },
  { id: 'rose-bonbon',     name: 'Rose acide',     hex: '#F4A9C6' },
  { id: 'rose-fuchsia',    name: 'Rose fuchsia',    hex: '#D3256B' },
  { id: 'rouge',           name: 'Rouge',           hex: '#C8262D', noPhoto: true },
  { id: 'corail',          name: 'Corail',          hex: '#F3A081' },
  { id: 'orange',          name: 'Orange',          hex: '#F0601F' },
  { id: 'jaune-moutarde',  name: 'Jaune moutarde',  hex: '#D0A030', noPhoto: true },
  { id: 'jaune',           name: 'Jaune',           hex: '#F0BE23' },
  { id: 'argente',         name: 'Argenté',         hex: '#B9B9BC', metal: true },
  { id: 'dore',            name: 'Doré',            hex: '#C9AB6E', metal: true }
];
window.MPC_COLOR = Object.fromEntries(window.MPC_COLORS.map(c => [c.id, c]));

/* Finitions : un seul supplément (3 €) quelle que soit la finition choisie */
window.MPC_FINISHES = [
  { id: 'aucune',   name: 'Sans détail',            paid: false },
  { id: 'dore',     name: 'Bordure dorée',          paid: true },
  { id: 'argente',  name: 'Bordure argentée',       paid: true },
  { id: 'perles',   name: 'Perles',                 paid: true },
  { id: 'charms',   name: 'Coquillages & étoiles dorés', paid: true },
  { id: 'fleurs',   name: 'Marguerites brodées',    paid: true },
  /* chaînes de 40 cm pour porter un sac à l'épaule plutôt qu'à la main (sacs seulement), proposées comme un détail (même supplément, une seule finition par pièce).
     chain = famille de tons du coloris qui va avec : dorée avec les tons chauds, argentée avec les tons froids (voir MPC_TONES plus bas) */
  { id: 'chaine-doree',    name: 'Chaîne dorée (40 cm)',    paid: true, chain: 'chaud' },
  { id: 'chaine-argentee', name: 'Chaîne argentée (40 cm)', paid: true, chain: 'froid' }
];

/* Quelles finitions pour quelle pièce (consigne de la gérante, 9 nov. 2026) :
   - bordure dorée ou argentée : seulement les paniers et les pochettes d'ordinateur (jamais les sacs) ;
   - pochette d'ordinateur : les bordures seulement ;
   - sac cabas et chaîne de téléphone : aucune finition, on ne choisit que les couleurs ;
   - sac : perles, coquillages et étoiles, marguerites, et (11 nov. 2026) la chaîne dorée ou argentée de 40 cm pour le porter à l'épaule, selon les tons (MPC_TONES) ; paniers : toutes les finitions sauf les chaînes.
   Clé = identifiant du produit ; « aucune » = sans détail. Liste réduite à « aucune » = pas de choix de finition. */
window.MPC_FINISH_RULES = {
  'sac':          ['aucune', 'perles', 'charms', 'fleurs', 'chaine-doree', 'chaine-argentee'],
  'panier-rond':  ['aucune', 'dore', 'argente', 'perles', 'charms', 'fleurs'],
  'panier-ovale': ['aucune', 'dore', 'argente', 'perles', 'charms', 'fleurs'],
  'pochette':     ['aucune', 'dore', 'argente'],
  'cabas':        ['aucune'],
  'cordon':       ['aucune']
};

/* Tons des coloris : Oriana ne mélange pas les tons froids avec les tons chauds (consigne du 11 nov. 2026).
   Sert aux chaînes de sac : la chaîne dorée va avec les tons chauds, l'argentée avec les tons froids ; les neutres (blanc, noir, vert feuille) vont avec les deux.
   Un sac dont un coloris est chaud et l'autre froid n'a donc aucune chaîne. À corriger ICI si Oriana classe un coloris autrement ;
   le même classement est dans paiement-serveur/commandes-worker.js (TONES), à garder identique. */
window.MPC_TONES = {
  chaud: ['beige', 'marron-clair', 'marron-fonce', 'vert-kaki', 'vert-olive', 'jaune', 'jaune-moutarde', 'orange', 'corail', 'rouge', 'rose-clair', 'rose-bonbon', 'rose-fuchsia', 'dore'],
  froid: ['bleu-clair', 'bleu-ciel', 'bleu-lac', 'bleu-electrique', 'lavande', 'violet-parme', 'gris-clair', 'gris-fonce', 'argente']
};
window.MPC_CHAIN_RULE = 'Dorée avec les tons chauds, argentée avec les tons froids.';
/* une finition est-elle permise avec ces coloris ? (vrai pour toute finition qui n'est pas une chaîne ; une chaîne n'accepte aucun coloris du ton opposé) */
window.MPC_chainOk = function (finishId, colorIds) {
  const f = (window.MPC_FINISHES || []).find(x => x.id === finishId);
  if (!f || !f.chain) return true;
  const opposite = window.MPC_TONES[f.chain === 'chaud' ? 'froid' : 'chaud'];
  return !(colorIds || []).some(c => c && opposite.includes(c));
};

const P = 'assets/img/';
/* Photos recolorées : assets/img/gen/<pièce>-<coloris>.jpg, uniquement si le fichier a été généré */
window.MPC_GEN = window.MPC_GEN || {};
/* séries dont la liste est écrite à la main, coloris par coloris, et ne cite que des photos qui existent : pour elles, « noPhoto » ne compte pas
   (paniers rond et ovale : les 4 derniers coloris de la palette ont leur photo depuis le 12 nov. 2026) */
window.MPC_GEN_HAND = ['panier-rond', 'panier-ovale'];
function genPhotos(prefix) {
  const out = {};
  const hand = window.MPC_GEN_HAND.includes(prefix);
  window.MPC_COLORS.forEach(c => { if ((!c.noPhoto || hand) && (window.MPC_GEN[prefix] || []).includes(c.id)) out[c.id] = 'gen/' + prefix + '-' + c.id; });   /* noPhoto : coloris sans photo recolorée (aperçu 3D à la place), sauf séries écrites à la main (MPC_GEN_HAND) */
  return out;
}
window.MPC_GEN.sac = window.MPC_COLORS.map(c => c.id);
window.MPC_GEN.paniers = window.MPC_COLORS.map(c => c.id);
/* séries refaites le 11 nov. 2026 à partir des deux photos de présentation (Higgsfield, Nano Banana Pro, mode Unlimited) : 21 coloris chacune (beige = la photo d'Oriana elle-même) ; l'ancienne série « paniers » ne sert plus que de secours.
   12 nov. 2026 : + rouge, violet parme, jaune moutarde, vert feuille (même méthode, mode Unlimited, aucun crédit) = 25 coloris chacune + beige = toute la palette */
window.MPC_GEN['panier-rond'] = ['blanc', 'gris-clair', 'gris-fonce', 'noir', 'marron-clair', 'marron-fonce', 'vert-kaki', 'vert-olive', 'bleu-clair', 'bleu-ciel', 'bleu-lac', 'bleu-electrique', 'lavande', 'rose-clair', 'rose-bonbon', 'rose-fuchsia', 'corail', 'orange', 'jaune', 'argente', 'dore', 'rouge', 'violet-parme', 'jaune-moutarde', 'vert-feuille'];
window.MPC_GEN['panier-ovale'] = ['blanc', 'gris-clair', 'gris-fonce', 'noir', 'marron-clair', 'marron-fonce', 'vert-kaki', 'vert-olive', 'bleu-clair', 'bleu-ciel', 'bleu-lac', 'bleu-electrique', 'lavande', 'rose-clair', 'rose-bonbon', 'rose-fuchsia', 'corail', 'orange', 'jaune', 'argente', 'dore', 'rouge', 'violet-parme', 'jaune-moutarde', 'vert-feuille'];
window.MPC_GEN.cabas = window.MPC_COLORS.map(c => c.id);
window.MPC_GEN.pochette = window.MPC_COLORS.map(c => c.id);
window.MPC_GEN.cordon = window.MPC_COLORS.map(c => c.id);
/* Cadrage des vraies photos (publications Instagram) dans la carte carrée de la boutique : pos = point du cadre conservé (object-position), zoom = agrandissement.
   Réglé pour que les pièces tombent au même niveau d'une carte à l'autre. */
window.MPC_FRAME = {
  'panier-rond-presentation':  { pos: '55% 52%', zoom: 1.5 },    /* nouvelle photo (panier tenu en main, mur sable), 11 nov. 2026 */
  'panier-ovale-presentation': { pos: '52% 56%', zoom: 1.25 },
  'pochette-presentation':     { pos: '50% 92%', zoom: 1 }
};
window.MPC_PRODUCTS = [
  {
    id: 'sac', type: 'bag', cat: 'sacs', name: 'Sac', badge: '',
    tagline: 'Simple ou double, crocheté pour vous.',
    desc: 'Je le crochète à la main en fil t-shirt, doux et souple, avec sa poignée découpée. Sac simple en une couleur, ou sac double en deux couleurs.',
    photo: P + 'sac-beige-main.jpg', photoAlt: 'Sac au crochet beige tenu par la poignée',
    gallery: ['sac-beige-main', 'sac-noir-main', 'sac-blanc', 'sac-gris-main', 'sac-rouge', 'sac-rose-main', 'sac-bleu-gris', 'trio-sacs'].map(n => P + n + '.jpg'),   /* le montage de 4 photos « sac-bleu-blanc » est retiré : une seule photo par vignette, que des sacs */
    photosByColor: genPhotos('sac'),   /* 23 coloris générés à partir de sa photo (Higgsfield, Nano Banana Pro, mode Unlimited) */
    sizes: null,
    models: [
      { id: 'm1', name: 'Modèle 1 : simple', sub: '1 couleur', colors: 1, price: 40, labels: ['Couleur'] },
      { id: 'm2', name: 'Modèle 2 : mélange', sub: '2 couleurs', colors: 2, price: 45, labels: ['Couleur A', 'Couleur B'] },
      { id: 'm3', name: 'Modèle 3 : asymétrique', sub: '3/4 – 1/4', colors: 2, price: 45, labels: ['Haut (3/4)', 'Bas (1/4)'] },
      { id: 'm4', name: 'Modèle 4', sub: 'anse d’une couleur, reste d’une autre', colors: 2, price: 45, labels: ['Corps', 'Anse'] }
    ],
    defaultColors: ['beige', 'noir', 'rose-fuchsia', 'vert-olive', 'bleu-electrique', 'jaune', 'blanc', 'corail']
  },
  {
    id: 'panier-rond', type: 'basketRound', cat: 'paniers', name: 'Panier rond', badge: '',
    tagline: 'Panier de rangement, sur socle bois.',
    desc: 'Mon panier de rangement au crochet, monté sur un socle en bois. Deux tailles (S, M) et quatre modèles : simple, avec bordure dorée ou argentée, bicolore ou asymétrique.',
    photo: P + 'panier-rond-presentation.jpg', photoAlt: 'Panier rond au crochet beige, tenu dans la main devant un mur couleur sable',
    gallery: ['panier-rond-presentation', 'panier-rond-caramel-dore', 'panier-blanc-bois', 'panier-cadeau', 'atelier-creation-en-cours', 'paniers-duo-rose'].map(n => P + n + '.jpg'),   /* que des paniers ronds (ou le duo rond + ovale) ; « panier-rond-caramel-dore » = l'ancienne photo de présentation */   /* panier jaune et panier marron à bordure dorée retirés à la demande de Justin (9 nov. 2026) ; « pause café » retirée à sa demande (11 nov. 2026) */
    /* photo de présentation = la photo d'Oriana (panier tenu en main, 1235 × 1274, fournie le 11 nov. 2026) pour son coloris beige ; les 25 autres coloris : photos recolorées depuis cette photo (assets/img/gen/panier-rond-<coloris>.jpg, 960 × 960, refaites le 11 nov. 2026 ; rouge, violet parme, jaune moutarde et vert feuille ajoutés le 12 nov. 2026) ; l'ancienne série « paniers » ne sert plus que de secours */
    photosByColor: Object.assign({}, Object.assign({}, genPhotos('paniers'), genPhotos('panier-rond')), { 'beige': 'panier-rond-presentation' }),
    sizes: [
      { id: 'S', name: 'Taille S', price: 15, shape: [225, 225] },
      { id: 'M', name: 'Taille M', price: 25, shape: [280, 280] }
    ],
    models: [
      { id: 'm1', name: 'Modèle 1 : simple', sub: '1 couleur (socle bois)', colors: 1, labels: ['Couleur'] },
      { id: 'm2', name: 'Modèle 2 : simple avec bordure', sub: 'dorée ou argentée', colors: 1, labels: ['Couleur'], forceFinish: ['dore', 'argente'] },
      { id: 'm3', name: 'Modèle 3 : bicolore', sub: 'double fil', colors: 2, labels: ['Couleur A', 'Couleur B'] },
      { id: 'm4', name: 'Modèle 4 : asymétrique', sub: 'haut / bas', colors: 2, labels: ['Haut', 'Bas'] }
    ],
    defaultColors: ['beige', 'marron-clair', 'blanc', 'jaune', 'rose-clair', 'vert-olive', 'bleu-clair', 'gris-clair']
  },
  {
    id: 'panier-ovale', type: 'basketOval', cat: 'paniers', name: 'Panier ovale', badge: '',
    tagline: 'Plus long, plus généreux.',
    desc: 'Le cousin ovale du panier rond, en trois tailles (S, M, L) : je le crochète pour une table de salon, une entrée ou une salle de bain.',
    photo: P + 'panier-ovale-presentation.jpg', photoAlt: 'Panier ovale au crochet beige, tenu dans la main devant un mur couleur sable',
    gallery: ['panier-ovale-presentation', 'panier-ovale-rouille', 'paniers-duo-rose'].map(n => P + n + '.jpg'),   /* « panier-cadeau » et « atelier-blanc » sont des paniers ronds : retirés des ovales ; « panier-ovale-rouille » = l'ancienne photo de présentation */
    /* photo de présentation = la photo d'Oriana (panier tenu en main, 1235 × 1274, fournie le 11 nov. 2026) pour son coloris beige ; les 25 autres coloris : photos recolorées depuis cette photo (assets/img/gen/panier-ovale-<coloris>.jpg, 960 × 960, refaites le 11 nov. 2026 ; rouge, violet parme, jaune moutarde et vert feuille ajoutés le 12 nov. 2026) ; l'ancienne série « paniers » ne sert plus que de secours */
    photosByColor: Object.assign({}, Object.assign({}, genPhotos('paniers'), genPhotos('panier-ovale')), { 'beige': 'panier-ovale-presentation' }),
    sizes: [
      { id: 'S', name: 'Taille S', price: 15, shape: [273, 188] },
      { id: 'M', name: 'Taille M', price: 25, shape: [356, 216] },
      { id: 'L', name: 'Taille L', price: 35, shape: [610, 342] }
    ],
    models: [
      { id: 'm1', name: 'Modèle 1 : simple', sub: '1 couleur (socle bois)', colors: 1, labels: ['Couleur'] },
      { id: 'm2', name: 'Modèle 2 : simple avec bordure', sub: 'dorée ou argentée', colors: 1, labels: ['Couleur'], forceFinish: ['dore', 'argente'] },
      { id: 'm3', name: 'Modèle 3 : bicolore', sub: 'double fil', colors: 2, labels: ['Couleur A', 'Couleur B'] },
      { id: 'm4', name: 'Modèle 4 : asymétrique', sub: 'haut / bas', colors: 2, labels: ['Haut', 'Bas'] }
    ],
    defaultColors: ['beige', 'marron-clair', 'rose-clair', 'blanc', 'vert-olive', 'gris-fonce', 'bleu-lac', 'jaune']
  },
  {
    id: 'cordon', type: 'strap', cat: 'cordons', name: 'Chaîne de téléphone', badge: 'Nouveau',
    tagline: 'Votre téléphone, jamais loin.',
    desc: 'Je tresse ma chaîne de téléphone (mon cordon) au crochet : portée en bandoulière, avec sa pastille de fixation. En une ou deux couleurs, elle se marie à toutes vos tenues.',
    photo: P + 'cordon-corail.jpg', photoAlt: 'Cordon de téléphone au crochet corail porté en bandoulière',
    gallery: ['cordon-corail', 'cordon-marron', 'cordon-bleu-clair', 'cordon-noir', 'cordon-kaki', 'cordon-rose', 'cordon-beige', 'cordon-lavande', 'cordon-jaune', 'cordon-orange-rose', 'cordon-bleu-electrique', 'cordon-olive', 'cordon-blanc'].map(n => P + n + '.jpg'),
    photosByColor: genPhotos('cordon'),   /* 23 coloris générés à partir de sa photo de la chaîne portée */
    sizes: null,
    models: [
      { id: 'm1', name: 'Une couleur', sub: '1 couleur', colors: 1, price: 15, labels: ['Couleur'] },
      { id: 'm2', name: 'Deux couleurs', sub: '2 couleurs', colors: 2, price: 15, labels: ['Couleur A', 'Couleur B'] }
    ],
    defaultColors: ['corail', 'marron-fonce', 'bleu-clair', 'noir', 'vert-kaki', 'rose-bonbon', 'lavande', 'jaune']
  },
  {
    id: 'pochette', type: 'sleeve', cat: 'sur-mesure', name: 'Pochette d’ordinateur / iPad', badge: 'Sur devis', quote: true,
    tagline: 'Taillée à la mesure de votre écran.',
    desc: 'Je crochète votre pochette pour ordinateur ou iPad à vos dimensions, en une ou deux couleurs, avec une finition argentée ou dorée (facultative).',
    photo: P + 'pochette-presentation.jpg', photoAlt: 'Pochette d’ordinateur au crochet vert kaki, un MacBook à moitié glissé dedans',
    gallery: ['pochette-marron', 'pochette-noir-or', 'pochette-gris', 'pochette-kaki'].map(n => P + n + '.jpg'),
    /* photo de présentation = sa publication Instagram (1086 × 1433, taille d'origine) pour le vert kaki ; les autres coloris : photos recolorées */
    photosByColor: Object.assign({}, genPhotos('pochette'), { 'vert-kaki': 'pochette-presentation' }),
    sizes: null, models: [], quoteType: 'Pochette d’ordinateur / iPad',
    defaultColors: ['vert-kaki', 'marron-fonce', 'noir', 'gris-fonce', 'beige', 'bleu-lac', 'rose-clair', 'blanc']
  },
  {
    id: 'cabas', type: 'bag', cat: 'sur-mesure', name: 'Sac cabas', badge: 'Nouveau · sur devis', quote: true,
    tagline: 'Le sac fourre-tout.',
    desc: 'Mon sac cabas au crochet : fourre-tout et original, dans les couleurs de votre choix. Chaque pièce est unique.',
    photo: P + 'cabas-bicolore.jpg', photoAlt: 'Sac cabas au crochet bicolore noir et beige accroché au mur',
    gallery: ['cabas-bicolore', 'cabas-anse'].map(n => P + n + '.jpg'),
    photosByColor: genPhotos('cabas'),   /* 23 coloris générés à partir de sa photo du cabas bicolore */
    sizes: null, models: [], quoteType: 'Sac cabas',
    defaultColors: ['noir', 'beige', 'marron-clair', 'blanc', 'vert-olive', 'bleu-lac', 'rose-clair', 'orange']
  }
];

/* Galerie et retours clientes : listes d'origine. Oriana peut les remplacer depuis son espace pro (js/content.js, voir js/content-apply.js) ;
   l'espace pro s'appuie aussi sur ces listes pour montrer ce qui est en ligne aujourd'hui. */
window.MPC_GALLERY_DEFAULT = [
  /* retirées à la demande de Justin (9 nov. 2026) : panier jaune, accessoires, panier marron à bordure dorée */
  { src: 'assets/img/sac-bleu-gris.jpg', caption: 'Sac bleu-gris sur bois' },
  { src: 'assets/img/galerie-panier-violet.jpg', caption: 'Panier rond violet sur rondelle de bois' },
  { src: 'assets/img/galerie-pochette-kaki.jpg', caption: 'Pochette d’ordinateur kaki' },
  { src: 'assets/img/atelier-creation-en-cours.jpg', caption: 'Un panier blanc en cours de création' },
  { src: 'assets/img/sac-rouge.jpg', caption: 'Sac rouge et rose' },
  { src: 'assets/img/galerie-panier-olive-peche.jpg', caption: 'Panier ovale vert olive et pêche' },
  { src: 'assets/img/sac-beige-main.jpg', caption: 'Sac beige, anse à la main' },
  { src: 'assets/img/galerie-pochette-gris.jpg', caption: 'Pochette d’ordinateur, mélange de gris' },
  { src: 'assets/img/galerie-panier-bleu-degrade.jpg', caption: 'Panier rond en dégradé de bleus' },
  { src: 'assets/img/sac-blanc-bois.jpg', caption: 'Sac blanc cassé' },
  { src: 'assets/img/marche.jpg', caption: 'Le stand au marché nocturne' },
  { src: 'assets/img/galerie-panier-kaki.jpg', caption: 'Panier ovale kaki' },
  { src: 'assets/img/paniers-duo-rose.jpg', caption: 'Duo de paniers pour la table de salon' },
  { src: 'assets/img/galerie-pochette-prune.jpg', caption: 'Pochette d’ordinateur couleur prune' },
  { src: 'assets/img/sac-noir-main.jpg', caption: 'Sac noir, anse à la main' },
  { src: 'assets/img/galerie-panier-gris-argente.jpg', caption: 'Panier gris à la bordure argentée' },
  { src: 'assets/img/sac-rose-main.jpg', caption: 'Sac rose porté à la main' },
  { src: 'assets/img/panier-blanc-bois.jpg', caption: 'Panier blanc sur rondelle de bois' },
  { src: 'assets/img/galerie-pochette-noir-or.jpg', caption: 'Pochette d’ordinateur noire et fil doré' },
  { src: 'assets/img/sac-gris-main.jpg', caption: 'Sac mélange gris et noir' },
  { src: 'assets/img/galerie-panier-creme-taupe.jpg', caption: 'Panier rond blanc cassé et taupe' }
];
window.MPC_REVIEWS_DEFAULT = [
  { src: 'assets/img/retour-porquerolles.jpg', caption: 'Retour d’une cliente, en direct de Porquerolles' },
  { src: 'assets/img/retour-marseille.jpg', caption: 'Sac personnalisé, à Marseille' },
  { src: 'assets/img/trio-sacs.jpg', caption: 'Une grosse commande de sacs. Merci !' }
];

window.MPC_FILTERS = [
  { id: 'all', name: 'Tout' },
  { id: 'sacs', name: 'Sacs' },
  { id: 'paniers', name: 'Paniers' },
  { id: 'cordons', name: 'Chaînes de téléphone' },
  { id: 'sur-mesure', name: 'Sur devis' }
];


