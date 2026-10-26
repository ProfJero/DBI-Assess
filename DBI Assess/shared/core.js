/*
 * DBI Assess core: Firebase setup, the Worker API client, on-device storage (IndexedDB),
 * auth guards and small UI helpers. Classic script; exposes window.DBI.
 * Requires firebase-app/auth/firestore compat scripts and shared/config.js to be loaded first.
 */
(function () {
  'use strict';
  var CFG = window.DBI_CONFIG;
  var DBI = (window.DBI = window.DBI || {});

  // ---------------------------------------------------------------- Firebase
  var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CFG.firebase);
  var auth = firebase.auth(app);
  var db = firebase.firestore(app);
  if (CFG.emulator && !DBI._emu) {
    auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
    db.useEmulator('127.0.0.1', 8080);
    DBI._emu = true;
  }
  DBI.app = app;
  DBI.auth = auth;
  DBI.db = db;
  DBI.config = CFG;

  /** Resolves with the signed-in user (or null) once Firebase has restored the session — works offline. */
  DBI.currentUser = function () {
    return new Promise(function (resolve) {
      var off = auth.onAuthStateChanged(function (u) {
        off();
        resolve(u);
      });
    });
  };

  DBI.claims = async function (user) {
    user = user || auth.currentUser;
    if (!user) return {};
    try {
      return (await user.getIdTokenResult()).claims || {};
    } catch (e) {
      // Offline: decode the cached token instead of refreshing it.
      try {
        var t = user.toJSON().stsTokenManager.accessToken.split('.')[1];
        return JSON.parse(atob(t.replace(/-/g, '+').replace(/_/g, '/')));
      } catch (e2) {
        return {};
      }
    }
  };

  // ---------------------------------------------------------------- IndexedDB key/value store
  var dbPromise = null;
  function idb() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var req = indexedDB.open('dbi-assess', 1);
        req.onupgradeneeded = function () {
          req.result.createObjectStore('kv');
        };
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    }
    return dbPromise;
  }
  function tx(mode, fn) {
    return idb().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction('kv', mode);
        var store = t.objectStore('kv');
        var out = fn(store);
        t.oncomplete = function () {
          resolve(out && 'result' in out ? out.result : undefined);
        };
        t.onerror = t.onabort = function () {
          reject(t.error);
        };
      });
    });
  }
  DBI.store = {
    get: function (k) {
      return tx('readonly', function (s) {
        return s.get(k);
      });
    },
    set: function (k, v) {
      return tx('readwrite', function (s) {
        s.put(v, k);
      });
    },
    del: function (k) {
      return tx('readwrite', function (s) {
        s.delete(k);
      });
    },
    keys: function (prefix) {
      return tx('readonly', function (s) {
        return s.getAllKeys();
      }).then(function (all) {
        return (all || []).filter(function (k) {
          return !prefix || String(k).indexOf(prefix) === 0;
        });
      });
    },
  };

  // ---------------------------------------------------------------- API client
  function ApiError(message, status, code, data) {
    this.message = message;
    this.status = status;
    this.code = code;
    this.data = data || {};
    this.offline = status === 0;
  }
  ApiError.prototype = Object.create(Error.prototype);
  DBI.ApiError = ApiError;

  /**
   * Calls the Worker. Adds the Firebase ID token, times out slow requests (low network), retries
   * network failures with backoff when `retries` is set, and turns errors into friendly messages.
   */
  DBI.api = async function (method, path, body, opts) {
    opts = opts || {};
    var retries = opts.retries || 0;
    for (var attempt = 0; ; attempt++) {
      try {
        var headers = { 'content-type': 'application/json' };
        if (auth.currentUser && !opts.noAuth) headers.authorization = 'Bearer ' + (await auth.currentUser.getIdToken());
        var ctrl = 'AbortController' in window ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 20000) : null;
        var res = await fetch(CFG.apiUrl + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl ? ctrl.signal : undefined });
        if (timer) clearTimeout(timer);
        var data = {};
        try {
          data = await res.json();
        } catch (e) {
          /* empty body */
        }
        if (!res.ok) throw new ApiError(data.error || 'Request failed (' + res.status + ')', res.status, data.code, data);
        return data;
      } catch (e) {
        var err = e instanceof ApiError ? e : new ApiError(navigator.onLine ? 'Could not reach DBI Assess. Check your connection and try again.' : 'You are offline.', 0, 'OFFLINE');
        if (err.status === 0 && attempt < retries) {
          await new Promise(function (r) { setTimeout(r, Math.min(15000, 800 * Math.pow(2, attempt))); });
          continue;
        }
        throw err;
      }
    }
  };

  // ---------------------------------------------------------------- auth flows
  DBI.studentSignIn = async function (studentId, password, sharedDevice) {
    var res = await DBI.api('POST', '/auth/student-login', { studentId: studentId, password: password }, { noAuth: true, timeout: 30000, retries: 1 });
    await auth.setPersistence(sharedDevice ? firebase.auth.Auth.Persistence.SESSION : firebase.auth.Auth.Persistence.LOCAL);
    await auth.signInWithCustomToken(res.token);
    try {
      localStorage.setItem('dbi:lastStudentId', res.studentId);
      localStorage.setItem('dbi:studentName', res.name || '');
    } catch (e) {}
    return res;
  };

  /** Signs out. Exams finished on this device but not yet uploaded are kept so nothing is lost. */
  DBI.signOut = async function (to) {
    try {
      var keys = await DBI.store.keys('exam:');
      for (var i = 0; i < keys.length; i++) {
        var e = await DBI.store.get(keys[i]);
        if (!e || !e.pendingSubmit) await DBI.store.del(keys[i]);
      }
    } catch (e) {}
    await auth.signOut();
    location.href = to || DBI.path('index.html');
  };

  /** Path from the current page to a file at the site root (pages live at /, /student/ and /admin/). */
  DBI.path = function (p) {
    var depth = /\/(student|admin)\/[^/]*$/.test(location.pathname) ? '../' : '';
    return depth + p;
  };

  /** For student pages: resolves with { user, claims, profile } or redirects to sign-in. */
  DBI.requireStudent = async function () {
    var user = await DBI.currentUser();
    var claims = user ? await DBI.claims(user) : {};
    if (!user || claims.role !== 'student') {
      location.replace(DBI.path('index.html') + '?next=' + encodeURIComponent(location.pathname + location.search));
      return new Promise(function () {});
    }
    var profile = null;
    try {
      var snap = await db.collection('users').doc(user.uid).get();
      profile = snap.exists ? snap.data() : null;
    } catch (e) {
      /* offline */
    }
    var name = profile ? ((profile.firstName || '') + ' ' + (profile.lastName || '')).trim() : '';
    return { user: user, claims: claims, studentId: claims.sid, profile: profile, name: name || localStorage.getItem('dbi:studentName') || claims.sid };
  };

  /** For admin pages: resolves with { user, admin } or redirects to the admin sign-in. */
  DBI.requireAdmin = async function () {
    var user = await DBI.currentUser();
    var adminDoc = null;
    if (user) {
      try {
        var snap = await db.collection('admins').doc(user.uid).get();
        if (snap.exists) adminDoc = snap.data();
      } catch (e) {}
    }
    if (!adminDoc) {
      location.replace(DBI.path('admin/index.html') + '?next=' + encodeURIComponent(location.pathname + location.search));
      return new Promise(function () {});
    }
    return { user: user, admin: adminDoc };
  };

  // ---------------------------------------------------------------- UI helpers
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
  /** Escapes text for HTML, including inside attribute values. */
  DBI.esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"'`]/g, function (c) {
      return ESC[c];
    });
  };

  /**
   * Very small, safe text formatter for question text: escapes everything, then allows
   * **bold**, *italic*, `code`, ```code blocks``` and line breaks.
   */
  DBI.rich = function (text) {
    var s = DBI.esc(text || '');
    var blocks = [];
    s = s.replace(/```(\w+)?\n?([\s\S]*?)```/g, function (_, lang, code) {
      blocks.push('<pre class="code"><code>' + code.replace(/\n$/, '') + '</code></pre>');
      return '\u0000' + (blocks.length - 1) + '\u0000';
    });
    s = s
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\n/g, '<br>');
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) {
      return blocks[Number(i)];
    });
  };

  DBI.toast = function (message, kind, ms) {
    var host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 300);
    }, ms || 3500);
  };

  /**
   * Accessible modal. actions: [{ label, value, kind }]. Resolves with the chosen value
   * (or null when dismissed). `body` may be an HTML string or a DOM node.
   */
  DBI.modal = function (opts) {
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var wrap = document.createElement('div');
      wrap.className = 'modal-wrap';
      var id = 'm' + Math.random().toString(36).slice(2);
      wrap.innerHTML =
        '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
        '<h2 id="' + id + '">' + DBI.esc(opts.title || '') + '</h2><div class="modal-body"></div><div class="modal-actions"></div></div>';
      var body = wrap.querySelector('.modal-body');
      if (typeof opts.body === 'string') body.innerHTML = opts.body;
      else if (opts.body) body.appendChild(opts.body);
      var actions = wrap.querySelector('.modal-actions');
      (opts.actions || [{ label: 'OK', value: true, kind: 'primary' }]).forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn ' + (a.kind || 'ghost');
        b.textContent = a.label;
        b.onclick = function () {
          if (a.validate && !a.validate(wrap)) return;
          close(typeof a.value === 'function' ? a.value(wrap) : a.value);
        };
        actions.appendChild(b);
      });
      function close(v) {
        wrap.remove();
        document.removeEventListener('keydown', onKey, true);
        if (prev && prev.focus) prev.focus();
        resolve(v === undefined ? null : v);
      }
      function onKey(e) {
        if (e.key === 'Escape' && opts.dismissable !== false) close(null);
      }
      if (opts.dismissable !== false)
        wrap.addEventListener('click', function (e) {
          if (e.target === wrap) close(null);
        });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(wrap);
      var focusable = wrap.querySelector('input, textarea, select') || actions.lastChild;
      if (focusable) focusable.focus();
    });
  };

  DBI.confirm = function (title, message, okLabel, danger) {
    return DBI.modal({
      title: title,
      body: '<p>' + DBI.esc(message) + '</p>',
      actions: [
        { label: 'Cancel', value: false },
        { label: okLabel || 'OK', value: true, kind: danger ? 'danger' : 'primary' },
      ],
    });
  };

  DBI.fmtDate = function (v, withTime) {
    if (!v) return '—';
    var d = v && v.toDate ? v.toDate() : new Date(v);
    if (isNaN(d)) return '—';
    var opts = { day: 'numeric', month: 'short', year: 'numeric' };
    if (withTime) {
      opts.hour = '2-digit';
      opts.minute = '2-digit';
    }
    return d.toLocaleString('en-GB', opts);
  };

  DBI.fmtDuration = function (sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm' + (s ? ' ' + s + 's' : '');
    return s + 's';
  };

  DBI.initials = function (name) {
    return String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (w) { return w[0].toUpperCase(); })
      .join('');
  };

  DBI.uuid = function () {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  };

  /** Inline SVG icons (no icon font to download on slow connections). */
  var ICONS = {
    home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
    award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.2 13.9 7 22l5-3 5 3-1.2-8.1',
    user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    flag: 'M4 22V4m0 0h13l-2 4 2 4H4',
    check: 'M20 6 9 17l-5-5',
    x: 'M18 6 6 18M6 6l12 12',
    left: 'M15 18l-6-6 6-6',
    right: 'M9 18l6-6-6-6',
    wifi: 'M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01',
    wifiOff: 'M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01',
    cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    play: 'M5 3l14 9-14 9z',
    up: 'M18 15l-6-6-6 6',
    down: 'M6 9l6 6 6-6',
    expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5V22h16',
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
    menu: 'M3 12h18M3 6h18M3 18h18',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
    plus: 'M12 5v14M5 12h14',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
    copy: 'M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  };
  DBI.icon = function (name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + (ICONS[name] || '') + '"/></svg>';
  };

  /** Shows a small "Offline" pill whenever the connection drops. */
  DBI.watchNetwork = function () {
    var pill = document.createElement('div');
    pill.className = 'net-pill';
    pill.setAttribute('role', 'status');
    document.body.appendChild(pill);
    function update() {
      pill.innerHTML = navigator.onLine ? '' : DBI.icon('wifiOff') + ' Offline — you can keep working';
      pill.classList.toggle('show', !navigator.onLine);
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  };

  /** Registers the service worker that keeps the app usable offline. */
  DBI.registerSW = function () {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register(DBI.path('sw.js')).catch(function () {});
    }
  };

  /**
   * Tests finished offline wait on the device; this uploads any that are waiting.
   * Returns { uploaded, waiting } so pages can show a banner.
   */
  DBI.uploadPendingExams = async function (uid) {
    var out = { uploaded: 0, waiting: 0, inProgress: [] };
    var keys = await DBI.store.keys('exam:' + uid + ':').catch(function () { return []; });
    for (var i = 0; i < keys.length; i++) {
      var s = await DBI.store.get(keys[i]);
      if (!s) continue;
      if (s.status === 'in-progress') out.inProgress.push({ assessmentId: s.assessmentId, title: s.pkg && s.pkg.assessment ? s.pkg.assessment.title : 'Test' });
      if (s.status !== 'sealed' || !s.pendingSubmit) continue;
      if (!navigator.onLine) {
        out.waiting++;
        continue;
      }
      try {
        var p = s.pendingSubmit;
        await DBI.api('POST', '/attempts/' + s.attemptId + '/submit', { sessionId: s.sessionId, submitId: p.submitId, sealedAt: p.sealedAt, answers: p.answers, reason: p.reason, offline: true }, { timeout: 30000 });
        await DBI.store.del(keys[i]);
        out.uploaded++;
      } catch (e) {
        if (e.status === 409 || e.status === 404) {
          await DBI.store.del(keys[i]);
          out.uploaded++;
        } else out.waiting++;
      }
    }
    return out;
  };

  /** Student page shell: header with name, nav (sidebar on desktop, bottom bar on phones). */
  DBI.studentShell = function (active, who) {
    var nav = [
      ['dashboard', 'Home', 'home', 'dashboard.html'],
      ['assessments', 'Tests', 'list', 'assessments.html'],
      ['results', 'Results', 'chart', 'results.html'],
      ['certificates', 'Certificates', 'award', 'student-certificates.html'],
      ['profile', 'Profile', 'user', 'profile.html'],
    ];
    var links = nav
      .map(function (n) {
        return '<a href="' + n[3] + '" class="' + (n[0] === active ? 'active' : '') + '"' + (n[0] === active ? ' aria-current="page"' : '') + '>' + DBI.icon(n[2]) + '<span>' + n[1] + '</span></a>';
      })
      .join('');
    var header = document.createElement('header');
    header.className = 'topbar';
    header.innerHTML =
      '<a class="brand" href="dashboard.html"><img src="../images/emblem.png" alt="" width="34" height="34"><span><b>DBI</b> Assess</span></a>' +
      '<div class="who"><span class="avatar">' + DBI.esc(DBI.initials(who.name)) + '</span><span class="who-text"><b>' + DBI.esc(who.name) + '</b><small>' + DBI.esc(who.studentId || '') + '</small></span>' +
      '<button class="icon-btn" id="signOutBtn" title="Sign out" aria-label="Sign out">' + DBI.icon('logout') + '</button></div>';
    var side = document.createElement('nav');
    side.className = 'sidenav';
    side.setAttribute('aria-label', 'Main');
    side.innerHTML = links;
    document.body.prepend(side);
    document.body.prepend(header);
    var foot = document.createElement('footer');
    foot.className = 'credit';
    foot.innerHTML = 'Built by <b>' + DBI.esc(CFG.brand.builtBy) + '</b> · Powered by <b>' + DBI.esc(CFG.brand.org) + '</b>';
    (document.querySelector('main') || document.body).appendChild(foot);
    document.getElementById('signOutBtn').onclick = async function () {
      if (await DBI.confirm('Sign out?', 'You can sign in again any time with your Student ID.', 'Sign out')) DBI.signOut();
    };
    DBI.watchNetwork();
    DBI.registerSW();
  };
})();
