/*
 * DBI Assess exam player.
 *
 * Offline-first: the exam package (questions without keys) is stored on the device when the test
 * starts. Every answer is saved to IndexedDB at once and queued as an operation; the queue is sent to
 * the Worker whenever there is a connection. A test can be finished and submitted with no network:
 * the answers are sealed on the device and uploaded later. The Worker's deadline is the only clock
 * that counts.
 */
(function () {
  'use strict';
  var esc = DBI.esc;
  var icon = DBI.icon;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };

  var S = null; // persisted exam state
  var R = { flushTimer: null, retry: 0, flushing: false, integrity: null, warnedAt: 0, qTimer: null, timer: null, saveTimer: null, textTimers: {} };
  var app;

  function deviceId() {
    try {
      var id = localStorage.getItem('dbi:device');
      if (!id) localStorage.setItem('dbi:device', (id = DBI.uuid()));
      return id;
    } catch (e) {
      return 'nostore-' + DBI.uuid();
    }
  }

  // ---------------------------------------------------------------- persistence
  function persist(now) {
    clearTimeout(R.saveTimer);
    S.savedAt = Date.now();
    var save = function () {
      var at = S.savedAt;
      return DBI.store.set(S.key, S).then(function () {
        // IndexedDB has everything the emergency backup had: drop the backup.
        try {
          var bak = JSON.parse(localStorage.getItem(backupKey()) || 'null');
          if (bak && bak.savedAt <= at) localStorage.removeItem(backupKey());
        } catch (e) {}
      }).catch(function (e) {
        console.error('Could not save the test on this device', e);
        toastOnce('storage', 'This device is low on storage. Keep this page open until you submit.', 'error');
      });
    };
    if (now) return save();
    R.saveTimer = setTimeout(save, 250);
  }

  function backupKey() {
    return 'dbi:bak:' + S.key;
  }

  /**
   * Called when the page is being hidden or closed. Pending typing is committed at once and a compact
   * copy goes to localStorage, which (unlike IndexedDB) is written synchronously and survives the
   * page being killed a moment after a keystroke.
   */
  function emergencySave() {
    if (!S || S.status !== 'in-progress') return;
    flushText();
    try {
      localStorage.setItem(backupKey(), JSON.stringify({ savedAt: Date.now(), answers: S.answers, ops: S.ops, index: S.index, flagged: S.flagged, lockedQ: S.lockedQ, events: S.events.slice(-50), violations: S.violations, qLeft: S.qLeft }));
    } catch (e) {}
    persist(true);
  }

  /** Applies a newer emergency backup (if any) to the state loaded from IndexedDB. */
  function restoreBackup() {
    try {
      var bak = JSON.parse(localStorage.getItem(backupKey()) || 'null');
      if (!bak || (S.savedAt && bak.savedAt <= S.savedAt)) return;
      ['answers', 'ops', 'index', 'flagged', 'lockedQ', 'violations', 'qLeft'].forEach(function (k) { if (bak[k] !== undefined) S[k] = bak[k]; });
      var have = {};
      S.events.forEach(function (e) { have[e.id] = 1; });
      (bak.events || []).forEach(function (e) { if (!have[e.id]) S.events.push(e); });
      persist(true);
    } catch (e) {}
  }

  var toasted = {};
  function toastOnce(key, msg, kind) {
    if (toasted[key] && Date.now() - toasted[key] < 30000) return;
    toasted[key] = Date.now();
    DBI.toast(msg, kind);
  }

  var seqBase = Date.now() * 10;
  function nextSeq() {
    // Monotonic across reloads and tabs: based on the clock, never repeating within this page.
    seqBase = Math.max(seqBase + 1, Date.now() * 10);
    return seqBase;
  }

  function serverNow() {
    return Date.now() + (S.offset || 0);
  }

  // ---------------------------------------------------------------- sync
  function setChip(state) {
    var chip = $('#sync');
    if (!chip) return;
    var map = {
      saved: ['ok', 'check', 'Saved'],
      saving: ['', 'cloud', 'Saving…'],
      device: ['off', 'check', 'Saved on this device'],
      offline: ['off', 'wifiOff', 'Offline — answers saved here'],
      retry: ['off', 'refresh', 'Retrying…'],
    };
    var m = map[state] || map.saved;
    chip.className = 'sync ' + m[0];
    chip.innerHTML = icon(m[1]) + '<span>' + m[2] + '</span>';
    chip.title = m[2];
  }

  function hasPending() {
    return Object.keys(S.ops).length || S.events.length || S.flagsDirty;
  }

  function scheduleFlush(ms) {
    clearTimeout(R.flushTimer);
    R.flushTimer = setTimeout(flush, ms === undefined ? 1500 : ms);
  }

  async function flush(force) {
    if (!S || R.flushing || S.status !== 'in-progress') return;
    if (!navigator.onLine) {
      setChip(hasPending() ? 'offline' : 'device');
      return;
    }
    if (!hasPending() && !force) return;
    R.flushing = true;
    var ops = Object.keys(S.ops).map(function (qid) { return { qid: qid, value: S.ops[qid].value, seq: S.ops[qid].seq }; });
    var events = S.events.slice(0, 100);
    setChip('saving');
    try {
      var r = await DBI.api('POST', '/attempts/' + S.attemptId + '/sync', { sessionId: S.sessionId, ops: ops, events: events, flagged: S.flagged }, { timeout: 20000 });
      ops.forEach(function (o) {
        if (S.ops[o.qid] && S.ops[o.qid].seq === o.seq) delete S.ops[o.qid];
      });
      var sent = {};
      events.forEach(function (e) { sent[e.id] = 1; });
      S.events = S.events.filter(function (e) { return !sent[e.id]; });
      S.flagsDirty = false;
      R.retry = 0;
      applyServer(r);
      persist();
      setChip(hasPending() ? 'saving' : 'saved');
      if (hasPending()) scheduleFlush(500);
    } catch (e) {
      if (e.status === 409 && e.data && e.data.replaced) return showMoved();
      if (e.status === 401) {
        setChip('device');
        toastOnce('auth', 'Your session expired. Your answers are safe here — sign in again after the test to upload them.', 'error');
      } else {
        setChip(navigator.onLine ? 'retry' : 'offline');
        R.retry++;
        scheduleFlush(Math.min(30000, 2000 * Math.pow(2, R.retry)));
      }
    } finally {
      R.flushing = false;
    }
  }

  function applyServer(r) {
    if (!r) return;
    if (r.serverNow) S.offset = Date.parse(r.serverNow) - Date.now();
    if (r.deadline !== undefined) S.deadline = r.deadline;
    if (typeof r.violations === 'number') S.violations = Math.max(S.violations || 0, r.violations);
    if (r.locked && !S.locked) {
      S.locked = true;
      showLocked();
    } else if (r.locked === false && S.locked) {
      S.locked = false;
      hideOverlay();
      DBI.toast('Your teacher unlocked the test. You can continue.', 'ok');
    }
    if (r.closed && r.status && r.status !== 'in-progress') {
      // Submitted elsewhere (time ran out on the server, the teacher ended it, or the integrity limit).
      S.status = 'submitted';
      persist(true);
      stopExam();
      showDone({ status: r.status, autoSubmitted: r.autoSubmitted });
    }
  }

  // ---------------------------------------------------------------- answers
  function setAnswer(qid, value, opts) {
    if (S.status !== 'in-progress' || S.locked || isLocked(qid)) return;
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) {
      delete S.answers[qid];
      value = null;
    } else S.answers[qid] = value;
    S.ops[qid] = { value: value, seq: nextSeq() };
    persist();
    updateNav();
    if (!opts || !opts.quiet) setChip(navigator.onLine ? 'saving' : 'offline');
    scheduleFlush();
  }

  function isLocked(qid) {
    return S.lockedQ.indexOf(qid) !== -1;
  }

  function answered(qid) {
    return !DBIGrading.isBlank(S.answers[qid]);
  }

  function addEvent(type, detail) {
    var q = S.pkg.questions[S.index];
    S.events.push({ id: DBI.uuid(), type: type, at: new Date(serverNow()).toISOString(), detail: String(detail || '').slice(0, 150), q: q ? q.id : null });
    persist();
    scheduleFlush(600);
  }

  // ---------------------------------------------------------------- integrity
  var COUNTED = { 'tab-hidden': 1, 'window-blur': 1, 'fullscreen-exit': 1, copy: 1, paste: 1, cut: 1, 'context-menu': 1, print: 1, devtools: 1, shortcut: 1, reload: 1 };
  function onIntegrity(type, detail) {
    addEvent(type, detail);
    if (!COUNTED[type]) return;
    S.violations = (S.violations || 0) + 1;
    persist();
    var a = S.pkg.assessment;
    var max = a.maxViolations;
    if (max && S.violations >= max) {
      if (a.violationAction === 'submit') {
        DBI.toast('You left the test too many times. It has been submitted.', 'error', 6000);
        return submit('integrity');
      }
      if (a.violationAction === 'lock') {
        S.locked = true;
        persist(true);
        flush(true);
        return showLocked();
      }
    }
    // One clear warning at a time.
    if (Date.now() - R.warnedAt < 4000 || document.visibilityState === 'hidden') return;
    R.warnedAt = Date.now();
    var label = DBIIntegrity.LABELS[type] || 'Not allowed during the test';
    var tail = max
      ? 'Warning ' + Math.min(S.violations, max) + ' of ' + max + '. After ' + max + ', ' + (a.violationAction === 'submit' ? 'your test will be submitted automatically.' : a.violationAction === 'lock' ? 'your test will be paused until your teacher unlocks it.' : 'your teacher will be alerted.')
      : 'This is recorded for your teacher.';
    DBI.modal({ title: label, body: '<p>Please stay on the test until you finish. ' + esc(tail) + '</p>', actions: [{ label: 'Back to my test', value: true, kind: 'primary' }] }).then(function () {
      if (a.antiCheat.fullScreen && R.integrity && !R.integrity.isFullscreen()) R.integrity.enterFullscreen();
    });
  }

  function onFullscreenChange(full) {
    if (!S || S.status !== 'in-progress') return;
    if (!full) {
      showOverlay(
        '<div class="box">' + icon('expand') + '<h2>Full screen is required</h2><p>This test must be taken in full screen. Leaving full screen is recorded.</p><button class="btn primary" id="refs">Return to full screen</button></div>',
      );
      $('#refs').onclick = function () {
        R.integrity.enterFullscreen().then(hideOverlay);
      };
    } else hideOverlay();
  }

  function showOverlay(html) {
    var o = $('#overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'overlay';
      o.className = 'overlay';
      o.setAttribute('role', 'alertdialog');
      document.body.appendChild(o);
    }
    o.innerHTML = html;
  }
  function hideOverlay() {
    var o = $('#overlay');
    if (o) o.remove();
  }

  function showLocked() {
    showOverlay(
      '<div class="box">' + icon('lock') + '<h2>Your test is paused</h2><p>You left the test too many times. Your answers are saved. Ask your teacher to unlock your test, then tap below.</p><button class="btn primary" id="checkLock">Check again</button></div>',
    );
    $('#checkLock').onclick = function () {
      flush(true);
    };
  }

  function showMoved() {
    stopExam();
    app.innerHTML = '<div class="screen"><div class="card" style="text-align:center">' + icon('alert', 'big-ic') + '<h2>This test was opened on another device</h2><p class="muted">For safety, a test can only be open in one place at a time. Continue on the other device, or reopen it here.</p><a class="btn primary" href="' + location.pathname + location.search + '">Reopen here</a> <a class="btn ghost" href="dashboard.html">Dashboard</a></div></div>';
  }

  // ---------------------------------------------------------------- timer
  function deadlineMs() {
    return S.deadline ? Date.parse(S.deadline) : null;
  }

  function tick() {
    var el = $('#timer');
    var dl = deadlineMs();
    if (!dl) {
      if (el) el.style.display = 'none';
      return;
    }
    var left = Math.max(0, Math.round((dl - serverNow()) / 1000));
    if (el && S.pkg.assessment.showTimer !== false) {
      var h = Math.floor(left / 3600);
      var m = Math.floor((left % 3600) / 60);
      var s = left % 60;
      el.innerHTML = icon('clock') + (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(s).padStart(2, '0');
      el.className = 'timer' + (left <= 60 ? ' danger' : left <= 300 ? ' warn' : '');
      el.setAttribute('aria-label', 'Time left ' + DBI.fmtDuration(left));
    }
    [600, 300, 60].forEach(function (mark) {
      if (left <= mark && left > mark - 2 && !S['warned' + mark]) {
        S['warned' + mark] = true;
        var msg = mark === 60 ? 'One minute left!' : mark / 60 + ' minutes left.';
        DBI.toast(msg, mark === 60 ? 'error' : 'info', 5000);
        var live = $('#live');
        if (live) live.textContent = msg;
      }
    });
    if (left <= 0 && S.status === 'in-progress') submit('time');
  }

  // ---------------------------------------------------------------- rendering
  function letter(i) {
    return String.fromCharCode(65 + i);
  }

  function mediaHtml(q) {
    return q.imageUrl ? '<img class="qimg" src="' + esc(q.imageUrl) + '" alt="' + esc(q.imageAlt || 'Question picture') + '" loading="lazy">' : '';
  }

  function typeHint(q) {
    return {
      'multiple-choice': 'Choose one answer',
      'multiple-select': 'Choose all the correct answers',
      'true-false': 'True or false?',
      'fill-blank': 'Fill in the blank' + (q.blanks > 1 ? 's' : ''),
      'short-answer': 'Type a short answer',
      numeric: 'Type a number',
      matching: 'Match each item',
      ordering: 'Put these in the right order',
      essay: 'Write your answer',
      code: 'Write your code',
      'file-upload': 'Upload a file',
    }[q.type] || '';
  }

  function renderQuestion(q, i) {
    var a = S.pkg.assessment;
    var locked = isLocked(q.id) || S.status !== 'in-progress';
    var flagged = S.flagged.indexOf(q.id) !== -1;
    var card = document.createElement('section');
    card.className = 'qcard';
    card.id = 'q-' + q.id;
    card.setAttribute('aria-labelledby', 'qt-' + q.id);
    card.innerHTML =
      '<div class="qhead"><span class="qnum">Question ' + (i + 1) + '</span><span class="muted small">of ' + S.pkg.questions.length + ' · ' + q.points + ' mark' + (q.points === 1 ? '' : 's') + '</span>' +
      '<button type="button" class="btn ghost sm flag-btn" aria-pressed="' + flagged + '" data-flag="' + esc(q.id) + '">' + icon('flag') + (flagged ? 'Flagged' : 'Flag') + '</button></div>' +
      '<div class="qtext" id="qt-' + q.id + '">' + DBI.rich(q.type === 'fill-blank' ? '' : q.text) + '</div>' +
      mediaHtml(q) +
      (q.codeToRead ? '<pre class="code"><code>' + esc(q.codeToRead) + '</code></pre>' : '') +
      (q.instructions ? '<p class="muted">' + DBI.rich(q.instructions) + '</p>' : '') +
      '<p class="muted small" style="margin:-6px 0 12px">' + esc(typeHint(q)) + '</p>' +
      '<div class="answer"></div><div class="feedback" aria-live="polite"></div>';
    var box = card.querySelector('.answer');
    var val = S.answers[q.id];

    switch (q.type) {
      case 'multiple-choice':
      case 'multiple-select': {
        var multi = q.type === 'multiple-select';
        var chosen = multi ? (Array.isArray(val) ? val : []) : val;
        box.innerHTML = '<div class="opts" role="' + (multi ? 'group' : 'radiogroup') + '" aria-labelledby="qt-' + q.id + '">' +
          (q.options || []).map(function (o, k) {
            var sel = multi ? chosen.indexOf(o.id) !== -1 : chosen === o.id;
            return '<label class="opt' + (multi ? ' multi' : '') + (sel ? ' selected' : '') + '"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="q_' + esc(q.id) + '" value="' + esc(o.id) + '"' + (sel ? ' checked' : '') + (locked ? ' disabled' : '') + '><span class="key">' + letter(k) + '</span><span>' + DBI.rich(o.text) + (o.imageUrl ? '<br><img src="' + esc(o.imageUrl) + '" alt="">' : '') + '</span></label>';
          }).join('') + '</div>';
        box.addEventListener('change', function () {
          var inputs = box.querySelectorAll('input');
          var v = multi ? [].filter.call(inputs, function (x) { return x.checked; }).map(function (x) { return x.value; }) : ([].filter.call(inputs, function (x) { return x.checked; })[0] || {}).value;
          [].forEach.call(inputs, function (x) { x.closest('.opt').classList.toggle('selected', x.checked); });
          setAnswer(q.id, v);
        });
        break;
      }
      case 'true-false': {
        box.innerHTML = '<div class="opts tf" role="radiogroup" aria-labelledby="qt-' + q.id + '">' +
          ['True', 'False'].map(function (t) {
            var sel = String(val) === t;
            return '<label class="opt' + (sel ? ' selected' : '') + '"><input type="radio" name="q_' + esc(q.id) + '" value="' + t + '"' + (sel ? ' checked' : '') + (locked ? ' disabled' : '') + '>' + (t === 'True' ? icon('check') : icon('x')) + t + '</label>';
          }).join('') + '</div>';
        box.addEventListener('change', function (e) {
          [].forEach.call(box.querySelectorAll('input'), function (x) { x.closest('.opt').classList.toggle('selected', x.checked); });
          setAnswer(q.id, e.target.value);
        });
        break;
      }
      case 'fill-blank': {
        // Blanks are drawn inside the sentence, where the student expects them.
        var parts = String(q.text || '').split(/_{3,}|\[\[\d+\]\]/);
        var arr = Array.isArray(val) ? val : val ? [val] : [];
        var count = Math.max(1, parts.length - 1);
        var html = '';
        if (parts.length > 1) {
          parts.forEach(function (p, k) {
            html += DBI.rich(p);
            if (k < parts.length - 1) html += '<input class="blank-input" data-b="' + k + '" aria-label="Blank ' + (k + 1) + '" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(arr[k] || '') + '"' + (locked ? ' disabled' : '') + '>';
          });
          card.querySelector('.qtext').innerHTML = html;
        } else {
          card.querySelector('.qtext').innerHTML = DBI.rich(q.text);
          box.innerHTML = '<input class="input" data-b="0" aria-label="Your answer" autocomplete="off" value="' + esc(arr[0] || '') + '"' + (locked ? ' disabled' : '') + '>';
        }
        card.addEventListener('input', function (e) {
          if (!e.target.dataset || e.target.dataset.b === undefined) return;
          debounceText(q.id, function () {
            var v = [];
            [].forEach.call(card.querySelectorAll('[data-b]'), function (inp) { v[Number(inp.dataset.b)] = inp.value; });
            for (var k = 0; k < count; k++) v[k] = v[k] || '';
            setAnswer(q.id, v.every(function (x) { return !x.trim(); }) ? null : v);
          });
        });
        break;
      }
      case 'short-answer':
      case 'numeric': {
        var num = q.type === 'numeric';
        box.innerHTML = '<div class="row"><input class="input" style="flex:1" ' + (num ? 'inputmode="decimal" ' : '') + 'aria-label="Your answer" autocomplete="off" value="' + esc(val || '') + '"' + (locked ? ' disabled' : '') + '>' + (q.unit ? '<span class="badge">' + esc(q.unit) + '</span>' : '') + '</div>';
        box.querySelector('input').addEventListener('input', function (e) {
          var v = e.target.value;
          debounceText(q.id, function () { setAnswer(q.id, v.trim() ? v : null); });
        });
        break;
      }
      case 'essay':
      case 'code': {
        var isCode = q.type === 'code';
        var start = val != null ? val : isCode ? q.starterCode || '' : '';
        box.innerHTML = '<textarea class="input' + (isCode ? ' code-input' : '') + '" rows="' + (isCode ? 12 : 8) + '" aria-label="Your answer" spellcheck="' + !isCode + '"' + (isCode ? ' autocapitalize="off" autocomplete="off"' : '') + (locked ? ' disabled' : '') + '>' + esc(start) + '</textarea>' + (isCode ? '' : '<div class="words"></div>');
        var ta = box.querySelector('textarea');
        var words = box.querySelector('.words');
        var updateWords = function () {
          if (!words) return;
          var n = DBIGrading.wordCount(ta.value);
          words.textContent = n + ' word' + (n === 1 ? '' : 's') + (q.maxWords ? ' / ' + q.maxWords + ' max' : '');
          words.classList.toggle('over', !!q.maxWords && n > q.maxWords);
        };
        updateWords();
        ta.addEventListener('input', function () {
          updateWords();
          var v = ta.value;
          debounceText(q.id, function () { setAnswer(q.id, v.trim() && v !== (isCode ? q.starterCode : '') ? v : null); });
        });
        if (isCode) {
          ta.addEventListener('keydown', function (e) {
            if (e.key === 'Tab' && !e.shiftKey) {
              e.preventDefault();
              var s0 = ta.selectionStart;
              ta.setRangeText('  ', s0, ta.selectionEnd, 'end');
              ta.dispatchEvent(new Event('input'));
            }
          });
        }
        break;
      }
      case 'matching': {
        var m = val && typeof val === 'object' ? val : {};
        box.innerHTML = (q.prompts || []).map(function (p) {
          return '<div class="match-row"><div><b>' + DBI.rich(p.text) + '</b></div><select class="input" data-p="' + esc(p.id) + '" aria-label="Match for ' + esc(p.text) + '"' + (locked ? ' disabled' : '') + '><option value="">Choose…</option>' +
            (q.choices || []).map(function (c) { return '<option value="' + esc(c.id) + '"' + (m[p.id] === c.id ? ' selected' : '') + '>' + esc(c.text) + '</option>'; }).join('') + '</select></div>';
        }).join('');
        box.addEventListener('change', function () {
          var v = {};
          [].forEach.call(box.querySelectorAll('select'), function (s) { if (s.value) v[s.dataset.p] = s.value; });
          setAnswer(q.id, Object.keys(v).length ? v : null);
        });
        break;
      }
      case 'ordering': {
        var items = q.items || [];
        var order = Array.isArray(val) && val.length === items.length ? val : items.map(function (it) { return it.id; });
        var byId = {};
        items.forEach(function (it) { byId[it.id] = it; });
        var draw = function () {
          box.innerHTML = '<ol class="order-list">' + order.map(function (id, k) {
            return '<li><span class="pos">' + (k + 1) + '</span><span class="txt">' + DBI.rich((byId[id] || {}).text || '') + '</span>' +
              '<button type="button" class="icon-btn" data-up="' + k + '" aria-label="Move up"' + (k === 0 || locked ? ' disabled' : '') + '>' + icon('up') + '</button>' +
              '<button type="button" class="icon-btn" data-down="' + k + '" aria-label="Move down"' + (k === order.length - 1 || locked ? ' disabled' : '') + '>' + icon('down') + '</button></li>';
          }).join('') + '</ol>' + (answered(q.id) || locked ? '' : '<button type="button" class="btn ghost sm" data-keep style="margin-top:10px">' + icon('check') + 'This order is correct</button>');
        };
        draw();
        box.addEventListener('click', function (e) {
          var b = e.target.closest('button');
          if (!b || locked) return;
          if (b.dataset.keep !== undefined) return setAnswer(q.id, order.slice()), draw();
          var k = Number(b.dataset.up !== undefined ? b.dataset.up : b.dataset.down);
          var j = b.dataset.up !== undefined ? k - 1 : k + 1;
          var t = order[k];
          order[k] = order[j];
          order[j] = t;
          setAnswer(q.id, order.slice());
          draw();
          var again = box.querySelector('[data-' + (b.dataset.up !== undefined ? 'up' : 'down') + '="' + j + '"]');
          if (again && !again.disabled) again.focus();
        });
        break;
      }
      case 'file-upload': {
        var f = val && val.url ? val : null;
        box.innerHTML = (f ? '<div class="alert ok" style="margin-bottom:10px">' + icon('check') + '<span>Uploaded: <a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a></span></div>' : '') +
          (locked ? '' : '<label class="btn ghost">' + icon('upload') + (f ? 'Replace file' : 'Choose a file') + '<input type="file" hidden></label><p class="hint">Max ' + (q.maxFileSize || 5) + ' MB. You need internet to upload.</p>');
        var input = box.querySelector('input[type=file]');
        if (input) input.addEventListener('change', function () { uploadFile(q, input.files[0], box); });
        break;
      }
      default:
        box.innerHTML = '<p class="alert warn">This question type cannot be shown. Tell your teacher.</p>';
    }

    if (S.checked[q.id]) showFeedback(card, q, S.checked[q.id]);
    else if (a.display === 'per-question' && !locked) {
      var check = document.createElement('button');
      check.type = 'button';
      check.className = 'btn blue';
      check.style.marginTop = '14px';
      check.innerHTML = icon('check') + 'Check my answer';
      check.onclick = function () { checkAnswer(q, card, check); };
      card.appendChild(check);
    }
    return card;
  }

  function debounceText(qid, fn) {
    clearTimeout(R.textTimers[qid]);
    R.textFns = R.textFns || {};
    R.textFns[qid] = fn;
    R.textTimers[qid] = setTimeout(function () {
      delete R.textFns[qid];
      fn();
    }, 450);
  }

  /** Runs any typing that is still waiting for its short delay. */
  function flushText() {
    var fns = R.textFns || {};
    R.textFns = {};
    Object.keys(fns).forEach(function (qid) {
      clearTimeout(R.textTimers[qid]);
      fns[qid]();
    });
  }

  async function uploadFile(q, file, box) {
    if (!file) return;
    if (file.size > (q.maxFileSize || 5) * 1024 * 1024) return DBI.toast('That file is too big (max ' + (q.maxFileSize || 5) + ' MB).', 'error');
    if (!navigator.onLine) return DBI.toast('You need internet to upload a file. Your other answers are safe.', 'error');
    box.insertAdjacentHTML('beforeend', '<div class="progress up" style="margin-top:10px"><i style="width:2%"></i></div>');
    try {
      var sig = await DBI.api('POST', '/media/sign', { kind: 'answer', attemptId: S.attemptId });
      var form = new FormData();
      form.append('file', file);
      ['api_key', 'timestamp', 'signature', 'folder', 'allowed_formats'].forEach(function (k) { form.append(k, k === 'api_key' ? sig.apiKey : sig[k]); });
      var url = await new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + sig.cloudName + '/auto/upload');
        xhr.upload.onprogress = function (e) {
          var bar = box.querySelector('.progress.up i');
          if (bar && e.lengthComputable) bar.style.width = Math.round((e.loaded / e.total) * 100) + '%';
        };
        xhr.onload = function () {
          var r = {};
          try { r = JSON.parse(xhr.responseText); } catch (e) {}
          if (xhr.status < 300 && r.secure_url) resolve(r.secure_url);
          else reject(new Error((r.error && r.error.message) || 'Upload failed'));
        };
        xhr.onerror = function () { reject(new Error('Upload failed. Check your connection.')); };
        xhr.send(form);
      });
      setAnswer(q.id, { url: url, name: file.name, bytes: file.size });
      DBI.toast('File uploaded', 'ok');
      rerender();
    } catch (e) {
      var bar = box.querySelector('.progress.up');
      if (bar) bar.remove();
      DBI.toast(e.message || 'Upload failed', 'error');
    }
  }

  async function checkAnswer(q, card, btn) {
    if (!answered(q.id)) return DBI.toast('Choose or type an answer first.', 'info');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Checking…';
    try {
      await flush(true);
      var r = await DBI.api('POST', '/attempts/' + S.attemptId + '/check', { qid: q.id, value: S.answers[q.id], seq: nextSeq() }, { retries: 1 });
      S.checked[q.id] = { status: r.result.status, correct: r.correct || null, explanation: r.explanation || '' };
      if (S.lockedQ.indexOf(q.id) === -1) S.lockedQ.push(q.id);
      delete S.ops[q.id];
      persist(true);
      rerender();
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = icon('check') + 'Check my answer';
      DBI.toast(e.offline ? 'You are offline. Your answer is saved — move on and it will be marked at the end.' : e.message, 'error');
    }
  }

  function showFeedback(card, q, fb) {
    var good = fb.status === 'correct';
    var part = fb.status === 'partial';
    var cls = good ? 'ok' : part ? 'warn' : fb.status === 'pending' ? '' : 'error';
    var title = good ? 'Correct!' : part ? 'Partly correct' : fb.status === 'pending' ? 'Saved — your teacher will mark this one' : 'Not quite';
    card.querySelector('.feedback').innerHTML = '<div class="alert ' + cls + '">' + icon(good ? 'check' : part ? 'alert' : fb.status === 'pending' ? 'clock' : 'x') + '<div><b>' + title + '</b>' +
      (fb.correct && fb.correct.text && !good ? '<div>Correct answer: ' + esc(fb.correct.text) + '</div>' : '') + (fb.explanation ? '<div style="margin-top:4px">' + DBI.rich(fb.explanation) + '</div>' : '') + '</div></div>';
    if (q.options && fb.correct && fb.correct.optionIds) {
      [].forEach.call(card.querySelectorAll('.opt'), function (o) {
        var inp = o.querySelector('input');
        if (!inp) return;
        if (fb.correct.optionIds.indexOf(inp.value) !== -1) o.classList.add('correct');
        else if (inp.checked) o.classList.add('wrong');
      });
    }
  }

  // ---------------------------------------------------------------- exam screen
  function watermark() {
    if (S.pkg.assessment.antiCheat.watermark === false) return '';
    var text = (S.who.name + ' · ' + S.who.studentId + ' · ' + new Date().toLocaleDateString('en-GB')).replace(/[<&"]/g, '');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200"><text x="20" y="120" transform="rotate(-24 180 100)" font-family="sans-serif" font-size="18" fill="#000">' + text + '</text></svg>';
    return '<div class="watermark" aria-hidden="true" style="background-image:url(\'data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '\')"></div>';
  }

  function renderExam() {
    var a = S.pkg.assessment;
    document.body.className = 'exam';
    app.innerHTML =
      '<header class="exam-top"><button class="icon-btn" id="openNav" aria-label="All questions">' + icon('grid') + '</button>' +
      '<div class="title"><b>' + esc(a.title) + '</b><small>' + esc(S.who.name) + ' · ' + esc(S.who.studentId) + '</small></div>' +
      '<span id="sync" class="sync" role="status"></span><span id="timer" class="timer" role="timer"></span></header>' +
      '<div class="exam-progress"' + (a.showProgress === false ? ' hidden' : '') + '><i id="progress"></i></div>' +
      '<main class="exam-main" id="examRoot"><div id="qhost"></div></main>' +
      '<nav class="exam-nav" aria-label="Question navigation"><button class="btn ghost" id="prev">' + icon('left') + '<span>Back</span></button><span class="count" id="count"></span><button class="btn primary" id="next"><span>Next</span>' + icon('right') + '</button></nav>' +
      '<div id="live" class="sr-only" aria-live="assertive"></div>' + watermark();
    $('#openNav').onclick = openNavigator;
    $('#prev').onclick = function () { go(S.index - 1); };
    $('#next').onclick = function () {
      if (S.index >= S.pkg.questions.length - 1 || a.onePerPage === false) showReview();
      else go(S.index + 1);
    };
    $('#qhost').addEventListener('click', function (e) {
      var f = e.target.closest('[data-flag]');
      if (f) toggleFlag(f.dataset.flag);
    });
    rerender();
    setChip(hasPending() ? (navigator.onLine ? 'saving' : 'offline') : 'saved');
    tick();
    clearInterval(R.timer);
    R.timer = setInterval(tick, 1000);
  }

  function rerender() {
    var host = $('#qhost');
    if (!host) return;
    var a = S.pkg.assessment;
    host.innerHTML = '';
    if (a.onePerPage === false) {
      S.pkg.questions.forEach(function (q, i) { host.appendChild(renderQuestion(q, i)); });
    } else {
      var q = S.pkg.questions[S.index];
      host.appendChild(renderQuestion(q, S.index));
      startQuestionTimer(q);
    }
    updateNav();
  }

  function startQuestionTimer(q) {
    clearInterval(R.qTimer);
    var limit = S.pkg.assessment.questionTimeLimit;
    if (!limit || isLocked(q.id)) return;
    S.qLeft[q.id] = S.qLeft[q.id] === undefined ? limit : S.qLeft[q.id];
    var card = $('#q-' + q.id + ' .qhead');
    var badge = document.createElement('span');
    badge.className = 'badge amber';
    card.insertBefore(badge, card.querySelector('.flag-btn'));
    var draw = function () { badge.innerHTML = icon('clock') + S.qLeft[q.id] + 's'; };
    draw();
    R.qTimer = setInterval(function () {
      S.qLeft[q.id] = Math.max(0, S.qLeft[q.id] - 1);
      draw();
      if (S.qLeft[q.id] % 5 === 0) persist();
      if (S.qLeft[q.id] <= 0) {
        clearInterval(R.qTimer);
        S.lockedQ.push(q.id);
        persist(true);
        DBI.toast('Time is up for this question.', 'info');
        if (S.index < S.pkg.questions.length - 1) go(S.index + 1, true);
        else showReview();
      }
    }, 1000);
  }

  function canGoBack() {
    var a = S.pkg.assessment;
    return a.allowBack !== false && !a.questionTimeLimit;
  }

  function go(i, force) {
    flushText();
    var n = S.pkg.questions.length;
    if (i < 0 || i >= n) return;
    if (i < S.index && !canGoBack() && !force) return;
    if (!canGoBack() && i > S.index) {
      // No backtracking: questions passed are locked.
      for (var k = S.index; k < i; k++) if (S.lockedQ.indexOf(S.pkg.questions[k].id) === -1) S.lockedQ.push(S.pkg.questions[k].id);
    }
    S.index = i;
    S.furthest = Math.max(S.furthest || 0, i);
    persist();
    rerender();
    window.scrollTo(0, 0);
    var h = $('.qtext');
    if (h) h.setAttribute('tabindex', '-1'), h.focus({ preventScroll: true });
  }

  function toggleFlag(qid) {
    var i = S.flagged.indexOf(qid);
    if (i === -1) S.flagged.push(qid);
    else S.flagged.splice(i, 1);
    S.flagsDirty = true;
    persist();
    var b = $('[data-flag="' + qid + '"]');
    if (b) {
      var on = i === -1;
      b.setAttribute('aria-pressed', on);
      b.innerHTML = icon('flag') + (on ? 'Flagged' : 'Flag');
    }
    updateNav();
    scheduleFlush();
  }

  function counts() {
    var qs = S.pkg.questions;
    var done = qs.filter(function (q) { return answered(q.id); }).length;
    return { total: qs.length, done: done, left: qs.length - done, flagged: S.flagged.length };
  }

  function updateNav() {
    var c = counts();
    var bar = $('#progress');
    if (bar) bar.style.width = (c.done / c.total) * 100 + '%';
    var cnt = $('#count');
    if (cnt) cnt.textContent = c.done + ' of ' + c.total + ' answered';
    var prev = $('#prev');
    var next = $('#next');
    var single = S.pkg.assessment.onePerPage === false;
    if (prev) prev.style.visibility = !single && S.index > 0 && canGoBack() ? 'visible' : 'hidden';
    if (next) {
      var last = single || S.index >= S.pkg.questions.length - 1;
      next.className = 'btn ' + (last ? 'blue' : 'primary');
      next.innerHTML = last ? '<span>Review & submit</span>' + icon('check') : '<span>Next</span>' + icon('right');
    }
  }

  function openNavigator() {
    flushText();
    var a = S.pkg.assessment;
    var c = counts();
    var wrap = document.createElement('div');
    wrap.className = 'drawer-wrap';
    wrap.innerHTML = '<aside class="drawer" role="dialog" aria-modal="true" aria-label="All questions"><div class="row"><h2 style="margin:0">Questions</h2><span class="spacer"></span><button class="icon-btn" data-close aria-label="Close">' + icon('x') + '</button></div>' +
      '<p class="muted small" style="margin:6px 0 0">' + c.done + ' answered · ' + c.left + ' left · ' + c.flagged + ' flagged</p>' +
      '<div class="navgrid">' + S.pkg.questions.map(function (q, i) {
        var cls = (answered(q.id) ? 'answered ' : '') + (S.flagged.indexOf(q.id) !== -1 ? 'flagged ' : '') + (i === S.index ? 'current' : '');
        var disabled = a.onePerPage !== false && !canGoBack() && i < S.index;
        return '<button class="' + cls + '" data-go="' + i + '" aria-label="Question ' + (i + 1) + (answered(q.id) ? ', answered' : ', not answered') + '"' + (disabled ? ' disabled' : '') + '>' + (i + 1) + '</button>';
      }).join('') + '</div><div class="legend"><span><i class="a"></i>Answered</span><span><i></i>Not answered</span><span><i class="f"></i>Flagged</span></div>' +
      (canGoBack() ? '' : '<p class="alert warn small" style="margin-top:12px">' + icon('alert') + '<span>You cannot go back to earlier questions in this test.</span></p>') +
      '<button class="btn blue block" style="margin-top:16px" data-review>Review & submit</button></aside>';
    document.body.appendChild(wrap);
    var close = function () { wrap.remove(); };
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('[data-close]')) return close();
      var g = e.target.closest('[data-go]');
      if (g && !g.disabled) {
        close();
        if (a.onePerPage === false) {
          var el = document.getElementById('q-' + S.pkg.questions[Number(g.dataset.go)].id);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else go(Number(g.dataset.go));
      }
      if (e.target.closest('[data-review]')) {
        close();
        showReview();
      }
    });
    wrap.querySelector('[data-close]').focus();
  }

  function showReview() {
    flushText();
    var c = counts();
    var unanswered = S.pkg.questions.map(function (q, i) { return { q: q, i: i }; }).filter(function (x) { return !answered(x.q.id); });
    var flagged = S.pkg.questions.map(function (q, i) { return { q: q, i: i }; }).filter(function (x) { return S.flagged.indexOf(x.q.id) !== -1; });
    var list = function (items) {
      return items.map(function (x) { return '<button class="btn ghost sm" data-go="' + x.i + '"' + (canGoBack() || x.i >= S.index ? '' : ' disabled') + '>Q' + (x.i + 1) + '</button>'; }).join(' ');
    };
    var body = document.createElement('div');
    body.innerHTML = '<p><b>' + c.done + '</b> of <b>' + c.total + '</b> questions answered.</p>' +
      (unanswered.length ? '<div class="alert warn" style="margin-bottom:10px">' + icon('alert') + '<div><b>' + unanswered.length + ' not answered</b><div class="row" style="margin-top:6px">' + list(unanswered) + '</div></div></div>' : '<div class="alert ok" style="margin-bottom:10px">' + icon('check') + '<span>You answered every question.</span></div>') +
      (flagged.length ? '<div class="alert" style="margin-bottom:10px">' + icon('flag') + '<div><b>' + flagged.length + ' flagged to check</b><div class="row" style="margin-top:6px">' + list(flagged) + '</div></div></div>' : '') +
      '<p class="muted small">After you submit you cannot change your answers.' + (navigator.onLine ? '' : ' You are offline: your test will be saved on this device and uploaded when you reconnect.') + '</p>';
    body.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]');
      if (g && !g.disabled) {
        document.querySelector('.modal-wrap').remove();
        go(Number(g.dataset.go));
      }
    });
    DBI.modal({ title: 'Ready to submit?', body: body, actions: [{ label: 'Keep working', value: false }, { label: 'Submit test', value: true, kind: 'primary' }] }).then(function (ok) {
      if (ok) submit('student');
    });
  }

  // ---------------------------------------------------------------- submit
  async function submit(reason) {
    if (S.status !== 'in-progress') return;
    clearTimeout(R.flushTimer);
    // Text typed in the last half-second is captured before sealing.
    flushText();
    collectVisibleText();
    S.status = 'sealed';
    S.pendingSubmit = { submitId: DBI.uuid(), sealedAt: new Date(serverNow()).toISOString(), answers: S.answers, reason: reason, offline: !navigator.onLine };
    await persist(true);
    stopExam();
    upload();
  }

  function collectVisibleText() {
    [].forEach.call(document.querySelectorAll('.qcard'), function (card) {
      var qid = card.id.slice(2);
      var q = S.pkg.questions.filter(function (x) { return x.id === qid; })[0];
      if (!q || isLocked(qid)) return;
      if (q.type === 'essay' || q.type === 'code') {
        var ta = card.querySelector('textarea');
        if (ta && ta.value.trim()) S.answers[qid] = ta.value;
      } else if (q.type === 'short-answer' || q.type === 'numeric') {
        var inp = card.querySelector('.answer input');
        if (inp && inp.value.trim()) S.answers[qid] = inp.value;
      } else if (q.type === 'fill-blank') {
        var v = [];
        [].forEach.call(card.querySelectorAll('[data-b]'), function (x) { v[Number(x.dataset.b)] = x.value; });
        if (v.some(function (x) { return x && x.trim(); })) S.answers[qid] = v;
      }
    });
  }

  function stopExam() {
    clearInterval(R.timer);
    clearInterval(R.qTimer);
    clearTimeout(R.flushTimer);
    if (R.integrity) R.integrity.stop();
    hideOverlay();
  }

  async function upload() {
    showUploading();
    try {
      if (navigator.onLine) await flushEventsOnly();
      var p = S.pendingSubmit;
      var r = await DBI.api('POST', '/attempts/' + S.attemptId + '/submit', { sessionId: S.sessionId, submitId: p.submitId, sealedAt: p.sealedAt, answers: p.answers, reason: p.reason, offline: p.offline }, { retries: 2, timeout: 30000 });
      await finishLocal(r);
      showDone(r);
    } catch (e) {
      if (e.status === 409 || e.status === 404) {
        await finishLocal({});
        return showDone({ status: 'submitted' });
      }
      if (e.status === 401) {
        showUploading('Sign in again to upload your test. Your answers are safe on this device.', true);
        return;
      }
      showUploading(null);
      R.uploadRetry = setTimeout(upload, 15000);
    }
  }

  async function flushEventsOnly() {
    if (!S.events.length) return;
    try {
      await DBI.api('POST', '/attempts/' + S.attemptId + '/sync', { sessionId: S.sessionId, ops: [], events: S.events.slice(0, 100) });
      S.events = [];
    } catch (e) {}
  }

  async function finishLocal(r) {
    // Nothing personal stays on a shared device once the server has the test.
    S.status = 'submitted';
    S.pendingSubmit = null;
    S.answers = {};
    S.ops = {};
    S.pkg.questions = [];
    S.result = { id: S.attemptId, released: !!r.released };
    await DBI.store.del(S.key);
  }

  function showUploading(message, needsLogin) {
    document.body.className = '';
    app.innerHTML = '<div class="screen"><div class="card" style="text-align:center">' + icon('cloud', 'big-ic') +
      '<h2>Test submitted on this device</h2><p>' + esc(message || (navigator.onLine ? 'Uploading your answers…' : 'You are offline. Your answers are sealed and safe on this device. They will upload automatically when you are back online.')) + '</p>' +
      '<div class="progress" style="margin:16px 0"><i style="width:' + (navigator.onLine ? 60 : 15) + '%"></i></div>' +
      '<p class="muted small">Do not clear your browser data. You can close this page; we will upload it next time you open DBI Assess.</p>' +
      (needsLogin ? '<a class="btn primary" href="../index.html?next=' + encodeURIComponent(location.pathname + location.search) + '">Sign in to upload</a>' : '<button class="btn primary" id="retryUp">' + icon('refresh') + 'Try again now</button>') + '</div></div>';
    var b = $('#retryUp');
    if (b) b.onclick = function () { clearTimeout(R.uploadRetry); upload(); };
  }

  function showDone(r) {
    document.body.className = '';
    var released = r && r.released && typeof r.score === 'number';
    var reason = r && (r.submitReason || r.autoSubmitted);
    var head = reason === 'time' ? 'Time is up — your test was submitted' : reason === 'integrity' ? 'Your test was submitted' : 'Test submitted!';
    app.innerHTML = '<div class="screen"><div class="card" style="text-align:center">' +
      (released ? '<div class="score-ring" style="--p:' + r.score + '"><div>' + r.score + '%</div></div><h2>' + (r.passed ? 'Well done, you passed! 🎉' : 'Test submitted') + '</h2><p class="muted">You scored ' + r.earnedPoints + ' of ' + r.totalPoints + ' marks. Pass mark: ' + r.passingScore + '%.</p>'
        : icon('check', 'big-ic') + '<h2>' + head + '</h2><p class="muted">' + (r && r.gradingStatus === 'pending-review' ? 'Some answers are marked by your teacher. You will see your result when it is released.' : 'Your teacher will release the results. Check the Results page later.') + '</p>') +
      (r && r.lateSync ? '<p class="alert warn small">' + icon('wifiOff') + '<span>Uploaded after the deadline because you were offline. Your teacher can see this.</span></p>' : '') +
      (r && r.certificateId ? '<p class="alert ok">' + icon('award') + '<span>You earned a certificate: <b>' + esc(r.certificateId) + '</b></span></p>' : '') +
      '<div class="row" style="justify-content:center;margin-top:10px">' + (released && S.result ? '<a class="btn primary" href="result-detail.html?id=' + encodeURIComponent(S.attemptId) + '">See my answers</a>' : '') + '<a class="btn ghost" href="dashboard.html">Back to dashboard</a></div></div></div>';
    if (released && r.passed && window.confetti) window.confetti();
  }

  // ---------------------------------------------------------------- start / resume
  function freshState(pkg, who, key) {
    var att = pkg.attempt;
    return {
      key: key,
      version: 2,
      attemptId: att.id,
      assessmentId: att.assessmentId,
      sessionId: deviceId(),
      pkg: pkg,
      who: who,
      status: 'in-progress',
      answers: att.answers || {},
      seqs: att.answerSeq || {},
      ops: {},
      events: [],
      flagged: att.flagged || [],
      flagsDirty: false,
      lockedQ: att.locked || [],
      checked: {},
      qLeft: {},
      index: 0,
      furthest: 0,
      deadline: att.deadline,
      offset: Date.parse(pkg.serverNow) - Date.now(),
      violations: att.violations || 0,
      locked: !!att.integrityLocked,
      pendingSubmit: null,
    };
  }

  /** Merges what the server has with what is on this device: the newer answer for each question wins. */
  function mergeServer(pkg) {
    var att = pkg.attempt;
    var serverAns = att.answers || {};
    var serverSeq = att.answerSeq || {};
    Object.keys(serverAns).forEach(function (qid) {
      var local = S.ops[qid];
      if (!local || (serverSeq[qid] || 0) >= local.seq) {
        S.answers[qid] = serverAns[qid];
        delete S.ops[qid];
      }
    });
    S.pkg.questions = pkg.questions;
    S.deadline = att.deadline;
    S.offset = Date.parse(pkg.serverNow) - Date.now();
    S.lockedQ = Array.from(new Set(S.lockedQ.concat(att.locked || [])));
    S.violations = Math.max(S.violations || 0, att.violations || 0);
    S.locked = !!att.integrityLocked;
    S.sessionId = deviceId();
  }

  function startIntegrity(isReload) {
    var a = S.pkg.assessment;
    R.integrity = new DBIIntegrity(a.antiCheat || {}, { onEvent: onIntegrity, root: document.body, onFullscreenChange: onFullscreenChange });
    R.integrity.start();
    if (isReload && a.antiCheat && a.antiCheat.monitorRefresh) onIntegrity('reload', 'Reloaded the test page');
    if (a.antiCheat && a.antiCheat.fullScreen && R.integrity.fullscreenSupported() && !R.integrity.isFullscreen()) onFullscreenChange(false);
  }

  function wireNetwork() {
    window.addEventListener('online', function () {
      if (S && S.status === 'in-progress') {
        addEvent('online', 'Connection restored');
        DBI.toast('Back online — uploading your answers.', 'ok');
        flush(true);
      } else if (S && S.status === 'sealed') upload();
    });
    window.addEventListener('offline', function () {
      if (S && S.status === 'in-progress') {
        addEvent('offline', 'Connection lost');
        setChip('offline');
        DBI.toast('You are offline. Keep going — your answers are saved on this device.', 'info', 5000);
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && S && S.status === 'in-progress') flush(true);
      if (document.visibilityState === 'hidden') emergencySave();
    });
    window.addEventListener('pagehide', emergencySave);
    window.addEventListener('beforeunload', emergencySave);
    setInterval(function () { if (S && S.status === 'in-progress') flush(); }, 8000);
  }

  async function showIntro(assessmentId, who) {
    var a = null;
    try {
      var snap = await DBI.db.collection('assessments').doc(assessmentId).get();
      a = snap.exists ? snap.data() : null;
    } catch (e) {}
    if (!a) {
      app.innerHTML = '<div class="screen"><div class="card empty">' + icon('alert') + '<h2>' + (navigator.onLine ? 'Test not found' : 'You are offline') + '</h2><p>' + (navigator.onLine ? 'This test does not exist or is not open.' : 'Connect to the internet to start this test. Once started, it keeps working offline.') + '</p><a class="btn ghost" href="assessments.html">My tests</a></div></div>';
      return;
    }
    var ac = a.antiCheat || {};
    var rules = [];
    if (Number(a.duration) > 0) rules.push(['clock', 'You have <b>' + esc(a.duration) + ' minutes</b>. The timer keeps running even if you close the page.']);
    rules.push(['wifiOff', 'If the internet goes off, keep going. Your answers are saved on this device and upload later.']);
    if (a.allowBack === false || a.answerDisplay === 'per-question') rules.push(['right', 'You cannot go back to a question once you move on.']);
    if (ac.fullScreen) rules.push(['expand', 'The test opens in <b>full screen</b>. Leaving full screen is recorded.']);
    if (ac.monitorTabs !== false) rules.push(['eye', 'Switching to another tab or app is recorded' + (Number(ac.warnings) > 0 ? ' — after <b>' + esc(ac.warnings) + '</b> times, ' + (ac.violationAction === 'submit' ? 'your test is submitted.' : ac.violationAction === 'lock' ? 'your test is paused.' : 'your teacher is alerted.') : '.')]);
    if (ac.disableCopy || ac.disablePaste) rules.push(['lock', 'Copy and paste are turned off.']);
    rules.push(['flag', 'Use <b>Flag</b> to mark questions you want to check before submitting.']);
    var tries = a.unlimitedAttempts ? 'Unlimited attempts' : (a.attempts || 1) + ' attempt' + ((a.attempts || 1) > 1 ? 's' : '');
    document.body.className = '';
    app.innerHTML = '<div class="screen"><a href="assessments.html" class="btn ghost sm" style="margin-bottom:12px">' + icon('left') + 'My tests</a><div class="card">' +
      '<span class="badge blue">' + esc(a.type || 'Test') + '</span><h1 style="margin-top:8px">' + esc(a.title) + '</h1>' + (a.description ? '<p class="muted">' + DBI.rich(a.description) + '</p>' : '') +
      '<div class="row small muted" style="margin:6px 0 12px"><span>' + icon('list') + ' ' + esc(a.poolSize || a.totalQuestions || '') + ' questions</span><span>' + icon('clock') + ' ' + (Number(a.duration) > 0 ? esc(a.duration) + ' min' : 'No time limit') + '</span><span>' + icon('refresh') + ' ' + tries + '</span><span>' + icon('award') + ' Pass: ' + esc(a.passingScore === 0 ? 0 : a.passingScore || 50) + '%</span></div>' +
      (a.instructions ? '<div class="alert" style="margin-bottom:12px">' + icon('book') + '<div>' + DBI.rich(a.instructions) + '</div></div>' : '') +
      '<h3>Before you start</h3><ul class="rules">' + rules.map(function (r) { return '<li>' + icon(r[0]) + '<span>' + r[1] + '</span></li>'; }).join('') + '</ul>' +
      '<div id="startMsg"></div>' +
      (a.accessCodeRequired ? '<label class="field"><span>Access code</span><input class="input" id="code" autocomplete="off" autocapitalize="characters" placeholder="Ask your teacher"></label>' : '') +
      (ac.pledge ? '<label class="check" style="margin:8px 0 16px"><input type="checkbox" id="pledge"><span>I will do this test on my own, without help from people, notes or the internet.</span></label>' : '') +
      '<button class="btn primary block" id="startBtn">' + icon('play') + 'Start test</button></div></div>';
    $('#startBtn').onclick = function () { begin(assessmentId, who, false); };
  }

  async function begin(assessmentId, who, takeOver) {
    var btn = $('#startBtn');
    var msg = $('#startMsg');
    var code = $('#code');
    var pledge = $('#pledge');
    if (pledge && !pledge.checked) {
      msg.innerHTML = '<div class="alert warn" style="margin-bottom:12px">' + icon('alert') + '<span>Please tick the honesty pledge to start.</span></div>';
      return;
    }
    if (!navigator.onLine) {
      msg.innerHTML = '<div class="alert warn" style="margin-bottom:12px">' + icon('wifiOff') + '<span>You need internet to start. After that the test works offline.</span></div>';
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Preparing your test…';
    // Fullscreen must be requested inside the tap, before any network wait.
    var probe = new DBIIntegrity((window.__assessmentAntiCheat || {}), {});
    if (window.__assessmentAntiCheat && window.__assessmentAntiCheat.fullScreen) probe.enterFullscreen();
    try {
      var pkg = await DBI.api('POST', '/attempts/start', { assessmentId: assessmentId, sessionId: deviceId(), accessCode: code ? code.value : '', pledge: pledge ? pledge.checked : false, takeOver: !!takeOver }, { retries: 2, timeout: 30000 });
      S = freshState(pkg, who, keyFor(who.uid, assessmentId));
      if (pkg.attempt.answers && Object.keys(pkg.attempt.answers).length) S.index = Math.min(S.pkg.questions.length - 1, 0);
      await persist(true);
      renderExam();
      startIntegrity(false);
      addEvent('resume', 'Started on this device');
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = icon('play') + 'Start test';
      if (e.code === 'ACTIVE_ELSEWHERE') {
        var ok = await DBI.confirm('Open on another device', e.message, 'Continue here');
        if (ok) return begin(assessmentId, who, true);
        return;
      }
      msg.innerHTML = '<div class="alert error" style="margin-bottom:12px">' + icon('alert') + '<span>' + esc(e.message) + '</span></div>';
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    }
  }

  function keyFor(uid, assessmentId) {
    return 'exam:' + uid + ':' + assessmentId;
  }

  async function boot() {
    app = document.getElementById('app');
    var assessmentId = new URLSearchParams(location.search).get('id');
    if (!assessmentId) {
      app.innerHTML = '<div class="screen"><div class="card empty">' + icon('alert') + '<h2>No test selected</h2><a class="btn ghost" href="assessments.html">My tests</a></div></div>';
      return;
    }
    var me = await DBI.requireStudent();
    var who = { uid: me.user.uid, name: me.name, studentId: me.studentId };
    wireNetwork();
    DBI.registerSW();
    var key = keyFor(who.uid, assessmentId);
    var local = await DBI.store.get(key).catch(function () { return null; });
    try {
      var snap = await DBI.db.collection('assessments').doc(assessmentId).get();
      if (snap.exists) window.__assessmentAntiCheat = snap.data().antiCheat || {};
    } catch (e) {}

    if (local && local.status === 'sealed' && local.pendingSubmit) {
      S = local;
      return upload();
    }
    if (local && local.status === 'in-progress') {
      // Resume straight from the device (works offline), then catch up with the server.
      S = local;
      S.who = who;
      restoreBackup();
      var reloaded = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0] || {}).type === 'reload';
      renderExam();
      if (S.locked) showLocked();
      startIntegrity(reloaded);
      if (S.deadline && Date.parse(S.deadline) <= serverNow()) return submit('time');
      if (navigator.onLine) {
        try {
          var pkg = await DBI.api('POST', '/attempts/start', { assessmentId: assessmentId, sessionId: deviceId() }, { timeout: 20000 });
          if (pkg.attempt.id !== S.attemptId) {
            // The old attempt was closed on the server (time, teacher). Start over from what the server says.
            await DBI.store.del(key);
            location.reload();
            return;
          }
          mergeServer(pkg);
          persist();
          rerender();
          flush(true);
        } catch (e) {
          if (e.code === 'ACTIVE_ELSEWHERE') {
            var ok = await DBI.confirm('Open on another device', e.message, 'Continue here');
            if (ok) {
              var p2 = await DBI.api('POST', '/attempts/start', { assessmentId: assessmentId, sessionId: deviceId(), takeOver: true });
              mergeServer(p2);
              persist();
              rerender();
              flush(true);
            } else showMoved();
          } else if (e.code === 'NO_ATTEMPTS' || e.code === 'CLOSED') {
            await DBI.store.del(key);
            location.reload();
          }
        }
      }
      return;
    }
    if (local) await DBI.store.del(key).catch(function () {});
    showIntro(assessmentId, who);
  }

  window.DBIExam = { boot: boot, _state: function () { return S; } };
})();
