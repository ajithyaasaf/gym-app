import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  membershipTerms,
  membershipPauses,
  plans,
  charges,
  members,
  attendance,
} from "@/db/schema";
import {
  calculateTermDates,
  addDays,
  differenceInCalendarDays,
  getTodayISTString,
  deriveMembershipStatus,
} from "@/lib/dates";
import { MEMBERSHIP_STATUSES, CHARGE_TYPES, CHARGE_STATUSES } from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

export interface CreateTermParams {
  memberId: string;
  planId: string;
  customStartDate?: string;
  discountPaise?: number;
  discountReason?: string;
  discountApprovedByUserId?: string;
  performedByUserId: string;
}

/**
 * Calculates start and end dates for a new term:
 * If an active or upcoming term exists:
 * - Early renewal starts at the end_date of the latest non-cancelled term!
 * If lapsed:
 * - Starts today (or custom date if provided)
 */
export async function determineNextTermStartDate(
  memberId: string,
  customStartDate?: string
): Promise<string> {
  if (customStartDate) {
    return customStartDate;
  }

  const today = getTodayISTString();

  // Find the latest non-cancelled term
  const latestTerms = await db
    .select()
    .from(membershipTerms)
    .where(
      and(
        eq(membershipTerms.memberId, memberId),
        sql`${membershipTerms.status} != ${MEMBERSHIP_STATUSES.CANCELLED}`
      )
    )
    .orderBy(desc(membershipTerms.endDate))
    .limit(1);

  if (latestTerms.length === 0) {
    return today;
  }

  const latest = latestTerms[0];
  // If the latest term is in the future or active (endDate > today), early renewal starts exactly at endDate!
  if (latest.endDate > today) {
    return latest.endDate;
  }

  // Otherwise membership has lapsed, default renewal starts today
  return today;
}

/**
 * Creates a membership term and its associated charges atomically.
 */
export async function enrollOrRenewTerm(
  params: CreateTermParams,
  txClient?: Parameters<Parameters<typeof db.transaction>[0]>[0]
): Promise<{ termId: string; chargeId: string; totalChargePaise: number }> {
  const execute = async (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) => {
    // 1. Fetch plan
    const planRows = await tx
      .select()
      .from(plans)
      .where(eq(plans.id, params.planId))
      .limit(1);

    if (planRows.length === 0) {
      throw new Error("Plan not found");
    }
    const plan = planRows[0];

    // 2. Determine start date
    const startDate = await determineNextTermStartDate(
      params.memberId,
      params.customStartDate
    );

    // 3. Calculate term interval
    const { endDate, validThrough } = calculateTermDates(
      startDate,
      plan.durationUnit as "DAYS" | "MONTHS",
      plan.durationQuantity
    );

    // Check for overlap with existing non-cancelled terms
    const overlapping = await tx
      .select()
      .from(membershipTerms)
      .where(
        and(
          eq(membershipTerms.memberId, params.memberId),
          sql`${membershipTerms.status} != ${MEMBERSHIP_STATUSES.CANCELLED}`,
          sql`${membershipTerms.startDate} < ${endDate} AND ${membershipTerms.endDate} > ${startDate}`
        )
      )
      .limit(1);

    if (overlapping.length > 0) {
      throw new Error(
        `Overlapping membership term detected with term from ${overlapping[0].startDate} to ${overlapping[0].endDate}`
      );
    }

    // 4. Calculate pricing & discounts
    const discountPaise = params.discountPaise || 0;
    if (discountPaise > 0 && !params.discountApprovedByUserId) {
      throw new Error("Discount requires owner approval");
    }

    const basePricePaise = plan.pricePaise;
    const joiningFeePaise = plan.joiningFeePaise || 0;
    const finalPricePaise = Math.max(0, basePricePaise + joiningFeePaise - discountPaise);

    const today = getTodayISTString();
    const initialStatus = deriveMembershipStatus({
      startDate,
      endDate,
      referenceDate: today,
    });

    const termId = crypto.randomUUID();

    // 5. Insert term with snapshot
    await tx.insert(membershipTerms).values({
      id: termId,
      memberId: params.memberId,
      planId: plan.id,
      status: initialStatus,
      startDate,
      endDate,
      validThrough,
      originalEndDate: endDate,
      totalPausedDays: 0,
      planNameSnapshot: plan.name,
      durationUnitSnapshot: plan.durationUnit,
      durationQuantitySnapshot: plan.durationQuantity,
      basePricePaiseSnapshot: basePricePaise,
      joiningFeePaiseSnapshot: joiningFeePaise,
      discountPaiseSnapshot: discountPaise,
      taxPaiseSnapshot: 0,
      finalPricePaiseSnapshot: finalPricePaise,
    });

    // 6. Create charge for this term
    const chargeId = crypto.randomUUID();
    await tx.insert(charges).values({
      id: chargeId,
      memberId: params.memberId,
      termId,
      chargeType: CHARGE_TYPES.MEMBERSHIP,
      title: `${plan.name} Membership (${startDate} to ${validThrough})`,
      baseAmountPaise: basePricePaise + joiningFeePaise,
      discountPaise,
      discountReason: params.discountReason || null,
      discountApprovedBy: params.discountApprovedByUserId || null,
      taxAmountPaise: 0,
      netAmountPaise: finalPricePaise,
      allocatedPaymentPaise: 0,
      balancePaise: finalPricePaise,
      dueDate: startDate,
      status: finalPricePaise === 0 ? CHARGE_STATUSES.PAID : CHARGE_STATUSES.PENDING,
    });

    // 7. Audit log
    await logAuditEvent({
      userId: params.performedByUserId,
      action: "MEMBERSHIP_ENROLL",
      entityType: "MEMBERSHIP_TERM",
      entityId: termId,
      details: {
        planId: plan.id,
        startDate,
        endDate,
        finalPricePaise,
      },
      tx,
    });

    return {
      termId,
      chargeId,
      totalChargePaise: finalPricePaise,
    };
  };

  if (txClient) {
    return execute(txClient);
  }
  return db.transaction(execute);
}

