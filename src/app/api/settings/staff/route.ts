import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import {
  createStaffAccount,
  deactivateStaffAccount,
  resetStaffPassword,
} from "@/server/services/staff-service";
import { USER_ROLES } from "@/lib/constants";

export async function GET() {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only the owner can view staff accounts." },
        { status: 403 }
      );
    }

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.isActive), users.name);

    return NextResponse.json({ staff: allUsers });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch staff accounts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only the owner can create staff accounts." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const res = await createStaffAccount({
      name: body.name,
      email: body.email,
      role: body.role || USER_ROLES.STAFF,
      tempPassword: body.tempPassword,
      performedByUserId: current.user.id,
    });

    return NextResponse.json(res, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create staff account" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Only the owner can manage staff accounts." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, userId } = body;

    if (action === "DEACTIVATE") {
      await deactivateStaffAccount({
        targetUserId: userId,
        performedByUserId: current.user.id,
      });
      return NextResponse.json({ success: true });
    } else if (action === "RESET_PASSWORD") {
      const res = await resetStaffPassword({
        targetUserId: userId,
        performedByUserId: current.user.id,
      });
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update staff account" },
      { status: 400 }
    );
  }
}
