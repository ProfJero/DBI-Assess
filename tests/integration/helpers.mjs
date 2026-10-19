// Helpers for talking to the Firebase emulators and the local Worker in integration tests.
export const PROJECT = process.env.TEST_PROJECT || 'demo-dbi-assess';
export const REGISTRY = process.env.TEST_REGISTRY || 'demo-registry';
export const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
export const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
export const API = process.env.API_URL || 'http://127.0.0.1:8787';

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
}
function fromValue(v) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  return null;
}

const docUrl = (project, path) => `http://${FS}/v1/projects/${project}/databases/(default)/documents/${path}`;

export async function put(path, data, project = PROJECT) {
  const res = await fetch(docUrl(project, path), {
    method: 'PATCH',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error(`put ${path}: ${await res.text()}`);
}

export async function get(path, project = PROJECT, token = 'owner') {
  const res = await fetch(docUrl(project, path), { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) return { __status: res.status };
  const d = await res.json();
  return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromValue(v)]));
}

export async function list(collection, project = PROJECT) {
  const res = await fetch(docUrl(project, collection) + '?pageSize=300', { headers: { authorization: 'Bearer owner' } });
  const d = await res.json();
  return (d.documents || []).map((x) => ({ id: x.name.split('/').pop(), ...Object.fromEntries(Object.entries(x.fields || {}).map(([k, v]) => [k, fromValue(v)])) }));
}

export async function clearAll() {
  await fetch(`http://${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${FS}/emulator/v1/projects/${REGISTRY}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

export async function signInWithCustomToken(token) {
  const res = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, returnSecureToken: true }),
  });
  const d = await res.json();
  if (!d.idToken) throw new Error(`custom token sign-in failed: ${JSON.stringify(d)}`);
  return d.idToken;
}

export async function createAdmin(email, password) {
  const res = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await res.json();
  await put(`admins/${d.localId}`, { email, name: 'Test Admin', role: 'Super Admin' });
  return { uid: d.localId, idToken: d.idToken };
}

export async function api(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ...data, status: res.status, state: data.status };
}
