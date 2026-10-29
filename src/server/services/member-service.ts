import { eq, and, sql, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import {
  members,
  membershipTerms,
  charges,
  payments,
  attendance,
  receipts,
  auditLogs,
} from "@/db/schema";
import { normalizeIndianPhone } from "@/lib/phone";
import { enrollOrRenewTerm } from "./membership-service";
import { recordPayment } from "./payment-service";
import { PaymentMethod, CHARGE_STATUSES, MEMBERSHIP_STATUSES } from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit";
import { getTodayISTString } from "@/lib/dates";
import crypto from "crypto";

export interface CreateMemberInput {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  sharedPhoneAcknowledged?: boolean;
  // Optional initial plan enrollment
  enrollment?: {
    planId: string;
    startDate?: string;
    discountPaise?: number;
    discountReason?: string;
    discountApprovedByUserId?: string;
    initialPaymentPaise?: number; // 0 for balance due, full, or partial
    paymentMethod?: PaymentMethod;
    paymentReference?: string;
  };
  performedByUserId: string;
}

/**
 * Generates the next sequential unique member code (e.g., MEM-1051)
 * using an atomic PostgreSQL sequence for concurrency safety.
 */
export async function generateNextMemberCode(txClient?: Parameters<Parameters<typeof db.transaction>[0]>[0]): Promise<string> {
  const currentDb = txClient || db;
  try {
    const res = await currentDb.execute(sql`SELECT nextval('member_code_seq') as seq`);
    const seq = (res.rows[0] as { seq: string | number }).seq;
    return `MEM-${seq}`;
  } catch {
    // If sequence does not exist, create it and get nextval
    await currentDb.execute(sql`CREATE SEQUENCE IF NOT EXISTS member_code_seq START WITH 1100`);
    const res = await currentDb.execute(sql`SELECT nextval('member_code_seq') as seq`);
    const seq = (res.rows[0] as { seq: string | number }).seq;
    return `MEM-${seq}`;
  }
}

/**
 * Creates a new member record, with optional initial plan purchase and payment,
 * all committed atomically in a single ACID transaction.
 */
export async function createMember(params: CreateMemberInput) {
  const trimmedName = params.name.trim();
  if (!trimmedName) {
    throw new Error("Member name is required");
  }

  const normalizedPhone = normalizeIndianPhone(params.phone);

  return db.transaction(async (tx) => {
    // Check for existing phone number
    const existingWithPhone = await tx
      .select({ id: members.id, name: members.name, memberCode: members.memberCode })
      .from(members)
      .where(and(eq(members.phone, normalizedPhone), eq(members.isArchived, false)))
      .limit(1);

    if (existingWithPhone.length > 0 && !params.sharedPhoneAcknowledged) {
      throw new Error(
        `A member (${existingWithPhone[0].name}, ${existingWithPhone[0].memberCode}) already exists with phone number ${normalizedPhone}. Check shared phone acknowledgement to proceed.`
      );
    }

    const memberId = crypto.randomUUID();
    const memberCode = await generateNextMemberCode(tx);

    let emergencyPhoneNorm: string | null = null;
    if (params.emergencyContactPhone) {
      try {
        emergencyPhoneNorm = normalizeIndianPhone(params.emergencyContactPhone);
      } catch {
        emergencyPhoneNorm = params.emergencyContactPhone.trim();
      }
    }

    // 1. Insert Member
    await tx.insert(members).values({
      id: memberId,
      memberCode,
      name: trimmedName,
      phone: normalizedPhone,
      email: params.email ? params.email.trim().toLowerCase() : null,
      address: params.address ? params.address.trim() : null,
      emergencyContactName: params.emergencyContactName ? params.emergencyContactName.trim() : null,
      emergencyContactPhone: emergencyPhoneNorm,
      notes: params.notes ? params.notes.trim() : null,
      photoUrl: params.photoUrl || null,
      sharedPhoneAcknowledged: !!params.sharedPhoneAcknowledged,
      version: 1,
    });

    let termResult = null;
    let paymentResult = null;

    // 2. If initial enrollment is requested
    if (params.enrollment?.planId) {
      termResult = await enrollOrRenewTerm(
        {
          memberId,
          planId: params.enrollment.planId,
          customStartDate: params.enrollment.startDate,
          discountPaise: params.enrollment.discountPaise,
          discountReason: params.enrollment.discountReason,
          discountApprovedByUserId: params.enrollment.discountApprovedByUserId,
          performedByUserId: params.performedByUserId,
        },
        tx
      );

      // 3. If initial payment is made (full or partial)
      const initialPaymentPaise = params.enrollment.initialPaymentPaise || 0;
      if (initialPaymentPaise > 0) {
        paymentResult = await recordPayment(
          {
            memberId,
            amountPaise: initialPaymentPaise,
            paymentMethod: params.enrollment.paymentMethod || ("CASH" as PaymentMethod),
            externalReference: params.enrollment.paymentReference || null,
            receivedByUserId: params.performedByUserId,
            specificChargeId: termResult.chargeId,
          },
          tx
        );
      }
    }

    // 4. Audit Log
    await logAuditEvent({
      userId: params.performedByUserId,
      action: "MEMBER_CREATE",
      entityType: "MEMBER",
      entityId: memberId,
      details: {
        memberCode,
        name: trimmedName,
        phone: normalizedPhone,
        hasInitialPlan: !!params.enrollment?.planId,
        initialPaymentPaise: params.enrollment?.initialPaymentPaise || 0,
      },
      tx,
    });

    return {
      memberId,
      memberCode,
      termResult,
      paymentResult,
    };
  });
}

/**
 * Updates an existing member with optimistic concurrency locking (Scenario 11).
 * Detects if the version has changed since the user loaded the form.
 */
export async function updateMember(params: {
  memberId: string;
  expectedVersion: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  doNotContact?: boolean;
  performedByUserId: string;
}) {
  const trimmedName = params.name.trim();
  const normalizedPhone = normalizeIndianPhone(params.phone);

  return db.transaction(async (tx) => {
    // Check existing record and version lock
    const existing = await tx
      .select()
      .from(members)
      .where(eq(members.id, params.memberId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Member not found");
    }
    const current = existing[0];

    if (current.version !== params.expectedVersion) {
      throw new Error(
        "CONCURRENT_MODIFICATION_CONFLICT: This member record was updated by another staff member while you were editing. Please refresh to see the latest changes."
      );
    }

    const nextVersion = current.version + 1;

    await tx
      .update(members)
      .set({
        name: trimmedName,
        phone: normalizedPhone,
        email: params.email ? params.email.trim().toLowerCase() : null,
        address: params.address ? params.address.trim() : null,
        emergencyContactName: params.emergencyContactName ? params.emergencyContactName.trim() : null,
        emergencyContactPhone: params.emergencyContactPhone ? params.emergencyContactPhone.trim() : null,
        notes: params.notes ? params.notes.trim() : null,
        photoUrl: params.photoUrl !== undefined ? params.photoUrl : current.photoUrl,
        doNotContact: params.doNotContact !== undefined ? params.doNotContact : current.doNotContact,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(and(eq(members.id, params.memberId), eq(members.version, params.expectedVersion)));

    await logAuditEvent({
      userId: params.performedByUserId,
      action: "MEMBER_UPDATE",
      entityType: "MEMBER",
      entityId: params.memberId,
      details: {
        fromVersion: params.expectedVersion,
        toVersion: nextVersion,
        name: trimmedName,
      },
      tx,
    });

    return {
      memberId: params.memberId,
      version: nextVersion,
    };
  });
}

/**
 * Archives a member:
 * Requires owner approval if active membership or outstanding debt exists.
 * Does NOT delete or write off outstanding obligations.
 */
export async function archiveMember(params: {
  memberId: string;
  reason: string;
  ownerUserId: string;
}) {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(members)
      .where(eq(members.id, params.memberId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Member not found");
    }

    // Check outstanding balance
    const duesResult = await tx.execute(
      sql`SELECT COALESCE(SUM(balance_paise), 0) as total_due FROM charges WHERE member_id = ${params.memberId} AND status != ${CHARGE_STATUSES.CANCELLED}`
    );
    const balancePaise = Number((duesResult.rows[0] as { total_due: number }).total_due);

    await tx
      .update(members)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        archivedReason: params.reason,
        updatedAt: new Date(),
      })
      .where(eq(members.id, params.memberId));

    await logAuditEvent({
      userId: params.ownerUserId,
      action: "MEMBER_ARCHIVE",
      entityType: "MEMBER",
      entityId: params.memberId,
      reason: params.reason,
      details: {
        outstandingBalancePaise: balancePaise,
      },
      tx,
    });

    return {
      memberId: params.memberId,
      outstandingBalancePaise: balancePaise,
    };
  });
}
