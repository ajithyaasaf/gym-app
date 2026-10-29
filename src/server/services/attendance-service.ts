import { eq, and, sql, desc, notInArray, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attendance,
  members,
  membershipTerms,
  gymSettings,
} from "@/db/schema";
import {
  getTodayISTString,
  addDays,
  differenceInCalendarDays,
} from "@/lib/dates";
import { MEMBERSHIP_STATUSES, USER_ROLES, type UserRole } from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

export interface MarkAttendanceParams {
  memberId: string;
  attendanceDate?: string; // defaults to today IST
  isException?: boolean;
  exceptionReason?: string;
  performedByUserId: string;
  userRole: UserRole;
}

export interface AttendanceRecordResult {
  id: string;
  memberId: string;
  attendanceDate: string;
  isException: boolean;
  isExisting: boolean;
}

/**
 * Checks member's status on a given business date.
 */
export async function getMemberStatusOnDate(
  memberId: string,
  targetDate: string
): Promise<{ status: string; validThrough?: string }> {
  // Check non-cancelled terms where targetDate >= startDate and targetDate < endDate
  const terms = await db
    .select()
    .from(membershipTerms)
    .where(
      and(
        eq(membershipTerms.memberId, memberId),
        sql`${membershipTerms.status} != ${MEMBERSHIP_STATUSES.CANCELLED}`,
        sql`${membershipTerms.startDate} <= ${targetDate} AND ${membershipTerms.endDate} > ${targetDate}`
      )
    )
    .limit(1);

  if (terms.length > 0) {
    const term = terms[0];
    if (term.status === MEMBERSHIP_STATUSES.PAUSED) {
      return { status: "PAUSED", validThrough: term.validThrough };
    }
    return { status: "ACTIVE", validThrough: term.validThrough };
  }

  // Check if upcoming
  const upcomingTerms = await db
    .select()
    .from(membershipTerms)
    .where(
      and(
        eq(membershipTerms.memberId, memberId),
        sql`${membershipTerms.status} != ${MEMBERSHIP_STATUSES.CANCELLED}`,
        sql`${membershipTerms.startDate} > ${targetDate}`
      )
    )
    .limit(1);

  if (upcomingTerms.length > 0) {
    return { status: "UPCOMING" };
  }

  return { status: "EXPIRED" };
}

/**
 * Marks daily attendance for a member in Asia/Kolkata business date.
 * Duplicate submission on the same date returns the existing record.
 */
export async function markAttendance(
  params: MarkAttendanceParams
): Promise<AttendanceRecordResult> {
  const todayIST = getTodayISTString();
  const attendanceDate = params.attendanceDate || todayIST;

  // Prevent future dates
  if (attendanceDate > todayIST) {
    throw new Error("Attendance cannot be recorded for future dates");
  }

  // Backdated attendance requires OWNER role
  if (attendanceDate < todayIST && params.userRole !== USER_ROLES.OWNER) {
    throw new Error("Recording backdated attendance requires Owner permission");
  }

  return db.transaction(async (tx) => {
    // 1. Check if valid check-in already exists for this date
    const existing = await tx
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.memberId, params.memberId),
          eq(attendance.attendanceDate, attendanceDate),
          eq(attendance.isVoided, false)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Prompt requirement: "One valid attendance record per member per local business date. Duplicate submission returns the existing record."
      return {
        id: existing[0].id,
        memberId: existing[0].memberId,
        attendanceDate: existing[0].attendanceDate,
        isException: existing[0].isException,
        isExisting: true,
      };
    }

    // 2. Validate membership eligibility on this date
    const { status } = await getMemberStatusOnDate(params.memberId, attendanceDate);

    let isException = false;
    let exceptionReason = null;

    if (status !== "ACTIVE") {
      // If member is not active (Upcoming/Expired/Paused/Cancelled)
      if (params.userRole !== USER_ROLES.OWNER) {
        throw new Error(
          `Cannot mark attendance: Member status is '${status}'. Only an Owner may record an attendance exception.`
        );
      }

      if (!params.isException || !params.exceptionReason) {
        throw new Error(
          `Owner exception with reason is required to mark attendance for non-active member (${status}).`
        );
      }

      isException = true;
      exceptionReason = params.exceptionReason;
    }

    const attendanceId = crypto.randomUUID();

    await tx.insert(attendance).values({
      id: attendanceId,
      memberId: params.memberId,
      attendanceDate,
      markedByUserId: params.performedByUserId,
      isException,
      exceptionReason,
      isVoided: false,
    });

    await logAuditEvent({
      userId: params.performedByUserId,
      action: isException ? "ATTENDANCE_MARK_EXCEPTION" : "ATTENDANCE_MARK",
      entityType: "ATTENDANCE",
      entityId: attendanceId,
      reason: exceptionReason,
      details: {
        memberId: params.memberId,
        attendanceDate,
        statusOnDate: status,
      },
      tx,
    });

    return {
      id: attendanceId,
      memberId: params.memberId,
      attendanceDate,
      isException,
      isExisting: false,
    };
  });
}

