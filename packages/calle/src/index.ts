import { createHash } from 'node:crypto';

import { ApprovedCallPlanSchema, type ApprovedCallPlan } from '@call-e-directory/call-plan';
import { z } from 'zod';

export const IdempotencyKeySchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const ExternalCallStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('not_created') }),
  z.object({ state: z.literal('scheduled'), providerCallId: z.string().min(1) }),
  z.object({ state: z.literal('in_progress'), providerCallId: z.string().min(1) }),
  z.object({ state: z.literal('completed'), providerCallId: z.string().min(1) }),
  z.object({
    state: z.literal('provider_terminal_failure'),
    providerCallId: z.string().min(1).optional(),
    providerCode: z.string().min(1),
  }),
  z.object({
    state: z.literal('unknown_external_outcome'),
    idempotencyKey: IdempotencyKeySchema,
    reconciliationRequired: z.literal(true),
  }),
]);

export type ExternalCallState = z.infer<typeof ExternalCallStateSchema>;

export interface CreateCallCommand {
  readonly plan: ApprovedCallPlan;
  readonly idempotencyKey: string;
}

export interface CalleGateway {
  createCall(command: CreateCallCommand, signal: AbortSignal): Promise<ExternalCallState>;
  reconcileCall(idempotencyKey: string, signal: AbortSignal): Promise<ExternalCallState>;
}

export function deriveIdempotencyKey(planInput: ApprovedCallPlan): string {
  const plan = ApprovedCallPlanSchema.parse(planInput);
  return createHash('sha256')
    .update(
      JSON.stringify({
        runId: plan.runId,
        facilityId: plan.facilityId,
        resultSchemaVersion: plan.resultSchemaVersion,
        questions: plan.questions,
        approvedPlanDigest: plan.approval.approvedPlanDigest,
      }),
    )
    .digest('hex');
}
