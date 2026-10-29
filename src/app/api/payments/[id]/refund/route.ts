import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { issueRefund } from "@/server/services/payment-service";
import { USER_ROLES } from "@/lib/constants";
import { withIdempotency } from "@/lib/idempotency";

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
        { error: "Only the gym owner can approve and issue refunds." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const idempotencyKey = req.headers.get("x-idempotency-key");

    const result = await withIdempotency({
      key: idempotencyKey,
      action: "PAYMENT_REFUND",
      payload: { paymentId: id, ...body },
      handler: async () => {
        const res = await issueRefund({
          paymentId: id,
          amountPaise: body.amountPaise,
          reason: body.reason,
          ownerUserId: current.user.id,
          paymentMethod: body.paymentMethod,
          externalReference: body.externalReference,
        });
        return { statusCode: 201, data: res };
      },
    });

    return NextResponse.json(result.data, { status: result.statusCode });
  } catch (error: any) {
    console.error("POST /api/payments/[id]/refund error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process refund" },
      { status: 400 }
    );
  }
}
