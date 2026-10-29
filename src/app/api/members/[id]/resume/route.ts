import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { resumeMembershipEarly } from "@/server/services/membership-service";
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
        { error: "Only the gym owner can resume paused memberships early." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const result = await resumeMembershipEarly({
      pauseId: body.pauseId,
      resumeDate: body.resumeDate,
      ownerUserId: current.user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/members/[id]/resume error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resume membership early" },
      { status: 400 }
    );
  }
}
