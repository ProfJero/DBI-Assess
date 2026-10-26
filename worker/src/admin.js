// Admin actions that must stay consistent with grading: manual marks, release, regrade,
// attempt control, student passwords and one-off data upgrades.
import G from '../../DBI Assess/shared/grading.js';
import { loadBundle } from './assessments.js';
import { fail, json, nowIso } from './context.js';
import { finalize, studentView } from './exam.js';
import { issueCertificateIfEligible } from './certificates.js';
import { hashPassword } from './google.js';
import { normaliseStudentId, profileFrom, studentUid } from './auth.js';

async function loadAttempt(ctx, id) {
  const att = await ctx.db.get(`studentResults/${id}`);
  if (!att) fail(404, 'NOT_FOUND', 'Attempt not found.');
  if (att.version !== 2) fail(400, 'LEGACY', 'This attempt was recorded by the old system and cannot be re-marked.');
  return att;
}

/** Re-totals an attempt from its answers, keys and manual marks, and releases it if the policy allows. */
async function regradeOne(ctx, att, bundle, { release, by } = {}) {
  const p = bundle.policy;
  const questions = att.questionIds.map((id) => bundle.questions.find((q) => q.id === id)).filter(Boolean);
  const g = G.gradeAttempt(questions, bundle.keys, att.answers || {}, { partialCredit: p.partialCredit, negativeMarking: p.negativeMarking, manualMarks: att.manualMarks || {} });
  const percent = Math.round(g.percent);
  const graded = g.complete;
  let released = !!att.released;
  if (release === true) released = true;
  else if (release === false) released = false;
  else if (graded && !att.released && (p.display === 'per-question' || p.display === 'end')) released = true;
  const data = {
    grading: { items: g.items, earned: g.earned, possible: g.possible, percent: g.percent, pendingCount: g.pendingCount, counts: g.counts },
    gradingStatus: graded ? 'graded' : 'pending-review',
    score: percent,
    passed: graded && percent >= p.passingScore,
    earnedPoints: g.earned,
    totalPoints: g.possible,
    correctCount: g.counts.correct,
    released,
    releasedAt: released && !att.released ? nowIso() : att.releasedAt || null,
    gradedAt: graded ? nowIso() : null,
    gradedBy: by || null,
  };
  await ctx.db.commit([{ path: `studentResults/${att.id}`, merge: true, data }]);
  const out = { ...att, ...data };
  if (graded && out.passed) await issueCertificateIfEligible(ctx, out, bundle.assessment).catch((e) => console.error('certificate', e));
  return out;
}

export async function markAttempt(request, ctx, admin, id) {
  const body = await request.json().catch(() => ({}));
  const att = await loadAttempt(ctx, id);
  if (att.status === 'in-progress') fail(409, 'IN_PROGRESS', 'The student is still taking this attempt.');
  const bundle = await loadBundle(ctx, att.assessmentId);
  const marks = { ...(att.manualMarks || {}) };
  for (const [qid, m] of Object.entries(body.marks || {})) {
    if (!att.questionIds.includes(qid)) continue;
    const q = bundle.questions.find((x) => x.id === qid);
    if (m === null) {
      delete marks[qid];
      continue;
    }
    const score = Math.max(-(q?.points || 1), Math.min(q?.points || 1, Number(m.score)));
    if (Number.isNaN(score)) fail(400, 'BAD_SCORE', 'Enter a number for the mark.');
    marks[qid] = { score, comment: String(m.comment || '').slice(0, 2000), by: admin.admin.name || admin.email || admin.sub, at: nowIso() };
  }
  await ctx.db.commit([{ path: `studentResults/${id}`, merge: true, data: { manualMarks: marks } }]);
  const updated = await regradeOne(ctx, { ...att, manualMarks: marks }, bundle, { release: body.release, by: admin.email || admin.sub });
  await audit(ctx, admin, 'mark', id, { questions: Object.keys(body.marks || {}).length, release: body.release ?? null });
  return json({ ok: true, attempt: summarize(updated) });
}

function summarize(att) {
  return { id: att.id, score: att.score, passed: att.passed, gradingStatus: att.gradingStatus, released: att.released, grading: att.grading, manualMarks: att.manualMarks || {} };
}

export async function attemptAction(request, ctx, admin, id) {
  const body = await request.json().catch(() => ({}));
  const att = await loadAttempt(ctx, id);
  const action = String(body.action || '');
  let data = {};
  switch (action) {
    case 'unlock':
      data = { 'integrity.locked': false, 'integrity.unlockedBy': admin.email || admin.sub, 'integrity.unlockedAt': nowIso() };
      break;
    case 'extend': {
      const minutes = Math.max(1, Math.min(600, Number(body.minutes) || 10));
      data = { extraSeconds: (Number(att.extraSeconds) || 0) + minutes * 60 };
      break;
    }
    case 'release':
    case 'unrelease':
      if (att.status === 'in-progress') fail(409, 'IN_PROGRESS', 'The attempt is still in progress.');
      data = { released: action === 'release', releasedAt: action === 'release' ? nowIso() : null };
      break;
    case 'void':
      data = { status: 'void', voidedBy: admin.email || admin.sub, voidedAt: nowIso(), voidReason: String(body.reason || '').slice(0, 500), released: false };
      break;
    case 'restore':
      if (att.status !== 'void') fail(400, 'NOT_VOID', 'Only voided attempts can be restored.');
      data = { status: att.submittedAt ? 'submitted' : 'in-progress' };
      break;
    case 'force-submit': {
      if (att.status !== 'in-progress') fail(409, 'CLOSED', 'The attempt is not in progress.');
      const bundle = await loadBundle(ctx, att.assessmentId);
      const done = await finalize(ctx, att, bundle, { reason: 'admin', answers: null });
      await audit(ctx, admin, action, id, {});
      return json({ ok: true, attempt: summarize(done) });
    }
    default:
      fail(400, 'BAD_ACTION', 'Unknown action.');
  }
  await ctx.db.commit([{ path: `studentResults/${id}`, merge: true, data }]);
  await audit(ctx, admin, action, id, body.minutes ? { minutes: body.minutes } : {});
  return json({ ok: true });
}

