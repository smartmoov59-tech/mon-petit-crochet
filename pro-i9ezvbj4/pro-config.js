/* Adresse du serveur de l'espace pro : c'est le petit serveur gratuit (un « Worker » Cloudflare) qui enregistre
   les modifications d'Oriana. Sans barre oblique à la fin. Tant que ce serveur n'a pas ses réglages secrets (identifiant, code, jeton GitHub),
   il répond que l'espace pro « n'est pas encore configuré » et l'écran de connexion le dit.
   Cette adresse n'est pas un secret : seul le mot de passe d'Oriana donne accès à l'espace pro. */
window.PRO_API = 'https://mpc-pro.smartmoov59.workers.dev';
