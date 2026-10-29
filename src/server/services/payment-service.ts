import { eq, and, sql, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  payments,
  charges,
  paymentAllocations,
  receipts,
  refunds,
  members,
  gymSettings,
} from "@/db/schema";
import { CHARGE_STATUSES, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { allocatePayment, formatINR } from "@/lib/money";
import { getNextReceiptNumber } from "@/lib/receipts";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

export interface RecordPaymentParams {
  memberId: string;
  amountPaise: number;
  paymentMethod: PaymentMethod;
  externalReference?: string | null;
  notes?: string | null;
  receivedByUserId: string;
  specificChargeId?: string | null;
}

export interface PaymentReceiptResult {
  paymentId: string;
  paymentNumber: string;
  receiptId: string;
  receiptNumber: string;
  amountPaise: number;
  memberBalanceAfterPaise: number;
}

/**
 * Atomically records an incoming payment, allocates to oldest charges,
 * updates charge balances, creates a printable receipt with snapshot,
 * and audits the event.
 */
export async function recordPayment(
  params: RecordPaymentParams,
  txClient?: Parameters<Parameters<typeof db.transaction>[0]>[0]
): Promise<PaymentReceiptResult> {
  if (params.amountPaise <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const execute = async (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) => {
    // 1. Fetch member details
    const memberRows = await tx
      .select()
      .from(members)
      .where(eq(members.id, params.memberId))
      .limit(1);

    if (memberRows.length === 0) {
      throw new Error("Member not found");
    }
    const member = memberRows[0];

    // 2. Fetch pending/partially paid charges with row locks
    // Using raw SQL lock query for concurrency safety against double-allocations
    const chargesQuery = params.specificChargeId
      ? sql`SELECT * FROM charges WHERE id = ${params.specificChargeId} AND member_id = ${params.memberId} AND balance_paise > 0 FOR UPDATE`
      : sql`SELECT * FROM charges WHERE member_id = ${params.memberId} AND balance_paise > 0 ORDER BY due_date ASC, created_at ASC FOR UPDATE`;

    const chargesResult = await tx.execute(chargesQuery);
    const lockedCharges = chargesResult.rows as unknown as Array<{
      id: string;
      title: string;
      net_amount_paise: number;
      allocated_payment_paise: number;
      balance_paise: number;
    }>;

    // Calculate total outstanding balance across locked charges
    const totalOutstandingPaise = lockedCharges.reduce(
      (sum, c) => sum + Number(c.balance_paise),
      0
    );

    // Reject accidental overpayment (prompt rule: Reject accidental overpayments; do not introduce a general-purpose wallet)
    if (params.amountPaise > totalOutstandingPaise) {
      throw new Error(
        `Payment of ${formatINR(params.amountPaise)} exceeds total outstanding balance of ${formatINR(totalOutstandingPaise)}. Accidental overpayments are rejected.`
      );
    }

    // 3. Allocate payment across oldest charges
    const allocationInput = lockedCharges.map((c) => ({
      id: c.id,
      balancePaise: Number(c.balance_paise),
    }));

    const { allocations, totalAllocatedPaise } = allocatePayment(
      params.amountPaise,
      allocationInput
    );

    if (totalAllocatedPaise !== params.amountPaise) {
      throw new Error("Could not fully allocate payment amount to eligible charges");
    }

    // 4. Insert Payment record
    const paymentId = crypto.randomUUID();
    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}-${crypto.randomInt(100, 999)}`;

    await tx.insert(payments).values({
      id: paymentId,
      paymentNumber,
      memberId: member.id,
      amountPaise: params.amountPaise,
      paymentMethod: params.paymentMethod,
      externalReference: params.externalReference || null,
      receivedByUserId: params.receivedByUserId,
      notes: params.notes || null,
      unallocatedAmountPaise: 0,
    });

    const breakdownItems: Array<{ chargeId: string; title: string; allocatedPaise: number }> = [];

    // 5. Insert allocations and update charges
    for (const alloc of allocations) {
      const charge = lockedCharges.find((c) => c.id === alloc.chargeId)!;
      const newAllocated = Number(charge.allocated_payment_paise) + alloc.allocatedPaise;
      const newBalance = Number(charge.balance_paise) - alloc.allocatedPaise;
      const newStatus = newBalance === 0 ? CHARGE_STATUSES.PAID : CHARGE_STATUSES.PARTIALLY_PAID;

      // Insert allocation
      await tx.insert(paymentAllocations).values({
        id: crypto.randomUUID(),
        paymentId,
        chargeId: alloc.chargeId,
        allocatedAmountPaise: alloc.allocatedPaise,
      });

      // Update charge
      await tx
        .update(charges)
        .set({
          allocatedPaymentPaise: newAllocated,
          balancePaise: newBalance,
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(charges.id, alloc.chargeId));

      breakdownItems.push({
        chargeId: alloc.chargeId,
        title: charge.title,
        allocatedPaise: alloc.allocatedPaise,
      });
    }

    // 6. Calculate member's new total remaining balance
    const remainingBalanceResult = await tx.execute(
      sql`SELECT COALESCE(SUM(balance_paise), 0) as total_due FROM charges WHERE member_id = ${member.id} AND status != ${CHARGE_STATUSES.CANCELLED}`
    );
    const memberBalanceAfterPaise = Number(
      (remainingBalanceResult.rows[0] as { total_due: number }).total_due
    );

    // 7. Generate Receipt atomically
    const { receiptNumber, sequenceNumber } = await getNextReceiptNumber(tx);

    // Fetch gym settings for snapshot
    const settingsRows = await tx
      .select()
      .from(gymSettings)
      .where(eq(gymSettings.id, "default"))
      .limit(1);
    const settings = settingsRows[0] || {
      gymName: "IronPulse Fitness",
      address: "123 MG Road, Bengaluru, Karnataka",
      phone: "+91 98765 43210",
      taxIdNumber: null,
    };

    const receiptId = crypto.randomUUID();

    await tx.insert(receipts).values({
      id: receiptId,
      receiptNumber,
      sequenceNumber,
      paymentId,
      memberId: member.id,
      issuedByUserId: params.receivedByUserId,
      gymNameSnapshot: settings.gymName,
      gymAddressSnapshot: settings.address,
      gymPhoneSnapshot: settings.phone,
      gymTaxIdSnapshot: settings.taxIdNumber || null,
      memberCodeSnapshot: member.memberCode,
      memberNameSnapshot: member.name,
      memberPhoneSnapshot: member.phone,
      paymentAmountPaise: params.amountPaise,
      paymentMethod: params.paymentMethod,
      externalReference: params.externalReference || null,
      allocatedBreakdownJson: JSON.stringify(breakdownItems),
      memberBalanceAfterPaise,
    });

    // 8. Audit log
    await logAuditEvent({
      userId: params.receivedByUserId,
      action: "PAYMENT_RECORD",
      entityType: "PAYMENT",
      entityId: paymentId,
      details: {
        receiptNumber,
        amountPaise: params.amountPaise,
        paymentMethod: params.paymentMethod,
        balanceAfterPaise: memberBalanceAfterPaise,
      },
      tx,
    });

    return {
      paymentId,
      paymentNumber,
      receiptId,
      receiptNumber,
      amountPaise: params.amountPaise,
      memberBalanceAfterPaise,
    };
  };

  if (txClient) {
    return execute(txClient);
  }
  return db.transaction(execute);
}

/**
 * Issues a refund for a payment (Owner only).
 * Refunds cannot exceed eligible unrefunded payments.
 */
export async function issueRefund(params: {
  paymentId: string;
  amountPaise: number;
  reason: string;
  ownerUserId: string;
  paymentMethod?: PaymentMethod;
  externalReference?: string | null;
}): Promise<{ refundId: string; refundedAmountPaise: number }> {
  if (params.amountPaise <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }

  return db.transaction(async (tx) => {
    // Lock payment row
    const paymentRows = await tx.execute(
      sql`SELECT * FROM payments WHERE id = ${params.paymentId} FOR UPDATE`
    );
    if (paymentRows.rows.length === 0) {
      throw new Error("Payment record not found");
    }
    const payment = paymentRows.rows[0] as unknown as {
      id: string;
      member_id: string;
      amount_paise: number;
      is_reversed: boolean;
    };

    if (payment.is_reversed) {
      throw new Error("Cannot issue a refund against a reversed payment");
    }

    // Check existing refunds for this payment
    const existingRefundsRows = await tx.execute(
      sql`SELECT COALESCE(SUM(amount_paise), 0) as total_refunded FROM refunds WHERE payment_id = ${params.paymentId}`
    );
    const alreadyRefunded = Number(
      (existingRefundsRows.rows[0] as { total_refunded: number }).total_refunded
    );
    const eligibleAmount = Number(payment.amount_paise) - alreadyRefunded;

    if (params.amountPaise > eligibleAmount) {
      throw new Error(
        `Refund amount of ${formatINR(params.amountPaise)} exceeds eligible unrefunded amount of ${formatINR(eligibleAmount)}`
      );
    }

    const refundId = crypto.randomUUID();

    await tx.insert(refunds).values({
      id: refundId,
      paymentId: payment.id,
      memberId: payment.member_id,
      amountPaise: params.amountPaise,
      reason: params.reason,
      approvedByUserId: params.ownerUserId,
      paymentMethod: params.paymentMethod || PAYMENT_METHODS.CASH,
      externalReference: params.externalReference || null,
    });

    await logAuditEvent({
      userId: params.ownerUserId,
      action: "PAYMENT_REFUND",
      entityType: "PAYMENT",
      entityId: payment.id,
      reason: params.reason,
      details: {
        refundId,
        amountPaise: params.amountPaise,
      },
      tx,
    });

    return {
      refundId,
      refundedAmountPaise: params.amountPaise,
    };
  });
}

/**
 * Reverses an erroneous payment (Owner only).
 * Reopens charges by undoing allocations.
 */
export async function reversePayment(params: {
  paymentId: string;
  reversalReason: string;
  ownerUserId: string;
}): Promise<void> {
  return db.transaction(async (tx) => {
    // Lock payment row
    const paymentRows = await tx.execute(
      sql`SELECT * FROM payments WHERE id = ${params.paymentId} FOR UPDATE`
    );
    if (paymentRows.rows.length === 0) {
      throw new Error("Payment record not found");
    }
    const payment = paymentRows.rows[0] as unknown as {
      id: string;
      member_id: string;
      is_reversed: boolean;
    };

    if (payment.is_reversed) {
      throw new Error("Payment has already been reversed");
    }

    // Check if any refunds exist against this payment
    const refundRows = await tx
      .select()
      .from(refunds)
      .where(eq(refunds.paymentId, params.paymentId))
      .limit(1);

    if (refundRows.length > 0) {
      throw new Error("Cannot reverse payment that already has issued refunds");
    }

    // Fetch allocations
    const allocRows = await tx
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, params.paymentId));

    // Rollback allocations on charges
    for (const alloc of allocRows) {
      const chargeRows = await tx.execute(
        sql`SELECT * FROM charges WHERE id = ${alloc.chargeId} FOR UPDATE`
      );
      if (chargeRows.rows.length > 0) {
        const charge = chargeRows.rows[0] as unknown as {
          allocated_payment_paise: number;
          balance_paise: number;
        };
        const newAllocated = Math.max(
          0,
          Number(charge.allocated_payment_paise) - alloc.allocatedAmountPaise
        );
        const newBalance = Number(charge.balance_paise) + alloc.allocatedAmountPaise;

        await tx
          .update(charges)
          .set({
            allocatedPaymentPaise: newAllocated,
            balancePaise: newBalance,
            status: CHARGE_STATUSES.PARTIALLY_PAID,
            updatedAt: new Date(),
          })
          .where(eq(charges.id, alloc.chargeId));
      }
    }

    // Mark payment reversed
    await tx
      .update(payments)
      .set({
        isReversed: true,
        reversedAt: new Date(),
        reversalReason: params.reversalReason,
        reversedByUserId: params.ownerUserId,
      })
      .where(eq(payments.id, params.paymentId));

    await logAuditEvent({
      userId: params.ownerUserId,
      action: "PAYMENT_REVERSE",
      entityType: "PAYMENT",
      entityId: params.paymentId,
      reason: params.reversalReason,
      tx,
    });
  });
}
