import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import { USER_ROLES } from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

export async function GET() {
  try {
    const allPlans = await db
      .select()
      .from(plans)
      .orderBy(desc(plans.isActive), plans.pricePaise);

    return NextResponse.json({ plans: allPlans });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentSession(req);
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only the owner can manage plans." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const planId = `plan_${crypto.randomUUID().slice(0, 8)}`;

    await db.insert(plans).values({
      id: planId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      durationUnit: body.durationUnit, // 'DAYS' | 'MONTHS'
      durationQuantity: Number(body.durationQuantity),
      pricePaise: Number(body.pricePaise),
      joiningFeePaise: Number(body.joiningFeePaise || 0),
      isActive: true,
    });

    await logAuditEvent({
      userId: current.user.id,
      action: "PLAN_CREATE",
      entityType: "PLAN",
      entityId: planId,
      details: body,
    });

    return NextResponse.json({ planId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create plan" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const current = await getCurrentSession(req);
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only the owner can edit plans." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, ...updates } = body;

    await db
      .update(plans)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, id));

    await logAuditEvent({
      userId: current.user.id,
      action: "PLAN_UPDATE",
      entityType: "PLAN",
      entityId: id,
      details: updates,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update plan" },
      { status: 400 }
    );
  }
}

