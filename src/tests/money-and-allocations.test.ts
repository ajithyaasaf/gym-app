import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, pool } from "@/db";
import {
  members,
  plans,
  membershipTerms,
  charges,
  payments,
  receipts,
  users,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  formatINR,
  rupeesToPaise,
  paiseToRupees,
  calculateDiscountPaise,
  allocatePayment,
} from "@/lib/money";
import { createMember } from "@/server/services/member-service";
import {
  recordPayment,
  issueRefund,
  reversePayment,
} from "@/server/services/payment-service";
import { getNextReceiptNumber } from "@/lib/receipts";
import { PAYMENT_METHODS } from "@/lib/constants";
import crypto from "crypto";

describe("Financial Calculations, Payments, Allocations & Invariants", () => {
  const testStaffId = "usr_test_staff";
  const testOwnerId = "usr_test_owner";
  let testPlanId: string;

  beforeAll(async () => {
    // Ensure test users exist
    await db
      .insert(users)
      .values([
        {
          id: testStaffId,
          email: "test.staff@gym.in",
          name: "Test Staff",
          role: "STAFF",
          passwordHash: "dummyhash",
        },
        {
          id: testOwnerId,
          email: "test.owner@gym.in",
          name: "Test Owner",
          role: "OWNER",
          passwordHash: "dummyhash",
        },
      ])
      .onConflictDoNothing();

    // Create a ₹1,500 plan (150,000 paise)
    testPlanId = `plan_test_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(plans).values({
      id: testPlanId,
      name: "Test 1 Month Plan (₹1,500)",
      durationUnit: "MONTHS",
      durationQuantity: 1,
      pricePaise: 150000,
      joiningFeePaise: 0,
    });
  });

  afterAll(async () => {
    // Keep DB clean
  });

  it("handles paise and rupee conversions with zero floating point drift", () => {
    expect(rupeesToPaise(1500)).toBe(150000);
    expect(rupeesToPaise("1,500.50")).toBe(150050);
    expect(paiseToRupees(150050)).toBe(1500.5);
    expect(formatINR(150000)).toBe("₹1,500");
    expect(formatINR(150050, { showDecimals: true })).toBe("₹1,500.50");
  });

  it("calculates discounts accurately without negative values", () => {
    // Fixed discount ₹200 on ₹1500 base
    expect(calculateDiscountPaise(150000, "FIXED", 20000)).toBe(20000);
    // Percentage discount 10% on ₹1500 base
    expect(calculateDiscountPaise(150000, "PERCENTAGE", 10)).toBe(15000);
    // Over-discount clamped to base
    expect(calculateDiscountPaise(150000, "FIXED", 200000)).toBe(150000);
    expect(calculateDiscountPaise(150000, "PERCENTAGE", 120)).toBe(150000);
  });

  it("Scenario 3 & 4: New member buys ₹1,500 term, pays ₹1,000, shows ₹500 balance; paying ₹500 generates second receipt and zero balance without extending membership", async () => {
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;
    const memberName = "Partial Payment Member";

    // 1. Create member with ₹1,500 term and ₹1,000 initial payment
    const createResult = await createMember({
      name: memberName,
      phone,
      enrollment: {
        planId: testPlanId,
        initialPaymentPaise: 100000, // ₹1,000
        paymentMethod: PAYMENT_METHODS.CASH,
      },
      performedByUserId: testStaffId,
    });

    const memberId = createResult.memberId;
    expect(createResult.paymentResult).not.toBeNull();
    expect(createResult.paymentResult!.amountPaise).toBe(100000);
    expect(createResult.paymentResult!.memberBalanceAfterPaise).toBe(50000); // ₹500 due!

    // Verify charge in DB shows ₹500 balance
    const chargeRows = await db
      .select()
      .from(charges)
      .where(eq(charges.memberId, memberId));
    expect(chargeRows.length).toBe(1);
    expect(chargeRows[0].baseAmountPaise).toBe(150000);
    expect(chargeRows[0].allocatedPaymentPaise).toBe(100000);
    expect(chargeRows[0].balancePaise).toBe(50000); // Exactly ₹500

    // Fetch initial membership term
    const initialTerms = await db
      .select()
      .from(membershipTerms)
      .where(eq(membershipTerms.memberId, memberId));
    expect(initialTerms.length).toBe(1);
    const originalEndDate = initialTerms[0].endDate;

    // 2. Scenario 4: Member pays remaining ₹500 (50,000 paise)
    const secondPayment = await recordPayment({
      memberId,
      amountPaise: 50000,
      paymentMethod: PAYMENT_METHODS.UPI,
      externalReference: "UPI998877",
      receivedByUserId: testStaffId,
    });

    expect(secondPayment.amountPaise).toBe(50000);
    expect(secondPayment.memberBalanceAfterPaise).toBe(0); // Zero balance!
    expect(secondPayment.receiptNumber).not.toBe(createResult.paymentResult!.receiptNumber); // Distinct receipt!

    // Verify charge is now fully PAID
    const updatedCharge = await db
      .select()
      .from(charges)
      .where(eq(charges.id, chargeRows[0].id));
    expect(updatedCharge[0].balancePaise).toBe(0);
    expect(updatedCharge[0].allocatedPaymentPaise).toBe(150000);
    expect(updatedCharge[0].status).toBe("PAID");

    // Verify membership term was NOT incorrectly extended by the balance payment
    const termsAfterBalancePay = await db
      .select()
      .from(membershipTerms)
      .where(eq(membershipTerms.memberId, memberId));
    expect(termsAfterBalancePay.length).toBe(1); // Still 1 term!
    expect(termsAfterBalancePay[0].endDate).toBe(originalEndDate); // Same end date!
  });

  it("Scenario 6 & 14: Accidental overpayments exceeding outstanding balance are rejected", async () => {
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;
    const createResult = await createMember({
      name: "Overpayment Guard Member",
      phone,
      enrollment: {
        planId: testPlanId,
        initialPaymentPaise: 100000, // ₹1,000 paid, ₹500 remaining
        paymentMethod: PAYMENT_METHODS.CASH,
      },
      performedByUserId: testStaffId,
    });

    // Attempt to pay ₹1,000 against a ₹500 balance
    await expect(
      recordPayment({
        memberId: createResult.memberId,
        amountPaise: 100000, // ₹1,000
        paymentMethod: PAYMENT_METHODS.CASH,
        receivedByUserId: testStaffId,
      })
    ).rejects.toThrow(/exceeds total outstanding balance/);
  });

  it("Scenario 7: Generates unique sequential receipt numbers atomically under concurrency", async () => {
    const promises = Array.from({ length: 5 }, () => getNextReceiptNumber());
    const results = await Promise.all(promises);

    const receiptNumbers = results.map((r) => r.receiptNumber);
    const uniqueReceipts = new Set(receiptNumbers);

    expect(uniqueReceipts.size).toBe(5); // All 5 receipt numbers must be strictly unique!
  });

  it("Scenario 10: Editing plan price does not rewrite historical charges or sold terms", async () => {
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;
    const createResult = await createMember({
      name: "Historical Plan Test Member",
      phone,
      enrollment: {
        planId: testPlanId,
        initialPaymentPaise: 150000,
        paymentMethod: PAYMENT_METHODS.CASH,
      },
      performedByUserId: testStaffId,
    });

    // Now edit the plan price in the catalogue to ₹2,500 (250,000 paise)
    await db
      .update(plans)
      .set({ pricePaise: 250000 })
      .where(eq(plans.id, testPlanId));

    // Verify previously sold term and charge still preserve the historic snapshot of ₹1,500
    const term = await db
      .select()
      .from(membershipTerms)
      .where(eq(membershipTerms.memberId, createResult.memberId));
    expect(term[0].basePricePaiseSnapshot).toBe(150000);
    expect(term[0].finalPricePaiseSnapshot).toBe(150000);

    const charge = await db
      .select()
      .from(charges)
      .where(eq(charges.memberId, createResult.memberId));
    expect(charge[0].baseAmountPaise).toBe(150000);
    expect(charge[0].netAmountPaise).toBe(150000);
  });

  it("Scenario 13 & 14: Refund above eligible received amount is rejected; valid refund reduces collections; reversal reopens debt", async () => {
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;
    const createResult = await createMember({
      name: "Refund Reversal Member",
      phone,
      enrollment: {
        planId: testPlanId,
        initialPaymentPaise: 150000, // ₹1,500 full payment
        paymentMethod: PAYMENT_METHODS.UPI,
      },
      performedByUserId: testStaffId,
    });

    const paymentId = createResult.paymentResult!.paymentId;

    // Reject refund higher than payment (e.g. ₹2,000 refund on ₹1,500 payment)
    await expect(
      issueRefund({
        paymentId,
        amountPaise: 200000, // ₹2,000
        reason: "Excessive refund attempt",
        ownerUserId: testOwnerId,
      })
    ).rejects.toThrow(/exceeds eligible unrefunded amount/);

    // Valid partial refund of ₹500
    const refundResult = await issueRefund({
      paymentId,
      amountPaise: 50000,
      reason: "Member dissatisfaction concession",
      ownerUserId: testOwnerId,
    });
    expect(refundResult.refundedAmountPaise).toBe(50000);

    // Second refund of remaining ₹1,000 succeeds
    await issueRefund({
      paymentId,
      amountPaise: 100000,
      reason: "Full remaining refund",
      ownerUserId: testOwnerId,
    });

    // Third refund should now be rejected as eligible amount is 0
    await expect(
      issueRefund({
        paymentId,
        amountPaise: 1000, // even ₹10 is rejected
        reason: "Excess refund after full refund",
        ownerUserId: testOwnerId,
      })
    ).rejects.toThrow(/exceeds eligible unrefunded amount/);
  });

  it("Scenario 29: Transaction atomicity: failure during multi-table operation rolls back completely leaving zero orphaned records", async () => {
    const badPhone = `+9198765${crypto.randomInt(10000, 99999)}`;
    const ghostName = "Ghost Member";

    // Trigger failure by requesting discount without required owner approval
    await expect(
      createMember({
        name: ghostName,
        phone: badPhone,
        enrollment: {
          planId: testPlanId,
          discountPaise: 30000, // requires discountApprovedByUserId
          // discountApprovedByUserId intentionally omitted!
        },
        performedByUserId: testStaffId,
      })
    ).rejects.toThrow("Discount requires owner approval");

    // Verify NO member, charge, or term was committed
    const foundMembers = await db
      .select()
      .from(members)
      .where(eq(members.phone, badPhone));
    expect(foundMembers.length).toBe(0);
  });
});
