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
  { id: 'vert-amande',     name: 'Vert anis',     hex: '#E0DBB2' },
  { id: 'bleu-clair',      name: 'Bleu clair',      hex: '#BFD7E3' },
  { id: 'bleu-ciel',       name: 'Bleu ciel',       hex: '#8FA9E6' },
  { id: 'bleu-lac',        name: 'Bleu lac',        hex: '#4E9188' },
  { id: 'bleu-electrique', name: 'Bleu électrique', hex: '#2E43B0' },
  { id: 'lavande',         name: 'Lavande',         hex: '#B8A5DE' },
  { id: 'rose-clair',      name: 'Rose clair',      hex: '#F4C2C4' },
  { id: 'rose-bonbon',     name: 'Rose acide',     hex: '#F4A9C6' },
  { id: 'rose-fuchsia',    name: 'Rose fuchsia',    hex: '#D3256B' },
  { id: 'corail',          name: 'Corail',          hex: '#F3A081' },
  { id: 'orange',          name: 'Orange',          hex: '#F0601F' },
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
  { id: 'fleurs',   name: 'Marguerites brodées',    paid: true }
];

const P = 'assets/img/';
/* Photos recolorées : assets/img/gen/<pièce>-<coloris>.jpg, uniquement si le fichier a été généré */
window.MPC_GEN = window.MPC_GEN || {};
function genPhotos(prefix) {
  const out = {};
  window.MPC_COLORS.forEach(c => { if ((window.MPC_GEN[prefix] || []).includes(c.id)) out[c.id] = 'gen/' + prefix + '-' + c.id; });
  return out;
}
window.MPC_GEN.sac = window.MPC_COLORS.map(c => c.id);
window.MPC_GEN.paniers = window.MPC_COLORS.map(c => c.id);
window.MPC_GEN.cabas = window.MPC_COLORS.map(c => c.id);
window.MPC_GEN.pochette = window.MPC_COLORS.map(c => c.id);
window.MPC_GEN.cordon = window.MPC_COLORS.map(c => c.id);
window.MPC_PRODUCTS = [
  {
    id: 'sac', type: 'bag', cat: 'sacs', name: 'Sac', badge: '',
    tagline: 'Simple ou double, crocheté pour vous.',
    desc: 'Je le crochète à la main en fil ruban, doux et souple, avec sa poignée découpée. Sac simple en une couleur, ou sac double en deux couleurs.',
    photo: P + 'sac-beige-main.jpg', photoAlt: 'Sac au crochet beige tenu par la poignée',
    gallery: ['sac-beige-main', 'sac-noir-main', 'sac-blanc', 'sac-gris-main', 'sac-rouge', 'sac-rose-main', 'sac-bleu-gris', 'sac-bleu-blanc', 'trio-sacs'].map(n => P + n + '.jpg'),
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
    photo: P + 'panier-blanc-bois.jpg', photoAlt: 'Panier rond au crochet blanc posé sur une rondelle de bois',
    gallery: ['panier-blanc-bois', 'panier-jaune', 'panier-cadeau', 'panier-dore', 'paniers-duo-rose', 'pause-cafe'].map(n => P + n + '.jpg'),
    photosByColor: genPhotos('paniers'),   /* 23 coloris générés à partir de sa photo des deux paniers */
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
    defaultColors: ['blanc', 'jaune', 'beige', 'rose-clair', 'vert-olive', 'bleu-clair', 'gris-clair', 'corail']
  },
  {
    id: 'panier-ovale', type: 'basketOval', cat: 'paniers', name: 'Panier ovale', badge: '',
    tagline: 'Plus long, plus généreux.',
    desc: 'Le cousin ovale du panier rond, en trois tailles (S, M, L) : je le crochète pour une table de salon, une entrée ou une salle de bain.',
    photo: P + 'paniers-duo-rose.jpg', photoAlt: 'Deux paniers ovales au crochet rose clair, un petit et un grand',
    gallery: ['paniers-duo-rose', 'panier-cadeau', 'panier-dore', 'atelier-blanc'].map(n => P + n + '.jpg'),
    photosByColor: genPhotos('paniers'),   /* même série : la photo montre le panier rond et le panier ovale */
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
    defaultColors: ['rose-clair', 'beige', 'blanc', 'vert-olive', 'gris-fonce', 'bleu-lac', 'jaune', 'corail']
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
    photo: P + 'pochette-marron.jpg', photoAlt: 'Pochette d’ordinateur au crochet marron et rose posée contre un ordinateur',
    gallery: ['pochette-marron', 'pochette-noir-or', 'pochette-gris', 'pochette-kaki'].map(n => P + n + '.jpg'),
    photosByColor: genPhotos('pochette'),   /* 23 coloris générés à partir de sa photo de pochette */
    sizes: null, models: [], quoteType: 'Pochette d’ordinateur / iPad',
    defaultColors: ['marron-fonce', 'noir', 'gris-fonce', 'vert-kaki', 'beige', 'bleu-lac', 'rose-clair', 'blanc']
  },
  {
    id: 'cabas', type: 'bag', cat: 'sur-mesure', name: 'Sac cabas', badge: 'Nouveau · sur devis', quote: true,
    tagline: 'Le sac fourre-tout.',
    desc: 'Mon sac cabas au crochet : fourre-tout, original et entièrement personnalisable (couleurs, anses, finitions). Chaque pièce est unique.',
    photo: P + 'cabas-bicolore.jpg', photoAlt: 'Sac cabas au crochet bicolore noir et beige accroché au mur',
    gallery: ['cabas-bicolore', 'cabas-anse'].map(n => P + n + '.jpg'),
    photosByColor: genPhotos('cabas'),   /* 23 coloris générés à partir de sa photo du cabas bicolore */
    sizes: null, models: [], quoteType: 'Sac cabas',
    defaultColors: ['noir', 'beige', 'marron-clair', 'blanc', 'vert-olive', 'bleu-lac', 'rose-clair', 'orange']
  }
];

window.MPC_FILTERS = [
  { id: 'all', name: 'Tout' },
  { id: 'sacs', name: 'Sacs' },
  { id: 'paniers', name: 'Paniers' },
  { id: 'cordons', name: 'Chaînes de téléphone' },
  { id: 'sur-mesure', name: 'Sur devis' }
];


