// Loading assessments, their questions and keys, and reading their settings consistently.
import G from '../../DBI Assess/shared/grading.js';
import { toMillis } from './context.js';

/** One place that turns an assessment document (old or new) into the rules the Worker enforces. */
export function policyOf(a) {
  const ac = a.antiCheat || {};
  const display = a.answerDisplay || 'end';
  const attempts = a.unlimitedAttempts ? Infinity : Math.max(1, Number(a.attempts) || 1);
  return {
    durationMin: Number(a.duration) > 0 ? Number(a.duration) : 0, // 0 = untimed
    graceMin: a.gracePeriod === 0 ? 0 : Number(a.gracePeriod) || 2,
    attempts,
    opensAt: toMillis(a.opensAt || a.startDate),
    closesAt: toMillis(a.closesAt || a.endDate),
    passingScore: a.passingScore === 0 ? 0 : Number(a.passingScore) || 50,
    randomQuestions: !!a.randomQuestions,
    randomOptions: !!a.randomOptions,
    poolSize: Number(a.poolSize) || 0,
    partialCredit: a.partialCredit !== false,
    negativeMarking: Number(a.negativeMarking) || 0,
    // When answers and scores may be shown: per-question (instant), end (on submit), release (teacher releases), none (score only, after release).
    display,
    showScore: a.showEndScore !== false && a.showScore !== false,
    showCorrect: display === 'per-question' ? !!a.showCorrectAnswers : !!(a.showEndCorrect || a.showCorrectAnswers),
    showFeedback: display === 'per-question' ? !!a.showFeedback : !!(a.showEndFeedback || a.showFeedback),
    allowBack: display === 'per-question' ? false : a.allowBack !== false,
    singleDevice: ac.singleDevice !== false,
    maxViolations: Number(ac.warnings) > 0 ? Number(ac.warnings) : 0, // 0 = only log
    violationAction: ac.violationAction || 'flag', // flag | submit | lock
    audience: a.audience && a.audience.type === 'list' ? (a.audience.studentIds || []).map((s) => String(s).toUpperCase()) : null,
    certificate: a.certificate || {},
  };
}

function sortQuestions(list) {
  return list.sort((x, y) => {
    const ox = x.order ?? Number.MAX_SAFE_INTEGER;
    const oy = y.order ?? Number.MAX_SAFE_INTEGER;
    if (ox !== oy) return ox - oy;
    return String(x.createdAt || '').localeCompare(String(y.createdAt || '')) || String(x.id).localeCompare(String(y.id));
  });
}

/** Loads an assessment with normalised questions and their keys. */
export async function loadBundle(ctx, assessmentId, { withKeys = true } = {}) {
  const [assessment, docs] = await Promise.all([ctx.db.get(`assessments/${assessmentId}`), ctx.db.query('questions', [['assessmentId', '==', assessmentId]])]);
  if (!assessment) return null;
  const active = sortQuestions(docs.filter((d) => !d.archived));
  const keyDocs = withKeys ? await ctx.db.getAll(active.map((d) => `questionKeys/${d.id}`)) : new Map();
  const questions = [];
  const keys = {};
  for (const d of active) {
    const n = G.normalizeQuestion(d, keyDocs.get(`questionKeys/${d.id}`) || null);
    n.question.id = d.id;
    questions.push(n.question);
    keys[d.id] = n.key;
  }
  return { assessment, policy: policyOf(assessment), questions, keys };
}

/**
 * What a student is shown for one question: no keys, options/choices/items in this student's order.
 * Ordering items are always shuffled; otherwise the answer would be on screen.
 */
export function studentQuestion(q, seed, policy) {
  const out = G.publicQuestion(q);
  if (out.options && policy.randomOptions) out.options = G.shuffle(out.options, `${seed}:${q.id}:o`);
  if (out.choices) out.choices = G.shuffle(out.choices, `${seed}:${q.id}:c`);
  if (out.items) {
    let items = G.shuffle(out.items, `${seed}:${q.id}:i`);
    // Never present the items already in the correct order.
    if (items.length > 1 && items.every((it, i) => it.id === out.items[i].id)) items = [...items.slice(1), items[0]];
    out.items = items;
  }
  return out;
}

export function pickQuestions(questions, seed, policy) {
  let list = questions.slice();
  if (policy.poolSize > 0 && policy.poolSize < list.length) {
    // A random pool per student, keeping the original order unless shuffling is on.
    const chosen = new Set(G.shuffle(list, `${seed}:pool`).slice(0, policy.poolSize).map((q) => q.id));
    list = list.filter((q) => chosen.has(q.id));
  }
  if (policy.randomQuestions) list = G.shuffle(list, `${seed}:q`);
  return list;
}
