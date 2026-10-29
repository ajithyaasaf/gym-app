import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  payments,
  refunds,
  expenses,
  charges,
  members,
  membershipTerms,
  attendance,
  users,
} from "@/db/schema";
import { getTodayISTString, addDays } from "@/lib/dates";
import { CHARGE_STATUSES, MEMBERSHIP_STATUSES } from "@/lib/constants";

export interface DateFilter {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
}

export interface FinancialSummaryReport {
  startDate: string;
  endDate: string;
  grossCollectionsPaise: number;
  totalRefundsPaise: number;
  netCollectionsPaise: number;
  totalExpensesPaise: number;
  cashSurplusPaise: number; // Net collections - expenses
  totalOutstandingDuesPaise: number;
  paymentMethodTotals: Record<string, number>;
  expenseCategoryTotals: Record<string, number>;
  staffCollections: Array<{
    staffId: string;
    staffName: string;
    collectedPaise: number;
    transactionCount: number;
  }>;
  counts: {
    newMembersCount: number;
    renewalCount: number;
    attendanceCount: number;
  };
}

/**
 * Calculates central authoritative financial reports for a date filter.
 * Consistent definitions across dashboard and reports modules.
 */
export async function getFinancialSummary(
  filter?: DateFilter
): Promise<FinancialSummaryReport> {
  const today = getTodayISTString();
  const startDate = filter?.startDate || `${today.slice(0, 7)}-01`; // first day of current month
  const endDate = filter?.endDate || today;

  // Convert IST date boundaries to UTC timestamps for timestamp fields
  const startTimestamp = new Date(`${startDate}T00:00:00+05:30`);
  const endTimestamp = new Date(`${endDate}T23:59:59.999+05:30`);

  // 1. Gross payments received in period (excluding reversed payments)
  const paymentsQuery = await db.execute(sql`
    SELECT 
      COALESCE(SUM(amount_paise), 0) as gross_paise,
      payment_method,
      COALESCE(SUM(amount_paise), 0) as method_total
    FROM payments
    WHERE received_at >= ${startTimestamp} AND received_at <= ${endTimestamp}
      AND is_reversed = false
    GROUP BY payment_method
  `);

  let grossCollectionsPaise = 0;
  const paymentMethodTotals: Record<string, number> = {
    CASH: 0,
    UPI: 0,
    CARD: 0,
    BANK_TRANSFER: 0,
  };

  for (const row of paymentsQuery.rows as unknown as Array<{
    payment_method: string;
    method_total: number;
  }>) {
    const amt = Number(row.method_total);
    grossCollectionsPaise += amt;
    paymentMethodTotals[row.payment_method] = amt;
  }

  // 2. Refunds posted in period
  const refundsQuery = await db.execute(sql`
    SELECT COALESCE(SUM(amount_paise), 0) as total_refunds
    FROM refunds
    WHERE refunded_at >= ${startTimestamp} AND refunded_at <= ${endTimestamp}
  `);
  const totalRefundsPaise = Number(
    (refundsQuery.rows[0] as { total_refunds: number }).total_refunds
  );

  // Net collections
  const netCollectionsPaise = grossCollectionsPaise - totalRefundsPaise;

  // 3. Expenses recorded in period (excluding reversed expenses)
  const expensesQuery = await db.execute(sql`
    SELECT 
      COALESCE(SUM(e.amount_paise), 0) as total_expenses,
      c.name as category_name,
      COALESCE(SUM(e.amount_paise), 0) as category_total
    FROM expenses e
    JOIN expense_categories c ON e.category_id = c.id
    WHERE e.expense_date >= ${startDate} AND e.expense_date <= ${endDate}
      AND e.is_reversed = false
    GROUP BY c.name
  `);

  let totalExpensesPaise = 0;
  const expenseCategoryTotals: Record<string, number> = {};

  for (const row of expensesQuery.rows as unknown as Array<{
    category_name: string;
    category_total: number;
  }>) {
    const amt = Number(row.category_total);
    totalExpensesPaise += amt;
    expenseCategoryTotals[row.category_name] = amt;
  }

  // Cash surplus = Net collections - Expenses
  const cashSurplusPaise = netCollectionsPaise - totalExpensesPaise;

  // 4. Total outstanding dues across ALL non-cancelled charges
  // (Scenario 22: Archived/cancelled members with dues remain visible in outstanding reports)
  const duesQuery = await db.execute(sql`
    SELECT COALESCE(SUM(balance_paise), 0) as total_outstanding
    FROM charges
    WHERE status != ${CHARGE_STATUSES.CANCELLED} AND balance_paise > 0
  `);
  const totalOutstandingDuesPaise = Number(
    (duesQuery.rows[0] as { total_outstanding: number }).total_outstanding
  );

  // 5. Staff collections breakdown
  const staffQuery = await db.execute(sql`
    SELECT 
      u.id as staff_id,
      u.name as staff_name,
      COALESCE(SUM(p.amount_paise), 0) as collected_paise,
      COUNT(p.id) as tx_count
    FROM payments p
    JOIN users u ON p.received_by_user_id = u.id
    WHERE p.received_at >= ${startTimestamp} AND p.received_at <= ${endTimestamp}
      AND p.is_reversed = false
    GROUP BY u.id, u.name
    ORDER BY collected_paise DESC
  `);

  const staffCollections = (staffQuery.rows as unknown as Array<{
    staff_id: string;
    staff_name: string;
    collected_paise: number;
    tx_count: number;
  }>).map((r) => ({
    staffId: r.staff_id,
    staffName: r.staff_name,
    collectedPaise: Number(r.collected_paise),
    transactionCount: Number(r.tx_count),
  }));

  // 6. Counts (new members, renewals, attendance)
  const newMembersQuery = await db.execute(sql`
    SELECT count(*)::int as count FROM members
    WHERE created_at >= ${startTimestamp} AND created_at <= ${endTimestamp}
  `);
  const newMembersCount = (newMembersQuery.rows[0] as { count: number }).count;

  const renewalsQuery = await db.execute(sql`
    SELECT count(*)::int as count FROM membership_terms
    WHERE created_at >= ${startTimestamp} AND created_at <= ${endTimestamp}
      AND term_number > 1
  `);
  const renewalCount = (renewalsQuery.rows[0] as { count: number }).count;

  const attendanceQuery = await db.execute(sql`
    SELECT count(*)::int as count FROM attendance
    WHERE attendance_date >= ${startDate} AND attendance_date <= ${endDate}
      AND is_voided = false
  `);
  const attendanceCount = (attendanceQuery.rows[0] as { count: number }).count;

  return {
    startDate,
    endDate,
    grossCollectionsPaise,
    totalRefundsPaise,
    netCollectionsPaise,
    totalExpensesPaise,
    cashSurplusPaise,
    totalOutstandingDuesPaise,
    paymentMethodTotals,
    expenseCategoryTotals,
    staffCollections,
    counts: {
      newMembersCount,
      renewalCount,
      attendanceCount,
    },
  };
}

