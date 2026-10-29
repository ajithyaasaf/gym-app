import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  members,
  membershipTerms,
  charges,
  payments,
  receipts,
  attendance,
  auditLogs,
} from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import { updateMember, archiveMember } from "@/server/services/member-service";
import { USER_ROLES } from "@/lib/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch member
    const memberRows = await db
      .select()
      .from(members)
      .where(eq(members.id, id))
      .limit(1);

    if (memberRows.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    const member = memberRows[0];

    // Fetch all terms
    const terms = await db
      .select()
      .from(membershipTerms)
      .where(eq(membershipTerms.memberId, id))
      .orderBy(desc(membershipTerms.startDate));

    // Fetch all charges
    const chargesList = await db
      .select()
      .from(charges)
      .where(eq(charges.memberId, id))
      .orderBy(desc(charges.createdAt));

    // Fetch all payments
    const paymentsList = await db
      .select()
      .from(payments)
      .where(eq(payments.memberId, id))
      .orderBy(desc(payments.receivedAt));

    // Fetch all receipts
    const receiptsList = await db
      .select()
      .from(receipts)
      .where(eq(receipts.memberId, id))
      .orderBy(desc(receipts.issuedAt));

    // Fetch attendance records
    const attendanceList = await db
      .select()
      .from(attendance)
      .where(eq(attendance.memberId, id))
      .orderBy(desc(attendance.attendanceDate))
      .limit(50);

    // Calculate total balance due
    const duesResult = await db.execute(
      sql`SELECT COALESCE(SUM(balance_paise), 0) as total_due FROM charges WHERE member_id = ${id} AND status != 'CANCELLED'`
    );
    const totalDuePaise = Number((duesResult.rows[0] as { total_due: number })?.total_due || 0);

    return NextResponse.json({
      member,
      totalDuePaise,
      terms,
      charges: chargesList,
      payments: paymentsList,
      receipts: receiptsList,
      attendance: attendanceList,
    });
  } catch (error) {
    console.error("GET /api/members/[id] error:", error);
    return NextResponse.json({ error: "Failed to load member profile" }, { status: 500 });
  }
}

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

    const res = await updateMember({
      memberId: id,
      expectedVersion: body.expectedVersion,
      name: body.name,
      phone: body.phone,
      email: body.email,
      address: body.address,
      emergencyContactName: body.emergencyContactName,
      emergencyContactPhone: body.emergencyContactPhone,
      notes: body.notes,
      photoUrl: body.photoUrl,
      doNotContact: body.doNotContact,
      performedByUserId: current.user.id,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("PATCH /api/members/[id] error:", error);
    const status = error.message?.includes("CONCURRENT_MODIFICATION_CONFLICT") ? 409 : 400;
    return NextResponse.json(
      { error: error.message || "Failed to update member" },
      { status }
    );
  }
}

export async function DELETE(
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
        { error: "Only the gym owner can archive member records." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const res = await archiveMember({
      memberId: id,
      reason: body.reason || "Archived by owner",
      ownerUserId: current.user.id,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("DELETE /api/members/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to archive member" },
      { status: 400 }
    );
  }
}

