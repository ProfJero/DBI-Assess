/*
 * DBI Assess configuration. Edit `apiUrl` after deploying the Worker (see README → Deploy).
 * The Firebase web config is public by design; access is controlled by firestore.rules.
 */
window.DBI_CONFIG = {
  // Your Cloudflare Worker URL, e.g. "https://dbi-assess-api.<your-subdomain>.workers.dev".
  apiUrl: 'https://dbi-assess-api.profjero.workers.dev',
  firebase: {
    apiKey: 'AIzaSyCdrmMMmZ0xdC2A_GXdAcWnUAa1i6QbjwQ',
    authDomain: 'dbi-assess.firebaseapp.com',
    projectId: 'dbi-assess',
    storageBucket: 'dbi-assess.firebasestorage.app',
    messagingSenderId: '558455201415',
    appId: '1:558455201415:web:4a12a7b7c4cff9ecb6a222',
  },
  brand: {
    name: 'DBI Assess',
    org: 'Digital Bridge Initiative',
    builtBy: 'ProfJero Digital Studio',
    supportEmail: 'ruraltechh@gmail.com',
  },
};

// Local testing against the Firebase emulators and `wrangler dev`: open any page with ?emulator=1 once.
(function () {
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('emulator') === '1') localStorage.setItem('dbi:emulator', '1');
    if (q.get('emulator') === '0') localStorage.removeItem('dbi:emulator');
    if (localStorage.getItem('dbi:emulator') === '1' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      window.DBI_CONFIG.emulator = true;
      window.DBI_CONFIG.apiUrl = 'http://127.0.0.1:8787';
      window.DBI_CONFIG.firebase.projectId = 'demo-dbi-assess';
    }
  } catch (e) {
    /* storage blocked */
  }
})();
