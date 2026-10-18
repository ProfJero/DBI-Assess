// Student journey in a real browser: sign in, take a test with every question type, lose the network
// mid-test, keep answering, submit offline, reconnect, and see the released result.
import { test, expect, studentLogin } from './fixtures.mjs';
import { clearAll, createAdmin, put, get, api } from '../integration/helpers.mjs';

const shots = 'test-results/screens';
let admin;

test.beforeAll(async () => {
  await clearAll();
  admin = await createAdmin('admin@dbi.test', 'Admin-pass-1');
  await put('users/legacy1', { studentId: 'DBI-25-101', firstName: 'Abena', lastName: 'Ofori', password: 'DBI#1101', status: 'active' });
  await put('assessments/allTypes', {
    title: 'Digital Skills Check', description: 'A short check of what you learned.', type: 'quiz', status: 'published', duration: 20, attempts: 1,
    passingScore: 50, answerDisplay: 'end', showEndScore: true, showEndCorrect: true, showEndFeedback: true, totalQuestions: 8, department: 'Digital Skills',
    antiCheat: { monitorTabs: true, disableCopy: true, disablePaste: true, warnings: 0 }, certificate: { enabled: true, minScore: 50 },
  });
  const Q = (id, order, data) => put(`questions/${id}`, { assessmentId: 'allTypes', order, points: 1, ...data });
  await Q('mc', 1, { type: 'multiple-choice', text: 'Which part is the **brain** of the computer?', options: [{ id: 'a', text: 'Monitor' }, { id: 'b', text: 'CPU' }, { id: 'c', text: 'Mouse' }] });
  await put('questionKeys/mc', { correct: ['b'], explanation: 'The CPU processes instructions.' });
  await Q('ms', 2, { type: 'multiple-select', text: 'Pick the input devices.', points: 2, options: [{ id: 'k', text: 'Keyboard' }, { id: 'p', text: 'Printer' }, { id: 'm', text: 'Mouse' }] });
  await put('questionKeys/ms', { correct: ['k', 'm'] });
  await Q('tf', 3, { type: 'true-false', text: 'RAM keeps your files when the computer is switched off.' });
  await put('questionKeys/tf', { correct: false });
  await Q('fb', 4, { type: 'fill-blank', text: 'HTML stands for ____ Markup Language.' });
  await put('questionKeys/fb', { blanks: [{ accepted: ['HyperText'] }] });
  await Q('nu', 5, { type: 'numeric', text: 'How many bits are in one byte?' });
  await put('questionKeys/nu', { value: 8 });
  await Q('ma', 6, { type: 'matching', text: 'Match each tag to what it does.', points: 2, prompts: [{ id: 'p1', text: '<h1>' }, { id: 'p2', text: '<img>' }], choices: [{ id: 'c1', text: 'Heading' }, { id: 'c2', text: 'Picture' }] });
  await put('questionKeys/ma', { pairs: { p1: 'c1', p2: 'c2' } });
  await Q('or', 7, { type: 'ordering', text: 'Put the steps in order.', items: [{ id: 's1', text: 'Turn on the computer' }, { id: 's2', text: 'Log in' }, { id: 's3', text: 'Open the browser' }] });
  await put('questionKeys/or', { order: ['s1', 's2', 's3'] });
  await Q('es', 8, { type: 'essay', text: 'Explain why we should back up our files.', points: 3, maxWordCount: 100 });
  await put('questionKeys/es', { rubric: 'Mentions losing work' });
});

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, e.stack && e.stack.split('\n').slice(0, 3).join(' | ')));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|Could not reach Cloud Firestore/.test(m.text()) && console.log('BROWSER', m.text()));
});

