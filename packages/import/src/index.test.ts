import { describe, expect, it } from 'vitest';

import { CanonicalClaimSchema } from './index.js';

const baseClaim = {
  claimId: '2008c47c-84f4-4c60-81a2-bc2b121a5b32',
  facilityId: '526771a3-8e4e-4f8e-b58e-a93a2e3d2315',
  criticality: 5,
  provenance: {
    sourceType: 'published_directory',
    sourceUri: 'https://example.invalid/directory.csv',
    sourceVersion: 'sha256:fixture',
    sourceRecordId: 'site-1',
  },
  validity: {
    observedAt: '2026-08-09T12:00:00-07:00',
    expiresAt: '2026-08-09T20:00:00-07:00',
  },
};

describe('CanonicalClaimSchema', () => {
  it('requires an explicit observation and future expiry', () => {
    expect(
      CanonicalClaimSchema.safeParse({ ...baseClaim, kind: 'activation_status', value: true })
        .success,
    ).toBe(true);
    expect(
      CanonicalClaimSchema.safeParse({
        ...baseClaim,
        validity: {
          observedAt: '2026-08-09T12:00:00-07:00',
          expiresAt: '2026-08-09T11:59:59-07:00',
        },
        kind: 'activation_status',
        value: true,
      }).success,
    ).toBe(false);
  });

  it('rejects an unmodeled claim kind instead of accepting a dictionary', () => {
    expect(
      CanonicalClaimSchema.safeParse({ ...baseClaim, kind: 'capacity', value: 20 }).success,
    ).toBe(false);
  });
});
