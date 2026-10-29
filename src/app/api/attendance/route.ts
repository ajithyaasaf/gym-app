import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { attendance, members, users } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import { markAttendance } from "@/server/services/attendance-service";
import { getTodayISTString } from "@/lib/dates";

export async function GET(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || getTodayISTString();

    const rows = await db
      .select({
        id: attendance.id,
        memberId: attendance.memberId,
        memberName: members.name,
        memberCode: members.memberCode,
        memberPhone: members.phone,
        attendanceDate: attendance.attendanceDate,
        checkInTime: attendance.checkInTime,
        isException: attendance.isException,
        exceptionReason: attendance.exceptionReason,
        isVoided: attendance.isVoided,
        voidReason: attendance.voidReason,
        markedByName: users.name,
      })
      .from(attendance)
      .innerJoin(members, eq(attendance.memberId, members.id))
      .innerJoin(users, eq(attendance.markedByUserId, users.id))
      .where(eq(attendance.attendanceDate, dateStr))
      .orderBy(desc(attendance.checkInTime));

    return NextResponse.json({ attendance: rows, date: dateStr });
  } catch (error) {
    console.error("GET /api/attendance error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const res = await markAttendance({
      memberId: body.memberId,
      attendanceDate: body.attendanceDate,
      isException: body.isException,
      exceptionReason: body.exceptionReason,
      performedByUserId: current.user.id,
      userRole: current.user.role,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("POST /api/attendance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark attendance" },
      { status: 400 }
    );
  }
}
