import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { reversePayment } from "@/server/services/payment-service";
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
        { error: "Only the gym owner can reverse payment entries." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    await reversePayment({
      paymentId: id,
      reversalReason: body.reversalReason || "Reversed by owner",
      ownerUserId: current.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/payments/[id]/reverse error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reverse payment" },
      { status: 400 }
    );
  }
}