/**
 * Pauses an active membership term:
 * - Duration extends the current term by the number of paused calendar days.
 * - Rejects overlapping pauses, invalid ranges, and retroactive pauses covering recorded attendance.
 * - Atomically shifts any future queued renewals forward by the same number of days.
 */
export async function pauseMembershipTerm(params: {
  termId: string;
  startDate: string; // inclusive
  endDate: string; // exclusive
  reason: string;
  ownerUserId: string;
}): Promise<{ pauseId: string; extendedEndDate: string; shiftedDays: number }> {
  return db.transaction(async (tx) => {
    // 1. Fetch term
    const termRows = await tx
      .select()
      .from(membershipTerms)
      .where(eq(membershipTerms.id, params.termId))
      .limit(1);

    if (termRows.length === 0) {
      throw new Error("Membership term not found");
    }
    const term = termRows[0];

    if (term.status === MEMBERSHIP_STATUSES.CANCELLED || term.status === MEMBERSHIP_STATUSES.EXPIRED) {
      throw new Error(`Cannot pause a term with status ${term.status}`);
    }

    if (params.startDate >= params.endDate) {
      throw new Error("Pause start date must be strictly before end date");
    }

    if (params.startDate < term.startDate || params.endDate > term.endDate) {
      throw new Error(
        `Pause dates [${params.startDate}, ${params.endDate}) must be within current term interval [${term.startDate}, ${term.endDate})`
      );
    }

    // Check for overlapping pauses
    const existingPauses = await tx
      .select()
      .from(membershipPauses)
      .where(
        and(
          eq(membershipPauses.termId, params.termId),
          sql`${membershipPauses.startDate} < ${params.endDate} AND ${membershipPauses.endDate} > ${params.startDate}`
        )
      )
      .limit(1);

    if (existingPauses.length > 0) {
      throw new Error("Overlapping pause already exists for this term");
    }

    // Check if member has recorded attendance within the proposed pause interval
    const conflictVisits = await tx
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.memberId, term.memberId),
          eq(attendance.isVoided, false),
          sql`${attendance.attendanceDate} >= ${params.startDate} AND ${attendance.attendanceDate} < ${params.endDate}`
        )
      )
      .limit(1);

    if (conflictVisits.length > 0) {
      throw new Error(
        `Cannot pause: Member has recorded attendance on ${conflictVisits[0].attendanceDate} within the pause window`
      );
    }

    const daysPaused = differenceInCalendarDays(params.endDate, params.startDate);
    if (daysPaused <= 0) {
      throw new Error("Pause duration must be at least 1 calendar day");
    }

    const pauseId = crypto.randomUUID();

    // Insert pause record
    await tx.insert(membershipPauses).values({
      id: pauseId,
      termId: term.id,
      startDate: params.startDate,
      endDate: params.endDate,
      daysPaused,
      reason: params.reason,
      approvedByUserId: params.ownerUserId,
    });

    // Extend current term end date
    const newEndDate = addDays(term.endDate, daysPaused);
    const newValidThrough = addDays(newEndDate, -1);
    const totalPausedDays = term.totalPausedDays + daysPaused;

    const today = getTodayISTString();
    const isCurrentlyPaused = today >= params.startDate && today < params.endDate;
    const newStatus = isCurrentlyPaused ? MEMBERSHIP_STATUSES.PAUSED : term.status;

    await tx
      .update(membershipTerms)
      .set({
        endDate: newEndDate,
        validThrough: newValidThrough,
        totalPausedDays,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(membershipTerms.id, term.id));

    // Shift any queued future terms for this member forward by daysPaused
    const futureTerms = await tx
      .select()
      .from(membershipTerms)
      .where(
        and(
          eq(membershipTerms.memberId, term.memberId),
          sql`${membershipTerms.status} != ${MEMBERSHIP_STATUSES.CANCELLED}`,
          gte(membershipTerms.startDate, term.endDate)
        )
      )
      .orderBy(membershipTerms.startDate);

    for (const fTerm of futureTerms) {
      const shiftedStart = addDays(fTerm.startDate, daysPaused);
      const shiftedEnd = addDays(fTerm.endDate, daysPaused);
      const shiftedValid = addDays(shiftedEnd, -1);

      await tx
        .update(membershipTerms)
        .set({
          startDate: shiftedStart,
          endDate: shiftedEnd,
          validThrough: shiftedValid,
          updatedAt: new Date(),
        })
        .where(eq(membershipTerms.id, fTerm.id));
    }

    // Audit log
    await logAuditEvent({
      userId: params.ownerUserId,
      action: "MEMBERSHIP_PAUSE",
      entityType: "MEMBERSHIP_TERM",
      entityId: term.id,
      reason: params.reason,
      details: {
        pauseId,
        startDate: params.startDate,
        endDate: params.endDate,
        daysPaused,
        extendedEndDate: newEndDate,
      },
      tx,
    });

    return {
      pauseId,
      extendedEndDate: newEndDate,
      shiftedDays: daysPaused,
    };
  });
}

