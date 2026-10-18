// Minimal Firestore REST client for the Worker, with plain-JSON conversion of Firestore values.
import { accessToken } from './google.js';

export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (v && v.__ts) return { timestampValue: v.__ts };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

export function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = toValue(v);
  return out;
}

export function fromValue(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue; // ISO string
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}

export function fromFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = fromValue(v);
  return out;
}

function docToObject(doc) {
  if (!doc || !doc.name) return null;
  return { id: doc.name.split('/').pop(), _name: doc.name, ...fromFields(doc.fields), _updateTime: doc.updateTime };
}

/** Marks a value as a server timestamp in writes. */
export const now = () => ({ __ts: new Date().toISOString() });

export class Firestore {
  constructor({ projectId, serviceAccount, emulatorHost, apiKey }) {
    this.projectId = projectId;
    this.sa = serviceAccount;
    this.emulatorHost = emulatorHost;
    this.apiKey = apiKey; // read-only, rules-checked access (used for the registrations project)
    const base = emulatorHost ? `http://${emulatorHost}` : 'https://firestore.googleapis.com';
    this.root = `projects/${projectId}/databases/(default)/documents`;
    this.base = `${base}/v1/${this.root}`;
  }

  async headers() {
    if (this.emulatorHost) return { authorization: 'Bearer owner', 'content-type': 'application/json' };
    if (this.sa) return { authorization: `Bearer ${await accessToken(this.sa)}`, 'content-type': 'application/json' };
    return { 'content-type': 'application/json' };
  }

  url(path, query = '') {
    const key = !this.sa && !this.emulatorHost && this.apiKey ? `${query ? '&' : '?'}key=${this.apiKey}` : '';
    return `${this.base}${path ? '/' + path : ''}${query}${key}`;
  }

  async req(method, url, body) {
    const res = await fetch(url, { method, headers: await this.headers(), body: body ? JSON.stringify(body) : undefined });
    if (res.status === 404 && method === 'GET') return null;
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`Firestore ${method} ${res.status}: ${text.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return text ? JSON.parse(text) : {};
  }

  async get(path) {
    return docToObject(await this.req('GET', this.url(path)));
  }

  /** Batch read; returns a Map path → doc (missing docs are absent). */
  async getAll(paths) {
    const out = new Map();
    if (!paths.length) return out;
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const res = await this.req('POST', this.url('', ':batchGet'), {
        documents: chunk.map((p) => `${this.root}/${p}`),
      });
      for (const r of res) if (r.found) out.set(r.found.name.split('/documents/')[1], docToObject(r.found));
    }
    return out;
  }

  /** Simple equality query on one collection: where = [[field, op, value], ...]. */
  async query(collection, where = [], { orderBy, limit } = {}) {
    const filters = where.map(([field, op, value]) => ({
      fieldFilter: { field: { fieldPath: field }, op: { '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', in: 'IN', 'array-contains': 'ARRAY_CONTAINS' }[op], value: toValue(value) },
    }));
    const structuredQuery = { from: [{ collectionId: collection }] };
    if (filters.length === 1) structuredQuery.where = filters[0];
    else if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters } };
    if (orderBy) structuredQuery.orderBy = [{ field: { fieldPath: orderBy[0] }, direction: orderBy[1] === 'desc' ? 'DESCENDING' : 'ASCENDING' }];
    if (limit) structuredQuery.limit = limit;
    const res = await this.req('POST', this.url('', ':runQuery'), { structuredQuery });
    return res.filter((r) => r.document).map((r) => docToObject(r.document));
  }

  /** Creates or overwrites fields. With `mask`, only the listed fields are written (a merge). */
  async set(path, data, { merge = false, mustExist, mustNotExist } = {}) {
    const params = [];
    if (merge) for (const k of Object.keys(data)) params.push(`updateMask.fieldPaths=${encodeURIComponent(k.includes('.') || /[^a-zA-Z0-9_]/.test(k) ? '`' + k + '`' : k)}`);
    if (mustExist) params.push('currentDocument.exists=true');
    if (mustNotExist) params.push('currentDocument.exists=false');
    const res = await this.req('PATCH', this.url(path, params.length ? `?${params.join('&')}` : ''), { fields: toFields(data) });
    return docToObject(res);
  }

  async create(collection, data, id) {
    if (id) return this.set(`${collection}/${id}`, data, { mustNotExist: true });
    const res = await this.req('POST', this.url(collection), { fields: toFields(data) });
    return docToObject(res);
  }

  async delete(path) {
    await this.req('DELETE', this.url(path));
  }

  /**
   * Atomic multi-document commit. Each write is one of:
   *   { path, data, merge?, exists?, updateTime?, increment?: {field: n}, append?: {field: [values]} }
   *   { delete: path }
   * With `merge`, only the fields in `data` are written (dotted paths like "answers.q1" allowed).
   * `updateTime` makes the commit fail if the document changed since it was read (optimistic transaction).
   */
  async commit(writes) {
    const quote = (k) => k.split('.').map((part) => (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part) ? part : '`' + part.replace(/`/g, '\\`') + '`')).join('.');
    const body = {
      writes: writes.map((w) => {
        if (w.delete) return { delete: `${this.root}/${w.delete}` };
        const out = {};
        if (w.data) {
          if (w.merge) {
            // Dotted keys address nested fields; build the nested document they describe.
            const fields = {};
            for (const [k, v] of Object.entries(w.data)) setPath(fields, k.split('.'), v);
            out.update = { name: `${this.root}/${w.path}`, fields: toFields(fields) };
            out.updateMask = { fieldPaths: Object.keys(w.data).map(quote) };
          } else {
            out.update = { name: `${this.root}/${w.path}`, fields: toFields(w.data) };
          }
        } else {
          out.update = { name: `${this.root}/${w.path}`, fields: {} };
          out.updateMask = { fieldPaths: [] };
        }
        const transforms = [];
        for (const [fieldPath, n] of Object.entries(w.increment || {})) transforms.push({ fieldPath: quote(fieldPath), increment: toValue(n) });
        for (const [fieldPath, vals] of Object.entries(w.append || {})) transforms.push({ fieldPath: quote(fieldPath), appendMissingElements: { values: vals.map(toValue) } });
        if (transforms.length) out.updateTransforms = transforms;
        if (w.exists === false) out.currentDocument = { exists: false };
        else if (w.exists === true) out.currentDocument = { exists: true };
        else if (w.updateTime) out.currentDocument = { updateTime: w.updateTime };
        return out;
      }),
    };
    return this.req('POST', `${this.base.replace(/\/documents$/, '')}/documents:commit`, body);
  }
}

function setPath(obj, parts, value) {
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] = o[parts[i]] && typeof o[parts[i]] === 'object' ? o[parts[i]] : {};
  o[parts[parts.length - 1]] = value;
}
