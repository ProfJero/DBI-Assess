// End-to-end checks of the Worker against the Firebase emulators.
// Run with: npm run test:integration (starts the emulators and `wrangler dev`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, clearAll, createAdmin, get, list, put, REGISTRY, signInWithCustomToken } from './helpers.mjs';

const A = 'exam1';
let admin;

async function studentToken(studentId, password) {
  const r = await api('POST', '/auth/student-login', { body: { studentId, password } });
  assert.equal(r.status, 200, JSON.stringify(r));
  return signInWithCustomToken(r.token);
}

test.before(async () => {
  await clearAll();
  admin = await createAdmin('admin@dbi.test', 'Admin-pass-1');
  // A student in the old format: random doc id and a plaintext password.
  await put('users/oldRandomId1', { studentId: 'DBI-25-001', firstName: 'Ama', lastName: 'Mensah', email: 'ama@x.test', password: 'DBI#1001', status: 'active' });
  // A student who exists only in the main DBI registry.
  await put('eventRegistrations/r1', { studentId: 'DBI-25-002', firstName: 'Kofi', lastName: 'Boateng', password: 'DBI#2002', status: 'active' }, REGISTRY);
  await put('eventRegistrations/r2', { studentId: 'DBI-25-003', firstName: 'Esi', lastName: 'Owusu', password: 'DBI#3003', status: 'suspended' }, REGISTRY);

  await put(`assessments/${A}`, {
    title: 'Digital Skills Test', status: 'published', duration: 30, attempts: 1, passingScore: 50, answerDisplay: 'end',
    showEndScore: true, showEndCorrect: true, randomQuestions: true, randomOptions: true, department: 'Digital Skills',
    antiCheat: { warnings: 3, violationAction: 'lock', singleDevice: true }, certificate: { enabled: true, minScore: 50 },
  });
  await put(`assessmentSecrets/${A}`, { accessCode: 'GH2026' });
  // Questions saved by the old builder: keys are option text, true/false as ['True'].
  await put('questions/q1', { assessmentId: A, type: 'multiple-choice', text: 'Brain of the computer?', points: 2, options: ['CPU', 'Monitor', 'Mouse'], correctAnswer: ['CPU'] });
  await put('questions/q2', { assessmentId: A, type: 'true-false', text: 'RAM keeps data when off.', points: 1, correctAnswer: ['False'] });
  await put('questions/q3', { assessmentId: A, type: 'multiple-select', text: 'Input devices', points: 2, options: ['Keyboard', 'Printer', 'Mouse'], correctAnswer: ['Keyboard', 'Mouse'] });
  await put('questions/q4', { assessmentId: A, type: 'fill-blank', text: 'HTML stands for ____ Markup Language', points: 1, correctAnswer: ['HyperText', 'Hypertext'] });
  await put('questions/q5', { assessmentId: A, type: 'essay', text: 'Why are backups important?', points: 4, rubric: 'Mentions data loss' });
});

test('legacy plaintext password signs in once and is replaced by a hash', async () => {
  const bad = await api('POST', '/auth/student-login', { body: { studentId: 'dbi-25-001', password: 'wrong' } });
  assert.equal(bad.status, 401);
  assert.equal(bad.code, 'BAD_CREDENTIALS');
  await studentToken(' dbi-25-001 ', 'DBI#1001'); // IDs are case and space insensitive
  const old = await get('users/oldRandomId1');
  assert.equal(old.password, null, 'plaintext password removed');
  assert.ok((await get('credentials/stu_DBI-25-001')).hash.startsWith('pbkdf2$'));
  assert.equal((await get('users/stu_DBI-25-001')).firstName, 'Ama');
  await studentToken('DBI-25-001', 'DBI#1001'); // still works from the hash
});

test('students from the main registry can sign in; suspended ones cannot', async () => {
  await studentToken('DBI-25-002', 'DBI#2002');
  assert.equal((await get('users/stu_DBI-25-002')).lastName, 'Boateng');
  const s = await api('POST', '/auth/student-login', { body: { studentId: 'DBI-25-003', password: 'DBI#3003' } });
  assert.equal(s.status, 403);
});

