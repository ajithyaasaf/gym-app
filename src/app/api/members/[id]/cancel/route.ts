import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { cancelMembershipTerm } from "@/server/services/membership-service";
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
        { error: "Only the gym owner can cancel memberships." },
        { status: 403 }
      );
    }

    const body = await req.json();

    await cancelMembershipTerm({
      termId: body.termId,
      effectiveDate: body.effectiveDate,
      cancellationReason: body.cancellationReason || "Cancelled by owner",
      ownerUserId: current.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/members/[id]/cancel error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel membership" },
      { status: 400 }
    );
  }
}

