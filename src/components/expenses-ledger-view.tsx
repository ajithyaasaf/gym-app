"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  IndianRupee,
  Plus,
  Repeat,
  Calendar,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { formatDisplayDate, getTodayISTString } from "@/lib/dates";

export default function ExpensesLedgerView() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Record Expense Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [expenseDate, setExpenseDate] = useState(getTodayISTString());
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [payee, setPayee] = useState("");
  const [amountRupees, setAmountRupees] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Reversal Modal
  const [reversingExpense, setReversingExpense] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalLoading, setReversalLoading] = useState(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) {
        const json = await res.json();
        setExpenses(json.expenses || []);
        setCategories(json.categories || []);
        setTemplates(json.templates || []);
        if (json.categories?.length > 0 && !categoryId) {
          setCategoryId(json.categories[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);

    try {
      const amountPaise = rupeesToPaise(amountRupees);
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `exp_${Date.now()}_${title.slice(0, 4)}`,
        },
        body: JSON.stringify({
          categoryId,
          expenseDate,
          title,
          payee,
          amountPaise,
          paymentMethod,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to record expense");
        setAddLoading(false);
        return;
      }

      setShowAddModal(false);
      setTitle("");
      setPayee("");
      setAmountRupees("");
      setReferenceNumber("");
      fetchExpenses();
    } catch {
      setAddError("Network error. Please try again.");
    } finally {
      setAddLoading(false);
    }
  };

  const handlePostTemplate = async (templateId: string, templateTitle: string) => {
    const confirmPost = confirm(
      `Record this month's recurring expense for "${templateTitle}"?`
    );
    if (!confirmPost) return;

    try {
      const res = await fetch(`/api/expenses/templates/${templateId}/post-month`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to post recurring expense");
        return;
      }

      alert("Recurring expense posted for this month!");
      fetchExpenses();
    } catch {
      alert("Network error.");
    }
  };

  const handleReversalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingExpense) return;
    setReversalLoading(true);

    try {
      const res = await fetch(`/api/expenses/${reversingExpense.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reversalReason }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to reverse expense");
        setReversalLoading(false);
        return;
      }

      alert("Expense reversed successfully.");
      setReversingExpense(null);
      setReversalReason("");
      fetchExpenses();
    } catch {
      alert("Network error.");
    } finally {
      setReversalLoading(false);
    }
  };

  const totalExpensePaise = expenses
    .filter((e) => !e.isReversed)
    .reduce((sum, e) => sum + e.amountPaise, 0);

  return (
    <div className="space-y-6">
      {/* Reusable Recurring Templates Section */}
      {templates.length > 0 && (
        <Card className="border-indigo-100 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Repeat className="h-4 w-4 text-indigo-600" />
              <span>One-Click Recurring Templates (Month-Locked)</span>
            </h3>
            <span className="text-[11px] text-slate-500">
              Current Month: {getTodayISTString().slice(0, 7)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-2 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">{tmpl.title}</div>
                  <div className="text-slate-500 text-[11px]">Payee: {tmpl.payee}</div>
                  <div className="text-slate-700 font-semibold text-sm mt-1">
                    {formatINR(tmpl.amountPaise)}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePostTemplate(tmpl.id, tmpl.title)}
                  className="w-full text-xs gap-1 text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Record This Month</span>
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Main Expense Register Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Expenses Ledger
          </h2>
          <p className="text-xs text-slate-500">
            Total recorded: <strong className="text-slate-900">{formatINR(totalExpensePaise)}</strong>
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="text-xs gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Record Expense</span>
        </Button>
      </div>

      {/* Table */}
      {loading && expenses.length === 0 ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-500 mt-2">Loading expenses...</p>
        </div>
      ) : expenses.length === 0 ? (
        <Card className="py-12 text-center p-6">
          <p className="text-sm font-semibold text-slate-700">No expenses recorded yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Track rent, staff salaries, electricity bills, and maintenance costs.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date (IST)</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description / Payee</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono">
                      {formatDisplayDate(e.expenseDate)}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant="neutral">{e.categoryName}</Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{e.title}</div>
                      <div className="text-[11px] text-slate-500">Payee: {e.payee}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-sm text-slate-900">
                        {formatINR(e.amountPaise)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-slate-700 font-medium">{e.paymentMethod}</span>
                      {e.referenceNumber && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ref: {e.referenceNumber}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">{e.recordedByName}</td>

                    <td className="py-3.5 px-4">
                      {e.isReversed ? (
                        <Badge variant="destructive">Reversed</Badge>
                      ) : (
                        <Badge variant="success">Paid</Badge>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {!e.isReversed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReversingExpense(e)}
                          className="h-8 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          Reverse
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL 1: RECORD EXPENSE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Record Operational Expense
            </h3>

            {addError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {addError}
              </p>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <Input
                label="Expense Date *"
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Expense Title *"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. BESCOM Power Bill"
              />

              <Input
                label="Payee / Vendor *"
                required
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="e.g. Electricity Board / CleanPro"
              />

              <Input
                label="Amount (₹) *"
                type="number"
                required
                min="1"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="e.g. 18500"
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Debit / Credit Card</option>
                </select>
              </div>

              <Input
                label="Reference / Txn Number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. UTR / Receipt Ref"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={addLoading}>
                  Save Expense
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: REVERSE EXPENSE */}
      {reversingExpense && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4 border-rose-200">
            <h3 className="text-base font-bold text-rose-800">
              Reverse Expense Entry
            </h3>
            <p className="text-xs text-slate-600">
              Reversing {reversingExpense.title} ({formatINR(reversingExpense.amountPaise)}). This will void the expense from cash surplus calculations.
            </p>

            <form onSubmit={handleReversalSubmit} className="space-y-3">
              <Input
                label="Reversal Reason *"
                required
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Duplicate entry, incorrect amount"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReversingExpense(null)}
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
