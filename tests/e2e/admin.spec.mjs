// Admin journey in a real browser: build an assessment with the question builder, publish it, let a
// student sit it, mark the written answer in the marking queue, upgrade old-format questions, add a
// student and issue a certificate by hand.
import { test, expect, adminLogin } from './fixtures.mjs';
import { api, clearAll, createAdmin, get, list, put, signInWithCustomToken } from '../integration/helpers.mjs';

const shots = 'test-results/screens';

test.beforeAll(async () => {
  await clearAll();
  await createAdmin('teacher@dbi.test', 'Teacher-pass-1');
  await put('users/legacy7', { studentId: 'DBI-25-201', firstName: 'Yaw', lastName: 'Asante', password: 'DBI#7201', status: 'active' });
  // An assessment made with the old builder: the key is text with stray spaces and capitals, and
  // the true/false question carries the old default.
  await put('assessments/oldQuiz', { title: 'Old quiz', status: 'draft', department: 'Digital Skills' });
  await put('questions/old1', { assessmentId: 'oldQuiz', type: 'multiple-choice', text: 'Brain of the computer?', options: ['Monitor', ' CPU ', 'Mouse'], correctAnswer: 'cpu' });
  await put('questions/old2', { assessmentId: 'oldQuiz', type: 'true-false', text: 'A mouse is an output device.', correctAnswer: 'False' });
});

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|Could not reach Cloud Firestore/.test(m.text()) && console.log('BROWSER', m.text()));
});

async function studentToken(id, pw) {
  const r = await api('POST', '/auth/student-login', { body: { studentId: id, password: pw } });
  expect(r.status, JSON.stringify(r)).toBe(200);
  return signInWithCustomToken(r.token);
}

