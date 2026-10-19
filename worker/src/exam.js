// The exam lifecycle: start/resume, autosave sync, instant check, submit, and the student's own results.
import G from '../../DBI Assess/shared/grading.js';
import { loadBundle, pickQuestions, policyOf, studentQuestion } from './assessments.js';
import { clientInfo, fail, json, nowIso } from './context.js';
import { issueCertificateIfEligible } from './certificates.js';

const MAX_EVENTS = 400;
/** Integrity events that count towards the violation limit. Others (online/offline, resume) are only logged. */
const VIOLATIONS = new Set(['tab-hidden', 'window-blur', 'fullscreen-exit', 'copy', 'paste', 'cut', 'context-menu', 'print', 'devtools', 'shortcut', 'reload', 'device-change', 'split-screen']);

const attemptId = (assessmentId, uid, n) => `${assessmentId}_${uid}_${n}`;

async function getAttempt(ctx, id, user) {
  const att = await ctx.db.get(`studentResults/${id}`);
  if (!att || att.version !== 2) fail(404, 'NOT_FOUND', 'Attempt not found.');
  if (att.studentUid !== user.sub) fail(403, 'NOT_YOURS', 'This attempt belongs to someone else.');
  return att;
}

function deadlineOf(att) {
  return att.deadline ? Date.parse(att.deadline) + (Number(att.extraSeconds) || 0) * 1000 : Infinity;
}

/** The exam package sent to the student: everything needed to sit the exam offline, minus keys. */
function packageFor(att, bundle) {
  const byId = new Map(bundle.questions.map((q) => [q.id, q]));
  const p = bundle.policy;
  const a = bundle.assessment;
  return {
    attempt: {
      id: att.id,
      assessmentId: att.assessmentId,
      attemptNumber: att.attemptNumber,
      startedAt: att.startedAt,
      deadline: Number.isFinite(deadlineOf(att)) ? new Date(deadlineOf(att)).toISOString() : null,
      answers: att.answers || {},
      answerSeq: att.answerSeq || {},
      flagged: att.flagged || [],
      locked: att.lockedQuestions || [],
      checked: att.checked || {},
      integrityLocked: !!att.integrity?.locked,
      violations: att.integrity?.count || 0,
      sessionId: att.sessionId,
    },
    assessment: {
      id: a.id,
      title: a.title || 'Assessment',
      description: a.description || '',
      instructions: a.instructions || '',
      durationMin: p.durationMin,
      allowBack: p.allowBack,
      display: p.display,
      showTimer: a.showTimer !== false,
      showProgress: a.showProgress !== false,
      onePerPage: a.onePerPage !== false,
      questionTimeLimit: Number(a.antiCheat?.questionTimeLimit) || 0,
      antiCheat: a.antiCheat || {},
      maxViolations: p.maxViolations,
      violationAction: p.violationAction,
      passingScore: p.passingScore,
    },
    questions: att.questionIds.map((id) => byId.get(id)).filter(Boolean).map((q) => studentQuestion(q, att.seed, p)),
    serverNow: nowIso(),
  };
}

/** Counts finished attempts, including ones made on the old system (which stored studentId, not uid). */
async function previousAttempts(ctx, assessmentId, user) {
  const [mine, legacy] = await Promise.all([
    ctx.db.query('studentResults', [['studentUid', '==', user.sub], ['assessmentId', '==', assessmentId]]),
    ctx.db.query('studentResults', [['studentId', '==', user.sid], ['assessmentId', '==', assessmentId]]),
  ]);
  const seen = new Set();
  return [...mine, ...legacy].filter((r) => !seen.has(r.id) && seen.add(r.id));
}