test('student takes a test, goes offline, submits offline and gets the result after reconnecting', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'phone', 'phone run covers the student journey');
  await studentLogin(page, 'dbi-25-101', 'DBI#1101');
  await expect(page.getByRole('heading', { name: /Abena/ })).toBeVisible();
  await page.screenshot({ path: `${shots}/s01-dashboard.png`, fullPage: true });

  // The service worker saves the app on the phone so the test still opens without internet.
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && (await caches.keys()).length > 0, null, { timeout: 30000 });
  await page.waitForFunction(async () => !!(await caches.match('/student/take-assessment.html', { ignoreSearch: true })), null, { timeout: 30000 });
  await page.getByRole('link', { name: 'Start' }).first().click();
  await expect(page.getByRole('heading', { name: 'Digital Skills Check' })).toBeVisible();
  await page.screenshot({ path: `${shots}/s02-intro.png`, fullPage: true });
  await page.getByRole('button', { name: 'Start test' }).click();

  // Q1 multiple choice
  await expect(page.getByText('Question 1')).toBeVisible();
  await page.getByText('CPU', { exact: true }).click();
  await page.screenshot({ path: `${shots}/s03-question.png`, fullPage: true });
  await page.getByRole('button', { name: 'Next' }).click();
  // Q2 multiple select (one right, partial credit)
  await page.getByText('Keyboard', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // The network drops: the student keeps going.
  await context.setOffline(true);
  await page.getByText('False', { exact: true }).click();
  await expect(page.locator('#sync')).toContainText(/Offline|Saved on this device/);
  await page.screenshot({ path: `${shots}/s04-offline.png`, fullPage: true });
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Blank 1').fill('hypertext');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Your answer').fill('8');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Match for <h1>').selectOption({ label: 'Heading' });
  await page.getByLabel('Match for <img>').selectOption({ label: 'Picture' });
  await page.getByRole('button', { name: 'Next' }).click();

  // Ordering: put the steps in order with the arrow buttons, whatever order they were shuffled into.
  for (let pass = 0; pass < 3; pass++) {
    const texts = await page.locator('.order-list li .txt').allTextContents();
    const want = ['Turn on the computer', 'Log in', 'Open the browser'];
    const i = texts.findIndex((t, k) => t !== want[k]);
    if (i === -1) break;
    const j = texts.indexOf(want[i]);
    for (let k = j; k > i; k--) await page.locator(`[data-up="${k}"]`).click();
  }
  if (await page.getByRole('button', { name: 'This order is correct' }).isVisible()) await page.getByRole('button', { name: 'This order is correct' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Reload while offline: the test comes back from the device, answers intact.
  await page.reload();
  // It reopens where the student was, with every answer still there.
  await expect(page.getByText('Question 8')).toBeVisible();
  await page.getByRole('button', { name: 'All questions' }).click();
  await expect(page.getByText('7 answered')).toBeVisible();
  await page.getByRole('button', { name: /Question 8/ }).click();

  await page.getByLabel('Your answer').fill('Backups stop you losing your work if the computer breaks or is stolen.');
  await expect(page.getByText(/13 words/)).toBeVisible();
  await page.getByRole('button', { name: 'Review & submit' }).click();
  await expect(page.getByText('You answered every question.')).toBeVisible();
  await page.getByRole('button', { name: 'Submit test' }).click();
  await expect(page.getByText('Test submitted on this device')).toBeVisible();
  await page.screenshot({ path: `${shots}/s05-sealed-offline.png`, fullPage: true });

  // Back online: the sealed test uploads by itself.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('heading', { name: 'Test submitted!' })).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${shots}/s06-submitted.png`, fullPage: true });

  // The essay needs a teacher: mark it through the Worker and check the student sees everything.
  const attemptId = 'allTypes_stu_DBI-25-101_1';
  const stored = await get(`studentResults/${attemptId}`);
  expect(stored.grading.items.mc.status).toBe('correct');
  expect(stored.grading.items.ms.status).toBe('partial');
  expect(stored.grading.items.tf.status).toBe('correct');
  expect(stored.grading.items.fb.status).toBe('correct');
  expect(stored.grading.items.nu.status).toBe('correct');
  expect(stored.grading.items.ma.status).toBe('correct');
  expect(stored.grading.items.or.status).toBe('correct');
  expect(stored.grading.items.es.status).toBe('pending');
  await api('POST', `/admin/attempts/${attemptId}/mark`, { token: admin.idToken, body: { marks: { es: { score: 3, comment: 'Clear and correct.' } } } });

  await page.goto('/student/results.html');
  await page.getByRole('link', { name: /Digital Skills Check/ }).click();
  await expect(page.locator('.score-ring')).toContainText('92%');
  await expect(page.getByText('Clear and correct.')).toBeVisible();
  await expect(page.getByText('Certificate earned')).toBeVisible();
  await page.screenshot({ path: `${shots}/s07-result.png`, fullPage: true });
  expect(page.errors).toEqual([]);
});
