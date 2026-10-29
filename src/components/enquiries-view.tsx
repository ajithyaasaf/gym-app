"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  UserCheck,
  Plus,
  Phone,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { formatDisplayDate, getTodayISTString } from "@/lib/dates";
import { formatINR } from "@/lib/money";

interface PlanItem {
  id: string;
  name: string;
  durationUnit: string;
  durationQuantity: number;
  pricePaise: number;
  joiningFeePaise: number;
}

interface EnquiriesViewProps {
  userRole: string;
  plans: PlanItem[];
}

export default function EnquiriesView({ userRole, plans }: EnquiriesViewProps) {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Enquiry Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState("");
  const [trialDate, setTrialDate] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState(getTodayISTString());
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Conversion Modal
  const [convertingEnquiry, setConvertingEnquiry] = useState<any | null>(null);
  const [convertPlanId, setConvertPlanId] = useState(plans[0]?.id || "");
  const [convertInitialPayRupees, setConvertInitialPayRupees] = useState("");
  const [convertPayMethod, setConvertPayMethod] = useState("CASH");
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/enquiries");
      if (res.ok) {
        const json = await res.json();
        setEnquiries(json.enquiries || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          interestNotes: interest,
          trialDate: trialDate || null,
          nextFollowUpDate: nextFollowUpDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to record enquiry");
        setCreateLoading(false);
        return;
      }

      setShowCreateModal(false);
      setName("");
      setPhone("");
      setInterest("");
      fetchEnquiries();
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingEnquiry) return;
    setConvertError(null);
    setConvertLoading(true);

    try {
      const initialPayPaise = convertInitialPayRupees
        ? Math.round(Number(convertInitialPayRupees) * 100)
        : 0;

      const res = await fetch(`/api/enquiries/${convertingEnquiry.id}/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `convert_enq_${convertingEnquiry.id}_${Date.now()}`,
        },
        body: JSON.stringify({
          enrollment: {
            planId: convertPlanId,
            initialPaymentPaise: initialPayPaise,
            paymentMethod: initialPayPaise > 0 ? convertPayMethod : undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setConvertError(data.error || "Failed to convert enquiry");
        setConvertLoading(false);
        return;
      }

      alert("Enquiry converted to Member successfully!");
      setConvertingEnquiry(null);
      fetchEnquiries();
    } catch {
      setConvertError("Network error. Please try again.");
    } finally {
      setConvertLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Enquiry Capture & Conversion Pipeline
        </h2>
        <Button
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="text-xs gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Prospect Enquiry</span>
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-500 mt-2">Loading enquiries...</p>
        </div>
      ) : enquiries.length === 0 ? (
        <Card className="py-12 text-center p-6">
          <p className="text-sm font-semibold text-slate-700">No enquiries recorded</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Capture prospective gym visitors, record their interest, book trials, and convert them to full members.
          </p>
          <div className="mt-4">
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              Record First Enquiry
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100 text-xs">
          {enquiries.map((e) => {
            const isJoined = e.status === "JOINED";

            return (
              <div
                key={e.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/60"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{e.name}</span>
                    <Badge
                      variant={
                        isJoined
                          ? "success"
                          : e.status === "TRIAL_BOOKED"
                          ? "warning"
                          : "default"
                      }
                    >
                      {e.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <div className="text-slate-600">{e.interestNotes || "General fitness inquiry"}</div>

                  <div className="text-slate-500 text-[11px] flex flex-wrap items-center gap-3">
                    <span className="font-mono">{e.phone}</span>
                    {e.trialDate && (
                      <span className="text-indigo-700 font-semibold">
                        Trial Date: {formatDisplayDate(e.trialDate)}
                      </span>
                    )}
                    {e.nextFollowUpDate && (
                      <span>Follow up on: {formatDisplayDate(e.nextFollowUpDate)}</span>
                    )}
                  </div>
                </div>

                <div>
                  {isJoined ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Converted to Member</span>
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setConvertingEnquiry(e)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1"
                    >
                      <span>Convert to Member</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* MODAL 1: CREATE ENQUIRY */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Record Prospect Enquiry
            </h3>
            {createError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {createError}
              </p>
            )}
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <Input
                label="Full Name *"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Anand Murthy"
              />

              <Input
                label="Mobile Number *"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Interest / Requirement Notes
                </label>
                <textarea
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  rows={2}
                  placeholder="e.g. Evening timings, weight loss, interested in 3-month plan"
                  className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <Input
                label="Trial Date (Optional)"
                type="date"
                value={trialDate}
                onChange={(e) => setTrialDate(e.target.value)}
              />

              <Input
                label="Next Follow-Up Date"
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={createLoading}>
                  Save Enquiry
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: CONVERT ENQUIRY TO MEMBER */}
      {convertingEnquiry && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Convert Enquiry to Gym Member
            </h3>
            <p className="text-xs text-slate-600">
              Converting prospect: <strong>{convertingEnquiry.name}</strong> ({convertingEnquiry.phone}).
              This will create a new member record and link the enquiry.
            </p>

            {convertError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {convertError}
              </p>
            )}

            <form onSubmit={handleConvertSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Initial Plan *
                </label>
                <select
                  value={convertPlanId}
                  onChange={(e) => setConvertPlanId(e.target.value)}
                  className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatINR(p.pricePaise)})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Initial Payment Received (₹)"
                type="number"
                min="0"
                value={convertInitialPayRupees}
                onChange={(e) => setConvertInitialPayRupees(e.target.value)}
                placeholder="0 (or full/partial payment)"
                helperText="Leave empty or 0 if fees will be paid later"
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={convertPayMethod}
                  onChange={(e) => setConvertPayMethod(e.target.value)}
                  className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConvertingEnquiry(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={convertLoading}>
                  Confirm & Convert
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
