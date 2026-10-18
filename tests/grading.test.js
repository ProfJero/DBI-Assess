// Unit tests for the shared grading engine: run with `node --test tests/`.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../DBI Assess/shared/grading.js');

const grade = (doc, answer, opts) => {
  const { question, key } = G.normalizeQuestion(doc);
  return G.gradeQuestion(question, key, answer, opts);
};

test('legacy multiple choice: key stored as option text still grades by option', () => {
  const doc = { type: 'multiple-choice', points: 2, options: ['HTML ', 'CSS', 'Python'], correctAnswer: ['HTML'] };
  const { question, key } = G.normalizeQuestion(doc);
  assert.deepEqual(key.correct, ['o1']); // trailing space in the option no longer breaks the match
  assert.equal(G.gradeQuestion(question, key, 'o1').status, 'correct');
  assert.equal(G.gradeQuestion(question, key, 'o1').score, 2);
  assert.equal(G.gradeQuestion(question, key, 'o2').status, 'incorrect');
});

test('legacy keys given as a letter or with different case are understood', () => {
  assert.deepEqual(G.normalizeQuestion({ options: ['a', 'b', 'c'], correctAnswer: 'B' }).key.correct, ['o2']);
  assert.deepEqual(G.normalizeQuestion({ options: ['Central Processing Unit', 'RAM'], correctAnswers: ['central processing unit'] }).key.correct, ['o1']);
});

test('a key that matches no option is reported, not silently marked correct', () => {
  const { question, key, warnings } = G.normalizeQuestion({ options: ['A1', 'B2'], correctAnswer: ['C3'] });
  assert.equal(warnings.length > 0, true);
  // The old engine returned true when no key was found; now the answer goes to review.
  assert.equal(G.gradeQuestion(question, key, 'o1').status, 'pending');
});

test('true/false accepts every way the answer has been stored', () => {
  for (const k of [['True'], 'true', true, 'TRUE', { correct: 'true' }]) {
    const doc = typeof k === 'object' && !Array.isArray(k) ? { type: 'true-false', ...k } : { type: 'true-false', correctAnswer: k };
    assert.equal(grade(doc, 'True').status, 'correct', JSON.stringify(k));
    assert.equal(grade(doc, true).status, 'correct');
    assert.equal(grade(doc, 'false').status, 'incorrect');
  }
});

test('multiple select: all-or-nothing and partial credit', () => {
  const doc = { type: 'multiple-select', points: 4, options: ['A', 'B', 'C', 'D'], correctAnswer: ['A', 'C'] };
  assert.equal(grade(doc, ['o3', 'o1']).status, 'correct'); // order of ticks doesn't matter
  assert.deepEqual(grade(doc, ['o1']).score, 2);
  assert.equal(grade(doc, ['o1', 'o2']).score, 0); // one right cancelled by one wrong
  assert.equal(grade(doc, ['o1', 'o2', 'o3', 'o4']).score, 0); // ticking everything earns nothing
  assert.equal(grade(doc, ['o1'], { partialCredit: false }).score, 0);
});

test('fill in the blank normalises spacing, case, punctuation and quotes', () => {
  const doc = { type: 'fill-blank', text: 'The ____ is the brain of the computer.', correctAnswers: ['CPU', 'Central Processing Unit'] };
  for (const a of ['cpu', ' CPU. ', 'central  processing unit', 'The CPU']) assert.equal(grade(doc, [a]).status, 'correct', a);
  assert.equal(grade(doc, 'cpu').status, 'correct'); // a plain string for a single blank
  assert.equal(grade(doc, ['GPU']).status, 'incorrect');
  // Answers typed with smart quotes match straight-quote keys.
  assert.equal(grade({ type: 'fill-blank', text: '____', correctAnswers: ["don't"] }, ['don’t']).status, 'correct');
});

test('fill in several blanks gives credit per blank', () => {
  const { question, key } = G.normalizeQuestion({ type: 'fill-blank', text: '[[1]] + [[2]]' }, { blanks: [{ accepted: ['2'] }, { accepted: ['3', 'three'] }] });
  assert.equal(question.blanks, 2);
  assert.equal(G.gradeQuestion(question, key, ['2', 'three']).status, 'correct');
  assert.equal(G.gradeQuestion(question, key, ['2', 'four']).status, 'partial');
  assert.equal(G.gradeQuestion(question, key, ['2.0', '3']).status, 'correct'); // numeric blanks compare numbers
});

test('short answer: wildcard, fuzzy and keyword modes; no key means manual review', () => {
  const sa = (key, ans) => G.gradeQuestion({ id: 'q', type: 'short-answer', points: 1 }, key, ans);
  assert.equal(sa({ accepted: ['photosynth*'] }, 'Photosynthesis').status, 'correct');
  assert.equal(sa({ accepted: ['photosynthesis'], fuzzy: true }, 'photosynthesys').status, 'correct');
  assert.equal(sa({ accepted: ['photosynthesis'] }, 'photosynthesys').status, 'incorrect');
  assert.equal(sa({ accepted: ['input', 'output', 'storage'], match: 'keywords' }, 'Input, processing and output').status, 'partial');
  assert.equal(sa({}, 'Anything at all').status, 'pending');
});

test('written answers are never auto-marked correct (the original bug)', () => {
  for (const type of ['essay', 'code', 'file-upload']) {
    const r = grade({ type, text: 'Explain…' }, 'asdf');
    assert.equal(r.status, 'pending', type);
    assert.equal(r.score, 0);
  }
  // Short answers with no accepted answers set also wait for a teacher.
  assert.equal(grade({ type: 'short-answer', text: 'Why?' }, 'because').status, 'pending');
});

