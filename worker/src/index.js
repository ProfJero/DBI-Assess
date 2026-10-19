// DBI Assess API — the trusted server for grading, timing, attempts, integrity and uploads.
import { HttpError, corsHeaders, fail, getContext, json, requireAdmin, requireStudent, requireUser } from './context.js';
import { changePassword, studentLogin } from './auth.js';
import { checkAnswer, myAttempt, myAttempts, startAttempt, submitAttempt, syncAttempt } from './exam.js';
import { adminAttempt, attemptAction, importRegistry, markAttempt, regradeAssessment, securePasswords, setStudentPassword } from './admin.js';
import { sha1Hex } from './google.js';
import { issueManualCertificate } from './certificates.js';
import { audit } from './admin.js';

async function signUpload(request, ctx) {
  const env = ctx.env;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) fail(501, 'NO_STORAGE', 'File uploads are not set up yet.');
  const user = await requireUser(request, ctx);
  const body = await request.json().catch(() => ({}));
  let folder;
  let formats = 'jpg,jpeg,png,webp,gif,pdf';
  if (body.kind === 'answer') {
    if (user.role !== 'student') fail(403, 'NOT_STUDENT', 'Only students upload answers.');
    const att = await ctx.db.get(`studentResults/${String(body.attemptId || '')}`);
    if (!att || att.studentUid !== user.sub || att.status !== 'in-progress') fail(403, 'NOT_ALLOWED', 'You can only upload to your own open attempt.');
    folder = `dbi-assess/answers/${att.assessmentId}/${att.id}`;
    formats = 'jpg,jpeg,png,webp,pdf,doc,docx,ppt,pptx,xls,xlsx,txt,zip,py,js,html,css';
  } else {
    if (!(await ctx.db.get(`admins/${user.sub}`))) fail(403, 'NOT_ADMIN', 'Only administrators upload question media.');
    folder = 'dbi-assess/questions';
  }
  const params = { allowed_formats: formats, folder, timestamp: String(Math.floor(Date.now() / 1000)) };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return json({ cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, signature: await sha1Hex(toSign + env.CLOUDINARY_API_SECRET), ...params });
}

/** Public certificate check: only what a verifier needs, never the student's contact details. */
async function verifyCertificate(ctx, serial) {
  const id = String(serial).trim().toUpperCase();
  const rows = await ctx.db.query('certificates', [['certificateId', '==', id]], { limit: 1 });
  const c = rows[0];
  if (!c || c.isTemplate || !['issued', 'revoked'].includes(c.status)) return json({ valid: false }, 404);
  return json({
    valid: c.status === 'issued',
    status: c.status,
    certificateId: c.certificateId,
    name: `${c.studentFirstName || ''} ${c.studentLastName || ''}`.trim(),
    assessmentTitle: c.assessmentTitle || c.eventName || '',
    department: c.department || '',
    grade: c.grade || '',
    type: c.type || '',
    issuedAt: c.issuedAt || null,
  });
}

async function route(request, env) {
  const ctx = getContext(env);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = (re) => path.match(re);
  const post = request.method === 'POST';
  let r;

  if (path === '/' || path === '/health') return json({ ok: true, service: 'dbi-assess', time: new Date().toISOString() });
  if (request.method === 'GET' && (r = m(/^\/verify\/([\w-]+)$/))) return verifyCertificate(ctx, r[1]);
  if (post && path === '/auth/student-login') return studentLogin(request, ctx);
  if (post && path === '/auth/change-password') return changePassword(request, ctx, await requireStudent(request, ctx));
  if (post && path === '/media/sign') return signUpload(request, ctx);

  // Student
  if (post && path === '/attempts/start') return startAttempt(request, ctx, await requireStudent(request, ctx));
  if (post && (r = m(/^\/attempts\/([\w-]+)\/sync$/))) return syncAttempt(request, ctx, await requireStudent(request, ctx), r[1]);
  if (post && (r = m(/^\/attempts\/([\w-]+)\/check$/))) return checkAnswer(request, ctx, await requireStudent(request, ctx), r[1]);
  if (post && (r = m(/^\/attempts\/([\w-]+)\/submit$/))) return submitAttempt(request, ctx, await requireStudent(request, ctx), r[1]);
  if (request.method === 'GET' && path === '/me/attempts') return myAttempts(request, ctx, await requireStudent(request, ctx));
  if (request.method === 'GET' && (r = m(/^\/me\/attempts\/([\w-]+)$/))) return myAttempt(request, ctx, await requireStudent(request, ctx), r[1]);

  // Admin
  if (request.method === 'GET' && (r = m(/^\/admin\/attempts\/([\w-]+)$/))) return adminAttempt(request, ctx, await requireAdmin(request, ctx), r[1]);
  if (post && (r = m(/^\/admin\/attempts\/([\w-]+)\/mark$/))) return markAttempt(request, ctx, await requireAdmin(request, ctx), r[1]);
  if (post && (r = m(/^\/admin\/attempts\/([\w-]+)\/action$/))) return attemptAction(request, ctx, await requireAdmin(request, ctx), r[1]);
  if (post && (r = m(/^\/admin\/assessments\/([\w-]+)\/regrade$/))) return regradeAssessment(request, ctx, await requireAdmin(request, ctx), r[1]);
  if (post && path === '/admin/students/password') return setStudentPassword(request, ctx, await requireAdmin(request, ctx));
  if (post && path === '/admin/students/secure-passwords') return securePasswords(request, ctx, await requireAdmin(request, ctx));
  if (post && path === '/admin/certificates/issue') {
    const admin = await requireAdmin(request, ctx);
    const out = await issueManualCertificate(ctx, admin, await request.json().catch(() => ({})));
    if (out.error) fail(400, 'BAD_REQUEST', out.error);
    await audit(ctx, admin, 'issue-certificate', out.certificateId, {});
    return json(out);
  }
  if (post && path === '/admin/students/import') return importRegistry(request, ctx, await requireAdmin(request, ctx));

  fail(404, 'NOT_FOUND', 'Not found.');
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(request, env);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code, ...(e.extra || {}) }, e.status, cors);
      console.error(e && e.stack ? e.stack : e);
      return json({ error: 'Something went wrong on the server. Your answers are safe on your device; please try again.', code: 'SERVER' }, 500, cors);
    }
  },
};