test('repeated wrong passwords lock the ID for a while', async () => {
  for (let i = 0; i < 8; i++) await api('POST', '/auth/student-login', { body: { studentId: 'DBI-25-009', password: 'x' } });
  const r = await api('POST', '/auth/student-login', { body: { studentId: 'DBI-25-009', password: 'x' } });
  assert.equal(r.status, 429);
});

test('security rules keep keys, questions and results away from students', async () => {
  const t = await studentToken('DBI-25-001', 'DBI#1001');
  assert.equal((await get('questions/q1', undefined, t)).__status, 403);
  assert.equal((await get(`assessmentSecrets/${A}`, undefined, t)).__status, 403);
  assert.equal((await get('credentials/stu_DBI-25-001', undefined, t)).__status, 403);
  assert.equal((await get(`assessments/${A}`, undefined, t)).title, 'Digital Skills Test');
});

test('full exam: access code, no keys sent, sync, single device, submit, manual review, release, certificate', async () => {
  const t = await studentToken('DBI-25-001', 'DBI#1001');
  assert.equal((await api('POST', '/attempts/start', { token: t, body: { assessmentId: A, sessionId: 's1' } })).code, 'NEED_CODE');
  assert.equal((await api('POST', '/attempts/start', { token: t, body: { assessmentId: A, sessionId: 's1', accessCode: 'nope' } })).code, 'BAD_CODE');
  const pkg = await api('POST', '/attempts/start', { token: t, body: { assessmentId: A, sessionId: 's1', accessCode: 'gh2026' } });
  assert.equal(pkg.status, 200, JSON.stringify(pkg));
  assert.equal(pkg.questions.length, 5);
  const raw = JSON.stringify(pkg.questions);
  for (const leak of ['correctAnswer', 'rubric', 'Mentions data loss']) assert.ok(!raw.includes(leak), `package leaks ${leak}`);
  const byText = Object.fromEntries(pkg.questions.map((q) => [q.text, q]));
  const opt = (q, text) => byText[q].options.find((o) => o.text === text).id;
  const id = pkg.attempt.id;

  // Answers are sent as idempotent operations; an older seq never overwrites a newer one.
  const ops = [
    { qid: 'q1', value: opt('Brain of the computer?', 'CPU'), seq: 2 },
    { qid: 'q1', value: opt('Brain of the computer?', 'Mouse'), seq: 1 },
    { qid: 'q2', value: 'False', seq: 1 },
    { qid: 'q3', value: [opt('Input devices', 'Keyboard')], seq: 1 },
    { qid: 'q4', value: ['hypertext'], seq: 1 },
    { qid: 'q5', value: 'Backups protect you from losing your work when a computer breaks.', seq: 1 },
  ];
  let s = await api('POST', `/attempts/${id}/sync`, { token: t, body: { sessionId: 's1', ops, events: [{ id: 'e1', type: 'tab-hidden', at: new Date().toISOString() }] } });
  assert.equal(s.status, 200, JSON.stringify(s));
  assert.equal(s.applied, 5);
  s = await api('POST', `/attempts/${id}/sync`, { token: t, body: { sessionId: 's1', ops, events: [{ id: 'e1', type: 'tab-hidden' }] } });
  assert.equal(s.applied, 0, 'replayed operations are ignored');
  assert.equal(s.violations, 1, 'replayed events are not double counted');

  // A second device is refused while the first is active, unless the student moves the exam.
  const other = await api('POST', '/attempts/start', { token: t, body: { assessmentId: A, sessionId: 's2' } });
  assert.equal(other.code, 'ACTIVE_ELSEWHERE');
  const moved = await api('POST', '/attempts/start', { token: t, body: { assessmentId: A, sessionId: 's2', takeOver: true } });
  assert.equal(moved.attempt.id, id);
  assert.equal(moved.attempt.answers.q1, opt('Brain of the computer?', 'CPU'), 'resume keeps answers by question id');
  const stale = await api('POST', `/attempts/${id}/sync`, { token: t, body: { sessionId: 's1', ops: [] } });
  assert.equal(stale.replaced, true, 'the old device is told the exam moved');

  const sub = await api('POST', `/attempts/${id}/submit`, { token: t, body: { sessionId: 's2', submitId: 'sub1', answers: {} } });
  assert.equal(sub.status, 200, JSON.stringify(sub));
  assert.equal(sub.gradingStatus, 'pending-review', 'essay waits for a teacher');
  assert.equal(sub.released, false);
  assert.equal(sub.score, undefined, 'no score before release');
  const again = await api('POST', `/attempts/${id}/submit`, { token: t, body: { sessionId: 's2', submitId: 'sub1' } });
  assert.equal(again.alreadySubmitted, true, 'submitting twice is safe');

  const stored = await get(`studentResults/${id}`);
  // q1 2/2, q2 1/1, q3 partial 1/2, q4 1/1, essay pending → 5 of 10 auto marks.
  assert.equal(stored.grading.earned, 5);
  assert.equal(stored.grading.items.q5.status, 'pending');
  assert.equal(stored.grading.items.q3.status, 'partial');

  // The teacher marks the essay; the attempt is graded and released, and a certificate is issued.
  const mark = await api('POST', `/admin/attempts/${id}/mark`, { token: admin.idToken, body: { marks: { q5: { score: 3, comment: 'Good point about data loss.' } } } });
  assert.equal(mark.status, 200, JSON.stringify(mark));
  assert.equal(mark.attempt.score, 80);
  assert.equal(mark.attempt.released, true);
  const view = await api('GET', `/me/attempts/${id}`, { token: t });
  assert.equal(view.score, 80);
  assert.equal(view.review.length, 5);
  assert.ok(view.review.find((r) => r.question.id === 'q5').comment.includes('data loss'));
  assert.equal(view.review.find((r) => r.question.id === 'q1').correct.text, 'CPU');
  const certs = await list('certificates');
  assert.equal(certs.length, 1);
  assert.match(certs[0].certificateId, /^DBI-DS-\d\d-CC001$/);
  const verified = await api('GET', `/verify/${certs[0].certificateId}`);
  assert.equal(verified.valid, true);
  assert.equal(verified.name, 'Ama Mensah');
  assert.equal(verified.email, undefined, 'verification does not expose contact details');

  // Only one attempt was allowed.
  const second = await api('POST', '/attempts/start', { token: t, body: { assessmentId: A, sessionId: 's3', accessCode: 'GH2026' } });
  assert.equal(second.code, 'NO_ATTEMPTS');
});

