import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import { members, plans, enquiries, membershipTerms, charges, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createMember,
  updateMember,
  archiveMember,
} from "@/server/services/member-service";
import {
  createEnquiry,
  convertEnquiryToMember,
} from "@/server/services/enquiry-service";
import {
  pauseMembershipTerm,
  resumeMembershipEarly,
} from "@/server/services/membership-service";
import { withIdempotency } from "@/lib/idempotency";
import { normalizeIndianPhone } from "@/lib/phone";
import { addDays } from "@/lib/dates";
import crypto from "crypto";

describe("Members, Enquiries, Pauses, and Concurrency Scenarios", () => {
  const staffId = "usr_test_staff";
  const ownerId = "usr_test_owner";
  let planId: string;

  beforeAll(async () => {
    planId = `plan_enq_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(plans).values({
      id: planId,
      name: "Enquiry Test Plan",
      durationUnit: "MONTHS",
      durationQuantity: 1,
      pricePaise: 120000,
      joiningFeePaise: 0,
    });
  });

  it("normalizes Indian phone numbers consistently", () => {
    expect(normalizeIndianPhone("9876543210")).toBe("+919876543210");
    expect(normalizeIndianPhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeIndianPhone("09876543210")).toBe("+919876543210");
    expect(normalizeIndianPhone("91-98765-43210")).toBe("+919876543210");
    expect(() => normalizeIndianPhone("12345")).toThrow(/Invalid Indian mobile number/);
    expect(() => normalizeIndianPhone("5876543210")).toThrow(/Must be a valid 10-digit number/); // must start with 6-9
  });

  it("Scenario 19: Requires explicit acknowledgement for shared family phone numbers", async () => {
    const sharedPhone = `+9198765${crypto.randomInt(10000, 99999)}`;

    // Create first family member
    await createMember({
      name: "Rajesh Sharma (Father)",
      phone: sharedPhone,
      performedByUserId: staffId,
    });

    // Attempt to create second family member with same phone without acknowledgement
    await expect(
      createMember({
        name: "Rohit Sharma (Son)",
        phone: sharedPhone,
        sharedPhoneAcknowledged: false, // Not acknowledged!
        performedByUserId: staffId,
      })
    ).rejects.toThrow(/already exists with phone number/);

    // Now create with explicit acknowledgement
    const secondMember = await createMember({
      name: "Rohit Sharma (Son)",
      phone: sharedPhone,
      sharedPhoneAcknowledged: true, // Explicitly acknowledged!
      performedByUserId: staffId,
    });

    expect(secondMember.memberId).toBeDefined();
    expect(secondMember.memberCode).toBeDefined();
  });

  it("Scenario 11: Two concurrent member edits detect conflicts instead of silently losing changes (Optimistic Locking)", async () => {
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;
    const created = await createMember({
      name: "Concurrency Test Member",
      phone,
      performedByUserId: staffId,
    });

    // User A and User B both load the member record (version = 1)
    const initialVersion = 1;

    // User A successfully updates the member
    const userAUpdate = await updateMember({
      memberId: created.memberId,
      expectedVersion: initialVersion,
      name: "Updated Name by User A",
      phone,
      performedByUserId: staffId,
    });
    expect(userAUpdate.version).toBe(2);

    // User B tries to update using the stale version (version = 1)
    await expect(
      updateMember({
        memberId: created.memberId,
        expectedVersion: initialVersion, // Stale!
        name: "Overwriting Name by User B",
        phone,
        performedByUserId: staffId,
      })
    ).rejects.toThrow(/CONCURRENT_MODIFICATION_CONFLICT/);
  });

  it("Scenario 19: Enquiry conversion prevents duplicate conversion", async () => {
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;
    const { enquiryId } = await createEnquiry({
      name: "Prospect Neha",
      phone,
      interestNotes: "Interested in HIIT",
      performedByUserId: staffId,
    });

    // First conversion succeeds
    const conversion = await convertEnquiryToMember({
      enquiryId,
      performedByUserId: staffId,
    });
    expect(conversion.memberId).toBeDefined();

    // Second conversion attempt must be rejected!
    await expect(
      convertEnquiryToMember({
        enquiryId,
        performedByUserId: staffId,
      })
    ).rejects.toThrow(/already been converted/);
  });

  it("Scenario 12: Pause extends the term; overlapping pauses fail; early resume recalculates extension", async () => {
    const phone = `+9198765${crypto.randomInt(10000, 99999)}`;
    const created = await createMember({
      name: "Pause Test Member",
      phone,
      enrollment: {
        planId,
        startDate: "2026-11-01",
      },
      performedByUserId: staffId,
    });

    const termId = created.termResult!.termId;
    const term = await db
      .select()
      .from(membershipTerms)
      .where(eq(membershipTerms.id, termId));
    const originalEndDate = term[0].endDate; // 2026-12-01

    // 1. Pause for 7 days (2026-11-10 to 2026-11-17)
    const pauseResult = await pauseMembershipTerm({
      termId,
      startDate: "2026-11-10",
      endDate: "2026-11-17",
      reason: "Traveling out of city",
      ownerUserId: ownerId,
    });

    expect(pauseResult.shiftedDays).toBe(7);
    expect(pauseResult.extendedEndDate).toBe(addDays(originalEndDate, 7));

    // Overlapping pause must fail
    await expect(
      pauseMembershipTerm({
        termId,
        startDate: "2026-11-12",
        endDate: "2026-11-20",
        reason: "Overlapping attempt",
        ownerUserId: ownerId,
      })
    ).rejects.toThrow(/Overlapping pause already exists/);

    // 2. Early resume: Resumed early on 2026-11-14 (actual paused days = 4 instead of 7)
    const resumeResult = await resumeMembershipEarly({
      pauseId: pauseResult.pauseId,
      resumeDate: "2026-11-14",
      ownerUserId: ownerId,
    });

    expect(resumeResult.actualDaysPaused).toBe(4);
    expect(resumeResult.adjustedEndDate).toBe(addDays(originalEndDate, 4));
  });

  it("Scenario 5: Idempotency keys prevent duplicate executions on network retries", async () => {
    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    let executionCount = 0;

    const payload = { amount: 500, test: "value" };

    const action = async () => {
      executionCount++;
      return { statusCode: 200, data: { success: true, count: executionCount } };
    };

    // First call executes
    const firstCall = await withIdempotency({
      key: idempotencyKey,
      action: "TEST_PAYMENT",
      payload,
      handler: action,
    });

    expect(firstCall.isCached).toBe(false);
    expect(firstCall.data.count).toBe(1);
    expect(executionCount).toBe(1);

    // Second call with SAME key and SAME payload returns cached result without re-executing
    const secondCall = await withIdempotency({
      key: idempotencyKey,
      action: "TEST_PAYMENT",
      payload,
      handler: action,
    });

    expect(secondCall.isCached).toBe(true);
    expect(secondCall.data.count).toBe(1);
    expect(executionCount).toBe(1); // Not incremented!

    // Third call with SAME key but CHANGED payload throws 409 conflict
    await expect(
      withIdempotency({
        key: idempotencyKey,
        action: "TEST_PAYMENT",
        payload: { amount: 999, test: "different" },
        handler: action,
      })
    ).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
  });
});

