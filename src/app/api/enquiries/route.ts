import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { enquiries, users } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import { createEnquiry } from "@/server/services/enquiry-service";

export async function GET(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const conditions = [];
    if (status) {
      conditions.push(eq(enquiries.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: enquiries.id,
        name: enquiries.name,
        phone: enquiries.phone,
        interestNotes: enquiries.interestNotes,
        trialDate: enquiries.trialDate,
        status: enquiries.status,
        nextFollowUpDate: enquiries.nextFollowUpDate,
        convertedMemberId: enquiries.convertedMemberId,
        assignedStaffName: users.name,
        createdAt: enquiries.createdAt,
      })
      .from(enquiries)
      .leftJoin(users, eq(enquiries.assignedStaffId, users.id))
      .where(whereClause)
      .orderBy(desc(enquiries.createdAt));

    return NextResponse.json({ enquiries: rows });
  } catch (error) {
    console.error("GET /api/enquiries error:", error);
    return NextResponse.json({ error: "Failed to fetch enquiries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const res = await createEnquiry({
      ...body,
      performedByUserId: current.user.id,
    });

    return NextResponse.json(res, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/enquiries error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create enquiry" },
      { status: 400 }
    );
  }
}
