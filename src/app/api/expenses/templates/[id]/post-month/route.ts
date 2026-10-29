import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { postRecurringExpenseTemplate } from "@/server/services/expense-service";
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
        { error: "Forbidden: Only the owner can post recurring expenses." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const res = await postRecurringExpenseTemplate({
      templateId: id,
      expenseDate: body.expenseDate,
      monthKey: body.monthKey,
      performedByUserId: current.user.id,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("POST /api/expenses/templates/[id]/post-month error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to post recurring expense" },
      { status: 400 }
    );
  }
}