test('violations past the limit lock the attempt until an admin unlocks it', async () => {
  await put('assessments/exam2', { title: 'Quiz 2', status: 'published', duration: 10, attempts: 2, answerDisplay: 'end', antiCheat: { warnings: 2, violationAction: 'lock' } });
  await put('questions/x1', { assessmentId: 'exam2', type: 'true-false', text: 'Sky is blue', correctAnswer: ['True'] });
  const t = await studentToken('DBI-25-002', 'DBI#2002');
  const pkg = await api('POST', '/attempts/start', { token: t, body: { assessmentId: 'exam2', sessionId: 'k1' } });
  const id = pkg.attempt.id;
  const r = await api('POST', `/attempts/${id}/sync`, { token: t, body: { sessionId: 'k1', events: [{ id: 'v1', type: 'tab-hidden' }, { id: 'v2', type: 'fullscreen-exit' }] } });
  assert.equal(r.locked, true);
  const blocked = await api('POST', `/attempts/${id}/sync`, { token: t, body: { sessionId: 'k1', ops: [{ qid: 'x1', value: 'True', seq: 1 }] } });
  assert.equal(blocked.applied, 0, 'answers are not accepted while locked');
  await api('POST', `/admin/attempts/${id}/action`, { token: admin.idToken, body: { action: 'unlock' } });
  const ok = await api('POST', `/attempts/${id}/sync`, { token: t, body: { sessionId: 'k1', ops: [{ qid: 'x1', value: 'True', seq: 1 }] } });
  assert.equal(ok.applied, 1);
  const sub = await api('POST', `/attempts/${id}/submit`, { token: t, body: { sessionId: 'k1', submitId: 'z' } });
  assert.equal(sub.score, 100);
  assert.equal(sub.released, true, 'fully auto-marked attempts are released at once when the policy is "end"');
});

