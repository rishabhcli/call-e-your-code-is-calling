import { EstablishedFieldEvidenceSchema } from '@call-e-directory/evidence';
import { z } from 'zod';

const TimestampSchema = z.iso.datetime({ offset: true });

export const PublicationCandidateSchema = z.object({
  candidateId: z.uuid(),
  facilityId: z.uuid(),
  sourceSnapshotId: z.uuid(),
  evidence: EstablishedFieldEvidenceSchema,
  review: z.object({
    reviewerId: z.string().trim().min(1).max(200),
    reviewedAt: TimestampSchema,
    decision: z.literal('approved'),
  }),
});

export const PublicDeltaSchema = z.object({
  deltaId: z.uuid(),
  facilityId: z.uuid(),
  previousSnapshotId: z.uuid(),
  snapshotId: z.uuid(),
  field: z.string().trim().min(1).max(100),
  value: z.union([z.string(), z.boolean(), z.number()]),
  sourceType: z.enum(['live_person', 'voicemail', 'automated_menu']),
  observedAt: TimestampSchema,
  expiresAt: TimestampSchema,
  reviewerId: z.string().trim().min(1).max(200),
  publishedAt: TimestampSchema,
  evidenceSpanIds: z.array(z.uuid()).min(1),
});

export type PublicationCandidate = z.infer<typeof PublicationCandidateSchema>;
export type PublicDelta = z.infer<typeof PublicDeltaSchema>;

export function createPublicDelta(
  rawCandidate: unknown,
  deltaIdentity: {
    readonly deltaId: string;
    readonly snapshotId: string;
    readonly publishedAt: string;
  },
): PublicDelta {
  const candidate = PublicationCandidateSchema.parse(rawCandidate);
  return PublicDeltaSchema.parse({
    deltaId: deltaIdentity.deltaId,
    facilityId: candidate.facilityId,
    previousSnapshotId: candidate.sourceSnapshotId,
    snapshotId: deltaIdentity.snapshotId,
    field: candidate.evidence.field,
    value: candidate.evidence.normalizedValue,
    sourceType: candidate.evidence.sourceType,
    observedAt: candidate.evidence.observedAt,
    expiresAt: candidate.evidence.expiresAt,
    reviewerId: candidate.review.reviewerId,
    publishedAt: deltaIdentity.publishedAt,
    evidenceSpanIds: candidate.evidence.spans.map((span) => span.spanId),
  });
}