test('numeric answers with tolerance, ranges and the ways students write numbers', () => {
  const n = (key, a) => G.gradeQuestion({ id: 'n', type: 'numeric', points: 1 }, key, a).status;
  assert.equal(n({ value: 3.5 }, '3,5'), 'correct');
  assert.equal(n({ value: 1000 }, '1,000'), 'correct');
  assert.equal(n({ value: 0.25 }, '1/4'), 'correct');
  assert.equal(n({ value: 9.81, tolerance: 0.05 }, '9.8'), 'correct');
  assert.equal(n({ value: 9.81, tolerance: 0.005 }, '9.8'), 'incorrect');
  assert.equal(n({ min: 10, max: 20 }, '15'), 'correct');
  assert.equal(n({ value: 5 }, 'five'), 'incorrect');
  assert.ok(isNaN(G.parseNumber('1.2.3')));
});

test('matching and ordering', () => {
  const m = G.gradeQuestion({ id: 'm', type: 'matching', points: 3 }, { pairs: { p1: 'c1', p2: 'c2', p3: 'c3' } }, { p1: 'c1', p2: 'c3', p3: 'c2' });
  assert.equal(m.status, 'partial');
  assert.equal(m.score, 1);
  const o = { id: 'o', type: 'ordering', points: 4 };
  assert.equal(G.gradeQuestion(o, { order: ['a', 'b', 'c', 'd'] }, ['a', 'b', 'c', 'd']).status, 'correct');
  assert.equal(G.gradeQuestion(o, { order: ['a', 'b', 'c', 'd'] }, ['a', 'b', 'd', 'c']).score, 2);
  // Legacy matching stored "left = right" strings in options.
  const legacy = G.normalizeQuestion({ type: 'matching', options: ['HTML = Structure', 'CSS = Style'] });
  assert.equal(legacy.question.prompts.length, 2);
  assert.equal(G.gradeQuestion(legacy.question, legacy.key, { p1: 'c1', p2: 'c2' }).status, 'correct');
});

test('array answers no longer crash grading (old code called .trim() on them)', () => {
  assert.doesNotThrow(() => grade({ type: 'ordering', options: ['a', 'b'] }, ['i1', 'i2']));
  assert.doesNotThrow(() => grade({ type: 'essay' }, ['x']));
});

test('whole attempt: grades by question id regardless of display order', () => {
  const docs = [
    { id: 'q1', type: 'multiple-choice', options: ['A', 'B'], correctAnswer: ['B'], points: 1 },
    { id: 'q2', type: 'true-false', correctAnswer: ['False'], points: 1 },
    { id: 'q3', type: 'essay', points: 3 },
  ];
  const qs = [];
  const keys = {};
  docs.forEach((d) => {
    const n = G.normalizeQuestion(d);
    qs.push(n.question);
    keys[d.id] = n.key;
  });
  const shuffled = G.shuffle(qs, 'student-1:exam-1');
  const r = G.gradeAttempt(shuffled, keys, { q1: 'o2', q2: 'False', q3: 'My essay' });
  assert.equal(r.earned, 2);
  assert.equal(r.possible, 5);
  assert.equal(r.pendingCount, 1);
  assert.equal(r.complete, false);
  // After a teacher marks the essay the attempt is complete.
  const done = G.gradeAttempt(qs, keys, { q1: 'o2', q2: 'False', q3: 'My essay' }, { manualMarks: { q3: { score: 2, comment: 'Good' } } });
  assert.equal(done.earned, 4);
  assert.equal(done.percent, 80);
  assert.equal(done.complete, true);
});

test('negative marking never drives the total below zero', () => {
  const qs = [G.normalizeQuestion({ id: 'a', options: ['x', 'y'], correctAnswer: 'x' }).question];
  const keys = { a: { correct: ['o1'] } };
  const r = G.gradeAttempt(qs, keys, { a: 'o2' }, { negativeMarking: 0.25 });
  assert.equal(r.items.a.score, -0.25);
  assert.equal(r.earned, 0);
});

test('seeded shuffle is stable for the same student and differs between students', () => {
  const list = Array.from({ length: 20 }, (_, i) => i);
  assert.deepEqual(G.shuffle(list, 'u1:e1'), G.shuffle(list, 'u1:e1'));
  assert.notDeepEqual(G.shuffle(list, 'u1:e1'), G.shuffle(list, 'u2:e1'));
  assert.deepEqual([...G.shuffle(list, 'x')].sort((a, b) => a - b), list);
});

test('public questions never include keys', () => {
  const pub = G.publicQuestion({ id: 'q', text: 'x', options: ['a'], correctAnswer: ['a'], correct: 'a', solution: 's', rubric: 'r', explanation: 'e' });
  for (const k of ['correctAnswer', 'correct', 'solution', 'rubric', 'explanation']) assert.equal(k in pub, false, k);
});

test('similarity flags near-identical essays', () => {
  const a = 'The computer processes data using the central processing unit and stores it in memory for later use.';
  assert.ok(G.similarity(a, a.replace('later', 'future')) > 0.6);
  assert.ok(G.similarity(a, 'Plants make food using sunlight in a process called photosynthesis every day.') < 0.1);
});

test('item analysis computes facility and discrimination', () => {
  const q = { id: 'q', type: 'multiple-choice', options: [{ id: 'o1' }, { id: 'o2' }] };
  const rows = [90, 80, 70, 60, 40, 30, 20, 10].map((total, i) => ({ total, answer: i < 4 ? 'o1' : 'o2', item: { score: i < 4 ? 1 : 0, max: 1, status: i < 4 ? 'correct' : 'incorrect' } }));
  const a = G.itemAnalysis(q, rows);
  assert.equal(a.facility, 0.5);
  assert.equal(a.discrimination, 1);
  assert.deepEqual(a.options, { o1: 4, o2: 4 });
});
