import { z } from 'zod';

const TimestampSchema = z.iso.datetime({ offset: true });

export const EvidenceSourceTypeSchema = z.enum(['live_person', 'voicemail', 'automated_menu']);

export const EvidenceSpanSchema = z.object({
  transcriptId: z.uuid(),
  spanId: z.uuid(),
  startMilliseconds: z.number().int().nonnegative(),
  endMilliseconds: z.number().int().positive(),
  speaker: z.enum(['facility', 'automated_system']),
  redactedExcerpt: z.string().trim().min(1).max(1_000),
  entityConfirmed: z.literal(true),
  localDateConfirmed: z.literal(true),
});

export const EstablishedFieldEvidenceSchema = z.object({
  disposition: z.literal('established'),
  field: z.string().trim().min(1).max(100),
  normalizedValue: z.union([z.string(), z.boolean(), z.number()]),
  sourceType: EvidenceSourceTypeSchema,
  observedAt: TimestampSchema,
  expiresAt: TimestampSchema,
  spans: z.array(EvidenceSpanSchema).min(1),
  schemaVersion: z.string().trim().min(1).max(100),
});

export const NonEstablishedFieldEvidenceSchema = z.object({
  disposition: z.enum(['ambiguous', 'refused', 'unreachable', 'not_asked']),
  field: z.string().trim().min(1).max(100),
  reasonCode: z.string().trim().min(1).max(100),
  observedAt: TimestampSchema,
  schemaVersion: z.string().trim().min(1).max(100),
});

export const FieldEvidenceSchema = z.discriminatedUnion('disposition', [
  EstablishedFieldEvidenceSchema,
  NonEstablishedFieldEvidenceSchema,
]);

export type EstablishedFieldEvidence = z.infer<typeof EstablishedFieldEvidenceSchema>;
export type FieldEvidence = z.infer<typeof FieldEvidenceSchema>;
