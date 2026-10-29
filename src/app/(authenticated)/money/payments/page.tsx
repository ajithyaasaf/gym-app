import { getCurrentSession } from "@/lib/auth";
import PaymentsLedgerView from "@/components/payments-ledger-view";

export default async function PaymentsPage() {
  const current = await getCurrentSession();

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Payments & Receipts Register
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable audit record of all fees collected, printable receipts, and owner refund/reversal controls
        </p>
      </div>

      <PaymentsLedgerView userRole={current?.user.role || "STAFF"} />
    </div>
  );
}

