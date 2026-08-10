import type { CanonicalClaim } from '@call-e-directory/import';
import { z } from 'zod';

export const PriorityFeaturesSchema = z.object({
  staleness: z.number().min(0).max(1),
  sourceUncertainty: z.number().min(0).max(1),
  recentChangeLikelihood: z.number().min(0).max(1),
  expectedDownstreamUse: z.number().min(0).max(1),
  expectedCallCost: z.number().positive().max(100),
});

export type PriorityFeatures = z.infer<typeof PriorityFeaturesSchema>;

export interface PriorityDecision {
  readonly claimId: string;
  readonly score: number;
  readonly rationale: Readonly<PriorityFeatures & { criticality: number }>;
  readonly algorithmVersion: 'priority-v1';
}

export function calculatePriority(
  claim: CanonicalClaim,
  rawFeatures: PriorityFeatures,
): PriorityDecision {
  const features = PriorityFeaturesSchema.parse(rawFeatures);
  const score =
    (claim.criticality *
      features.staleness *
      features.sourceUncertainty *
      features.recentChangeLikelihood *
      features.expectedDownstreamUse) /
    features.expectedCallCost;

  return {
    claimId: claim.claimId,
    score,
    rationale: { criticality: claim.criticality, ...features },
    algorithmVersion: 'priority-v1',
  };
}
