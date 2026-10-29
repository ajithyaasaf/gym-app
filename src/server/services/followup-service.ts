import { eq, and, sql, desc, or } from "drizzle-orm";
import { db } from "@/db";
import {
  followUps,
  followUpLogs,
  members,
  enquiries,
  membershipTerms,
  charges,
} from "@/db/schema";
import {
  FOLLOW_UP_OUTCOMES,
  FOLLOW_UP_STATUSES,
  type FollowUpOutcome,
  type FollowUpStatus,
} from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit";
import { getTodayISTString, addDays } from "@/lib/dates";
import crypto from "crypto";

export interface LogContactParams {
  followUpId: string;
  outcome: FollowUpOutcome;
  promiseDate?: string | null;
  notes?: string | null;
  nextFollowUpDate?: string | null;
  performedByUserId: string;
}

/**
 * Records an explicit contact outcome with detailed history log.
 * Completing a call does NOT clear money or alter membership terms!
 */
export async function logFollowUpContact(params: LogContactParams) {
  if (params.outcome === FOLLOW_UP_OUTCOMES.PROMISED_PAYMENT && !params.promiseDate) {
    throw new Error("A promise-to-pay outcome requires a promise date");
  }

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(followUps)
      .where(eq(followUps.id, params.followUpId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Follow-up record not found");
    }
    const current = existing[0];

    // Determine status
    let newStatus: FollowUpStatus = FOLLOW_UP_STATUSES.CONTACTED;
    if (params.outcome === FOLLOW_UP_OUTCOMES.RENEWED_RESOLVED) {
      newStatus = FOLLOW_UP_STATUSES.RESOLVED;
    } else if (params.outcome === FOLLOW_UP_OUTCOMES.NOT_INTERESTED) {
      newStatus = FOLLOW_UP_STATUSES.DISMISSED;
    }

    const logId = crypto.randomUUID();

    // 1. Insert into follow_up_logs table for audit and history
    await tx.insert(followUpLogs).values({
      id: logId,
      followUpId: params.followUpId,
      contactedByUserId: params.performedByUserId,
      outcome: params.outcome,
      promiseDate: params.promiseDate || null,
      notes: params.notes ? params.notes.trim() : null,
    });

    // 2. Update follow-up record
    const nextDueDate = params.nextFollowUpDate || params.promiseDate || current.dueDate;

    await tx
      .update(followUps)
      .set({
        status: newStatus,
        lastOutcome: params.outcome,
        lastContactedAt: new Date(),
        promiseDate: params.promiseDate || null,
        outcomeNotes: params.notes ? params.notes.trim() : null,
        dueDate: nextDueDate,
        resolvedAt: newStatus === FOLLOW_UP_STATUSES.RESOLVED ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(followUps.id, params.followUpId));

    await logAuditEvent({
      userId: params.performedByUserId,
      action: "FOLLOW_UP_LOG_CONTACT",
      entityType: "FOLLOW_UP",
      entityId: params.followUpId,
      details: {
        outcome: params.outcome,
        promiseDate: params.promiseDate,
        nextDueDate,
      },
      tx,
    });

    return {
      followUpId: params.followUpId,
      status: newStatus,
      lastOutcome: params.outcome,
    };
  });
}

/**
 * Creates or schedules a manual callback follow-up for a member or enquiry.
 */
export async function createManualFollowUp(params: {
  memberId?: string | null;
  enquiryId?: string | null;
  title: string;
  notes?: string | null;
  dueDate: string;
  assignedStaffId?: string | null;
  performedByUserId: string;
}) {
  const followUpId = crypto.randomUUID();

  await db.insert(followUps).values({
    id: followUpId,
    memberId: params.memberId || null,
    enquiryId: params.enquiryId || null,
    reasonType: "MANUAL_CALLBACK",
    title: params.title.trim(),
    notes: params.notes ? params.notes.trim() : null,
    dueDate: params.dueDate,
    assignedStaffId: params.assignedStaffId || null,
    status: FOLLOW_UP_STATUSES.PENDING,
  });

  await logAuditEvent({
    userId: params.performedByUserId,
    action: "FOLLOW_UP_CREATE_MANUAL",
    entityType: "FOLLOW_UP",
    entityId: followUpId,
    details: {
      title: params.title,
      dueDate: params.dueDate,
    },
  });

  return { followUpId };
}