/**
 * Calculates operational stats for Dashboard:
 * Tailored for Owner vs Staff.
 */
export async function getDashboardStats(role: string) {
  const today = getTodayISTString();
  const monthStart = `${today.slice(0, 7)}-01`;
  const next7Days = addDays(today, 7);

  const todayStartTs = new Date(`${today}T00:00:00+05:30`);
  const todayEndTs = new Date(`${today}T23:59:59.999+05:30`);

  const monthStartTs = new Date(`${monthStart}T00:00:00+05:30`);

  // Active unique members count:
  // Must have a non-cancelled, non-paused term where startDate <= today and endDate > today
  // Member must not be archived.
  const activeMembersQuery = await db.execute(sql`
    SELECT count(DISTINCT m.id)::int as active_count
    FROM members m
    JOIN membership_terms t ON m.id = t.member_id
    WHERE m.is_archived = false
      AND t.status = ${MEMBERSHIP_STATUSES.ACTIVE}
      AND t.start_date <= ${today}
      AND t.end_date > ${today}
  `);
  const activeMembersCount = (activeMembersQuery.rows[0] as { active_count: number }).active_count;

  // Paused unique members count:
  const pausedMembersQuery = await db.execute(sql`
    SELECT count(DISTINCT m.id)::int as paused_count
    FROM members m
    JOIN membership_terms t ON m.id = t.member_id
    WHERE m.is_archived = false
      AND t.status = ${MEMBERSHIP_STATUSES.PAUSED}
      AND t.start_date <= ${today}
      AND t.end_date > ${today}
  `);
  const pausedMembersCount = (pausedMembersQuery.rows[0] as { paused_count: number }).paused_count;

  // Today unique attendance:
  const todayAttendanceQuery = await db.execute(sql`
    SELECT count(DISTINCT member_id)::int as attendance_count
    FROM attendance
    WHERE attendance_date = ${today} AND is_voided = false
  `);
  const todayAttendanceCount = (todayAttendanceQuery.rows[0] as { attendance_count: number }).attendance_count;

  // Upcoming expiries in next 7 days:
  const upcomingExpiriesQuery = await db.execute(sql`
    SELECT count(DISTINCT member_id)::int as expiries_count
    FROM membership_terms
    WHERE status = ${MEMBERSHIP_STATUSES.ACTIVE}
      AND valid_through >= ${today}
      AND valid_through <= ${next7Days}
  `);
  const upcomingExpiriesCount = (upcomingExpiriesQuery.rows[0] as { expiries_count: number }).expiries_count;

  // Overdue follow-ups & due today count:
  const followUpsQuery = await db.execute(sql`
    SELECT count(*)::int as count
    FROM follow_ups
    WHERE status IN ('PENDING', 'CONTACTED')
      AND due_date <= ${today}
  `);
  const dueFollowUpsCount = (followUpsQuery.rows[0] as { count: number }).count;

  const operationalStats = {
    activeMembersCount,
    pausedMembersCount,
    todayAttendanceCount,
    upcomingExpiriesCount,
    dueFollowUpsCount,
  };

  // If STAFF role, do not include aggregate financial numbers!
  if (role !== "OWNER") {
    return {
      isOwner: false as const,
      ...operationalStats,
    };
  }

  // Owner aggregate financials
  const todayCollectionsQuery = await db.execute(sql`
    SELECT COALESCE(SUM(amount_paise), 0) as total
    FROM payments
    WHERE received_at >= ${todayStartTs} AND received_at <= ${todayEndTs}
      AND is_reversed = false
  `);
  const todayCollectionsPaise = Number((todayCollectionsQuery.rows[0] as { total: number }).total);

  const monthCollectionsQuery = await db.execute(sql`
    SELECT COALESCE(SUM(amount_paise), 0) as total
    FROM payments
    WHERE received_at >= ${monthStartTs}
      AND is_reversed = false
  `);
  const monthCollectionsPaise = Number((monthCollectionsQuery.rows[0] as { total: number }).total);

  const monthRefundsQuery = await db.execute(sql`
    SELECT COALESCE(SUM(amount_paise), 0) as total
    FROM refunds
    WHERE refunded_at >= ${monthStartTs}
  `);
  const monthRefundsPaise = Number((monthRefundsQuery.rows[0] as { total: number }).total);

  const monthNetCollectionsPaise = monthCollectionsPaise - monthRefundsPaise;

  const duesQuery = await db.execute(sql`
    SELECT COALESCE(SUM(balance_paise), 0) as total
    FROM charges
    WHERE status != ${CHARGE_STATUSES.CANCELLED} AND balance_paise > 0
  `);
  const totalOutstandingDuesPaise = Number((duesQuery.rows[0] as { total: number }).total);

  return {
    isOwner: true as const,
    ...operationalStats,
    financials: {
      todayCollectionsPaise,
      monthCollectionsPaise,
      monthRefundsPaise,
      monthNetCollectionsPaise,
      totalOutstandingDuesPaise,
    },
  };
}
