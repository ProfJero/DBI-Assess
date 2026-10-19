// Student sign-in. Passwords are checked here, never in the browser, and stored only as PBKDF2 hashes.
import { customToken, hashPassword, timingSafeEqual, verifyPassword } from './google.js';
import { fail, json, nowIso } from './context.js';

const MAX_FAILURES = 8;
const LOCK_MINUTES = 10;

export const studentUid = (studentId) => `stu_${String(studentId).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_')}`;

export function normaliseStudentId(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Profile fields copied from the registry or the old users doc (never the password). */
export function profileFrom(src, studentId) {
  const pick = (k) => (src && src[k] != null ? String(src[k]) : '');
  return {
    studentId,
    firstName: pick('firstName'),
    lastName: pick('lastName'),
    email: pick('email'),
    phone: pick('phone'),
    school: pick('school'),
    community: pick('community'),
    educationLevel: pick('educationLevel'),
    gender: pick('gender'),
    department: pick('department') || pick('program'),
    status: pick('status') || 'active',
  };
}

async function findLegacyUser(ctx, studentId) {
  const rows = await ctx.db.query('users', [['studentId', '==', studentId]], { limit: 5 });
  return rows[0] || null;
}

async function findRegistration(ctx, studentId) {
  if (!ctx.registry) return null;
  try {
    const rows = await ctx.registry.query('eventRegistrations', [['studentId', '==', studentId]], { limit: 1 });
    return rows[0] || null;
  } catch (e) {
    console.warn('registry lookup failed', e.message);
    return null;
  }
}

export async function studentLogin(request, ctx) {
  const body = await request.json().catch(() => ({}));
  const studentId = normaliseStudentId(body.studentId);
  const password = String(body.password || '');
  if (!studentId || !password) fail(400, 'MISSING', 'Enter your Student ID and password.');
  const uid = studentUid(studentId);

  // Slow down guessing: lock the ID for a few minutes after repeated failures.
  const throttle = await ctx.db.get(`loginThrottle/${uid}`);
  if (throttle && throttle.lockedUntil && Date.parse(throttle.lockedUntil) > Date.now()) {
    const mins = Math.ceil((Date.parse(throttle.lockedUntil) - Date.now()) / 60000);
    fail(429, 'LOCKED', `Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? '' : 's'}, or ask your teacher to reset it.`);
  }

  const [cred, userDoc] = await Promise.all([ctx.db.get(`credentials/${uid}`), ctx.db.get(`users/${uid}`)]);
  let profile = userDoc;
  let ok = false;
  let upgradeFrom = null; // where a plaintext password was found, so it can be replaced by a hash

  if (cred && cred.hash) {
    ok = await verifyPassword(password, cred.hash);
  } else {
    // Older accounts: a users doc with a random id and a plaintext password, or only the registry entry.
    const legacy = userDoc && userDoc.password ? userDoc : await findLegacyUser(ctx, studentId);
    if (legacy && legacy.password) {
      ok = timingSafeEqual(legacy.password, password);
      upgradeFrom = { kind: 'users', doc: legacy };
      profile = profile || legacy;
    } else {
      const reg = await findRegistration(ctx, studentId);
      if (reg && reg.password) {
        ok = timingSafeEqual(String(reg.password), password);
        upgradeFrom = { kind: 'registry', doc: reg };
        profile = profile || reg;
      }
    }
  }

  if (!ok) {
    const failures = (throttle?.failures || 0) + 1;
    await ctx.db.set(`loginThrottle/${uid}`, {
      failures: failures >= MAX_FAILURES ? 0 : failures,
      lockedUntil: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
      lastFailureAt: nowIso(),
    });
    // Same message whether the ID or the password is wrong, so IDs can't be probed.
    fail(401, 'BAD_CREDENTIALS', 'Student ID or password is incorrect.');
  }

  const status = String(profile?.status || 'active').toLowerCase();
  if (['suspended', 'inactive', 'disabled', 'blocked'].includes(status)) fail(403, 'SUSPENDED', 'Your account is not active. Please contact DBI.');

  // First sign-in on the new system: create the profile at users/{uid} and replace any plaintext password.
  const writes = [];
  const fresh = profileFrom(profile, studentId);
  writes.push({
    path: `users/${uid}`,
    merge: true,
    data: { ...(userDoc ? {} : { ...fresh, createdAt: nowIso(), source: upgradeFrom?.kind || 'credentials' }), uid, studentId, lastLogin: nowIso() },
  });
  if (upgradeFrom) {
    writes.push({ path: `credentials/${uid}`, data: { hash: await hashPassword(password), studentId, updatedAt: nowIso(), migratedFrom: upgradeFrom.kind } });
    if (upgradeFrom.kind === 'users') {
      // Remove the plaintext password, and fold an old random-id doc into users/{uid}.
      writes.push({ path: upgradeFrom.doc._name.split('/documents/')[1], merge: true, data: { password: null, passwordMigrated: true } });
    }
  }
  if (throttle) writes.push({ delete: `loginThrottle/${uid}` });
  await ctx.db.commit(writes);

  const claims = { role: 'student', sid: studentId };
  const token = ctx.serviceAccount ? await customToken(ctx.serviceAccount, uid, claims) : unsignedToken(uid, claims);
  const name = `${fresh.firstName} ${fresh.lastName}`.trim();
  return json({ token, uid, studentId, name: name || studentId, firstName: fresh.firstName, lastName: fresh.lastName, mustChangePassword: !!cred?.mustChange });
}

/** The Auth emulator accepts unsigned custom tokens; used only in local tests. */
function unsignedToken(uid, claims) {
  const b = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  return `${b({ alg: 'none', typ: 'JWT' })}.${b({ uid, claims, iat: now, exp: now + 3600, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit' })}.`;
}

/** A signed-in student changes their own password. */
export async function changePassword(request, ctx, user) {
  const body = await request.json().catch(() => ({}));
  const next = String(body.newPassword || '');
  if (next.length < 6) fail(400, 'WEAK', 'Use at least 6 characters.');
  const cred = await ctx.db.get(`credentials/${user.sub}`);
  if (cred?.hash && !(await verifyPassword(String(body.currentPassword || ''), cred.hash))) fail(401, 'BAD_CREDENTIALS', 'Your current password is incorrect.');
  await ctx.db.set(`credentials/${user.sub}`, { hash: await hashPassword(next), studentId: user.sid, updatedAt: nowIso(), mustChange: false });
  return json({ ok: true });
}
