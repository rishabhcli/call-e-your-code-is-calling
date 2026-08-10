import { z } from 'zod';

const Rfc3339TimestampSchema = z.iso.datetime({ offset: true });
const LocalTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);

export const CallPlanRefusalCodeSchema = z.enum([
  'TARGET_NOT_PUBLISHED_ORGANIZATION',
  'EMERGENCY_OR_CRISIS_TARGET',
  'RECIPIENT_OPTED_OUT',
  'OUTSIDE_CONTACT_WINDOW',
  'FACILITY_RATE_WINDOW_ACTIVE',
  'APPROVAL_MISSING_OR_EXPIRED',
  'INVALID_PLAN_INPUT',
]);

export type CallPlanRefusalCode = z.infer<typeof CallPlanRefusalCodeSchema>;

export class CallPlanRefusal extends Error {
  public readonly retryable: boolean;

  public constructor(
    public readonly code: CallPlanRefusalCode,
    safeMessage: string,
    retryable = false,
  ) {
    super(safeMessage);
    this.name = 'CallPlanRefusal';
    this.retryable = retryable;
  }
}

export const CallPlanDraftSchema = z.object({
  planId: z.uuid(),
  runId: z.uuid(),
  facilityId: z.uuid(),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/u),
  isPublishedOrganizationalNumber: z.boolean(),
  isEmergencyOrCrisisNumber: z.boolean(),
  optedOutAt: Rfc3339TimestampSchema.nullable(),
  disclosure: z.string().trim().min(40).max(1_000),
  questions: z.array(z.string().trim().min(5).max(500)).min(1).max(6),
  resultSchemaVersion: z.string().trim().min(1).max(100),
  contactWindow: z.object({
    startLocalTime: LocalTimeSchema,
    endLocalTime: LocalTimeSchema,
    timeZone: z.string().trim().min(1).max(100),
  }),
  minimumContactIntervalMinutes: z.number().int().min(1).max(43_200),
  lastContactAt: Rfc3339TimestampSchema.nullable(),
  maximumAttempts: z.number().int().min(1).max(2),
});

export const ApprovalSchema = z.object({
  approvalId: z.uuid(),
  reviewerId: z.string().trim().min(1).max(200),
  approvedAt: Rfc3339TimestampSchema,
  expiresAt: Rfc3339TimestampSchema,
  approvedPlanDigest: z.string().regex(/^[a-f0-9]{64}$/u),
});

export const ApprovedCallPlanSchema = CallPlanDraftSchema.extend({
  isPublishedOrganizationalNumber: z.literal(true),
  isEmergencyOrCrisisNumber: z.literal(false),
  optedOutAt: z.null(),
  approval: ApprovalSchema,
  compiledAt: Rfc3339TimestampSchema,
  planState: z.literal('approved'),
});

export type CallPlanDraft = z.infer<typeof CallPlanDraftSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type ApprovedCallPlan = z.infer<typeof ApprovedCallPlanSchema>;

function minutesSinceMidnight(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number.parseInt(hour, 10) * 60 + Number.parseInt(minute, 10);
}

function localMinuteOfDay(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone,
  }).formatToParts(now);
  const hour = Number.parseInt(parts.find((part) => part.type === 'hour')?.value ?? '-1', 10);
  const minute = Number.parseInt(parts.find((part) => part.type === 'minute')?.value ?? '-1', 10);
  if (hour < 0 || minute < 0) {
    throw new CallPlanRefusal('INVALID_PLAN_INPUT', 'The contact timezone is invalid.');
  }
  return hour * 60 + minute;
}

export function compileApprovedCallPlan(
  rawDraft: unknown,
  rawApproval: unknown,
  nowIso: string,
): ApprovedCallPlan {
  const draftResult = CallPlanDraftSchema.safeParse(rawDraft);
  const approvalResult = ApprovalSchema.safeParse(rawApproval);
  const nowResult = Rfc3339TimestampSchema.safeParse(nowIso);
  if (!draftResult.success || !approvalResult.success || !nowResult.success) {
    throw new CallPlanRefusal('INVALID_PLAN_INPUT', 'The call plan input is invalid.');
  }

  const draft = draftResult.data;
  const approval = approvalResult.data;
  const now = new Date(nowResult.data);

  if (!draft.isPublishedOrganizationalNumber) {
    throw new CallPlanRefusal(
      'TARGET_NOT_PUBLISHED_ORGANIZATION',
      'Only published organizational numbers may be called.',
    );
  }
  if (draft.isEmergencyOrCrisisNumber) {
    throw new CallPlanRefusal(
      'EMERGENCY_OR_CRISIS_TARGET',
      'Emergency and crisis numbers cannot be included in a call plan.',
    );
  }
  if (draft.optedOutAt !== null) {
    throw new CallPlanRefusal('RECIPIENT_OPTED_OUT', 'This recipient has opted out.');
  }
  if (
    Date.parse(approval.approvedAt) > now.getTime() ||
    Date.parse(approval.expiresAt) <= now.getTime()
  ) {
    throw new CallPlanRefusal(
      'APPROVAL_MISSING_OR_EXPIRED',
      'The call plan approval is not currently valid.',
    );
  }

  const startMinute = minutesSinceMidnight(draft.contactWindow.startLocalTime);
  const endMinute = minutesSinceMidnight(draft.contactWindow.endLocalTime);
  const currentMinute = localMinuteOfDay(now, draft.contactWindow.timeZone);
  if (startMinute >= endMinute || currentMinute < startMinute || currentMinute >= endMinute) {
    throw new CallPlanRefusal(
      'OUTSIDE_CONTACT_WINDOW',
      'The facility is outside its configured contact window.',
      true,
    );
  }

  if (
    draft.lastContactAt !== null &&
    now.getTime() - Date.parse(draft.lastContactAt) < draft.minimumContactIntervalMinutes * 60_000
  ) {
    throw new CallPlanRefusal(
      'FACILITY_RATE_WINDOW_ACTIVE',
      'The facility contact rate window is still active.',
      true,
    );
  }

  return ApprovedCallPlanSchema.parse({
    ...draft,
    approval,
    compiledAt: nowResult.data,
    planState: 'approved',
  });
}
