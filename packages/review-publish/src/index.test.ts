import { describe, expect, it } from 'vitest';

import { PublicationCandidateSchema, createPublicDelta } from './index.js';

const establishedEvidence = {
  disposition: 'established' as const,
  field: 'closing_time',
  normalizedValue: '18:00',
  sourceType: 'live_person' as const,
  observedAt: '2026-08-09T12:00:00Z',
  expiresAt: '2026-08-10T00:00:00Z',
  spans: [
    {
      transcriptId: '5646ef2f-78e3-4f85-9df9-28ffc5a6fdd6',
      spanId: '98147889-5d00-45a8-b0e6-f27aa06f0f84',
      startMilliseconds: 1_000,
      endMilliseconds: 2_000,
      speaker: 'facility' as const,
      redactedExcerpt: 'We close at 6 PM today.',
      entityConfirmed: true as const,
      localDateConfirmed: true as const,
    },
  ],
  schemaVersion: 'evidence-v1',
};

describe('publication boundary', () => {
  it('rejects non-established outcomes before review and projects no transcript content publicly', () => {
    expect(
      PublicationCandidateSchema.safeParse({
        candidateId: '25191f15-2f87-4e0d-8afb-7706680fbf9f',
        facilityId: '7efb9f29-0217-4d04-aa2a-b305fabd3573',
        sourceSnapshotId: '88739837-ef96-4201-a40a-eb1f9da65edc',
        evidence: {
          disposition: 'ambiguous',
          field: 'closing_time',
          reasonCode: 'usually',
          observedAt: '2026-08-09T12:00:00Z',
          schemaVersion: 'evidence-v1',
        },
        review: {
          reviewerId: 'reviewer-1',
          reviewedAt: '2026-08-09T12:10:00Z',
          decision: 'approved',
        },
      }).success,
    ).toBe(false);

    const delta = createPublicDelta(
      {
        candidateId: '25191f15-2f87-4e0d-8afb-7706680fbf9f',
        facilityId: '7efb9f29-0217-4d04-aa2a-b305fabd3573',
        sourceSnapshotId: '88739837-ef96-4201-a40a-eb1f9da65edc',
        evidence: establishedEvidence,
        review: {
          reviewerId: 'reviewer-1',
          reviewedAt: '2026-08-09T12:10:00Z',
          decision: 'approved',
        },
      },
      {
        deltaId: 'bf6b077a-7e7d-42c6-b8b8-125fe6a12a8d',
        snapshotId: 'f423f33f-c5c7-49d2-a8a7-f811a3a1bc41',
        publishedAt: '2026-08-09T12:20:00Z',
      },
    );
    expect(JSON.stringify(delta)).not.toContain('We close at 6 PM');
    expect(delta.evidenceSpanIds).toEqual(['98147889-5d00-45a8-b0e6-f27aa06f0f84']);
  });
});
