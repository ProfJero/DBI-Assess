// Shared request context: environment, Firestore clients, auth and HTTP helpers.
import { Firestore } from './firestore.js';
import { verifyIdToken } from './google.js';

export class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const fail = (status, code, message, extra) => {
  throw new HttpError(status, code, message, extra);
};

let cache = null;

/** Builds the per-isolate context once (Firestore clients keep their access token cached). */
export function getContext(env) {
  if (cache && cache.env === env) return cache;
  const serviceAccount = env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) : null;
  const projectId = env.FIREBASE_PROJECT_ID || serviceAccount?.project_id;
  const emulatorHost = env.FIRESTORE_EMULATOR_HOST || '';
  cache = {
    env,
    projectId,
    serviceAccount,
    emulator: !!emulatorHost,
    db: new Firestore({ projectId, serviceAccount, emulatorHost }),
    // The student registry in the main DBI project is read with its public web API key, as the old site did.
    registry: env.REGISTRY_PROJECT_ID
      ? new Firestore({ projectId: env.REGISTRY_PROJECT_ID, apiKey: env.REGISTRY_API_KEY, emulatorHost })
      : null,
    lateSyncHours: Number(env.LATE_SYNC_HOURS || 24),
  };
  return cache;
}

export async function requireUser(request, ctx) {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) fail(401, 'NOT_SIGNED_IN', 'Please sign in again.');
  try {
    return await verifyIdToken(token, ctx.projectId, { emulator: ctx.emulator });
  } catch {
    fail(401, 'NOT_SIGNED_IN', 'Your session has expired. Please sign in again.');
  }
}

export async function requireStudent(request, ctx) {
  const user = await requireUser(request, ctx);
  if (user.role !== 'student' || !user.sid) fail(403, 'NOT_STUDENT', 'Only students can do this.');
  return user;
}

export async function requireAdmin(request, ctx) {
  const user = await requireUser(request, ctx);
  const admin = await ctx.db.get(`admins/${user.sub}`);
  if (!admin) fail(403, 'NOT_ADMIN', 'Only administrators can do this.');
  return { ...user, admin };
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? origin || '*' : allowed[0] || '',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

export function clientInfo(request) {
  return {
    ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '',
    ua: (request.headers.get('user-agent') || '').slice(0, 200),
    country: request.headers.get('cf-ipcountry') || '',
  };
}

export const nowIso = () => new Date().toISOString();

export function toMillis(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.seconds) return v.seconds * 1000;
  // datetime-local strings with no zone ("2026-10-18T09:00") are Ghana time, which is UTC all year.
  const s = String(v);
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) || !/T\d\d:\d\d/.test(s) ? s : `${s}Z`);
  return Number.isNaN(t) ? null : t;
}