test('admin builds, publishes, marks and releases an assessment', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop run covers the admin journey');
  await adminLogin(page, 'teacher@dbi.test', 'Teacher-pass-1');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await page.screenshot({ path: `${shots}/a01-dashboard.png`, fullPage: true });

  // Create the assessment.
  await page.goto('/admin/assessments.html');
  await page.getByRole('button', { name: 'New assessment' }).click();
  await page.getByLabel('Title').fill('ICT Basics Test');
  await page.getByRole('tab', { name: 'Security' }).click();
  await page.screenshot({ path: `${shots}/a02-settings.png` });
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/questions\.html\?a=/);
  const aid = new URL(page.url()).searchParams.get('a');

  // Multiple choice.
  await page.getByRole('button', { name: 'Add question' }).first().click();
  await page.getByLabel('Question', { exact: true }).fill('Which part is the brain of the computer?');
  for (const [i, t] of ['Monitor', 'CPU', 'Mouse', 'Speaker'].entries()) await page.getByLabel(`Option ${'ABCD'[i]}`).fill(t);
  await page.getByLabel('Correct answer').nth(1).check();
  await page.getByRole('button', { name: 'Save & add another' }).click();

  // True / false: nothing is pre-selected, so the teacher must choose.
  await page.getByLabel('Question type').selectOption('true-false');
  await page.getByLabel('Question', { exact: true }).fill('RAM keeps files when the computer is off.');
  await page.getByRole('button', { name: 'Save & add another' }).click();
  await expect(page.getByText('Choose True or False as the correct answer.')).toBeVisible();
  await page.getByRole('radio', { name: 'False' }).check();
  await page.getByRole('button', { name: 'Save & add another' }).click();

  // Short answer with automatic marking, checked with "Test the answer key".
  await page.getByLabel('Question type').selectOption('short-answer');
  await page.getByLabel('Question', { exact: true }).fill('What does CPU stand for?');
  await page.getByLabel('How is it marked?').selectOption('exact');
  await page.getByLabel('Accepted answers / keywords (one per line)').fill('Central Processing Unit');
  await page.locator('#try_in').fill('  central processing unit. ');
  await expect(page.locator('#try_out')).toContainText('Correct');
  await page.locator('#try_in').fill('Central Processor');
  await expect(page.locator('#try_out')).toContainText('Teacher marks');
  await page.screenshot({ path: `${shots}/a03-builder.png` });
  await page.getByRole('button', { name: 'Save & add another' }).click();

  // Essay: always waits for a teacher.
  await page.getByLabel('Question type').selectOption('essay');
  await page.getByLabel('Question', { exact: true }).fill('Explain why backups matter.');
  await page.getByLabel('Marks').fill('3');
  await page.getByLabel('Marking guide (rubric) for teachers').fill('1 mark each: losing work, example, clear writing');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.qcard-admin')).toHaveCount(4);
  await page.screenshot({ path: `${shots}/a04-questions.png`, fullPage: true });

  // Keys are stored apart from the questions.
  const keys = await list('questionKeys');
  expect(keys.filter((k) => k.assessmentId === aid)).toHaveLength(4);

  // Publish.
  await page.goto('/admin/assessments.html');
  const row = page.getByRole('row', { name: /ICT Basics Test/ });
  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(row.locator('.badge', { hasText: 'Published' })).toBeVisible();

  // A student sits it (through the API, as the player would).
  const t = await studentToken('DBI-25-201', 'DBI#7201');
  const pkg = await api('POST', '/attempts/start', { token: t, body: { assessmentId: aid, sessionId: 'p1' } });
  expect(pkg.status, JSON.stringify(pkg)).toBe(200);
  const q = Object.fromEntries(pkg.questions.map((x) => [x.type, x]));
  const ops = [
    { qid: q['multiple-choice'].id, value: q['multiple-choice'].options.find((o) => o.text === 'CPU').id, seq: 1 },
    { qid: q['true-false'].id, value: false, seq: 1 },
    { qid: q['short-answer'].id, value: 'Central Processor', seq: 1 },
    { qid: q.essay.id, value: 'If the laptop is stolen you lose your work, so keep a copy in the cloud.', seq: 1 },
  ];
  await api('POST', `/attempts/${pkg.attempt.id}/sync`, { token: t, body: { sessionId: 'p1', ops } });
  const sub = await api('POST', `/attempts/${pkg.attempt.id}/submit`, { token: t, body: { sessionId: 'p1', submitId: 'x1' } });
  expect(sub.status).toBe(200);
  let att = await get(`studentResults/${pkg.attempt.id}`);
  expect(att.gradingStatus).toBe('pending-review');
  expect(att.grading.items[q['short-answer'].id].status).toBe('pending');
  expect(att.released).toBe(false);

  // Mark both waiting answers in the marking queue.
  await page.goto(`/admin/results.html?a=${aid}&view=queue`);
  await expect(page.getByRole('heading', { name: /Q3 · 1 to mark/ })).toBeVisible();
  await page.screenshot({ path: `${shots}/a05-queue.png`, fullPage: true });
  await page.getByLabel('Mark (out of 1)').fill('1');
  await page.getByRole('button', { name: 'Save marks for Q3' }).click();
  await expect(page.getByRole('heading', { name: /Q4 · 1 to mark/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Q3 ·/ })).toHaveCount(0);
  await page.getByLabel('Mark (out of 3)').fill('2');
  await page.getByLabel('Comment for the student (optional)').fill('Good example. Explain more.');
  await page.getByRole('button', { name: 'Save marks for Q4' }).click();
  await expect(page.getByText('Nothing to mark for this assessment.')).toBeVisible();

  att = await get(`studentResults/${pkg.attempt.id}`);
  expect(att.gradingStatus).toBe('graded');
  expect(att.score).toBe(83); // 5 of 6 marks
  expect(att.released).toBe(true);

  // The attempt panel shows answers, keys and the integrity log.
  await page.getByRole('tab', { name: 'Results' }).click();
  await page.getByRole('link', { name: 'Yaw Asante' }).click();
  await expect(page.getByText('Integrity log')).toBeVisible();
  await expect(page.getByText('Good example. Explain more.')).toBeVisible();
  await page.screenshot({ path: `${shots}/a06-attempt.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Question analysis' }).click();
  await expect(page.getByText('Score spread')).toBeVisible();

  // The student sees the released result with the comment.
  const mine = await api('GET', `/me/attempts/${pkg.attempt.id}`, { token: t });
  expect(mine.score).toBe(83);
});

test('old questions are upgraded so right answers are no longer marked wrong', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop only');
  await adminLogin(page, 'teacher@dbi.test', 'Teacher-pass-1');
  await page.goto('/admin/questions.html?a=oldQuiz');
  await expect(page.getByText(/2 questions need checking/)).toBeVisible();
  await page.getByRole('button', { name: 'Check answer keys' }).click();
  await page.screenshot({ path: `${shots}/a07-health.png` });
  await page.getByRole('button', { name: /Upgrade 2 question/ }).click();
  await expect(page.getByText(/Confirm the answer/)).toBeVisible();
  const k1 = await get('questionKeys/old1');
  const q1 = await get('questions/old1');
  expect(q1.version).toBe(2);
  expect(q1.correctAnswer).toBeUndefined();
  expect(k1.correct).toEqual([q1.options.find((o) => o.text.trim() === 'CPU').id]);
  expect((await get('questionKeys/old2')).correct).toBe(false);
});

test('admin adds a student and issues a certificate by hand', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop only');
  await adminLogin(page, 'teacher@dbi.test', 'Teacher-pass-1');
  await page.goto('/admin/students.html');
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Student ID').fill('dbi-25-300');
  await page.getByLabel('First name').fill('Akosua');
  await page.getByLabel('Last name').fill('Darko');
  await page.getByLabel('Password').fill('Secret-300');
  await page.getByRole('button', { name: 'Add student' }).last().click();
  await expect(page.getByText('Student added')).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('Akosua Darko')).toBeVisible();
  await studentToken('DBI-25-300', 'Secret-300');
  expect((await get('credentials/stu_DBI-25-300')).hash).toMatch(/^pbkdf2\$/);

  await page.goto('/admin/certificates.html');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Issue certificate' }).click();
    await page.getByLabel('Student ID').fill('DBI-25-300');
    await page.getByLabel('For (programme, workshop or test)').fill('Web Design Workshop');
    await page.getByRole('button', { name: 'Issue', exact: true }).click();
    await expect(page.getByText(/Issued DBI-DS-\d\d-CC00\d/)).toBeVisible();
  }
  const certs = (await list('certificates')).map((c) => c.certificateId).sort();
  expect(new Set(certs).size).toBe(certs.length);
  await page.screenshot({ path: `${shots}/a08-certificates.png`, fullPage: true });
});

test('admin pages work on a phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout check');
  await adminLogin(page, 'teacher@dbi.test', 'Teacher-pass-1');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'Results & marking' })).toBeVisible();
  await page.screenshot({ path: `${shots}/a09-phone-menu.png` });
  await page.getByRole('link', { name: 'Questions' }).click();
  await expect(page.locator('.qcard-admin').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${shots}/a10-phone-questions.png`, fullPage: true });
});
