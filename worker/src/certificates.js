// Certificates, created only by the Worker, with serials allocated atomically so they can never repeat.
import { nowIso } from './context.js';

const PROGRAM_CODES = {
  'Software Development': 'SD',
  'Graphics & Multimedia': 'GM',
  'Data Analysis': 'DA',
  'Digital Marketing': 'DM',
  Cybersecurity: 'CS',
  'Network & Cloud': 'NC',
  'Digital Skills': 'DS',
  General: 'GEN',
};

export const programCode = (department) => PROGRAM_CODES[department] || 'GEN';

export function gradeFor(score) {
  if (score >= 80) return { grade: 'Outstanding', gradeClass: 'outstanding' };
  if (score >= 70) return { grade: 'Distinction', gradeClass: 'distinction' };
  if (score >= 60) return { grade: 'Merit', gradeClass: 'merit' };
  return { grade: 'Completion', gradeClass: 'completion' };
}

/**
 * Takes the next number for a serial prefix. The counter is created from the highest existing
 * certificate with that prefix (so serials issued by the old system are never reused), then
 * incremented with an optimistic transaction together with the certificate itself.
 */
async function allocateAndCreate(ctx, prefix, makeDoc) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const counter = await ctx.db.get(`counters/cert_${prefix}`);
    let next;
    if (counter) next = Number(counter.value) + 1;
    else {
      const existing = await ctx.db.query('certificates', [['certificateId', '>=', prefix], ['certificateId', '<', `${prefix}~`]]);
      const max = existing.reduce((m, c) => Math.max(m, Number(String(c.certificateId).slice(prefix.length)) || 0), 0);
      next = max + 1;
    }
    const serial = `${prefix}${String(next).padStart(3, '0')}`;
    try {
      await ctx.db.commit([
        { path: `counters/cert_${prefix}`, data: { value: next, prefix, updatedAt: nowIso() }, ...(counter ? { updateTime: counter._updateTime } : { exists: false }) },
        { path: `certificates/${serial}`, data: makeDoc(serial), exists: false },
      ]);
      return serial;
    } catch (e) {
      if (![400, 409].includes(e.status)) throw e; // precondition failed: someone else took the number, retry
    }
  }
  throw new Error('Could not allocate a certificate number');
}

export async function issueCertificateIfEligible(ctx, result, assessment) {
  const cert = assessment.certificate || {};
  if (!cert.enabled || cert.autoGenerate === false) return null;
  const minScore = cert.minScore === 0 ? 0 : Number(cert.minScore) || 70;
  if (result.score < minScore || result.certificateId) return null;
  // One certificate per student per assessment, whatever the number of attempts.
  const existing = await ctx.db.query('certificates', [['studentId', '==', result.studentId], ['assessmentId', '==', result.assessmentId]], { limit: 1 });
  if (existing.length && existing[0].status !== 'revoked') {
    await ctx.db.commit([{ path: `studentResults/${result.id}`, merge: true, data: { certificateId: existing[0].certificateId } }]);
    return existing[0].certificateId;
  }
  const type = assessment.type === 'final' ? 'achievement' : 'completion';
  const department = assessment.department || 'General';
  const code = programCode(department);
  const year = new Date().getUTCFullYear().toString().slice(-2);
  const prefix = `DBI-${code}-${year}-${type === 'achievement' ? 'CA' : 'CC'}`;
  const pending = !!cert.lockOnGenerate;
  const { grade, gradeClass } = gradeFor(result.score);
  const serial = await allocateAndCreate(ctx, prefix, (certificateId) => ({
    certificateId,
    studentId: result.studentId,
    studentUid: result.studentUid,
    studentFirstName: result.studentFirstName || '',
    studentLastName: result.studentLastName || '',
    studentEmail: result.studentEmail || '',
    assessmentId: result.assessmentId,
    assessmentTitle: assessment.title || 'Assessment',
    department,
    type,
    grade,
    gradeClass,
    score: result.score,
    hasResult: true,
    status: pending ? 'pending' : 'issued',
    issuedAt: pending ? null : nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    template: cert.template || 'default',
    isTemplate: false,
    isManual: false,
    watermark: pending ? 'PENDING' : null,
    isLocked: pending,
    signatory1: 'executiveDirector',
    signatory2: 'departmentHead',
    signatory3: 'secretary',
    programCode: code,
    resultDocId: result.id,
  }));
  await ctx.db.commit([{ path: `studentResults/${result.id}`, merge: true, data: { certificateId: serial } }]);
  return serial;
}

export { allocateAndCreate };
