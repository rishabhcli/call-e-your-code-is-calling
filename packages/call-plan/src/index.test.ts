import { describe, expect, it } from 'vitest';

import { CallPlanRefusal, compileApprovedCallPlan } from './index.js';

const draft = {
  planId: '01149165-672c-4327-b5b0-f874db0be85e',
  runId: '0a50a658-9cf3-4dc8-9e9e-692f19b13bf9',
  facilityId: '7efb9f29-0217-4d04-aa2a-b305fabd3573',
  phoneE164: '+14155550100',
  isPublishedOrganizationalNumber: true,
  isEmergencyOrCrisisNumber: false,
  optedOutAt: null,
  disclosure:
    'This is an automated assistant verifying the published cooling-center listing for today.',
  questions: ['Are you activated as a cooling center today?'],
  resultSchemaVersion: 'verification-v1',
  contactWindow: { startLocalTime: '08:00', endLocalTime: '18:00', timeZone: 'UTC' },
  minimumContactIntervalMinutes: 1_440,
  lastContactAt: null,
  maximumAttempts: 1,
};
const approval = {
  approvalId: '8169f2ec-6ec7-4fcc-b7f3-36ff0d734f8e',
  reviewerId: 'reviewer-1',
  approvedAt: '2026-08-09T10:00:00Z',
  expiresAt: '2026-08-09T14:00:00Z',
  approvedPlanDigest: 'a'.repeat(64),
};
const now = '2026-08-09T12:00:00Z';

function expectRefusal(rawDraft: unknown, code: string): void {
  try {
    compileApprovedCallPlan(rawDraft, approval, now);
    throw new Error('expected call-plan refusal');
  } catch (error) {
    expect(error).toBeInstanceOf(CallPlanRefusal);
    expect((error as CallPlanRefusal).code).toBe(code);
  }
}

describe('compileApprovedCallPlan', () => {
  it('produces the only call-plan type accepted by the caller boundary after approval', () => {
    const compiled = compileApprovedCallPlan(draft, approval, now);
    expect(compiled.planState).toBe('approved');
    expect(compiled.approval.reviewerId).toBe('reviewer-1');
  });

  it('refuses unpublished, emergency, opted-out, quiet-hour, and rate-window targets', () => {
    expectRefusal(
      { ...draft, isPublishedOrganizationalNumber: false },
      'TARGET_NOT_PUBLISHED_ORGANIZATION',
    );
    expectRefusal({ ...draft, isEmergencyOrCrisisNumber: true }, 'EMERGENCY_OR_CRISIS_TARGET');
    expectRefusal({ ...draft, optedOutAt: '2026-08-08T00:00:00Z' }, 'RECIPIENT_OPTED_OUT');
    expectRefusal(
      { ...draft, contactWindow: { ...draft.contactWindow, startLocalTime: '13:00' } },
      'OUTSIDE_CONTACT_WINDOW',
    );
    expectRefusal(
      { ...draft, lastContactAt: '2026-08-09T11:59:00Z' },
      'FACILITY_RATE_WINDOW_ACTIVE',
    );
  });
});
