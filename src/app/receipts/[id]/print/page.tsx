import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatINR } from "@/lib/money";
import { formatDisplayDate } from "@/lib/dates";
import PrintButton from "@/components/print-button";

export default async function PrintReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await getCurrentSession();
  if (!current) {
    redirect("/login");
  }

  const { id } = await params;

  const receiptRows = await db
    .select()
    .from(receipts)
    .where(eq(receipts.id, id))
    .limit(1);

  if (receiptRows.length === 0) {
    notFound();
  }

  const r = receiptRows[0];
  const items = JSON.parse(r.allocatedBreakdownJson || "[]") as Array<{
    title: string;
    allocatedPaise: number;
  }>;

  // Format date in Asia/Kolkata
  const issuedDateStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(r.issuedAt));

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 flex flex-col items-center">
      {/* Top action toolbar (hidden on print) */}
      <div className="no-print w-full max-w-md mb-4 flex items-center justify-between">
        <a
          href="/money/payments"
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          ← Back to Payments
        </a>
        <PrintButton />
      </div>

      {/* The Printable Receipt Card */}
      <div className="receipt-container bg-white w-full max-w-md rounded-xl border border-slate-300 p-6 shadow-sm text-slate-900 font-mono text-xs">
        {/* Gym Header */}
        <div className="text-center pb-4 border-b border-dashed border-slate-300 space-y-1">
          <h1 className="text-base font-bold tracking-tight uppercase font-sans">
            {r.gymNameSnapshot}
          </h1>
          <p className="text-[11px] text-slate-600">{r.gymAddressSnapshot}</p>
          <p className="text-[11px] text-slate-600">Phone: {r.gymPhoneSnapshot}</p>
          {r.gymTaxIdSnapshot && (
            <p className="text-[11px] text-slate-600">GSTIN: {r.gymTaxIdSnapshot}</p>
          )}
          <div className="pt-2 text-xs font-semibold tracking-wider">
            OFFICIAL PAYMENT RECEIPT
          </div>
        </div>

        {/* Receipt Meta */}
        <div className="py-3 border-b border-dashed border-slate-300 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Receipt No:</span>
            <span className="font-bold">{r.receiptNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Issued On:</span>
            <span>{issuedDateStr}</span>
          </div>
        </div>

        {/* Member Details */}
        <div className="py-3 border-b border-dashed border-slate-300 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Member ID:</span>
            <span className="font-semibold">{r.memberCodeSnapshot}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Member Name:</span>
            <span className="font-semibold">{r.memberNameSnapshot}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Phone:</span>
            <span>{r.memberPhoneSnapshot}</span>
          </div>
        </div>

        {/* Line Items Paid */}
        <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
          <div className="font-semibold text-slate-700">Payment Breakdown:</div>
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between">
              <span className="pr-2">{item.title}</span>
              <span className="font-semibold">{formatINR(item.allocatedPaise)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5">
          <div className="flex justify-between text-sm font-bold pt-1">
            <span>TOTAL RECEIVED:</span>
            <span>{formatINR(r.paymentAmountPaise)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Payment Mode:</span>
            <span>{r.paymentMethod}</span>
          </div>
          {r.externalReference && (
            <div className="flex justify-between text-slate-600">
              <span>Reference / Txn:</span>
              <span>{r.externalReference}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-700 font-semibold pt-1">
            <span>Balance Due After Payment:</span>
            <span>{formatINR(r.memberBalanceAfterPaise)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 text-center space-y-1 text-[11px] text-slate-500">
          <p>Thank you for choosing {r.gymNameSnapshot}!</p>
          <p>Please keep this receipt for your records.</p>
        </div>
      </div>
    </div>
  );
}
