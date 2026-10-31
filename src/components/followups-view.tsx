"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PhoneCall,
  Calendar,
  AlertTriangle,
  Clock,
  UserCheck,
  CheckCircle2,
  Phone,
  MessageSquare,
  RotateCcw,
  Plus,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { formatDisplayDate, getTodayISTString, addDays } from "@/lib/dates";
import { buildWhatsAppLink } from "@/lib/phone";
import { FOLLOW_UP_OUTCOMES, type FollowUpOutcome } from "@/lib/constants";

interface FollowUpsViewProps {
  initialTab: string;
  userRole: string;
}

export default function FollowUpsView({ initialTab, userRole }: FollowUpsViewProps) {
  const [tab, setTab] = useState(initialTab);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Outcome Logging Modal
  const [selectedFollowUp, setSelectedFollowUp] = useState<any | null>(null);
  const [outcome, setOutcome] = useState<FollowUpOutcome>(FOLLOW_UP_OUTCOMES.CONTACTED);
  const [promiseDate, setPromiseDate] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [nextContactDate, setNextContactDate] = useState("");
  const [submittingOutcome, setSubmittingOutcome] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Manual Follow-up Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDueDate, setManualDueDate] = useState(getTodayISTString());
  const [manualNotes, setManualNotes] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/follow-ups?tab=${tab}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleLogContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowUp) return;
    setModalError(null);

    if (outcome === FOLLOW_UP_OUTCOMES.PROMISED_PAYMENT && !promiseDate) {
      setModalError("Please select the promised payment date.");
      return;
    }

    setSubmittingOutcome(true);

    try {
      const res = await fetch(`/api/follow-ups/${selectedFollowUp.id}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          promiseDate: promiseDate || undefined,
          notes: outcomeNotes || undefined,
          nextFollowUpDate: nextContactDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setModalError(data.error || "Failed to log contact");
        setSubmittingOutcome(false);
        return;
      }

      setSelectedFollowUp(null);
      setOutcomeNotes("");
      setPromiseDate("");
      fetchItems();
    } catch {
      setModalError("Network error. Please try again.");
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingManual(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualTitle,
          dueDate: manualDueDate,
          notes: manualNotes,
        }),
      });

      if (res.ok) {
        setShowManualModal(false);
        setManualTitle("");
        setManualNotes("");
        fetchItems();
      }
    } catch {
      alert("Failed to create follow-up");
    } finally {
      setSubmittingManual(false);
    }
  };

  const tabs = [
    { id: "DUE_TODAY", label: "Due Today / Overdue" },
    { id: "RENEWAL_UPCOMING", label: "Upcoming Renewals (7 Days)" },
    { id: "OVERDUE_BALANCE", label: "Fee Dues Follow-ups" },
    { id: "ABSENT", label: "Absent Active Members (10+ Days)" },
  ];

  return (
    <div className="space-y-5">
      {/* Tab Navigation & Manual Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-lg transition-colors ${
                tab === t.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowManualModal(true)}
          className="text-xs gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Callback</span>
        </Button>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-500 mt-2">Loading follow-ups...</p>
        </div>
      ) : items.length === 0 ? (
        <Card className="py-12 text-center p-6 space-y-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {tab === "DUE_TODAY" ? "All clear for today!" : "No records found in this category"}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {tab === "DUE_TODAY"
                ? "No follow-up calls are scheduled for today. Check other categories to engage members:"
                : "There are no members or callbacks matching this list right now."}
            </p>
          </div>

          {tab === "DUE_TODAY" && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("ABSENT")}
                className="text-xs text-slate-700"
              >
                Absent Members (10+ Days)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("RENEWAL_UPCOMING")}
                className="text-xs text-slate-700"
              >
                Upcoming Renewals
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTab("OVERDUE_BALANCE")}
                className="text-xs text-slate-700"
              >
                Fee Dues
              </Button>
            </div>
          )}
        </Card>
      ) : tab === "ABSENT" ? (
        /* Absent Active Members View */
        <Card className="divide-y divide-slate-100 text-xs">
          <div className="p-4 bg-amber-50/60 border-b border-amber-200/80 text-amber-900 text-xs flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              These active members have had no recorded attendance for 10 or more eligible days. Reach out to encourage them back to their fitness routine!
            </span>
          </div>

          {items.map((m: any) => (
            <div
              key={m.memberId}
              className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/60"
            >
              <div>
                <Link
                  href={`/members/${m.memberId}`}
                  className="font-bold text-sm text-slate-900 hover:text-indigo-600 hover:underline"
                >
                  {m.name}
                </Link>
                <div className="text-slate-500 font-mono text-xs mt-0.5">
                  {m.phone}
                </div>
                <div className="text-slate-600 mt-1 text-[11px]">
                  Last visit: {formatDisplayDate(m.lastAttendanceDate)} •{" "}
                  <strong className="text-amber-800">{m.daysSinceLastVisit} days absent</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`tel:${m.phone}`}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call</span>
                </a>

                <a
                  href={buildWhatsAppLink(
                    m.phone,
                    `Hello ${m.name}! We noticed you haven't visited IronPulse Fitness in a few days. Hope all is well! Let us know if you need any assistance with your workouts.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium border border-emerald-200"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        /* Standard Follow-ups View */
        <Card className="divide-y divide-slate-100 text-xs">
          {items.map((f: any) => {
            const personName = f.memberName || f.enquiryName || "Contact";
            const personPhone = f.memberPhone || f.enquiryPhone || "";
            const isDnc = f.memberDoNotContact;

            return (
              <div
                key={f.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/60"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {personName}
                    </span>
                    <Badge variant="default" className="text-[10px]">
                      {f.reasonType.replace(/_/g, " ")}
                    </Badge>
                    {isDnc && <Badge variant="destructive">DNC (Do Not Call)</Badge>}
                  </div>

                  <div className="text-slate-700 font-medium">{f.title}</div>

                  <div className="text-slate-500 text-[11px] flex flex-wrap items-center gap-3">
                    <span className="font-mono">{personPhone}</span>
                    <span>Due: {formatDisplayDate(f.dueDate)}</span>
                    {f.lastOutcome && (
                      <span className="text-indigo-700 font-semibold">
                        Last Outcome: {f.lastOutcome.replace(/_/g, " ")}
                      </span>
                    )}
                    {f.promiseDate && (
                      <span className="text-amber-800 font-bold">
                        Promised on: {formatDisplayDate(f.promiseDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isDnc && (
                    <>
                      <a
                        href={`tel:${personPhone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium min-h-[36px]"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Call</span>
                      </a>

                      <a
                        href={buildWhatsAppLink(
                          personPhone,
                          `Hello ${personName}, greeting from IronPulse Fitness regarding your gym membership.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium border border-emerald-200 min-h-[36px]"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </>
                  )}

                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedFollowUp(f);
                      setOutcome(FOLLOW_UP_OUTCOMES.CONTACTED);
                    }}
                    className="text-xs h-9"
                  >
                    Log Contact Result
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* MODAL: LOG CONTACT OUTCOME */}
      {selectedFollowUp && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Record Follow-Up Contact Outcome
            </h3>
            <p className="text-xs text-slate-600">
              Target:{" "}
              <strong>
                {selectedFollowUp.memberName || selectedFollowUp.enquiryName}
              </strong>
            </p>

            {modalError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {modalError}
              </p>
            )}

            <form onSubmit={handleLogContactSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contact Outcome *
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as FollowUpOutcome)}
                  className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value={FOLLOW_UP_OUTCOMES.CONTACTED}>Contacted (Discussed)</option>
                  <option value={FOLLOW_UP_OUTCOMES.NO_ANSWER}>No Answer / Busy</option>
                  <option value={FOLLOW_UP_OUTCOMES.PROMISED_PAYMENT}>Promised Payment (Set Date)</option>
                  <option value={FOLLOW_UP_OUTCOMES.RENEWED_RESOLVED}>Renewed / Resolved</option>
                  <option value={FOLLOW_UP_OUTCOMES.NOT_INTERESTED}>Not Interested / Dismiss</option>
                </select>
              </div>

              {outcome === FOLLOW_UP_OUTCOMES.PROMISED_PAYMENT && (
                <Input
                  label="Promise to Pay Date *"
                  type="date"
                  required
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  helperText="Follow-up will reappear on this date without marking debt paid"
                />
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Call Notes & Details
                </label>
                <textarea
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Member stated they will stop by reception tomorrow evening"
                  className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedFollowUp(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={submittingOutcome}>
                  Save Outcome
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: MANUAL CALLBACK */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Schedule Callback</h3>
            <form onSubmit={handleCreateManual} className="space-y-4">
              <Input
                label="Callback Title / Description *"
                required
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="e.g. Call Vikram about personal trainer inquiry"
              />

              <Input
                label="Scheduled Date *"
                type="date"
                required
                value={manualDueDate}
                onChange={(e) => setManualDueDate(e.target.value)}
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowManualModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={submittingManual}>
                  Save Callback
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

