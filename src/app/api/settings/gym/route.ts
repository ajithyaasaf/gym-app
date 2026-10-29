import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gymSettings } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import { USER_ROLES } from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const settings = await db
      .select()
      .from(gymSettings)
      .where(eq(gymSettings.id, "default"))
      .limit(1);

    return NextResponse.json(settings[0] || {});
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only the owner can modify gym settings." },
        { status: 403 }
      );
    }

    const body = await req.json();

    await db
      .update(gymSettings)
      .set({
        gymName: body.gymName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        receiptPrefix: body.receiptPrefix?.trim().toUpperCase() || "REC",
        absenceThresholdDays: Number(body.absenceThresholdDays) || 10,
        taxEnabled: !!body.taxEnabled,
        taxName: body.taxName || "GST",
        taxIdNumber: body.taxIdNumber || null,
        taxPercentageBasisPoints: Number(body.taxPercentageBasisPoints) || 1800,
        updatedAt: new Date(),
      })
      .where(eq(gymSettings.id, "default"));

    await logAuditEvent({
      userId: current.user.id,
      action: "SETTINGS_UPDATE",
      entityType: "GYM_SETTINGS",
      entityId: "default",
      details: body,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update settings" },
      { status: 400 }
    );
  }
}

