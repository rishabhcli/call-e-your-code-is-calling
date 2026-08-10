import { describe, expect, it } from 'vitest';

import { calculatePriority } from './index.js';

describe('calculatePriority', () => {
  it('preserves the inspectable priority formula and version', () => {
    const decision = calculatePriority(
      {
        claimId: '2008c47c-84f4-4c60-81a2-bc2b121a5b32',
        facilityId: '526771a3-8e4e-4f8e-b58e-a93a2e3d2315',
        criticality: 5,
        provenance: {
          sourceType: 'published_directory',
          sourceUri: 'https://example.invalid/directory.csv',
          sourceVersion: 'fixture-v1',
          sourceRecordId: 'site-1',
        },
        validity: {
          observedAt: '2026-08-09T12:00:00-07:00',
          expiresAt: '2026-08-09T20:00:00-07:00',
        },
        kind: 'activation_status',
        value: true,
      },
      {
        staleness: 1,
        sourceUncertainty: 0.5,
        recentChangeLikelihood: 0.8,
        expectedDownstreamUse: 0.5,
        expectedCallCost: 2,
      },
    );
    expect(decision.score).toBe(0.5);
    expect(decision.algorithmVersion).toBe('priority-v1');
    expect(decision.rationale.criticality).toBe(5);
  });
});
