import { describe, expect, it } from 'vitest';

import { deriveIdempotencyKey } from './index.js';

const approvedPlan = {
  planId: '01149165-672c-4327-b5b0-f874db0be85e',
  runId: '0a50a658-9cf3-4dc8-9e9e-692f19b13bf9',
  facilityId: '7efb9f29-0217-4d04-aa2a-b305fabd3573',
  phoneE164: '+14155550100',
  isPublishedOrganizationalNumber: true as const,
  isEmergencyOrCrisisNumber: false as const,
  optedOutAt: null,
  disclosure:
    'This is an automated assistant verifying the published cooling-center listing for today.',
  questions: ['Are you activated as a cooling center today?'],
  resultSchemaVersion: 'verification-v1',
  contactWindow: { startLocalTime: '08:00', endLocalTime: '18:00', timeZone: 'UTC' },
  minimumContactIntervalMinutes: 1_440,
  lastContactAt: null,
  maximumAttempts: 1,
  approval: {
    approvalId: '8169f2ec-6ec7-4fcc-b7f3-36ff0d734f8e',
    reviewerId: 'reviewer-1',
    approvedAt: '2026-08-09T10:00:00Z',
    expiresAt: '2026-08-09T14:00:00Z',
    approvedPlanDigest: 'a'.repeat(64),
  },
  compiledAt: '2026-08-09T12:00:00Z',
  planState: 'approved' as const,
};

describe('deriveIdempotencyKey', () => {
  it('is stable for the same approved external operation and changes with the question set', () => {
    const first = deriveIdempotencyKey(approvedPlan);
    const second = deriveIdempotencyKey(approvedPlan);
    const changed = deriveIdempotencyKey({
      ...approvedPlan,
      questions: ['Are you open today?'],
    });
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });
});
