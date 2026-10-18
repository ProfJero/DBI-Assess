/*
 * DBI Assess — grading engine.
 *
 * One implementation shared by the Cloudflare Worker (which does the real, trusted grading)
 * and the browser (question previews in the builder, practice mode, manual-review totals).
 * Works as a classic <script> (window.DBIGrading) and as a CommonJS/ESM import.
 *
 * Questions are graded by stable ids, never by display position, so shuffling questions or
 * options can never change a mark.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DBIGrading = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Question types that need a person to mark them. */
  var MANUAL_TYPES = ['essay', 'code', 'file-upload'];
  var TYPES = [
    'multiple-choice', 'multiple-select', 'true-false', 'fill-blank', 'short-answer',
    'numeric', 'matching', 'ordering', 'essay', 'code', 'file-upload',
  ];

  // ---------------------------------------------------------------- text helpers

  /**
   * Makes two typed answers comparable: Unicode-normalised, smart quotes and dashes made plain,
   * whitespace collapsed, trailing full stops dropped, and lower-cased unless case matters.
   */
  function normalizeText(value, caseSensitive) {
    var s = String(value == null ? '' : value);
    if (s.normalize) s = s.normalize('NFKC');
    s = s
      .replace(/[‘’‚‛′]/g, "'")
      .replace(/[“”„‟″]/g, '"')
      .replace(/[‐-―−]/g, '-')
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.!?;:,]+$/, '')
      .trim();
    return caseSensitive ? s : s.toLowerCase();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [];
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var cur = [i];
      for (var k = 1; k <= b.length; k++) {
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /** Allows one typo in answers of 5–9 characters and two in longer ones, when the author opts in. */
  function closeEnough(given, expected) {
    var d = levenshtein(given, expected);
    if (expected.length < 5) return d === 0;
    if (expected.length < 10) return d <= 1;
    return d <= 2;
  }

  /**
   * Parses a typed number the way students write it: "3.5", " 3,5 " (comma decimal),
   * "1,000" / "1 000" (thousands), "50%", "-2", "1/4", "2.5e3". Returns NaN when unclear.
   */
  function parseNumber(value) {
    if (typeof value === 'number') return value;
    var s = String(value == null ? '' : value).trim().replace(/\s+/g, '').replace(/%$/, '');
    if (!s) return NaN;
    var frac = s.match(/^(-?\d+)\/(\d+)$/);
    if (frac) return Number(frac[2]) === 0 ? NaN : Number(frac[1]) / Number(frac[2]);
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    if (!/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return Number(s);
  }

  function stripArticle(s) {
    return s.replace(/^(the|a|an)\s+/i, '');
  }

  /**
   * True when `given` matches one of the accepted answers. A leading "the/a/an" is ignored,
   * and an accepted answer may use * as a wildcard (e.g. "photosynth*").
   */
  function textMatches(given, accepted, opts) {
    opts = opts || {};
    var g = normalizeText(given, opts.caseSensitive);
    if (!g) return false;
    var g2 = opts.keepArticles ? g : stripArticle(g);
    for (var i = 0; i < accepted.length; i++) {
      var a = normalizeText(accepted[i], opts.caseSensitive);
      if (!a) continue;
      var a2 = opts.keepArticles ? a : stripArticle(a);
      if (a.indexOf('*') !== -1) {
        var re = new RegExp('^' + a2.split('*').map(function (part) { return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }).join('.*') + '$', opts.caseSensitive ? '' : 'i');
        if (re.test(g2)) return true;
        continue;
      }
      if (opts.match === 'contains' ? g.indexOf(a) !== -1 || g2.indexOf(a2) !== -1 : g === a || g2 === a2) return true;
      if (opts.fuzzy && opts.match !== 'contains' && closeEnough(g2, a2)) return true;
    }
    return false;
  }

  function asArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v : [v];
  }

  function isBlank(answer) {
    if (answer === undefined || answer === null) return true;
    if (typeof answer === 'string') return answer.trim() === '';
    if (Array.isArray(answer)) return answer.every(isBlank);
    if (typeof answer === 'object') {
      if ('url' in answer) return !answer.url;
      var keys = Object.keys(answer);
      return keys.length === 0 || keys.every(function (k) { return isBlank(answer[k]); });
    }
    return false;
  }

  // ---------------------------------------------------------------- legacy conversion

  function optionId(i) {
    return 'o' + (i + 1);
  }

  function toBool(v) {
    if (typeof v === 'boolean') return v;
    var s = normalizeText(Array.isArray(v) ? v[0] : v);
    if (s === 'true' || s === 't' || s === 'yes' || s === '1') return true;
    if (s === 'false' || s === 'f' || s === 'no' || s === '0') return false;
    return null;
  }

  /**
   * Converts a question document — the current format or the original one, where options are
   * plain strings and the key is option *text* in correctAnswer / correctAnswers / correct —
   * into { question, key, warnings }. `question` is safe to show students; `key` is not.
   */
  function normalizeQuestion(doc, keyDoc) {
    doc = doc || {};
    var warnings = [];
    var type = doc.type || 'multiple-choice';
    if (type === 'image') type = asArray(doc.options).length ? 'multiple-choice' : 'short-answer';
    if (type === 'multiple-answer' || type === 'checkbox') type = 'multiple-select';
    if (type === 'fill-in-blank' || type === 'fill-in-the-blank') type = 'fill-blank';
    if (TYPES.indexOf(type) === -1) type = 'essay';

    var q = {
      id: doc.id,
      type: type,
      text: doc.text || doc.question || '',
      points: Number(doc.points) > 0 ? Number(doc.points) : 1,
      imageUrl: doc.imageUrl || '',
      imageAlt: doc.imageAlt || '',
    };

    // Options become { id, text } so the key can refer to stable ids.
    var rawOptions = asArray(doc.options);
    var options = rawOptions
      .map(function (o, i) {
        if (o && typeof o === 'object') return { id: String(o.id || optionId(i)), text: String(o.text == null ? '' : o.text), imageUrl: o.imageUrl || '' };
        return { id: optionId(i), text: String(o == null ? '' : o) };
      })
      .filter(function (o) { return o.text.trim() !== '' || o.imageUrl; });

    var key = keyDoc ? JSON.parse(JSON.stringify(keyDoc)) : {};
    var legacyKey = asArray(doc.correctAnswer != null && !(Array.isArray(doc.correctAnswer) && !doc.correctAnswer.length) ? doc.correctAnswer : doc.correctAnswers != null ? doc.correctAnswers : doc.correct != null ? doc.correct : doc.answer);

    function idsFromLegacy(values) {
      var ids = [];
      values.forEach(function (v) {
        if (v && typeof v === 'object' && v.id) v = v.id;
        var byId = options.filter(function (o) { return o.id === String(v); })[0];
        if (byId) return ids.push(byId.id);
        var t = normalizeText(v);
        var byText = options.filter(function (o) { return normalizeText(o.text) === t; })[0];
        if (byText) return ids.push(byText.id);
        // Old keys sometimes stored the letter or the position: "B" or 1.
        if (/^[a-h]$/i.test(String(v).trim())) {
          var idx = String(v).trim().toUpperCase().charCodeAt(0) - 65;
          if (options[idx]) return ids.push(options[idx].id);
        }
        warnings.push('The answer key "' + v + '" does not match any option.');
      });
      return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
    }

    if (type === 'multiple-choice' || type === 'multiple-select') {
      q.options = options;
      if (!key.correct) key.correct = idsFromLegacy(legacyKey);
      if (!key.correct.length) warnings.push('No correct option is set.');
      if (type === 'multiple-choice' && key.correct.length > 1) warnings.push('More than one correct option on a single-answer question.');
    } else if (type === 'true-false') {
      if (key.correct === undefined) {
        var b = toBool(legacyKey.length ? legacyKey[0] : undefined);
        key.correct = b;
        if (b === null) warnings.push('The true/false answer is not set.');
      }
    } else if (type === 'fill-blank') {
      // Blanks are written as ____ (three or more underscores) or [[1]], [[2]] in the question text.
      var blanks = (q.text.match(/_{3,}|\[\[\d+\]\]/g) || []).length || 1;
      q.blanks = blanks;
      if (!key.blanks) {
        // The original builder stored one list of accepted answers for a single blank.
        key.blanks = blanks === 1 ? [{ accepted: legacyKey.map(String) }] : legacyKey.map(function (a) { return { accepted: String(a).split('|') }; });
      }
      if (!key.blanks.length || key.blanks.some(function (bk) { return !asArray(bk.accepted).length; })) warnings.push('A blank has no accepted answer.');
    } else if (type === 'short-answer') {
      if (!key.accepted && legacyKey.length) key.accepted = legacyKey.map(String);
      if (!key.accepted || !key.accepted.length) key.manual = true;
      q.maxWords = Number(doc.maxWordCount) || 0;
    } else if (type === 'numeric') {
      if (key.value === undefined && legacyKey.length) key.value = parseNumber(legacyKey[0]);
      q.unit = doc.unit || '';
      if (key.value === undefined && key.min === undefined) warnings.push('No numeric answer is set.');
    } else if (type === 'matching') {
      q.prompts = asArray(doc.prompts).map(function (p, i) { return typeof p === 'object' ? { id: String(p.id || 'p' + (i + 1)), text: String(p.text || '') } : { id: 'p' + (i + 1), text: String(p) }; });
      q.choices = asArray(doc.choices).map(function (c, i) { return typeof c === 'object' ? { id: String(c.id || 'c' + (i + 1)), text: String(c.text || '') } : { id: 'c' + (i + 1), text: String(c) }; });
      // Original format: options as "left = right" (or "left | right") strings.
      if (!q.prompts.length && options.length) {
        options.forEach(function (o, i) {
          var parts = o.text.split(/\s*(?:=|\||->|→)\s*/);
          q.prompts.push({ id: 'p' + (i + 1), text: parts[0] || '' });
          q.choices.push({ id: 'c' + (i + 1), text: parts.slice(1).join(' ') || '' });
          key.pairs = key.pairs || {};
          key.pairs['p' + (i + 1)] = 'c' + (i + 1);
        });
      }
      if (!key.pairs || !Object.keys(key.pairs).length) warnings.push('No matching pairs are set.');
    } else if (type === 'ordering') {
      q.items = asArray(doc.items).length
        ? asArray(doc.items).map(function (it, i) { return typeof it === 'object' ? { id: String(it.id || 'i' + (i + 1)), text: String(it.text || '') } : { id: 'i' + (i + 1), text: String(it) }; })
        : options.map(function (o, i) { return { id: 'i' + (i + 1), text: o.text }; });
      // The original builder entered items in the correct order.
      if (!key.order) key.order = q.items.map(function (it) { return it.id; });
    } else if (type === 'code') {
      q.language = doc.language || 'javascript';
      q.starterCode = doc.starterCode || doc.codeIncomplete || doc.codeWithErrors || '';
      q.codeToRead = doc.codeToRead || '';
      q.codeSubType = doc.codeSubType || 'writing';
      q.instructions = doc.instructions || '';
    } else if (type === 'essay') {
      q.maxWords = Number(doc.maxWordCount) || 0;
    } else if (type === 'file-upload') {
      q.fileTypes = doc.fileTypes || 'all';
      q.maxFileSize = Number(doc.maxFileSize) || 5;
    }

    if (!key.rubric && doc.rubric) key.rubric = doc.rubric;
    if (!key.explanation && (doc.explanation || (typeof doc.feedback === 'string' ? doc.feedback : ''))) key.explanation = doc.explanation || doc.feedback;
    if (!key.sampleAnswer && (doc.solution || doc.codeCorrected || doc.codeCompleted)) key.sampleAnswer = doc.solution || doc.codeCorrected || doc.codeCompleted;
    return { question: q, key: key, warnings: warnings };
  }

  /** Removes everything a student must not see before results are released. */
  function publicQuestion(q) {
    var out = JSON.parse(JSON.stringify(q));
    delete out.correctAnswer;
    delete out.correctAnswers;
    delete out.correct;
    delete out.answer;
    delete out.solution;
    delete out.rubric;
    delete out.explanation;
    delete out.feedback;
    delete out.codeCorrected;
    delete out.codeCompleted;
    return out;
  }

  // ---------------------------------------------------------------- grading

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  /**
   * Grades one answer. Returns { status, score, max, detail } where status is one of
   * correct | partial | incorrect | unanswered | pending (needs a person to mark it).
   * opts: { partialCredit (default true), negativeMarking (0..1, fraction of the mark lost on a wrong answer) }
   */
  function gradeQuestion(q, key, answer, opts) {
    opts = opts || {};
    key = key || {};
    var max = Number(q.points) > 0 ? Number(q.points) : 1;
    var partial = opts.partialCredit !== false && key.partialCredit !== false;
    var negative = Math.max(0, Math.min(1, Number(opts.negativeMarking) || 0));
    function result(fraction, detail) {
      fraction = Math.max(0, Math.min(1, fraction));
      var status = fraction >= 1 ? 'correct' : fraction > 0 ? 'partial' : 'incorrect';
      var score = fraction * max;
      if (status === 'incorrect' && negative) score = -negative * max;
      return { status: status, score: round2(score), max: max, detail: detail || null };
    }

    if (isBlank(answer)) return { status: 'unanswered', score: 0, max: max, detail: null };

    switch (q.type) {
      case 'multiple-choice': {
        var correct = asArray(key.correct).map(String);
        var chosen = String(Array.isArray(answer) ? answer[0] : answer);
        if (!correct.length) return { status: 'pending', score: 0, max: max, detail: 'no-key' };
        return result(correct.indexOf(chosen) !== -1 ? 1 : 0);
      }
      case 'multiple-select': {
        var right = asArray(key.correct).map(String);
        if (!right.length) return { status: 'pending', score: 0, max: max, detail: 'no-key' };
        var picked = asArray(answer).map(String).filter(function (v, i, a) { return a.indexOf(v) === i; });
        var hits = picked.filter(function (p) { return right.indexOf(p) !== -1; }).length;
        var wrong = picked.length - hits;
        if (hits === right.length && wrong === 0) return result(1);
        // Partial credit: each right choice earns a share, each wrong choice cancels one.
        return result(partial ? (hits - wrong) / right.length : 0, { hits: hits, wrong: wrong, of: right.length });
      }
      case 'true-false': {
        if (key.correct === null || key.correct === undefined) return { status: 'pending', score: 0, max: max, detail: 'no-key' };
        var given = toBool(answer);
        return result(given !== null && given === toBool(key.correct) ? 1 : 0);
      }
      case 'fill-blank': {
        var blanks = asArray(key.blanks);
        if (!blanks.length) return { status: 'pending', score: 0, max: max, detail: 'no-key' };
        var answers = asArray(answer);
        var per = blanks.map(function (b, i) {
          var acc = asArray(b.accepted);
          var g = answers[i];
          if (b.numeric || (acc.length && acc.every(function (a) { return !isNaN(parseNumber(a)); }) && !isNaN(parseNumber(g)))) {
            var n = parseNumber(g);
            var tol = Number(b.tolerance) || 0;
            return acc.some(function (a) { return Math.abs(parseNumber(a) - n) <= tol + 1e-9; });
          }
          return textMatches(g, acc, { caseSensitive: b.caseSensitive || key.caseSensitive, fuzzy: b.fuzzy || key.fuzzy });
        });
        var ok = per.filter(Boolean).length;
        return result(partial ? ok / blanks.length : ok === blanks.length ? 1 : 0, { blanks: per });
      }
      case 'short-answer': {
        if (key.manual || !asArray(key.accepted).length) return { status: 'pending', score: 0, max: max, detail: 'manual' };
        if (key.match === 'keywords') {
          var text = normalizeText(answer, key.caseSensitive);
          var kws = asArray(key.accepted);
          var found = kws.filter(function (k) { return text.indexOf(normalizeText(k, key.caseSensitive)) !== -1; }).length;
          var need = Number(key.minKeywords) || kws.length;
          return result(found >= need ? 1 : partial ? found / need : 0, { keywords: found, of: need });
        }
        var hit = textMatches(answer, asArray(key.accepted), { caseSensitive: key.caseSensitive, match: key.match, fuzzy: key.fuzzy });
        // A wrong typed answer may still be right in other words, so it goes to review if the author asked.
        if (!hit && key.reviewIfWrong) return { status: 'pending', score: 0, max: max, detail: 'review-if-wrong' };
        return result(hit ? 1 : 0);
      }
      case 'numeric': {
        var num = parseNumber(answer);
        if (isNaN(num)) return result(0, { parsed: null });
        var okNum;
        if (key.min !== undefined || key.max !== undefined) okNum = (key.min === undefined || num >= Number(key.min) - 1e-9) && (key.max === undefined || num <= Number(key.max) + 1e-9);
        else okNum = Math.abs(num - Number(key.value)) <= (Number(key.tolerance) || 0) + 1e-9;
        return result(okNum ? 1 : 0, { parsed: num });
      }
      case 'matching': {
        var pairs = key.pairs || {};
        var ids = Object.keys(pairs);
        if (!ids.length) return { status: 'pending', score: 0, max: max, detail: 'no-key' };
        var given2 = answer && typeof answer === 'object' ? answer : {};
        var good = ids.filter(function (p) { return String(given2[p]) === String(pairs[p]); }).length;
        return result(partial ? good / ids.length : good === ids.length ? 1 : 0, { matched: good, of: ids.length });
      }
      case 'ordering': {
        var order = asArray(key.order).map(String);
        if (!order.length) return { status: 'pending', score: 0, max: max, detail: 'no-key' };
        var got = asArray(answer).map(String);
        var inPlace = order.filter(function (id, i) { return got[i] === id; }).length;
        return result(partial ? inPlace / order.length : inPlace === order.length ? 1 : 0, { inPlace: inPlace, of: order.length });
      }
      default:
        // Essays, code and uploads are never auto-marked: a person reviews them.
        return { status: 'pending', score: 0, max: max, detail: 'manual' };
    }
  }

  /**
   * Grades a whole attempt. `questions` are normalised questions, `keys` maps question id → key,
   * `answers` maps question id → answer. Manual marks (from review) override automatic ones.
   */
  function gradeAttempt(questions, keys, answers, opts) {
    opts = opts || {};
    var manual = opts.manualMarks || {};
    var items = {};
    var total = 0;
    var max = 0;
    var pending = 0;
    var counts = { correct: 0, partial: 0, incorrect: 0, unanswered: 0, pending: 0 };
    questions.forEach(function (q) {
      var r = gradeQuestion(q, keys[q.id], answers ? answers[q.id] : undefined, opts);
      var m = manual[q.id];
      if (m && m.score !== undefined && m.score !== null) {
        var s = Math.max(Number(opts.negativeMarking) ? -r.max : 0, Math.min(r.max, Number(m.score)));
        r = { status: s >= r.max ? 'correct' : s > 0 ? 'partial' : 'incorrect', score: round2(s), max: r.max, detail: r.detail, manual: true, comment: m.comment || '' };
      }
      items[q.id] = r;
      counts[r.status]++;
      max += r.max;
      if (r.status === 'pending') pending++;
      else total += r.score;
    });
    total = round2(Math.max(0, total));
    return {
      items: items,
      earned: total,
      possible: max,
      percent: max ? Math.round((total / max) * 1000) / 10 : 0,
      pendingCount: pending,
      complete: pending === 0,
      counts: counts,
    };
  }

  // ---------------------------------------------------------------- deterministic shuffling

  /** Small seeded PRNG so a student's question and option order is the same every time they resume. */
  function seededRandom(seed) {
    var h = 1779033703 ^ String(seed).length;
    for (var i = 0; i < String(seed).length; i++) {
      h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function shuffle(list, seed) {
    var rnd = seededRandom(seed);
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // ---------------------------------------------------------------- statistics

  /**
   * Item analysis for one question across attempts: facility (share of marks earned),
   * discrimination (upper 27% minus lower 27% facility) and, for choice questions, how often each option was picked.
   */
  function itemAnalysis(q, rows) {
    // rows: [{ total: attempt percent, item: {score, max, status}, answer }]
    var scored = rows.filter(function (r) { return r.item && r.item.status !== 'pending'; });
    if (!scored.length) return { n: 0 };
    var fac = function (list) {
      return list.length ? list.reduce(function (s, r) { return s + Math.max(0, r.item.score) / r.item.max; }, 0) / list.length : 0;
    };
    var sorted = scored.slice().sort(function (a, b) { return b.total - a.total; });
    var k = Math.max(1, Math.round(sorted.length * 0.27));
    var out = {
      n: scored.length,
      facility: round2(fac(scored)),
      discrimination: sorted.length >= 4 ? round2(fac(sorted.slice(0, k)) - fac(sorted.slice(-k))) : null,
      unanswered: scored.filter(function (r) { return r.item.status === 'unanswered'; }).length,
    };
    if (q.options) {
      out.options = {};
      q.options.forEach(function (o) { out.options[o.id] = 0; });
      scored.forEach(function (r) {
        asArray(r.answer).forEach(function (a) { if (out.options[a] !== undefined) out.options[a]++; });
      });
    }
    return out;
  }

  /** Word-shingle similarity (0..1) between two written answers, used to flag possible copying. */
  function similarity(a, b) {
    function shingles(t) {
      var w = normalizeText(t).split(' ').filter(Boolean);
      var set = {};
      for (var i = 0; i + 2 < w.length; i++) set[w[i] + ' ' + w[i + 1] + ' ' + w[i + 2]] = 1;
      return set;
    }
    var A = shingles(a);
    var B = shingles(b);
    var ka = Object.keys(A);
    var kb = Object.keys(B);
    if (ka.length < 3 || kb.length < 3) return 0;
    var inter = ka.filter(function (s) { return B[s]; }).length;
    return round2(inter / (ka.length + kb.length - inter));
  }

  function wordCount(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  return {
    TYPES: TYPES,
    MANUAL_TYPES: MANUAL_TYPES,
    normalizeText: normalizeText,
    parseNumber: parseNumber,
    textMatches: textMatches,
    isBlank: isBlank,
    normalizeQuestion: normalizeQuestion,
    publicQuestion: publicQuestion,
    gradeQuestion: gradeQuestion,
    gradeAttempt: gradeAttempt,
    seededRandom: seededRandom,
    shuffle: shuffle,
    itemAnalysis: itemAnalysis,
    similarity: similarity,
    wordCount: wordCount,
  };
});
