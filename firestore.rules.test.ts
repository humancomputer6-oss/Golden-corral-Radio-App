/**
 * Security rules verification suite for Golden Corral Clean Radio.
 * Exercises the "Dirty Dozen" attack payloads defined in security_spec.md
 * against firestore.rules when running with @firebase/rules-unit-testing.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Self-Promotion on Sign-Up',
    collection: 'users',
    operation: 'create',
    payload: { uid: 'attacker', email: 'a@test.com', displayName: 'Attacker', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Role Escalation Update',
    collection: 'users',
    operation: 'update',
    payload: { role: 'manager' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Submission',
    collection: 'submissions',
    operation: 'create',
    payload: { artistName: 'A', trackTitle: 'B', isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Self-Approval Status Shortcut',
    collection: 'submissions',
    operation: 'update',
    payload: { status: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Uncertified Explicit Track',
    collection: 'submissions',
    operation: 'create',
    payload: { cleanEditCertified: false, status: 'pending' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Unverified Email Spoofing',
    collection: 'submissions',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'PII Cross-Read on Submissions',
    collection: 'submissions',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning',
    collection: 'audioZones',
    operation: 'create',
    payload: { id: '../bad', volume: 50 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Timestamp Tampering',
    collection: 'staffShifts',
    operation: 'create',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Audit Log Erasure',
    collection: 'reportActivityLogs',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Volume Out-of-Bounds Poisoning',
    collection: 'audioZones',
    operation: 'update',
    payload: { volume: 9999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket List Scraping',
    collection: 'users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
];
