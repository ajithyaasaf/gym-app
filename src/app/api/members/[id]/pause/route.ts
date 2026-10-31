import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { pauseMembershipTerm } from "@/server/services/membership-service";
import { USER_ROLES } from "@/lib/constants";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession(req);
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Only the gym owner can pause memberships." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const result = await pauseMembershipTerm({
      termId: body.termId,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason || "Paused by owner",
      ownerUserId: current.user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/members/[id]/pause error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to pause membership" },
      { status: 400 }
    );
  }
}

