import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { voidAttendance } from "@/server/services/attendance-service";
import { USER_ROLES } from "@/lib/constants";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Only the gym owner can void attendance check-ins." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    await voidAttendance({
      attendanceId: id,
      voidReason: body.voidReason || "Voided by owner",
      ownerUserId: current.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/attendance/[id]/void error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to void attendance" },
      { status: 400 }
    );
  }
}

