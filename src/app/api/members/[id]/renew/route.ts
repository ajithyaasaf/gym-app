import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { enrollOrRenewTerm } from "@/server/services/membership-service";
import { withIdempotency } from "@/lib/idempotency";
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

    const { id } = await params;
    const body = await req.json();
    const idempotencyKey = req.headers.get("x-idempotency-key");

    // Discount check
    if (body.discountPaise && body.discountPaise > 0) {
      if (current.user.role !== USER_ROLES.OWNER) {
        return NextResponse.json(
          { error: "Only the owner can approve fee discounts." },
          { status: 403 }
        );
      }
    }

    const result = await withIdempotency({
      key: idempotencyKey,
      action: "MEMBERSHIP_RENEW",
      payload: { memberId: id, ...body },
      handler: async () => {
        const res = await enrollOrRenewTerm({
          memberId: id,
          planId: body.planId,
          customStartDate: body.startDate,
          discountPaise: body.discountPaise,
          discountReason: body.discountReason,
          discountApprovedByUserId: body.discountPaise ? current.user.id : undefined,
          performedByUserId: current.user.id,
        });
        return { statusCode: 201, data: res };
      },
    });

    return NextResponse.json(result.data, { status: result.statusCode });
  } catch (error: any) {
    console.error("POST /api/members/[id]/renew error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to renew membership" },
      { status: 400 }
    );
  }
}

