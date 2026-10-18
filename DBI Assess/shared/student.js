/* Data helpers shared by the student pages (dashboard, tests, results). Cached for offline viewing. */
(function () {
  'use strict';
  var esc = DBI.esc;
  var icon = DBI.icon;

  function toMs(v) {
    if (!v) return null;
    if (v.toDate) return v.toDate().getTime();
    var s = String(v);
    // Times typed in the old builder have no zone; they are Ghana time (UTC).
    var t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) || !/T\d\d:\d\d/.test(s) ? s : s + 'Z');
    return isNaN(t) ? null : t;
  }

  /** Loads published tests, the student's attempts and certificates; falls back to the last copy when offline. */
  async function loadOverview(me) {
    var cacheKey = 'dbi:overview:' + me.user.uid;
    try {
      var results = await Promise.all([
        DBI.db.collection('assessments').where('status', 'in', ['published', 'closed']).get(),
        DBI.api('GET', '/me/attempts', null, { timeout: 20000 }),
        DBI.db.collection('certificates').where('studentId', '==', me.studentId).where('status', '==', 'issued').get(),
      ]);
      var data = {
        assessments: results[0].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }),
        attempts: results[1].attempts || [],
        certificates: results[2].size,
        at: Date.now(),
      };
      // Firestore timestamps are not JSON; keep only what the pages use.
      data.assessments = data.assessments.map(function (a) {
        return {
          id: a.id, title: a.title, description: a.description, type: a.type, department: a.department, status: a.status, duration: a.duration,
          attempts: a.attempts, unlimitedAttempts: a.unlimitedAttempts, passingScore: a.passingScore, totalQuestions: a.poolSize || a.totalQuestions,
          opensAt: toMs(a.opensAt || a.startDate), closesAt: toMs(a.closesAt || a.endDate), audience: a.audience || null, accessCodeRequired: !!a.accessCodeRequired,
        };
      });
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    } catch (e) {
      var cached = null;
      try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch (e2) {}
      if (cached) {
        cached.stale = true;
        return cached;
      }
      throw e;
    }
  }

  /** Works out what the student can do with each test right now. */
  function classify(data, me) {
    var now = Date.now();
    return data.assessments
      .filter(function (a) {
        if (a.audience && a.audience.type === 'list') return (a.audience.studentIds || []).map(function (s) { return String(s).toUpperCase(); }).indexOf(me.studentId) !== -1;
        return true;
      })
      .map(function (a) {
        var mine = data.attempts.filter(function (t) { return t.assessmentId === a.id && t.status !== 'void'; });
        var inProgress = mine.filter(function (t) { return t.status === 'in-progress'; })[0];
        var finished = mine.filter(function (t) { return t.status !== 'in-progress' && t.status !== 'abandoned'; });
        var limit = a.unlimitedAttempts ? Infinity : Math.max(1, Number(a.attempts) || 1);
        var state;
        if (inProgress) state = 'in-progress';
        else if (a.status === 'closed' || (a.closesAt && now > a.closesAt)) state = 'closed';
        else if (a.opensAt && now < a.opensAt) state = 'upcoming';
        else if (finished.length >= limit) state = 'done';
        else state = finished.length ? 'retake' : 'open';
        var best = finished.filter(function (t) { return typeof t.score === 'number' && t.released; }).reduce(function (m, t) { return Math.max(m, t.score); }, -1);
        return { a: a, state: state, finished: finished, inProgress: inProgress, left: limit === Infinity ? '∞' : Math.max(0, limit - finished.length), best: best >= 0 ? best : null };
      })
      .sort(function (x, y) {
        var order = { 'in-progress': 0, open: 1, retake: 2, upcoming: 3, done: 4, closed: 5 };
        return order[x.state] - order[y.state] || String(x.a.title).localeCompare(String(y.a.title));
      });
  }

  function testCard(item) {
    var a = item.a;
    var badge = {
      'in-progress': '<span class="badge amber">In progress</span>',
      open: '<span class="badge green">Open</span>',
      retake: '<span class="badge blue">Try again</span>',
      upcoming: '<span class="badge">Opens ' + esc(DBI.fmtDate(a.opensAt, true)) + '</span>',
      done: '<span class="badge">Completed</span>',
      closed: '<span class="badge">Closed</span>',
    }[item.state];
    var action = {
      'in-progress': '<a class="btn primary" href="take-assessment.html?id=' + encodeURIComponent(a.id) + '">' + icon('play') + 'Continue</a>',
      open: '<a class="btn primary" href="take-assessment.html?id=' + encodeURIComponent(a.id) + '">' + icon('play') + 'Start</a>',
      retake: '<a class="btn blue" href="take-assessment.html?id=' + encodeURIComponent(a.id) + '">' + icon('refresh') + 'Try again</a>',
    }[item.state] || (item.finished.length ? '<a class="btn ghost" href="results.html">' + icon('chart') + 'Results</a>' : '');
    return '<article class="card test-card"><div class="row"><span class="badge blue">' + esc(a.type || 'quiz') + '</span>' + badge + '<span class="spacer"></span>' + (item.best !== null ? '<b class="small">Best: ' + item.best + '%</b>' : '') + '</div>' +
      '<h3 style="margin:10px 0 4px">' + esc(a.title) + '</h3>' + (a.department ? '<p class="muted small" style="margin:0 0 6px">' + esc(a.department) + '</p>' : '') +
      '<div class="row small muted" style="margin-bottom:12px">' + (a.totalQuestions ? '<span>' + icon('list') + ' ' + esc(a.totalQuestions) + ' questions</span>' : '') +
      '<span>' + icon('clock') + ' ' + (Number(a.duration) > 0 ? esc(a.duration) + ' min' : 'No time limit') + '</span>' +
      '<span>' + icon('refresh') + ' ' + esc(item.left) + ' attempt' + (item.left === 1 ? '' : 's') + ' left</span>' +
      (a.closesAt && item.state !== 'closed' ? '<span>' + icon('alert') + ' Closes ' + esc(DBI.fmtDate(a.closesAt, true)) + '</span>' : '') + '</div>' + action + '</article>';
  }

  window.DBIStudent = { loadOverview: loadOverview, classify: classify, testCard: testCard };
})();
