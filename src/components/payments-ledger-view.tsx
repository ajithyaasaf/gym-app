"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IndianRupee,
  Search,
  Calendar,
  Printer,
  RotateCcw,
  AlertTriangle,
  RotateCw,
  Filter,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { formatDisplayDate } from "@/lib/dates";

interface PaymentItem {
  id: string;
  paymentNumber: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  memberPhone: string;
  amountPaise: number;
  paymentMethod: string;
  externalReference: string | null;
  receivedAt: string;
  receivedByName: string;
  isReversed: boolean;
  reversalReason: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
}

interface PaymentsLedgerViewProps {
  userRole: string;
}

export default function PaymentsLedgerView({ userRole }: PaymentsLedgerViewProps) {
  const isOwner = userRole === "OWNER";
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Refund Modal State
  const [refundingPayment, setRefundingPayment] = useState<PaymentItem | null>(null);
  const [refundAmountRupees, setRefundAmountRupees] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Reversal Modal State
  const [reversingPayment, setReversingPayment] = useState<PaymentItem | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalLoading, setReversalLoading] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (method) params.set("method", method);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPayments(json.payments || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.totalCount || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, method, startDate, endDate, page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingPayment) return;
    setRefundError(null);
    setRefundLoading(true);

    try {
      const amountPaise = rupeesToPaise(refundAmountRupees);
      const res = await fetch(`/api/payments/${refundingPayment.id}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `refund_${refundingPayment.id}_${Date.now()}`,
        },
        body: JSON.stringify({
          amountPaise,
          reason: refundReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRefundError(data.error || "Failed to process refund");
        setRefundLoading(false);
        return;
      }

      alert("Refund recorded successfully.");
      setRefundingPayment(null);
      setRefundAmountRupees("");
      setRefundReason("");
      fetchPayments();
    } catch {
      setRefundError("Network error. Please try again.");
    } finally {
      setRefundLoading(false);
    }
  };

  const handleReversalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingPayment) return;
    setReversalError(null);
    setReversalLoading(true);

    try {
      const res = await fetch(`/api/payments/${reversingPayment.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reversalReason }),
      });

      const data = await res.json();
      if (!res.ok) {
        setReversalError(data.error || "Failed to reverse payment");
        setReversalLoading(false);
        return;
      }

      alert("Payment reversed successfully. Dues reopened.");
      setReversingPayment(null);
      setReversalReason("");
      fetchPayments();
    } catch {
      setReversalError("Network error. Please try again.");
    } finally {
      setReversalLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <Card className="p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by receipt #, member name, ID, or phone..."
              className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div>
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setPage(1);
              }}
              className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">All Payment Modes</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setMethod("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="w-full text-xs"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Total: <strong>{totalCount}</strong> recorded payments
          </span>
          {loading && <span className="text-indigo-600 font-medium">Loading register...</span>}
        </div>
      </Card>

      {/* Table / List */}
      {loading && payments.length === 0 ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-500 mt-2">Loading payments...</p>
        </div>
      ) : payments.length === 0 ? (
        <Card className="py-12 text-center p-6">
          <p className="text-sm font-semibold text-slate-700">No payment records found</p>
          <p className="text-xs text-slate-500 mt-1">
            Incoming payments recorded at reception will appear in this ledger.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Receipt / Txn #</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Amount Paid</th>
                  <th className="py-3 px-4">Mode & Ref</th>
                  <th className="py-3 px-4">Date & Time (IST)</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-900">
                        {p.receiptNumber || p.paymentNumber}
                      </div>
                      <div className="text-[10px] text-slate-400">{p.paymentNumber}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Link
                        href={`/members/${p.memberId}`}
                        className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                      >
                        {p.memberName}
                      </Link>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {p.memberCode}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-sm text-slate-900">
                        {formatINR(p.amountPaise)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant="default">{p.paymentMethod}</Badge>
                      {p.externalReference && (
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-[120px]">
                          {p.externalReference}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {new Intl.DateTimeFormat("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(p.receivedAt))}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700">
                      {p.receivedByName}
                    </td>

                    <td className="py-3.5 px-4">
                      {p.isReversed ? (
                        <Badge variant="destructive">Reversed</Badge>
                      ) : (
                        <Badge variant="success">Settled</Badge>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1">
                      {p.receiptId && (
                        <Link href={`/receipts/${p.receiptId}/print`} target="_blank">
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                            <Printer className="h-3 w-3" />
                            <span>Receipt</span>
                          </Button>
                        </Link>
                      )}

                      {isOwner && !p.isReversed && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRefundingPayment(p);
                              setRefundAmountRupees(String(p.amountPaise / 100));
                            }}
                            className="h-8 text-xs text-amber-700 hover:bg-amber-50"
                          >
                            Refund
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReversingPayment(p)}
                            className="h-8 text-xs text-rose-600 hover:bg-rose-50"
                          >
                            Reverse
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* MODAL: ISSUE REFUND (OWNER ONLY) */}
      {refundingPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Process Fee Refund (Owner Approval)
            </h3>
            <p className="text-xs text-slate-600">
              Payment: <strong>{refundingPayment.receiptNumber || refundingPayment.paymentNumber}</strong> ({formatINR(refundingPayment.amountPaise)}) for {refundingPayment.memberName}.
            </p>

            {refundError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {refundError}
              </p>
            )}

            <form onSubmit={handleRefundSubmit} className="space-y-3">
              <Input
                label="Refund Amount (₹) *"
                type="number"
                required
                min="1"
                max={refundingPayment.amountPaise / 100}
                value={refundAmountRupees}
                onChange={(e) => setRefundAmountRupees(e.target.value)}
              />

              <Input
                label="Refund Reason *"
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Concession granted by owner"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRefundingPayment(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={refundLoading}>
                  Approve Refund
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: REVERSE PAYMENT (OWNER ONLY) */}
      {reversingPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4 border-rose-200">
            <h3 className="text-base font-bold text-rose-800">
              Reverse Payment Entry
            </h3>
            <p className="text-xs text-slate-600">
              Reversing payment {reversingPayment.paymentNumber} ({formatINR(reversingPayment.amountPaise)}) will undo allocations and reopen the outstanding debt on the member's charges.
            </p>

            {reversalError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {reversalError}
              </p>
            )}

            <form onSubmit={handleReversalSubmit} className="space-y-3">
              <Input
                label="Reversal Reason *"
                required
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Erroneous payment recorded, dishonoured cheque"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReversingPayment(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  isLoading={reversalLoading}
                >
                  Confirm Reversal
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