/**
 * Resumes an active pause early:
 * Recalculates the exact days paused up to resumeDate, adjusts the term end date,
 * and shifts queued renewals accordingly.
 */
export async function resumeMembershipEarly(params: {
  pauseId: string;
  resumeDate: string; // 'YYYY-MM-DD'
  ownerUserId: string;
}): Promise<{ adjustedEndDate: string; actualDaysPaused: number }> {
  return db.transaction(async (tx) => {
    const pauseRows = await tx
      .select()
      .from(membershipPauses)
      .where(eq(membershipPauses.id, params.pauseId))
      .limit(1);

    if (pauseRows.length === 0) {
      throw new Error("Pause record not found");
    }
    const pause = pauseRows[0];

    if (pause.isResumedEarly) {
      throw new Error("This pause has already been resumed early");
    }

    const termRows = await tx
      .select()
      .from(membershipTerms)
      .where(eq(membershipTerms.id, pause.termId))
      .limit(1);
    const term = termRows[0];

    if (params.resumeDate <= pause.startDate || params.resumeDate >= pause.endDate) {
      throw new Error(
        `Resume date ${params.resumeDate} must be strictly between pause start ${pause.startDate} and pause end ${pause.endDate}`
      );
    }

    const actualDaysPaused = differenceInCalendarDays(params.resumeDate, pause.startDate);
    const daysSaved = pause.daysPaused - actualDaysPaused;

    // Update pause record
    await tx
      .update(membershipPauses)
      .set({
        resumedAt: params.resumeDate,
        isResumedEarly: true,
        daysPaused: actualDaysPaused,
      })
      .where(eq(membershipPauses.id, pause.id));

    // Shift term end date backward by daysSaved
    const newEndDate = addDays(term.endDate, -daysSaved);
    const newValidThrough = addDays(newEndDate, -1);
    const newTotalPausedDays = term.totalPausedDays - daysSaved;

    const today = getTodayISTString();
    const newStatus = deriveMembershipStatus({
      startDate: term.startDate,
      endDate: newEndDate,
      referenceDate: today,
    });

    await tx
      .update(membershipTerms)
      .set({
        endDate: newEndDate,
        validThrough: newValidThrough,
        totalPausedDays: newTotalPausedDays,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(membershipTerms.id, term.id));

    // Shift future terms back by daysSaved
    const futureTerms = await tx
      .select()
      .from(membershipTerms)
      .where(
        and(
          eq(membershipTerms.memberId, term.memberId),
          sql`${membershipTerms.status} != ${MEMBERSHIP_STATUSES.CANCELLED}`,
          gte(membershipTerms.startDate, term.endDate)
        )
      );

    for (const fTerm of futureTerms) {
      const shiftedStart = addDays(fTerm.startDate, -daysSaved);
      const shiftedEnd = addDays(fTerm.endDate, -daysSaved);
      const shiftedValid = addDays(shiftedEnd, -1);

      await tx
        .update(membershipTerms)
        .set({
          startDate: shiftedStart,
          endDate: shiftedEnd,
          validThrough: shiftedValid,
          updatedAt: new Date(),
        })
        .where(eq(membershipTerms.id, fTerm.id));
    }

    await logAuditEvent({
      userId: params.ownerUserId,
      action: "MEMBERSHIP_RESUME_EARLY",
      entityType: "MEMBERSHIP_TERM",
      entityId: term.id,
      details: {
        pauseId: pause.id,
        resumeDate: params.resumeDate,
        actualDaysPaused,
        daysSaved,
        newEndDate,
      },
      tx,
    });

    return {
      adjustedEndDate: newEndDate,
      actualDaysPaused,
    };
  });
}

/**
 * Cancels a membership term:
 * Stops service from effective date, records actor & reason.
 * Does NOT automatically refund payments or forgive debt.
 */
export async function cancelMembershipTerm(params: {
  termId: string;
  effectiveDate: string;
  cancellationReason: string;
  ownerUserId: string;
}): Promise<void> {
  return db.transaction(async (tx) => {
    const termRows = await tx
      .select()
      .from(membershipTerms)
      .where(eq(membershipTerms.id, params.termId))
      .limit(1);

    if (termRows.length === 0) {
      throw new Error("Term not found");
    }
    const term = termRows[0];

    await tx
      .update(membershipTerms)
      .set({
        status: MEMBERSHIP_STATUSES.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: params.cancellationReason,
        cancelledByUserId: params.ownerUserId,
        updatedAt: new Date(),
      })
      .where(eq(membershipTerms.id, params.termId));

    await logAuditEvent({
      userId: params.ownerUserId,
      action: "MEMBERSHIP_CANCEL",
      entityType: "MEMBERSHIP_TERM",
      entityId: params.termId,
      reason: params.cancellationReason,
      details: {
        effectiveDate: params.effectiveDate,
      },
      tx,
    });
  });
}
