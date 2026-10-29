import { eq, sql } from "drizzle-orm";
import { db, pool } from "./index";
import {
  plans,
  users,
  members,
  membershipTerms,
  charges,
  payments,
  paymentAllocations,
  receipts,
  attendance,
  enquiries,
  followUps,
  expenseCategories,
  expenseTemplates,
  expenses,
  gymSettings,
} from "./schema";
import { hashPassword } from "@/lib/auth";
import {
  USER_ROLES,
  CHARGE_TYPES,
  CHARGE_STATUSES,
  MEMBERSHIP_STATUSES,
  PAYMENT_METHODS,
  ENQUIRY_STATUSES,
  FOLLOW_UP_REASONS,
  FOLLOW_UP_STATUSES,
} from "@/lib/constants";
import { getTodayISTString, addDays, calculateTermDates } from "@/lib/dates";
import crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[SECURITY GUARD] Synthetic development seed is strictly prohibited in production!");
  }

  console.log("=== Seeding Gym Database with Realistic Synthetic Data ===");
  const today = getTodayISTString();

  // 1. Ensure Gym Settings
  await db
    .insert(gymSettings)
    .values({
      id: "default",
      gymName: "IronPulse Fitness Club",
      phone: "+91 98765 43210",
      email: "contact@ironpulse.in",
      address: "123 MG Road, Indiranagar, Bengaluru, Karnataka 560001",
      receiptPrefix: "REC",
      timezone: "Asia/Kolkata",
      absenceThresholdDays: 10,
    })
    .onConflictDoNothing();

  // 2. Staff Accounts
  const staffHash = await hashPassword("Staff@12345");
  const priyaId = "usr_staff_priya";
  const rahulId = "usr_staff_rahul";

  await db
    .insert(users)
    .values([
      {
        id: priyaId,
        email: "priya@ironpulse.in",
        name: "Priya Sharma (Reception)",
        role: USER_ROLES.STAFF,
        passwordHash: staffHash,
        isActive: true,
        mustChangePassword: false,
      },
      {
        id: rahulId,
        email: "rahul@ironpulse.in",
        name: "Rahul Verma (Desk)",
        role: USER_ROLES.STAFF,
        passwordHash: staffHash,
        isActive: true,
        mustChangePassword: false,
      },
    ])
    .onConflictDoNothing();

  // 3. Plans
  const standardPlans = [
    {
      id: "plan_1mo",
      name: "1 Month Regular",
      description: "Standard monthly gym access with cardio and strength equipment",
      durationUnit: "MONTHS",
      durationQuantity: 1,
      pricePaise: 150000, // ₹1,500
      joiningFeePaise: 50000, // ₹500
      isActive: true,
    },
    {
      id: "plan_3mo",
      name: "3 Months Transformation",
      description: "Quarterly fitness pack with free trainer orientation",
      durationUnit: "MONTHS",
      durationQuantity: 3,
      pricePaise: 400000, // ₹4,000
      joiningFeePaise: 0,
      isActive: true,
    },
    {
      id: "plan_6mo",
      name: "6 Months Consistency",
      description: "Half-yearly access with 1 guest pass per month",
      durationUnit: "MONTHS",
      durationQuantity: 6,
      pricePaise: 750000, // ₹7,500
      joiningFeePaise: 0,
      isActive: true,
    },
    {
      id: "plan_12mo",
      name: "Annual Elite Membership",
      description: "Full year unlimited access + locker facility",
      durationUnit: "MONTHS",
      durationQuantity: 12,
      pricePaise: 1400000, // ₹14,000
      joiningFeePaise: 0,
      isActive: true,
    },
    {
      id: "plan_10day",
      name: "10-Day Flex Pass",
      description: "Short term access pass for visitors",
      durationUnit: "DAYS",
      durationQuantity: 10,
      pricePaise: 70000, // ₹700
      joiningFeePaise: 0,
      isActive: true,
    },
  ];

  for (const p of standardPlans) {
    await db.insert(plans).values(p).onConflictDoNothing();
  }

  // 4. Expense Categories & Recurring Templates
  const rentCat = "cat_rent";
  const elecCat = "cat_electricity";
  const suppCat = "cat_supplies";

  await db
    .insert(expenseTemplates)
    .values([
      {
        id: "tmpl_rent",
        categoryId: rentCat,
        title: "Gym Space Rent",
        amountPaise: 6500000, // ₹65,000
        payee: "MG Properties Commercial Lease",
        defaultPaymentMethod: "BANK_TRANSFER",
        isActive: true,
      },
      {
        id: "tmpl_elec",
        categoryId: elecCat,
        title: "BESCOM Electricity Bill",
        amountPaise: 1850000, // ₹18,500
        payee: "BESCOM Power Utility",
        defaultPaymentMethod: "UPI",
        isActive: true,
      },
      {
        id: "tmpl_clean",
        categoryId: suppCat,
        title: "Sanitation & Towel Laundry",
        amountPaise: 800000, // ₹8,000
        payee: "CleanPro Services",
        defaultPaymentMethod: "CASH",
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  // Record an expense for this month
  const monthKey = today.slice(0, 7);
  await db
    .insert(expenses)
    .values({
      id: "exp_rent_current",
      categoryId: rentCat,
      expenseTemplateId: "tmpl_rent",
      templateMonthKey: monthKey,
      expenseDate: `${monthKey}-05`,
      title: `Gym Space Rent (${monthKey})`,
      payee: "MG Properties Commercial Lease",
      amountPaise: 6500000,
      paymentMethod: "BANK_TRANSFER",
      referenceNumber: "NEFT88239102",
      recordedByUserId: priyaId,
    })
    .onConflictDoNothing();

  // 5. Seed Members with diverse states (Active with zero dues, Active with dues, Upcoming, Expired, Paused)
  console.log("Seeding realistic member profiles and financial terms...");

  const syntheticMembers = [
    {
      id: "mem_arun",
      memberCode: "MEM-1001",
      name: "Arun Kumar",
      phone: "+919876510001",
      status: "ACTIVE_ZERO_DUE",
      planId: "plan_3mo",
      startOffset: -30,
      paidFraction: 1.0,
    },
    {
      id: "mem_sneha",
      memberCode: "MEM-1002",
      name: "Sneha Reddy",
      phone: "+919876510002",
      status: "ACTIVE_WITH_DUE",
      planId: "plan_1mo",
      startOffset: -10,
      paidFraction: 0.6667, // Paid 1000 out of 1500 (balance 500)
    },
    {
      id: "mem_vikram",
      memberCode: "MEM-1003",
      name: "Vikram Malhotra",
      phone: "+919876510003",
      status: "RENEWAL_DUE_SOON",
      planId: "plan_1mo",
      startOffset: -26, // Expires in 4 days!
      paidFraction: 1.0,
    },
    {
      id: "mem_ananya",
      memberCode: "MEM-1004",
      name: "Ananya Iyer",
      phone: "+919876510004",
      status: "EXPIRED",
      planId: "plan_1mo",
      startOffset: -45, // Expired 15 days ago
      paidFraction: 1.0,
    },
    {
      id: "mem_karthik",
      memberCode: "MEM-1005",
      name: "Karthik Nair",
      phone: "+919876510005",
      status: "ABSENT",
      planId: "plan_6mo",
      startOffset: -60,
      paidFraction: 1.0,
    },
  ];

  let seqNum = 1;
  for (const sm of syntheticMembers) {
    // Insert member
    await db
      .insert(members)
      .values({
        id: sm.id,
        memberCode: sm.memberCode,
        name: sm.name,
        phone: sm.phone,
        email: `${sm.id.replace("mem_", "")}@example.in`,
        version: 1,
      })
      .onConflictDoNothing();

    // Find plan
    const plan = standardPlans.find((p) => p.id === sm.planId)!;
    const termStartDate = addDays(today, sm.startOffset);
    const { endDate, validThrough } = calculateTermDates(
      termStartDate,
      plan.durationUnit as "DAYS" | "MONTHS",
      plan.durationQuantity
    );

    const termStatus =
      endDate <= today
        ? MEMBERSHIP_STATUSES.EXPIRED
        : termStartDate > today
        ? MEMBERSHIP_STATUSES.UPCOMING
        : MEMBERSHIP_STATUSES.ACTIVE;

    const termId = `term_${sm.id}`;
    const chargeId = `chg_${sm.id}`;
    const totalPaise = plan.pricePaise;

    await db
      .insert(membershipTerms)
      .values({
        id: termId,
        memberId: sm.id,
        planId: plan.id,
        termNumber: 1,
        status: termStatus,
        startDate: termStartDate,
        endDate,
        validThrough,
        originalEndDate: endDate,
        planNameSnapshot: plan.name,
        durationUnitSnapshot: plan.durationUnit,
        durationQuantitySnapshot: plan.durationQuantity,
        basePricePaiseSnapshot: plan.pricePaise,
        finalPricePaiseSnapshot: totalPaise,
      })
      .onConflictDoNothing();

    const paymentAmount = Math.round(totalPaise * sm.paidFraction);
    const balancePaise = totalPaise - paymentAmount;

    await db
      .insert(charges)
      .values({
        id: chargeId,
        memberId: sm.id,
        termId,
        chargeType: CHARGE_TYPES.MEMBERSHIP,
        title: `${plan.name} Membership`,
        baseAmountPaise: totalPaise,
        netAmountPaise: totalPaise,
        allocatedPaymentPaise: paymentAmount,
        balancePaise,
        dueDate: termStartDate,
        status: balancePaise === 0 ? CHARGE_STATUSES.PAID : CHARGE_STATUSES.PARTIALLY_PAID,
      })
      .onConflictDoNothing();

    if (paymentAmount > 0) {
      const paymentId = `pay_${sm.id}`;
      await db
        .insert(payments)
        .values({
          id: paymentId,
          paymentNumber: `PAY-2026-000${sm.memberCode.slice(-3)}`,
          memberId: sm.id,
          amountPaise: paymentAmount,
          paymentMethod: PAYMENT_METHODS.UPI,
          externalReference: `UPI${crypto.randomInt(100000, 999999)}`,
          receivedByUserId: priyaId,
        })
        .onConflictDoNothing();

      await db
        .insert(paymentAllocations)
        .values({
          id: `alloc_${sm.id}`,
          paymentId,
          chargeId,
          allocatedAmountPaise: paymentAmount,
        })
        .onConflictDoNothing();

      await db
        .insert(receipts)
        .values({
          id: `rec_${sm.id}`,
          receiptNumber: `REC-2026-000${sm.memberCode.slice(-3)}`,
          sequenceNumber: seqNum++,
          paymentId,
          memberId: sm.id,
          issuedByUserId: priyaId,
          gymNameSnapshot: "IronPulse Fitness Club",
          gymAddressSnapshot: "123 MG Road, Bengaluru",
          gymPhoneSnapshot: "+91 98765 43210",
          memberCodeSnapshot: sm.memberCode,
          memberNameSnapshot: sm.name,
          memberPhoneSnapshot: sm.phone,
          paymentAmountPaise: paymentAmount,
          paymentMethod: PAYMENT_METHODS.UPI,
          allocatedBreakdownJson: JSON.stringify([
            { title: `${plan.name} Membership`, allocatedPaise: paymentAmount },
          ]),
          memberBalanceAfterPaise: balancePaise,
        })
        .onConflictDoNothing();
    }

    // Attendance records (except for absent member Karthik)
    if (sm.status !== "ABSENT") {
      await db
        .insert(attendance)
        .values({
          id: `att_${sm.id}_today`,
          memberId: sm.id,
          attendanceDate: today,
          markedByUserId: priyaId,
          isException: false,
          isVoided: false,
        })
        .onConflictDoNothing();
    }
  }

  // 6. Enquiries & Follow-ups
  await db
    .insert(enquiries)
    .values([
      {
        id: "enq_manoj",
        name: "Manoj Gowda",
        phone: "+919876520001",
        interestNotes: "Looking for morning strength workouts",
        trialDate: addDays(today, 1),
        status: ENQUIRY_STATUSES.NEW,
        nextFollowUpDate: today,
        assignedStaffId: rahulId,
      },
      {
        id: "enq_deepa",
        name: "Deepa Nair",
        phone: "+919876520002",
        interestNotes: "Weight loss inquiry for evening hours",
        status: ENQUIRY_STATUSES.CONTACTED,
        nextFollowUpDate: addDays(today, 2),
        assignedStaffId: priyaId,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(followUps)
    .values([
      {
        id: "flw_sneha_balance",
        memberId: "mem_sneha",
        reasonType: FOLLOW_UP_REASONS.OVERDUE_BALANCE,
        title: "Sneha Reddy - ₹500 balance due for 1 Month plan",
        dueDate: today,
        assignedStaffId: priyaId,
        status: FOLLOW_UP_STATUSES.PENDING,
      },
      {
        id: "flw_vikram_expiry",
        memberId: "mem_vikram",
        reasonType: FOLLOW_UP_REASONS.RENEWAL_UPCOMING,
        title: "Vikram Malhotra - Membership expires in 4 days",
        dueDate: today,
        assignedStaffId: rahulId,
        status: FOLLOW_UP_STATUSES.PENDING,
      },
    ])
    .onConflictDoNothing();

  console.log("[SUCCESS] Seed completed with plans, members, charges, receipts, attendance, and follow-ups!");
  await pool.end();
}

seed().catch(async (err) => {
  console.error("[ERROR] Seed failed:", err);
  await pool.end();
  process.exit(1);
});
