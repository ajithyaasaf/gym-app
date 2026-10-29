import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { reverseExpense } from "@/server/services/expense-service";
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
        { error: "Forbidden: Only the owner can reverse expenses." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    await reverseExpense({
      expenseId: id,
      reversalReason: body.reversalReason || "Reversed by owner",
      ownerUserId: current.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/expenses/[id]/reverse error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reverse expense" },
      { status: 400 }
    );
  }
}