/**
 * Void/correct an erroneous attendance record (Owner only).
 */
export async function voidAttendance(params: {
  attendanceId: string;
  voidReason: string;
  ownerUserId: string;
}): Promise<void> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(attendance)
      .where(eq(attendance.id, params.attendanceId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Attendance record not found");
    }

    if (existing[0].isVoided) {
      throw new Error("Attendance record has already been voided");
    }

    await tx
      .update(attendance)
      .set({
        isVoided: true,
        voidedAt: new Date(),
        voidedByUserId: params.ownerUserId,
        voidReason: params.voidReason,
      })
      .where(eq(attendance.id, params.attendanceId));

    await logAuditEvent({
      userId: params.ownerUserId,
      action: "ATTENDANCE_VOID",
      entityType: "ATTENDANCE",
      entityId: params.attendanceId,
      reason: params.voidReason,
      tx,
    });
  });
}

/**
 * Calculates absent active members:
 * Active members who have had NO valid attendance in the last `thresholdDays` eligible days.
 * Strictly excludes:
 * - Members who are paused, cancelled, upcoming, or archived
 * - Members whose membership started less than `thresholdDays` ago (too new to meet threshold)
 */
export async function getAbsentMembers(
  thresholdDays?: number
): Promise<Array<{ memberId: string; name: string; phone: string; lastAttendanceDate: string | null; daysSinceLastVisit: number }>> {
  const today = getTodayISTString();

  // Fetch settings if threshold not provided
  let threshold = thresholdDays;
  if (!threshold) {
    const settings = await db
      .select()
      .from(gymSettings)
      .where(eq(gymSettings.id, "default"))
      .limit(1);
    threshold = settings[0]?.absenceThresholdDays || 10;
  }

  const cutoffDate = addDays(today, -threshold);

  // 1. Get all currently ACTIVE membership terms (non-paused, non-cancelled, started <= cutoffDate)
  // Note: if member joined after cutoffDate, they have not yet had `threshold` eligible days!
  const activeMembers = await db
    .select({
      memberId: members.id,
      name: members.name,
      phone: members.phone,
      startDate: membershipTerms.startDate,
      endDate: membershipTerms.endDate,
    })
    .from(members)
    .innerJoin(membershipTerms, eq(members.id, membershipTerms.memberId))
    .where(
      and(
        eq(members.isArchived, false),
        eq(membershipTerms.status, MEMBERSHIP_STATUSES.ACTIVE),
        sql`${membershipTerms.startDate} <= ${cutoffDate}`, // joined at least threshold days ago
        sql`${membershipTerms.endDate} > ${today}` // term is currently active
      )
    );

  if (activeMembers.length === 0) {
    return [];
  }

  const memberIds = activeMembers.map((m) => m.memberId);

  // 2. Find attendance for these members on or after cutoffDate
  const recentAttendances = await db
    .select({
      memberId: attendance.memberId,
      lastDate: sql<string>`MAX(${attendance.attendanceDate})`,
    })
    .from(attendance)
    .where(
      and(
        inArray(attendance.memberId, memberIds),
        eq(attendance.isVoided, false),
        sql`${attendance.attendanceDate} > ${cutoffDate}`
      )
    )
    .groupBy(attendance.memberId);

  const recentlyAttendedSet = new Set(recentAttendances.map((a) => a.memberId));

  // 3. For members without attendance after cutoffDate, get their most recent attendance date
  const allLastAttendances = await db
    .select({
      memberId: attendance.memberId,
      lastDate: sql<string>`MAX(${attendance.attendanceDate})`,
    })
    .from(attendance)
    .where(
      and(
        inArray(attendance.memberId, memberIds),
        eq(attendance.isVoided, false)
      )
    )
    .groupBy(attendance.memberId);

  const lastAttendanceMap = new Map(allLastAttendances.map((a) => [a.memberId, a.lastDate]));

  const absentList: Array<{
    memberId: string;
    name: string;
    phone: string;
    lastAttendanceDate: string | null;
    daysSinceLastVisit: number;
  }> = [];

  for (const m of activeMembers) {
    if (!recentlyAttendedSet.has(m.memberId)) {
      const lastDate = lastAttendanceMap.get(m.memberId) || null;
      const daysSince = lastDate ? differenceInCalendarDays(today, lastDate) : differenceInCalendarDays(today, m.startDate);

      absentList.push({
        memberId: m.memberId,
        name: m.name,
        phone: m.phone,
        lastAttendanceDate: lastDate,
        daysSinceLastVisit: daysSince,
      });
    }
  }

  return absentList;
}

