import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { USER_ROLES } from "@/lib/constants";
import { generateCsv } from "@/lib/csv";
import { formatINR } from "@/lib/money";
import { db } from "@/db";
import { payments, members, users, receipts } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getTodayISTString } from "@/lib/dates";

export async function GET(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (current.user.role !== USER_ROLES.OWNER) {
      return new Response("Forbidden: Owner role required for bulk data export", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || `${getTodayISTString().slice(0, 7)}-01`;
    const endDate = searchParams.get("endDate") || getTodayISTString();

    const startTs = new Date(`${startDate}T00:00:00+05:30`);
    const endTs = new Date(`${endDate}T23:59:59.999+05:30`);

    const rows = await db
      .select({
        paymentNumber: payments.paymentNumber,
        receiptNumber: receipts.receiptNumber,
        memberCode: members.memberCode,
        memberName: members.name,
        memberPhone: members.phone,
        amountPaise: payments.amountPaise,
        paymentMethod: payments.paymentMethod,
        externalReference: payments.externalReference,
        receivedAt: payments.receivedAt,
        receivedByName: users.name,
        isReversed: payments.isReversed,
      })
      .from(payments)
      .innerJoin(members, eq(payments.memberId, members.id))
      .innerJoin(users, eq(payments.receivedByUserId, users.id))
      .leftJoin(receipts, eq(payments.id, receipts.paymentId))
      .where(and(gte(payments.receivedAt, startTs), lte(payments.receivedAt, endTs)))
      .orderBy(desc(payments.receivedAt));

    const headers = [
      "Payment ID",
      "Receipt Number",
      "Member ID",
      "Member Name",
      "Phone",
      "Amount (₹)",
      "Payment Method",
      "Reference",
      "Received Date (UTC)",
      "Staff",
      "Status",
    ];

    const dataRows = rows.map((r) => [
      r.paymentNumber,
      r.receiptNumber || "N/A",
      r.memberCode,
      r.memberName,
      r.memberPhone,
      (r.amountPaise / 100).toFixed(2),
      r.paymentMethod,
      r.externalReference || "",
      r.receivedAt.toISOString().slice(0, 19).replace("T", " "),
      r.receivedByName,
      r.isReversed ? "REVERSED" : "SETTLED",
    ]);

    const csvString = generateCsv(headers, dataRows);

    return new Response(csvString, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gym-collections-${startDate}-to-${endDate}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/export-csv error:", error);
    return new Response("Failed to generate CSV export", { status: 500 });
  }
}
