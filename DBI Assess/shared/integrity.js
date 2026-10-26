/*
 * DBI Assess integrity monitor. Watches for behaviour that suggests cheating during an exam and
 * reports each event (the server keeps the count and applies the limit). Browser checks are
 * deterrents: they cannot stop a second phone or a person helping, which is why they are logged
 * for the teacher rather than silently trusted.
 *
 * new DBIIntegrity(settings, { onEvent(type, detail), root, onFullscreenChange(isFull) })
 */
(function (root) {
  'use strict';

  var isTouch = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  function Integrity(settings, opts) {
    this.s = settings || {};
    this.opts = opts || {};
    this.active = false;
    this.lastHidden = 0;
    this.lastBlur = 0;
    this.lastDevtools = 0;
    this.handlers = [];
  }

  Integrity.prototype.on = function (target, type, fn, capture) {
    target.addEventListener(type, fn, capture || false);
    this.handlers.push([target, type, fn, capture || false]);
  };

  Integrity.prototype.report = function (type, detail) {
    if (!this.active) return;
    if (this.opts.onEvent) this.opts.onEvent(type, detail || '');
  };

  Integrity.prototype.fullscreenSupported = function () {
    var el = document.documentElement;
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(el.requestFullscreen || el.webkitRequestFullscreen);
  };

  Integrity.prototype.isFullscreen = function () {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  };

  /** Must be called from a click/tap (browsers only allow fullscreen after a user gesture). */
  Integrity.prototype.enterFullscreen = function () {
    if (!this.s.fullScreen || !this.fullscreenSupported() || this.isFullscreen()) return Promise.resolve();
    var el = document.documentElement;
    var p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
    return Promise.resolve(p).catch(function () {});
  };

  Integrity.prototype.start = function () {
    var self = this;
    var s = this.s;
    if (this.active) return;
    this.active = true;
    var area = this.opts.root || document.body;

    // Leaving the test: switching tab/app (most reliable on phones) and focus moving away (desktop).
    if (s.monitorTabs !== false) {
      this.on(document, 'visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          self.lastHidden = Date.now();
          self.blurContent(true);
          self.report('tab-hidden', 'Left the test page');
        } else self.blurContent(false);
      });
    }
    if (s.monitorMinimize !== false && !isTouch) {
      this.on(window, 'blur', function () {
        // Ignore the blur that accompanies a tab switch (already counted) and focus moving into our own iframes.
        setTimeout(function () {
          if (Date.now() - self.lastHidden < 1500 || document.visibilityState === 'hidden') return;
          if (document.activeElement && document.activeElement.tagName === 'IFRAME') return;
          if (Date.now() - self.lastBlur < 3000) return;
          self.lastBlur = Date.now();
          self.blurContent(true);
          self.report('window-blur', 'Clicked outside the test window');
        }, 250);
      });
      this.on(window, 'focus', function () {
        self.blurContent(false);
      });
    }

    if (s.fullScreen && this.fullscreenSupported()) {
      var onFs = function () {
        var full = self.isFullscreen();
        if (!full) self.report('fullscreen-exit', 'Left full screen');
        if (self.opts.onFullscreenChange) self.opts.onFullscreenChange(full);
      };
      this.on(document, 'fullscreenchange', onFs);
      this.on(document, 'webkitfullscreenchange', onFs);
    }

    var block = function (type, label) {
      return function (e) {
        var t = e.target;
        // Typing in answer boxes is fine; copying the question text is not.
        if (type === 'paste' && !s.disablePaste) return;
        if ((type === 'copy' || type === 'cut') && !s.disableCopy) return;
        e.preventDefault();
        self.report(type, label);
        if (self.opts.onBlocked) self.opts.onBlocked(type);
        return t;
      };
    };
    if (s.disableCopy) {
      this.on(document, 'copy', block('copy', 'Tried to copy'), true);
      this.on(document, 'cut', block('cut', 'Tried to cut'), true);
    }
    if (s.disablePaste) this.on(document, 'paste', block('paste', 'Tried to paste'), true);
    if (s.disableRightClick) {
      this.on(document, 'contextmenu', function (e) {
        e.preventDefault();
        self.report('context-menu', 'Right-click / long press menu');
      }, true);
    }
    if (s.disableSelection) area.classList.add('no-select');
    if (s.disableDrag !== false) {
      this.on(document, 'dragstart', function (e) {
        if (!(e.target.closest && e.target.closest('[data-draggable]'))) e.preventDefault();
      }, true);
    }

    if (s.disablePrint) {
      document.documentElement.classList.add('no-print');
      this.on(window, 'beforeprint', function () {
        self.report('print', 'Tried to print');
      });
    }

    // Keyboard shortcuts for copying, printing, saving, viewing source and developer tools.
    this.on(document, 'keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      var mod = e.ctrlKey || e.metaKey;
      var devtools = k === 'f12' || (mod && e.shiftKey && ['i', 'j', 'c', 'k'].indexOf(k) !== -1) || (e.metaKey && e.altKey && ['i', 'j', 'c'].indexOf(k) !== -1);
      var blocked =
        devtools ||
        (mod && k === 'p' && s.disablePrint) ||
        (mod && (k === 's' || k === 'u')) ||
        (mod && (k === 'c' || k === 'x') && s.disableCopy && !isTypingTarget(e.target)) ||
        (mod && k === 'v' && s.disablePaste);
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        self.report(devtools ? 'devtools' : k === 'p' ? 'print' : 'shortcut', 'Pressed ' + (mod ? (e.metaKey ? 'Cmd+' : 'Ctrl+') : '') + (e.shiftKey ? 'Shift+' : '') + (e.key || ''));
      }
    }, true);
    this.on(document, 'keyup', function (e) {
      if (e.key === 'PrintScreen') {
        self.report('print', 'Pressed Print Screen');
        try {
          navigator.clipboard && navigator.clipboard.writeText('');
        } catch (err) {}
      }
    }, true);

    // Developer tools heuristic (desktop only, low confidence: docked tools change the window size).
    if (s.monitorDevTools && !isTouch) {
      this.devtoolsTimer = setInterval(function () {
        var gapW = window.outerWidth - window.innerWidth;
        var gapH = window.outerHeight - window.innerHeight;
        if ((gapW > 200 || gapH > 260) && Date.now() - self.lastDevtools > 60000 && document.visibilityState === 'visible') {
          self.lastDevtools = Date.now();
          self.report('devtools', 'Developer tools may be open (window ' + gapW + '×' + gapH + ' px smaller)');
        }
      }, 2500);
    }
  };

  function isTypingTarget(t) {
    return t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /text|search|number/.test(t.type || 'text')));
  }

  Integrity.prototype.blurContent = function (on) {
    if (!this.s.blurOnLeave && this.s.blurOnLeave !== undefined) return;
    var area = this.opts.root || document.body;
    area.classList.toggle('blurred', !!on);
  };

  Integrity.prototype.stop = function () {
    this.active = false;
    this.handlers.forEach(function (h) {
      h[0].removeEventListener(h[1], h[2], h[3]);
    });
    this.handlers = [];
    clearInterval(this.devtoolsTimer);
    var area = this.opts.root || document.body;
    area.classList.remove('no-select', 'blurred');
    document.documentElement.classList.remove('no-print');
    if (this.isFullscreen() && document.exitFullscreen) document.exitFullscreen().catch(function () {});
  };

  /** Plain-language names for the teacher's timeline and the student's warnings. */
  Integrity.LABELS = {
    'tab-hidden': 'Left the test (switched tab or app)',
    'window-blur': 'Clicked outside the test window',
    'fullscreen-exit': 'Left full screen',
    copy: 'Tried to copy',
    cut: 'Tried to cut',
    paste: 'Tried to paste',
    'context-menu': 'Opened the right-click menu',
    print: 'Tried to print or screenshot',
    devtools: 'Developer tools (possible)',
    shortcut: 'Used a blocked shortcut',
    reload: 'Reloaded the test page',
    'device-change': 'Continued on another device',
    offline: 'Went offline',
    online: 'Came back online',
    resume: 'Resumed the test',
  };

  root.DBIIntegrity = Integrity;
})(window);