test('an offline submission sealed before the deadline is accepted late and flagged', async () => {
  await put('assessments/exam3', { title: 'Timed', status: 'published', duration: 1, gracePeriod: 0, attempts: 1, answerDisplay: 'end' });
  await put('questions/y1', { assessmentId: 'exam3', type: 'true-false', text: 'Water is wet', correctAnswer: ['True'] });
  const t = await studentToken('DBI-25-002', 'DBI#2002');
  const pkg = await api('POST', '/attempts/start', { token: t, body: { assessmentId: 'exam3', sessionId: 'o1' } });
  const id = pkg.attempt.id;
  // Pretend the deadline has passed while the device was offline.
  await put(`studentResults/${id}`, { ...(await get(`studentResults/${id}`)), version: 2, deadline: new Date(Date.now() - 5 * 60000).toISOString(), startedAt: new Date(Date.now() - 6 * 60000).toISOString() });
  const sealedAt = new Date(Date.now() - 5.5 * 60000).toISOString();
  const sub = await api('POST', `/attempts/${id}/submit`, { token: t, body: { sessionId: 'o1', submitId: 'late1', sealedAt, offline: true, answers: { y1: 'True' } } });
  assert.equal(sub.status, 200, JSON.stringify(sub));
  assert.equal(sub.lateSync, true);
  assert.equal(sub.score, 100);
});

test('a submission sealed after the deadline only keeps answers saved in time', async () => {
  await put('assessments/exam4', { title: 'Timed 2', status: 'published', duration: 1, gracePeriod: 0, attempts: 1, answerDisplay: 'end' });
  await put('questions/z1', { assessmentId: 'exam4', type: 'true-false', text: 'Fire is cold', correctAnswer: ['False'] });
  const t = await studentToken('DBI-25-001', 'DBI#1001');
  const pkg = await api('POST', '/attempts/start', { token: t, body: { assessmentId: 'exam4', sessionId: 'p1' } });
  const id = pkg.attempt.id;
  await put(`studentResults/${id}`, { ...(await get(`studentResults/${id}`)), deadline: new Date(Date.now() - 5 * 60000).toISOString() });
  const sub = await api('POST', `/attempts/${id}/submit`, { token: t, body: { sessionId: 'p1', submitId: 'x', sealedAt: new Date().toISOString(), answers: { z1: 'False' } } });
  assert.equal(sub.score, 0, 'answers typed after time ran out are ignored');
});

test('admins can set a password; students can change their own', async () => {
  const r = await api('POST', '/admin/students/password', { token: admin.idToken, body: { studentId: 'DBI-25-010', password: 'Start#123', profile: { firstName: 'Yaw' } } });
  assert.equal(r.status, 200);
  const t = await studentToken('DBI-25-010', 'Start#123');
  assert.equal((await api('POST', '/auth/change-password', { token: t, body: { currentPassword: 'bad', newPassword: 'Newpass#1' } })).status, 401);
  assert.equal((await api('POST', '/auth/change-password', { token: t, body: { currentPassword: 'Start#123', newPassword: 'Newpass#1' } })).status, 200);
  await studentToken('DBI-25-010', 'Newpass#1');
  const notAdmin = await api('POST', '/admin/students/password', { token: t, body: { studentId: 'DBI-25-001', password: 'hacked1' } });
  assert.equal(notAdmin.status, 403);
});