export async function startAttempt(request, ctx, user) {
  const body = await request.json().catch(() => ({}));
  const assessmentId = String(body.assessmentId || '');
  const sessionId = String(body.sessionId || '').slice(0, 64);
  if (!assessmentId || !sessionId) fail(400, 'MISSING', 'Missing assessment.');
  const bundle = await loadBundle(ctx, assessmentId);
  if (!bundle) fail(404, 'NOT_FOUND', 'This assessment does not exist.');
  const { assessment: a, policy: p } = bundle;
  const info = clientInfo(request);

  const all = await previousAttempts(ctx, assessmentId, user);
  let inProgress = all.find((r) => r.version === 2 && r.status === 'in-progress');

  // An attempt whose time ran out while the student was away is submitted with what was saved.
  if (inProgress && Date.now() > deadlineOf(inProgress) + p.graceMin * 60000) {
    await finalize(ctx, inProgress, bundle, { reason: 'time', answers: null });
    inProgress = null;
  }

  if (inProgress) {
    const fresh = inProgress.lastSeenAt && Date.now() - Date.parse(inProgress.lastSeenAt) < 90_000;
    if (inProgress.sessionId !== sessionId) {
      if (p.singleDevice && fresh && !body.takeOver) {
        fail(409, 'ACTIVE_ELSEWHERE', 'This exam is open on another device or browser. Close it there, or continue here to move the exam to this device.', { canTakeOver: true });
      }
      const event = { id: crypto.randomUUID(), type: 'device-change', at: nowIso(), detail: `${info.ua.slice(0, 80)} · ${info.ip}` };
      await ctx.db.commit([
        {
          path: `studentResults/${inProgress.id}`,
          merge: true,
          data: { sessionId, lastSeenAt: nowIso(), lastIp: info.ip },
          append: { 'integrity.events': [event], ips: [info.ip] },
          increment: { 'integrity.count': 1, 'integrity.byType.device-change': 1 },
        },
      ]);
      inProgress = await ctx.db.get(`studentResults/${inProgress.id}`);
    }
    return json(packageFor(inProgress, bundle));
  }

  // New attempt: every check below runs on the server.
  if (a.status !== 'published') fail(403, 'NOT_OPEN', 'This assessment is not open.');
  if (p.opensAt && Date.now() < p.opensAt) fail(403, 'NOT_YET', `This assessment opens on ${new Date(p.opensAt).toUTCString().replace(' GMT', '')}.`, { opensAt: new Date(p.opensAt).toISOString() });
  if (p.closesAt && Date.now() > p.closesAt) fail(403, 'CLOSED', 'This assessment has closed.');
  if (p.audience && !p.audience.includes(user.sid)) fail(403, 'NOT_ASSIGNED', 'This assessment is not assigned to you.');
  const finished = all.filter((r) => r.status !== 'in-progress' && r.status !== 'void').length;
  if (finished >= p.attempts) fail(403, 'NO_ATTEMPTS', `You have used all ${p.attempts} attempt${p.attempts === 1 ? '' : 's'}.`);
  if (!bundle.questions.length) fail(409, 'EMPTY', 'This assessment has no questions yet.');

  const secrets = await ctx.db.get(`assessmentSecrets/${assessmentId}`);
  if (secrets?.accessCode) {
    const given = String(body.accessCode || '').trim().toUpperCase();
    if (!given) fail(403, 'NEED_CODE', 'Enter the access code your teacher gave you.');
    if (given !== String(secrets.accessCode).trim().toUpperCase()) fail(403, 'BAD_CODE', 'That access code is not correct.');
  }
  if (a.antiCheat?.pledge && !body.pledge) fail(400, 'NEED_PLEDGE', 'Please accept the honesty pledge to start.');

  const profile = await ctx.db.get(`users/${user.sub}`);
  const attemptNumber = Math.max(all.length ? Math.max(...all.map((r) => Number(r.attemptNumber) || 0)) : 0, finished) + 1;
  const seed = `${user.sub}:${assessmentId}:${attemptNumber}:${crypto.randomUUID().slice(0, 8)}`;
  const picked = pickQuestions(bundle.questions, seed, p);
  const start = Date.now();
  let deadline = p.durationMin ? start + p.durationMin * 60000 + (Number(profile?.extraTimePercent) || 0) * p.durationMin * 600 : null;
  if (p.closesAt && (!deadline || deadline > p.closesAt)) deadline = p.closesAt;
  const id = attemptId(assessmentId, user.sub, attemptNumber);
  const doc = {
    version: 2,
    assessmentId,
    assessmentTitle: a.title || 'Assessment',
    department: a.department || '',
    studentUid: user.sub,
    studentId: user.sid,
    studentName: `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || user.sid,
    studentFirstName: profile?.firstName || '',
    studentLastName: profile?.lastName || '',
    studentEmail: profile?.email || '',
    attemptNumber,
    status: 'in-progress',
    released: false,
    startedAt: new Date(start).toISOString(),
    deadline: deadline ? new Date(deadline).toISOString() : null,
    extraSeconds: 0,
    seed,
    questionIds: picked.map((q) => q.id),
    totalQuestions: picked.length,
    answers: {},
    answerSeq: {},
    flagged: [],
    lockedQuestions: [],
    checked: {},
    sessionId,
    lastSeenAt: nowIso(),
    lastIp: info.ip,
    ips: [info.ip],
    userAgent: info.ua,
    integrity: { count: 0, byType: {}, events: [], locked: false },
    syncCount: 0,
    score: 0,
    passed: false,
  };
  try {
    await ctx.db.create('studentResults', doc, id);
  } catch (e) {
    // Two starts at once (double tap, two tabs): the deterministic id means the second one just resumes.
    if (e.status !== 409) throw e;
  }
  const saved = await ctx.db.get(`studentResults/${id}`);
  return json(packageFor(saved, bundle));
}

function cleanEvents(list) {
  return (Array.isArray(list) ? list : []).slice(0, 100).map((e) => ({
    id: String(e.id || crypto.randomUUID()).slice(0, 40),
    type: String(e.type || 'other').slice(0, 30),
    at: String(e.at || nowIso()).slice(0, 30),
    detail: String(e.detail || '').slice(0, 160),
    q: e.q ? String(e.q).slice(0, 40) : null,
  }));
}

/**
 * Applies queued answer operations and integrity events. Each answer carries a per-question sequence
 * number, so replays and out-of-order deliveries are harmless (idempotent).
 */
export async function syncAttempt(request, ctx, user, id) {
  const body = await request.json().catch(() => ({}));
  const att = await getAttempt(ctx, id, user);
  const base = { serverNow: nowIso(), status: att.status, deadline: Number.isFinite(deadlineOf(att)) ? new Date(deadlineOf(att)).toISOString() : null };
  if (att.status !== 'in-progress') return json({ ...base, closed: true });
  if (att.sessionId && body.sessionId && att.sessionId !== body.sessionId) {
    return json({ ...base, replaced: true }, 409);
  }
  const assessment = await ctx.db.get(`assessments/${att.assessmentId}`);
  const p = policyOf(assessment || {});
  const info = clientInfo(request);
  const allowed = new Set(att.questionIds || []);
  const locked = new Set(att.lockedQuestions || []);
  const late = Date.now() > deadlineOf(att) + p.graceMin * 60000;
  const data = { lastSeenAt: nowIso(), lastIp: info.ip };
  const increment = { syncCount: 1 };
  let applied = 0;

  if (!late && !att.integrity?.locked) {
    // Keep only the newest operation per question, whatever order they arrive in.
    const newest = new Map();
    for (const op of Array.isArray(body.ops) ? body.ops.slice(0, 500) : []) {
      const qid = String(op.qid || '');
      const seq = Number(op.seq) || 0;
      if (!allowed.has(qid) || locked.has(qid)) continue;
      if (seq <= (Number(att.answerSeq?.[qid]) || 0)) continue;
      if (!newest.has(qid) || newest.get(qid).seq < seq) newest.set(qid, { seq, value: op.value });
    }
    for (const [qid, op] of newest) {
      data[`answers.${qid}`] = sanitizeAnswer(op.value);
      data[`answerSeq.${qid}`] = op.seq;
      applied++;
    }
    if (Array.isArray(body.flagged)) data.flagged = body.flagged.filter((q) => allowed.has(q)).slice(0, 500);
  }

  const events = cleanEvents(body.events);
  const known = new Set((att.integrity?.events || []).map((e) => e.id));
  const newEvents = events.filter((e) => !known.has(e.id));
  let violations = 0;
  for (const e of newEvents) {
    if (VIOLATIONS.has(e.type)) {
      violations++;
      increment[`integrity.byType.${e.type}`] = (increment[`integrity.byType.${e.type}`] || 0) + 1;
    }
  }
  if (violations) increment['integrity.count'] = violations;
  const total = (att.integrity?.count || 0) + violations;
  const write = { path: `studentResults/${id}`, merge: true, data, increment };
  if (newEvents.length && (att.integrity?.events || []).length < MAX_EVENTS) write.append = { 'integrity.events': newEvents.slice(0, MAX_EVENTS - (att.integrity?.events || []).length) };
  if (info.ip && !(att.ips || []).includes(info.ip)) write.append = { ...(write.append || {}), ips: [info.ip] };

  let action = null;
  if (p.maxViolations && total >= p.maxViolations && violations) {
    if (p.violationAction === 'lock') {
      data['integrity.locked'] = true;
      action = 'locked';
    } else if (p.violationAction === 'submit') action = 'submit';
    else data['integrity.flagged'] = true;
  }
  await ctx.db.commit([write]);

  if (action === 'submit') {
    const bundle = await loadBundle(ctx, att.assessmentId);
    const fresh = await ctx.db.get(`studentResults/${id}`);
    await finalize(ctx, fresh, bundle, { reason: 'integrity', answers: null });
    return json({ ...base, closed: true, status: 'submitted', autoSubmitted: 'integrity', applied });
  }
  return json({ ...base, applied, late, violations: total, locked: action === 'locked' || !!att.integrity?.locked });
}

function sanitizeAnswer(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.slice(0, 20000);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => (typeof x === 'object' ? null : String(x).slice(0, 2000)));
  if (typeof v === 'object') {
    if (v.url) return { url: String(v.url).slice(0, 500), name: String(v.name || '').slice(0, 200), bytes: Number(v.bytes) || 0 };
    const out = {};
    for (const [k, x] of Object.entries(v).slice(0, 50)) out[String(k).slice(0, 40)] = String(x).slice(0, 200);
    return out;
  }
  return null;
}

/** Instant feedback mode: lock one answer, grade it, and say whether it was right. */
export async function checkAnswer(request, ctx, user, id) {
  const body = await request.json().catch(() => ({}));
  const att = await getAttempt(ctx, id, user);
  if (att.status !== 'in-progress') fail(409, 'CLOSED', 'This attempt is already submitted.');
  const bundle = await loadBundle(ctx, att.assessmentId);
  if (bundle.policy.display !== 'per-question') fail(400, 'NOT_ALLOWED', 'Instant feedback is off for this assessment.');
  const qid = String(body.qid || '');
  if (!(att.questionIds || []).includes(qid)) fail(400, 'BAD_QUESTION', 'Unknown question.');
  const q = bundle.questions.find((x) => x.id === qid);
  const existing = att.checked?.[qid];
  const answer = existing ? att.answers?.[qid] : sanitizeAnswer(body.value);
  const r = existing || G.gradeQuestion(q, bundle.keys[qid], answer, bundle.policy);
  if (!existing) {
    await ctx.db.commit([
      {
        path: `studentResults/${id}`,
        merge: true,
        data: { [`answers.${qid}`]: answer, [`answerSeq.${qid}`]: Number(body.seq) || 1e9, [`checked.${qid}`]: { status: r.status, score: r.score, max: r.max }, lastSeenAt: nowIso() },
        append: { lockedQuestions: [qid] },
      },
    ]);
  }
  return json({ qid, result: { status: r.status, score: r.score, max: r.max }, ...reveal(q, bundle.keys[qid], bundle.policy) });
}

/** Correct answers and explanations, but only as far as the assessment allows. */
function reveal(q, key, p) {
  const out = {};
  if (p.showCorrect && key) out.correct = describeKey(q, key);
  if (p.showFeedback && key?.explanation) out.explanation = key.explanation;
  return out;
}

export function describeKey(q, key) {
  const text = (id, list) => (list || []).find((o) => o.id === id)?.text ?? id;
  switch (q.type) {
    case 'multiple-choice':
    case 'multiple-select':
      return { optionIds: key.correct || [], text: (key.correct || []).map((id) => text(id, q.options)).join(', ') };
    case 'true-false':
      return { value: key.correct, text: key.correct === true ? 'True' : key.correct === false ? 'False' : '' };
    case 'fill-blank':
      return { blanks: (key.blanks || []).map((b) => b.accepted || []), text: (key.blanks || []).map((b) => (b.accepted || [])[0]).join(' · ') };
    case 'short-answer':
      return key.accepted ? { text: key.accepted.join(' / ') } : key.sampleAnswer ? { text: key.sampleAnswer } : null;
    case 'numeric':
      return { text: key.min !== undefined ? `${key.min} – ${key.max}` : `${key.value}${key.tolerance ? ` (± ${key.tolerance})` : ''}` };
    case 'matching':
      return { pairs: key.pairs || {}, text: Object.entries(key.pairs || {}).map(([p, c]) => `${text(p, q.prompts)} → ${text(c, q.choices)}`).join('; ') };
    case 'ordering':
      return { order: key.order || [], text: (key.order || []).map((id) => text(id, q.items)).join(' → ') };
    default:
      return key.sampleAnswer ? { text: key.sampleAnswer } : null;
  }
}

/**
 * Grades and closes an attempt. `answers` (from a final submit) replace saved ones when given.
 * Shared by submit, time-out, integrity auto-submit and admin force-submit.
 */
export async function finalize(ctx, att, bundle, { reason, answers, sealedAt, submitId, lateSync, offline } = {}) {
  const p = bundle.policy;
  const merged = { ...(att.answers || {}) };
  if (answers) {
    const allowed = new Set(att.questionIds);
    const locked = new Set(att.lockedQuestions || []);
    for (const [qid, v] of Object.entries(answers)) if (allowed.has(qid) && !locked.has(qid)) merged[qid] = sanitizeAnswer(v);
  }
  const questions = att.questionIds.map((id) => bundle.questions.find((q) => q.id === id)).filter(Boolean);
  const g = G.gradeAttempt(questions, bundle.keys, merged, { partialCredit: p.partialCredit, negativeMarking: p.negativeMarking, manualMarks: att.manualMarks || {} });
  const graded = g.complete;
  const percent = Math.round(g.percent);
  const passed = graded && percent >= p.passingScore;
  // Results are released straight away only if the assessment says so and nothing awaits a teacher.
  const released = graded && (p.display === 'per-question' || p.display === 'end');
  const startedMs = Date.parse(att.startedAt);
  const data = {
    status: 'submitted',
    gradingStatus: graded ? 'graded' : 'pending-review',
    released,
    releasedAt: released ? nowIso() : null,
    submittedAt: nowIso(),
    sealedAt: sealedAt || null,
    submitId: submitId || null,
    submitReason: reason || 'student',
    lateSync: !!lateSync,
    offlineSubmit: !!offline,
    answers: merged,
    grading: { items: g.items, earned: g.earned, possible: g.possible, percent: g.percent, pendingCount: g.pendingCount, counts: g.counts },
    score: percent,
    passed,
    earnedPoints: g.earned,
    totalPoints: g.possible,
    correctCount: g.counts.correct,
    timeTaken: Math.max(0, Math.round(((sealedAt ? Date.parse(sealedAt) : Date.now()) - startedMs) / 1000)),
  };
  await ctx.db.commit([{ path: `studentResults/${att.id}`, merge: true, data, updateTime: att._updateTime }]);
  const result = { ...att, ...data };
  if (graded && passed) await issueCertificateIfEligible(ctx, result, bundle.assessment).catch((e) => console.error('certificate', e));
  return result;
}

export async function submitAttempt(request, ctx, user, id) {
  const body = await request.json().catch(() => ({}));
  const att = await getAttempt(ctx, id, user);
  if (att.status !== 'in-progress') {
    // Retries of a submit that already went through get the same answer.
    if (att.status === 'submitted') return json({ ok: true, alreadySubmitted: true, ...studentView(att, policyOf((await ctx.db.get(`assessments/${att.assessmentId}`)) || {})) });
    fail(409, 'CLOSED', 'This attempt is closed.');
  }
  const bundle = await loadBundle(ctx, att.assessmentId);
  const p = bundle.policy;
  const deadline = deadlineOf(att);
  const graceMs = p.graceMin * 60000;
  const sealedAt = body.sealedAt && !Number.isNaN(Date.parse(body.sealedAt)) ? new Date(Math.min(Date.parse(body.sealedAt), Date.now())).toISOString() : null;
  let answers = body.answers && typeof body.answers === 'object' ? body.answers : null;
  let lateSync = false;
  if (Date.now() > deadline + graceMs) {
    // Arrived late. Accept the sealed answers only if they were sealed in time and uploaded within the late-sync window.
    const sealedOk = sealedAt && Date.parse(sealedAt) <= deadline + graceMs && Date.now() <= deadline + ctx.lateSyncHours * 3600_000;
    if (sealedOk) lateSync = true;
    else answers = null; // fall back to what the server saved before the deadline
  }
  if (att.integrity?.locked) answers = null;
  const fresh = await finalize(ctx, att, bundle, { reason: body.reason === 'time' ? 'time' : 'student', answers, sealedAt, submitId: String(body.submitId || ''), lateSync, offline: !!body.offline });
  return json({ ok: true, ...studentView(fresh, p) });
}

/** What a student may see about their attempt, given the release policy. */
export function studentView(att, p, bundle) {
  const base = {
    id: att.id,
    assessmentId: att.assessmentId,
    assessmentTitle: att.assessmentTitle,
    attemptNumber: att.attemptNumber,
    status: att.status,
    gradingStatus: att.gradingStatus || null,
    released: !!att.released,
    startedAt: att.startedAt,
    submittedAt: att.submittedAt || null,
    deadline: att.deadline || null,
    timeTaken: att.timeTaken || null,
    lateSync: !!att.lateSync,
    submitReason: att.submitReason || null,
    certificateId: att.certificateId || null,
  };
  if (!att.released) return base;
  if (p.showScore) Object.assign(base, { score: att.score, passed: att.passed, earnedPoints: att.earnedPoints, totalPoints: att.totalPoints, passingScore: p.passingScore, counts: att.grading?.counts });
  if (bundle) {
    base.review = att.questionIds
      .map((qid) => {
        const q = bundle.questions.find((x) => x.id === qid);
        if (!q) return null;
        const item = att.grading?.items?.[qid] || {};
        const row = { question: G.publicQuestion(q), answer: att.answers?.[qid] ?? null, status: item.status || 'unanswered', comment: att.manualMarks?.[qid]?.comment || '' };
        if (p.showScore) Object.assign(row, { score: item.score, max: item.max });
        Object.assign(row, reveal(q, bundle.keys[qid], p));
        return row;
      })
      .filter(Boolean);
  }
  return base;
}

export async function myAttempts(request, ctx, user) {
  const [mine, legacy] = await Promise.all([
    ctx.db.query('studentResults', [['studentUid', '==', user.sub]]),
    ctx.db.query('studentResults', [['studentId', '==', user.sid]]),
  ]);
  const seen = new Set();
  const rows = [...mine, ...legacy].filter((r) => !seen.has(r.id) && seen.add(r.id));
  const ids = [...new Set(rows.map((r) => r.assessmentId))];
  const assessments = await ctx.db.getAll(ids.map((id) => `assessments/${id}`));
  const list = rows.map((r) => {
    const a = assessments.get(`assessments/${r.assessmentId}`) || {};
    if (r.version !== 2) {
      // Attempts from the old system: shown as they were recorded.
      return { id: r.id, assessmentId: r.assessmentId, assessmentTitle: r.assessmentTitle || a.title || 'Assessment', attemptNumber: r.attemptNumber || 1, status: r.status === 'in-progress' ? 'abandoned' : 'submitted', released: true, legacy: true, score: r.score ?? null, passed: !!r.passed, submittedAt: r.submittedAt || null };
    }
    return studentView(r, policyOf(a));
  });
  list.sort((x, y) => String(y.submittedAt || y.startedAt || '').localeCompare(String(x.submittedAt || x.startedAt || '')));
  return json({ attempts: list });
}

export async function myAttempt(request, ctx, user, id) {
  const att = await ctx.db.get(`studentResults/${id}`);
  if (!att) fail(404, 'NOT_FOUND', 'Result not found.');
  if (att.studentUid !== user.sub && att.studentId !== user.sid) fail(403, 'NOT_YOURS', 'This result belongs to someone else.');
  if (att.version !== 2) return json({ id: att.id, legacy: true, assessmentTitle: att.assessmentTitle, score: att.score ?? null, passed: !!att.passed, submittedAt: att.submittedAt || null, released: true });
  const bundle = att.released ? await loadBundle(ctx, att.assessmentId) : null;
  const assessment = bundle ? bundle.assessment : await ctx.db.get(`assessments/${att.assessmentId}`);
  return json(studentView(att, policyOf(assessment || {}), bundle));
}
