import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, desc, or, lte } from "drizzle-orm";
import { db } from "@/db";
import { followUps, followUpLogs, members, enquiries, users } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import {
  createManualFollowUp,
  logFollowUpContact,
} from "@/server/services/followup-service";
import { getAbsentMembers } from "@/server/services/attendance-service";
import { getTodayISTString, addDays } from "@/lib/dates";

export async function GET(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "DUE_TODAY";
    const today = getTodayISTString();

    if (tab === "ABSENT") {
      const absentMembers = await getAbsentMembers();
      return NextResponse.json({ items: absentMembers, type: "ABSENT" });
    }

    const conditions = [];

    if (tab === "DUE_TODAY") {
      conditions.push(lte(followUps.dueDate, today));
      conditions.push(sql`${followUps.status} IN ('PENDING', 'CONTACTED')`);
    } else if (tab === "RENEWAL_UPCOMING") {
      conditions.push(eq(followUps.reasonType, "RENEWAL_UPCOMING"));
      conditions.push(sql`${followUps.status} IN ('PENDING', 'CONTACTED')`);
    } else if (tab === "OVERDUE_BALANCE") {
      conditions.push(eq(followUps.reasonType, "OVERDUE_BALANCE"));
      conditions.push(sql`${followUps.status} IN ('PENDING', 'CONTACTED')`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: followUps.id,
        memberId: followUps.memberId,
        enquiryId: followUps.enquiryId,
        reasonType: followUps.reasonType,
        title: followUps.title,
        notes: followUps.notes,
        dueDate: followUps.dueDate,
        status: followUps.status,
        lastOutcome: followUps.lastOutcome,
        lastContactedAt: followUps.lastContactedAt,
        promiseDate: followUps.promiseDate,
        assignedStaffName: users.name,
        memberName: members.name,
        memberPhone: members.phone,
        memberDoNotContact: members.doNotContact,
        enquiryName: enquiries.name,
        enquiryPhone: enquiries.phone,
      })
      .from(followUps)
      .leftJoin(users, eq(followUps.assignedStaffId, users.id))
      .leftJoin(members, eq(followUps.memberId, members.id))
      .leftJoin(enquiries, eq(followUps.enquiryId, enquiries.id))
      .where(whereClause)
      .orderBy(followUps.dueDate);

    return NextResponse.json({ items: rows, type: "FOLLOW_UPS" });
  } catch (error) {
    console.error("GET /api/follow-ups error:", error);
    return NextResponse.json({ error: "Failed to fetch follow-ups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const res = await createManualFollowUp({
      memberId: body.memberId,
      enquiryId: body.enquiryId,
      title: body.title,
      notes: body.notes,
      dueDate: body.dueDate || getTodayISTString(),
      assignedStaffId: body.assignedStaffId || current.user.id,
      performedByUserId: current.user.id,
    });

    return NextResponse.json(res, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/follow-ups error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create follow-up" },
      { status: 400 }
    );
  }
}

