import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getFinancialSummary } from "@/server/services/reports-service";
import { USER_ROLES } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const current = await getCurrentSession(req);
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only the gym owner can view financial reports." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const summary = await getFinancialSummary(
      startDate && endDate ? { startDate, endDate } : undefined
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/reports/financial error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

