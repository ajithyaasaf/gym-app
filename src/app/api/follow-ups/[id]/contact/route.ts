import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { logFollowUpContact } from "@/server/services/followup-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const res = await logFollowUpContact({
      followUpId: id,
      outcome: body.outcome,
      promiseDate: body.promiseDate,
      notes: body.notes,
      nextFollowUpDate: body.nextFollowUpDate,
      performedByUserId: current.user.id,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("PATCH /api/follow-ups/[id]/contact error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to log contact" },
      { status: 400 }
    );
  }
}
