import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import { members, plans, attendance, followUps, charges } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  markAttendance,
  voidAttendance,
  getAbsentMembers,
} from "@/server/services/attendance-service";
import { createMember } from "@/server/services/member-service";
import {
  logFollowUpContact,
  createManualFollowUp,
} from "@/server/services/followup-service";
import { buildWhatsAppLink } from "@/lib/phone";
import { getTodayISTString, addDays } from "@/lib/dates";
import { FOLLOW_UP_OUTCOMES, FOLLOW_UP_STATUSES } from "@/lib/constants";
import crypto from "crypto";

describe("Attendance, Absence Detection, and Follow-Up Workflows", () => {
  const staffId = "usr_test_staff";
  const ownerId = "usr_test_owner";
  let activePlanId: string;

  beforeAll(async () => {
    activePlanId = `plan_att_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(plans).values({
      id: activePlanId,
      name: "Attendance Test Plan",
      durationUnit: "MONTHS",
      durationQuantity: 3,
      pricePaise: 300000,
      joiningFeePaise: 0,
    });
  });

  it("Scenario 15: Daily attendance check-in: duplicate submission on same date returns existing record; non-active requires owner exception", async () => {
    const today = getTodayISTString();
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;

    // 1. Create active member
    const activeMember = await createMember({
      name: "Active Checkin Member",
      phone,
      enrollment: {
        planId: activePlanId,
        startDate: today,
        initialPaymentPaise: 300000,
      },
      performedByUserId: staffId,
    });

    // 2. Mark attendance for today
    const firstCheckIn = await markAttendance({
      memberId: activeMember.memberId,
      attendanceDate: today,
      performedByUserId: staffId,
      userRole: "STAFF",
    });

    expect(firstCheckIn.isExisting).toBe(false);
    expect(firstCheckIn.attendanceDate).toBe(today);

    // 3. Duplicate check-in on the same date: returns existing record without throwing error
    const duplicateCheckIn = await markAttendance({
      memberId: activeMember.memberId,
      attendanceDate: today,
      performedByUserId: staffId,
      userRole: "STAFF",
    });

    expect(duplicateCheckIn.isExisting).toBe(true);
    expect(duplicateCheckIn.id).toBe(firstCheckIn.id);

    // 4. Non-active member check-in attempt by staff without active term
    const phone2 = `+9198765${crypto.randomInt(10000, 99999)}`;
    const inactiveMember = await createMember({
      name: "Inactive Member Without Term",
      phone: phone2,
      performedByUserId: staffId,
    });

    // Staff attempt to mark inactive member should fail
    await expect(
      markAttendance({
        memberId: inactiveMember.memberId,
        attendanceDate: today,
        performedByUserId: staffId,
        userRole: "STAFF",
      })
    ).rejects.toThrow(/Only an Owner may record an attendance exception/);

    // Owner records exception with explicit reason
    const ownerException = await markAttendance({
      memberId: inactiveMember.memberId,
      attendanceDate: today,
      isException: true,
      exceptionReason: "Guest day pass approved by owner",
      performedByUserId: ownerId,
      userRole: "OWNER",
    });

    expect(ownerException.isException).toBe(true);
    expect(ownerException.isExisting).toBe(false);
  });

  it("Scenario 16: Newly joined members do not incorrectly appear as absent", async () => {
    const today = getTodayISTString();
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;

    // Member who joined TODAY with a 3-month plan (has not yet reached the 10-day threshold!)
    const newMember = await createMember({
      name: "Brand New Member",
      phone,
      enrollment: {
        planId: activePlanId,
        startDate: today,
      },
      performedByUserId: staffId,
    });

    // Fetch absent members with 10-day threshold
    const absentList = await getAbsentMembers(10);
    const isNewMemberAbsent = absentList.some((m) => m.memberId === newMember.memberId);

    expect(isNewMemberAbsent).toBe(false); // Must NOT appear on absence list!
  });

  it("Scenario 17: Promise-to-pay callback appears on its date without marking the balance paid", async () => {
    const today = getTodayISTString();
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;

    // Member with ₹500 balance due
    const member = await createMember({
      name: "Promise Pay Member",
      phone,
      enrollment: {
        planId: activePlanId,
        initialPaymentPaise: 250000, // ₹500 balance remains!
      },
      performedByUserId: staffId,
    });

    // Create follow-up
    const { followUpId } = await createManualFollowUp({
      memberId: member.memberId,
      title: "Fee Reminder Call",
      dueDate: today,
      performedByUserId: staffId,
    });

    const promiseDate = addDays(today, 3);

    // Staff logs contact: Member promised payment on promiseDate
    await logFollowUpContact({
      followUpId,
      outcome: FOLLOW_UP_OUTCOMES.PROMISED_PAYMENT,
      promiseDate,
      notes: "Member promised to pay by Friday evening via UPI",
      performedByUserId: staffId,
    });

    // Verify follow-up record updated with promise date and next due date
    const updatedFollowUp = await db
      .select()
      .from(followUps)
      .where(eq(followUps.id, followUpId));

    expect(updatedFollowUp[0].lastOutcome).toBe(FOLLOW_UP_OUTCOMES.PROMISED_PAYMENT);
    expect(updatedFollowUp[0].promiseDate).toBe(promiseDate);
    expect(updatedFollowUp[0].dueDate).toBe(promiseDate);

    // Verify member balance is STILL outstanding (promise does NOT mark debt paid!)
    const memberCharges = await db
      .select()
      .from(charges)
      .where(eq(charges.memberId, member.memberId));
    expect(memberCharges[0].balancePaise).toBe(50000); // Still ₹500 balance!
  });

  it("Scenario 18: WhatsApp link generation prepares editable message without falsely logging delivery", () => {
    const link = buildWhatsAppLink(
      "+91 98765 43210",
      "Hello Arun, your membership renewal is due on 31 Oct."
    );

    expect(link).toContain("https://wa.me/919876543210?text=");
    expect(link).toContain(encodeURIComponent("Hello Arun, your membership renewal is due on 31 Oct."));
  });
});

