/* Admin page shell and helpers shared by every admin page. */
(function () {
  'use strict';
  var esc = DBI.esc;
  var icon = DBI.icon;

  var NAV = [
    ['dashboard', 'Dashboard', 'home', 'dashboard.html'],
    ['assessments', 'Assessments', 'list', 'assessments.html'],
    ['questions', 'Questions', 'help', 'questions.html'],
    ['results', 'Results & marking', 'chart', 'results.html'],
    ['students', 'Students', 'user', 'students.html'],
    ['certificates', 'Certificates', 'award', 'certificates.html'],
    ['settings', 'Settings & tools', 'settings', 'settings.html'],
    ['account', 'Admins', 'shield', 'account.html'],
  ];

  DBI.adminShell = function (active, me) {
    document.body.classList.add('admin');
    var name = (me.admin && me.admin.name) || me.user.email;
    var header = document.createElement('header');
    header.className = 'topbar';
    header.innerHTML =
      '<button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu">' + icon('menu') + '</button>' +
      '<a class="brand" href="' + DBI.path('admin/dashboard.html') + '"><img src="' + DBI.path('images/emblem.png') + '" alt="" width="34" height="34"><span><b>DBI</b> Assess <small class="badge blue" style="margin-left:4px">Admin</small></span></a>' +
      '<span class="spacer"></span><div class="who"><span class="avatar">' + esc(DBI.initials(name)) + '</span><span class="who-text"><b>' + esc(name) + '</b><small>' + esc((me.admin && me.admin.role) || 'Administrator') + '</small></span>' +
      '<button class="icon-btn" id="signOutBtn" title="Sign out" aria-label="Sign out">' + icon('logout') + '</button></div>';
    var side = document.createElement('nav');
    side.className = 'sidenav admin-nav';
    side.id = 'adminNav';
    side.setAttribute('aria-label', 'Admin');
    side.innerHTML = NAV.map(function (n) {
      var href = n[0] === 'account' ? DBI.path('account.html') : DBI.path('admin/' + n[3]);
      return '<a href="' + href + '" class="' + (n[0] === active ? 'active' : '') + '"' + (n[0] === active ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + n[1] + '</span></a>';
    }).join('');
    document.body.prepend(side);
    document.body.prepend(header);
    var foot = document.createElement('footer');
    foot.className = 'credit';
    foot.innerHTML = 'Built by <b>ProfJero Digital Studio</b> · Powered by <b>Digital Bridge Initiative</b>';
    (document.querySelector('main') || document.body).appendChild(foot);
    document.getElementById('menuBtn').onclick = function () {
      side.classList.toggle('open');
    };
    document.getElementById('signOutBtn').onclick = async function () {
      if (await DBI.confirm('Sign out?', 'You will need your email and password to sign in again.', 'Sign out')) {
        await DBI.auth.signOut();
        location.href = DBI.path('admin/index.html');
      }
    };
    DBI.watchNetwork();
  };

  /** Loads all assessments (title-sorted) for pickers. */
  DBI.loadAssessments = async function () {
    var snap = await DBI.db.collection('assessments').get();
    return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || '')); });
  };

  /** Datetime-local value for an ISO/legacy time, shown in the admin's own time zone. */
  DBI.toLocalInput = function (v) {
    if (!v) return '';
    var s = String(v);
    var ms = /[zZ]|[+-]\d\d:?\d\d$/.test(s) || !/T\d\d:\d\d/.test(s) ? Date.parse(s) : Date.parse(s + 'Z');
    if (isNaN(ms)) return '';
    var d = new Date(ms);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  /** ISO string (UTC) from a datetime-local value, which is in the admin's time zone. */
  DBI.fromLocalInput = function (v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d) ? null : d.toISOString();
  };

  DBI.downloadCsv = function (name, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        // Quote every cell and neutralise spreadsheet formulas.
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };

  /** Commits writes in batches of 400 (Firestore allows 500 per batch). */
  DBI.batchWrite = async function (ops) {
    for (var i = 0; i < ops.length; i += 400) {
      var b = DBI.db.batch();
      ops.slice(i, i + 400).forEach(function (op) { op(b); });
      await b.commit();
    }
  };

  /** Uploads a question image to Cloudinary with a Worker-signed request. Resolves with the https URL. */
  DBI.uploadMedia = async function (file) {
    if (file.size > 8 * 1024 * 1024) throw new Error('Images must be smaller than 8 MB.');
    var sig = await DBI.api('POST', '/media/sign', { kind: 'question' });
    var form = new FormData();
    form.append('file', file);
    ['timestamp', 'signature', 'folder', 'allowed_formats'].forEach(function (k) { form.append(k, sig[k]); });
    form.append('api_key', sig.apiKey);
    var res = await fetch('https://api.cloudinary.com/v1_1/' + sig.cloudName + '/auto/upload', { method: 'POST', body: form });
    var r = await res.json().catch(function () { return {}; });
    if (!res.ok || !r.secure_url) throw new Error((r.error && r.error.message) || 'Upload failed');
    // Serve a resized, compressed copy so it loads quickly on slow phone connections.
    return r.secure_url.replace('/upload/', '/upload/f_auto,q_auto,w_1200,c_limit/');
  };

  DBI.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span> ' + esc(label || 'Working…');
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  };
})();