/** After fixing a key, re-mark every finished attempt of an assessment. Optionally release all. */
export async function regradeAssessment(request, ctx, admin, assessmentId) {
  const body = await request.json().catch(() => ({}));
  const bundle = await loadBundle(ctx, assessmentId);
  if (!bundle) fail(404, 'NOT_FOUND', 'Assessment not found.');
  const rows = await ctx.db.query('studentResults', [['assessmentId', '==', assessmentId], ['version', '==', 2]]);
  let changed = 0;
  let released = 0;
  for (const att of rows) {
    if (att.status !== 'submitted') continue;
    const before = att.score;
    const out = await regradeOne(ctx, att, bundle, { release: body.release === true ? true : undefined, by: admin.email || admin.sub });
    if (out.score !== before) changed++;
    if (out.released && !att.released) released++;
  }
  await audit(ctx, admin, 'regrade', assessmentId, { attempts: rows.length, changed, released });
  return json({ ok: true, attempts: rows.length, changed, released });
}

/** Full attempt for the admin review screen, including keys. */
export async function adminAttempt(request, ctx, admin, id) {
  const att = await ctx.db.get(`studentResults/${id}`);
  if (!att) fail(404, 'NOT_FOUND', 'Attempt not found.');
  if (att.version !== 2) return json({ attempt: att, legacy: true });
  const bundle = await loadBundle(ctx, att.assessmentId);
  const questions = att.questionIds.map((qid) => {
    const q = bundle.questions.find((x) => x.id === qid);
    return q ? { question: q, key: bundle.keys[qid] || {} } : null;
  });
  return json({ attempt: att, questions: questions.filter(Boolean), policy: bundle.policy, studentView: studentView(att, bundle.policy, bundle) });
}

// ---------------------------------------------------------------- students

export async function setStudentPassword(request, ctx, admin) {
  const body = await request.json().catch(() => ({}));
  const studentId = normaliseStudentId(body.studentId);
  const password = String(body.password || '');
  if (!studentId) fail(400, 'MISSING', 'Student ID is required.');
  if (password.length < 6) fail(400, 'WEAK', 'Passwords need at least 6 characters.');
  const uid = studentUid(studentId);
  const writes = [{ path: `credentials/${uid}`, data: { hash: await hashPassword(password), studentId, updatedAt: nowIso(), setBy: admin.email || admin.sub, mustChange: !!body.mustChange } }];
  if (body.profile) writes.push({ path: `users/${uid}`, merge: true, data: { ...profileFrom(body.profile, studentId), uid, updatedAt: nowIso() } });
  writes.push({ delete: `loginThrottle/${uid}` });
  await ctx.db.commit(writes);
  await audit(ctx, admin, 'set-password', uid, {});
  return json({ ok: true, uid });
}

/**
 * Replaces every plaintext password in `users` with a hash, and moves old random-id profiles
 * to users/stu_<studentId>.
 */
export async function securePasswords(request, ctx, admin) {
  const users = await ctx.db.query('users', []);
  let hashed = 0;
  let merged = 0;
  for (const u of users) {
    if (!u.studentId) continue;
    const sid = normaliseStudentId(u.studentId);
    const uid = studentUid(sid);
    const writes = [];
    if (u.password) {
      const existing = await ctx.db.get(`credentials/${uid}`);
      if (!existing) writes.push({ path: `credentials/${uid}`, data: { hash: await hashPassword(String(u.password)), studentId: sid, updatedAt: nowIso(), migratedFrom: 'users' } });
      writes.push({ path: u._name.split('/documents/')[1], merge: true, data: { password: null, passwordMigrated: true } });
      hashed++;
    }
    if (u.id !== uid) {
      writes.push({ path: `users/${uid}`, merge: true, data: { ...profileFrom(u, sid), uid, legacyDocId: u.id } });
      merged++;
    }
    if (writes.length) await ctx.db.commit(writes);
  }
  await audit(ctx, admin, 'secure-passwords', 'users', { hashed, merged });
  return json({ ok: true, hashed, merged });
}

/** Imports students from the main DBI registry (no passwords are copied; they're hashed on first sign-in). */
export async function importRegistry(request, ctx, admin) {
  if (!ctx.registry) fail(400, 'NO_REGISTRY', 'The student registry is not configured.');
  const regs = await ctx.registry.query('eventRegistrations', []);
  let imported = 0;
  for (let i = 0; i < regs.length; i += 200) {
    const writes = [];
    for (const r of regs.slice(i, i + 200)) {
      if (!r.studentId) continue;
      const sid = normaliseStudentId(r.studentId);
      writes.push({ path: `users/${studentUid(sid)}`, merge: true, data: { ...profileFrom(r, sid), uid: studentUid(sid), registryDocId: r.id, importedAt: nowIso() } });
      imported++;
    }
    if (writes.length) await ctx.db.commit(writes);
  }
  await audit(ctx, admin, 'import-registry', 'users', { imported });
  return json({ ok: true, imported });
}

export async function audit(ctx, admin, action, target, details) {
  try {
    await ctx.db.create('auditLogs', { action, target, details, by: admin.email || admin.sub, byUid: admin.sub, at: nowIso() });
  } catch (e) {
    console.warn('audit failed', e.message);
  }
}
