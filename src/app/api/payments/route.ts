import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { payments, receipts, members, users } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth";
import { recordPayment } from "@/server/services/payment-service";
import { withIdempotency } from "@/lib/idempotency";

export async function GET(req: NextRequest) {
  try {
    const current = await getCurrentSession(req);
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const method = searchParams.get("method")?.trim();
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (method) {
      conditions.push(eq(payments.paymentMethod, method as any));
    }

    if (startDate) {
      conditions.push(gte(payments.receivedAt, new Date(`${startDate}T00:00:00+05:30`)));
    }
    if (endDate) {
      conditions.push(lte(payments.receivedAt, new Date(`${endDate}T23:59:59.999+05:30`)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count query
    const countRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(whereClause);
    const totalCount = countRes[0]?.count || 0;

    // Data query
    const rows = await db
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        memberId: payments.memberId,
        memberName: members.name,
        memberCode: members.memberCode,
        memberPhone: members.phone,
        amountPaise: payments.amountPaise,
        paymentMethod: payments.paymentMethod,
        externalReference: payments.externalReference,
        receivedAt: payments.receivedAt,
        receivedByName: users.name,
        isReversed: payments.isReversed,
        reversalReason: payments.reversalReason,
        receiptId: receipts.id,
        receiptNumber: receipts.receiptNumber,
      })
      .from(payments)
      .innerJoin(members, eq(payments.memberId, members.id))
      .innerJoin(users, eq(payments.receivedByUserId, users.id))
      .leftJoin(receipts, eq(payments.id, receipts.paymentId))
      .where(whereClause)
      .orderBy(desc(payments.receivedAt))
      .limit(limit)
      .offset(offset);

    // If search filter is active (filter by member name, phone, code, or receipt number)
    const filteredRows = search
      ? rows.filter(
        (r) =>
          r.memberName.toLowerCase().includes(search.toLowerCase()) ||
          r.memberCode.toLowerCase().includes(search.toLowerCase()) ||
          r.memberPhone.includes(search) ||
          r.receiptNumber?.toLowerCase().includes(search.toLowerCase())
      )
      : rows;

    return NextResponse.json({
      payments: filteredRows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentSession(req);
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idempotencyKey = req.headers.get("x-idempotency-key");
    const body = await req.json();

    const result = await withIdempotency({
      key: idempotencyKey,
      action: "PAYMENT_RECORD",
      payload: body,
      handler: async () => {
        const res = await recordPayment({
          ...body,
          receivedByUserId: current.user.id,
        });
        return { statusCode: 201, data: res };
      },
    });

    return NextResponse.json(result.data, { status: result.statusCode });
  } catch (error: any) {
    console.error("POST /api/payments error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record payment" },
      { status: 400 }
    );
  }
}

