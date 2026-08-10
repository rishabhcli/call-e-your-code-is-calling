import { z } from 'zod';

export const Rfc3339TimestampSchema = z.iso.datetime({ offset: true });

export const ClaimSourceTypeSchema = z.enum([
  'published_directory',
  'live_person',
  'voicemail',
  'automated_menu',
  'official_followup',
]);

export const ClaimProvenanceSchema = z.object({
  sourceType: ClaimSourceTypeSchema,
  sourceUri: z.url(),
  sourceVersion: z.string().trim().min(1).max(200),
  sourceRecordId: z.string().trim().min(1).max(200),
});

export const TemporalValiditySchema = z
  .object({
    observedAt: Rfc3339TimestampSchema,
    expiresAt: Rfc3339TimestampSchema,
  })
  .superRefine(({ observedAt, expiresAt }, context) => {
    if (Date.parse(expiresAt) <= Date.parse(observedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'expiresAt must be strictly later than observedAt',
        path: ['expiresAt'],
      });
    }
  });

const ClaimEnvelopeSchema = z.object({
  claimId: z.uuid(),
  facilityId: z.uuid(),
  criticality: z.number().int().min(1).max(5),
  provenance: ClaimProvenanceSchema,
  validity: TemporalValiditySchema,
});

const ClaimValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('activation_status'), value: z.boolean() }),
  z.object({
    kind: z.literal('closing_time'),
    value: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
    timeZone: z.string().trim().min(1).max(100),
    localDate: z.iso.date(),
  }),
  z.object({ kind: z.literal('address'), value: z.string().trim().min(1).max(500) }),
  z.object({ kind: z.literal('wheelchair_accessible'), value: z.boolean() }),
  z.object({ kind: z.literal('water_available'), value: z.boolean() }),
  z.object({ kind: z.literal('charging_available'), value: z.boolean() }),
  z.object({
    kind: z.literal('pet_policy'),
    value: z.enum(['allowed', 'not_allowed', 'conditional']),
  }),
  z.object({ kind: z.literal('overnight_operation'), value: z.boolean() }),
  z.object({ kind: z.literal('phone'), value: z.string().regex(/^\+[1-9]\d{7,14}$/u) }),
]);

export const CanonicalClaimSchema = z.intersection(ClaimEnvelopeSchema, ClaimValueSchema);

export type CanonicalClaim = z.infer<typeof CanonicalClaimSchema>;
export type ClaimSourceType = z.infer<typeof ClaimSourceTypeSchema>;

export function parseCanonicalClaim(input: unknown): CanonicalClaim {
  return CanonicalClaimSchema.parse(input);
}
