"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  IndianRupee,
  CheckCircle2,
  Clock,
  Printer,
  Pause,
  XCircle,
  Archive,
  Edit,
  AlertTriangle,
  RotateCcw,
  Plus,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge, StatusBadge } from "./ui/badge";
import { Input } from "./ui/input";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { formatDisplayDate, getTodayISTString, calculateTermDates } from "@/lib/dates";
import { buildWhatsAppLink } from "@/lib/phone";

interface PlanItem {
  id: string;
  name: string;
  durationUnit: string;
  durationQuantity: number;
  pricePaise: number;
  joiningFeePaise: number;
}

interface MemberProfileViewProps {
  memberId: string;
  userRole: string;
  plans: PlanItem[];
}

export default function MemberProfileView({
  memberId,
  userRole,
  plans,
}: MemberProfileViewProps) {
  const isOwner = userRole === "OWNER";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "memberships" | "payments" | "attendance" | "notes"
  >("overview");

  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states inside modals
  const [paymentAmountRupees, setPaymentAmountRupees] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [renewPlanId, setRenewPlanId] = useState(plans[0]?.id || "");
  const [renewStartDate, setRenewStartDate] = useState(getTodayISTString());
  const [renewDiscountRupees, setRenewDiscountRupees] = useState("");
  const [renewDiscountReason, setRenewDiscountReason] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  const [pauseStartDate, setPauseStartDate] = useState(getTodayISTString());
  const [pauseEndDate, setPauseEndDate] = useState(getTodayISTString());
  const [pauseReason, setPauseReason] = useState("");
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);

  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Edit profile state (with optimistic version!)
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editEmergencyName, setEditEmergencyName] = useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDoNotContact, setEditDoNotContact] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${memberId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);

        // Prep edit state
        if (json.member) {
          setEditName(json.member.name);
          setEditPhone(json.member.phone);
          setEditEmail(json.member.email || "");
          setEditAddress(json.member.address || "");
          setEditEmergencyName(json.member.emergencyContactName || "");
          setEditEmergencyPhone(json.member.emergencyContactPhone || "");
          setEditNotes(json.member.notes || "");
          setEditDoNotContact(json.member.doNotContact || false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading && !data) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-500 mt-2">Loading member record...</p>
      </div>
    );
  }

  if (!data?.member) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-semibold text-slate-800">Member profile not found</p>
        <Link href="/members" className="mt-4 inline-block text-xs text-indigo-600 underline">
          Return to directory
        </Link>
      </Card>
    );
  }

  const { member, totalDuePaise, terms, charges, payments, receipts, attendance } = data;
  const activeTerm = terms.find(
    (t: any) => t.status === "ACTIVE" || t.status === "PAUSED"
  ) || terms[0];

  // Quick Action Handlers
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    setPaymentLoading(true);

    try {
      const amountPaise = rupeesToPaise(paymentAmountRupees);
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `pay_${memberId}_${Date.now()}`,
        },
        body: JSON.stringify({
          memberId,
          amountPaise,
          paymentMethod,
          externalReference: paymentRef || null,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setPaymentError(resData.error || "Failed to record payment");
        setPaymentLoading(false);
        return;
      }

      setShowPaymentModal(false);
      setPaymentAmountRupees("");
      fetchProfile();
    } catch {
      setPaymentError("Network error. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenewError(null);
    setRenewLoading(true);

    try {
      const discountPaise = renewDiscountRupees ? rupeesToPaise(renewDiscountRupees) : 0;
      const res = await fetch(`/api/members/${memberId}/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `renew_${memberId}_${Date.now()}`,
        },
        body: JSON.stringify({
          planId: renewPlanId,
          startDate: renewStartDate,
          discountPaise,
          discountReason: renewDiscountReason || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setRenewError(resData.error || "Failed to renew membership");
        setRenewLoading(false);
        return;
      }

      setShowRenewModal(false);
      fetchProfile();
    } catch {
      setRenewError("Network error. Please try again.");
    } finally {
      setRenewLoading(false);
    }
  };

  const handleQuickCheckIn = async () => {
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const resData = await res.json();
      if (res.ok) {
        alert(
          resData.isExisting
            ? "Member is already marked present for today!"
            : "Attendance marked successfully for today!"
        );
        fetchProfile();
      } else {
        alert(resData.error || "Failed to mark attendance.");
      }
    } catch {
      alert("Network error.");
    }
  };

  const handlePause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTerm) return;
    setPauseError(null);
    setPauseLoading(true);

    try {
      const res = await fetch(`/api/members/${memberId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termId: activeTerm.id,
          startDate: pauseStartDate,
          endDate: pauseEndDate,
          reason: pauseReason,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setPauseError(resData.error || "Failed to pause membership");
        setPauseLoading(false);
        return;
      }

      setShowPauseModal(false);
      fetchProfile();
    } catch {
      setPauseError("Network error. Please try again.");
    } finally {
      setPauseLoading(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTerm) return;
    setCancelError(null);
    setCancelLoading(true);

    try {
      const res = await fetch(`/api/members/${memberId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termId: activeTerm.id,
          effectiveDate: getTodayISTString(),
          cancellationReason: cancelReason,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setCancelError(resData.error || "Failed to cancel membership");
        setCancelLoading(false);
        return;
      }

      setShowCancelModal(false);
      fetchProfile();
    } catch {
      setCancelError("Network error. Please try again.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditLoading(true);

    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: member.version, // Optimistic concurrency version!
          name: editName,
          phone: editPhone,
          email: editEmail || null,
          address: editAddress || null,
          emergencyContactName: editEmergencyName || null,
          emergencyContactPhone: editEmergencyPhone || null,
          notes: editNotes || null,
          doNotContact: editDoNotContact,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setEditError(resData.error || "Failed to update profile");
        setEditLoading(false);
        return;
      }

      setShowEditModal(false);
      fetchProfile();
    } catch {
      setEditError("Network error. Please try again.");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card: Member ID, Name, Status, Balance Due Warning, and Actions */}
      <Card className="p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">
                {member.memberCode}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {member.name}
              </h1>
              {member.isArchived ? (
                <Badge variant="neutral">Archived</Badge>
              ) : activeTerm ? (
                <StatusBadge status={activeTerm.status} />
              ) : (
                <Badge variant="neutral">No Term</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                {member.phone}
              </span>
              {member.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {member.email}
                </span>
              )}
              {activeTerm && (
                <span className="flex items-center gap-1 text-slate-700 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Valid through: {formatDisplayDate(activeTerm.validThrough)}
                </span>
              )}
            </div>
          </div>

          {/* Quick Balance Due Badge & Immediate Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {totalDuePaise > 0 ? (
              <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>{formatINR(totalDuePaise)} Balance Due</span>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Fees Cleared</span>
              </div>
            )}

            <Button
              size="sm"
              onClick={handleQuickCheckIn}
              className="bg-emerald-600 hover:bg-emerald-700 text-xs gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Mark Attendance</span>
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setPaymentAmountRupees(totalDuePaise > 0 ? String(totalDuePaise / 100) : "");
                setShowPaymentModal(true);
              }}
              variant="primary"
              className="text-xs gap-1.5"
            >
              <IndianRupee className="h-4 w-4" />
              <span>Record Payment</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRenewModal(true)}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Renew Membership</span>
            </Button>
          </div>
        </div>

        {/* Secondary Actions Bar (Edit, Pause, Cancel, WhatsApp, Call) */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <a
              href={`tel:${member.phone}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Call ({member.phone})</span>
            </a>

            {!member.doNotContact && (
              <a
                href={buildWhatsAppLink(
                  member.phone,
                  `Hello ${member.name}, greetings from IronPulse Fitness! We are following up regarding your gym membership.`
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium border border-emerald-200"
              >
                <span>WhatsApp Message</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="h-8 text-xs gap-1 text-slate-600"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </Button>

            {isOwner && activeTerm && activeTerm.status === "ACTIVE" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPauseStartDate(getTodayISTString());
                  setShowPauseModal(true);
                }}
                className="h-8 text-xs gap-1 text-amber-700 hover:bg-amber-50"
              >
                <Pause className="h-3.5 w-3.5" />
                <span>Pause Term</span>
              </Button>
            )}

            {isOwner && activeTerm && activeTerm.status !== "CANCELLED" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                className="h-8 text-xs gap-1 text-rose-600 hover:bg-rose-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Cancel Term</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          { id: "overview", label: "Overview" },
          { id: "memberships", label: `Memberships (${terms.length})` },
          { id: "payments", label: `Payments & Receipts (${payments.length})` },
          { id: "attendance", label: `Attendance (${attendance.length})` },
          { id: "notes", label: "Notes & History" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Membership Term</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {activeTerm ? (
                <>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Plan Enrolled:</span>
                    <strong className="text-slate-800">{activeTerm.planNameSnapshot}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Duration:</span>
                    <span>
                      {activeTerm.durationQuantitySnapshot}{" "}
                      {activeTerm.durationUnitSnapshot.toLowerCase()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Start Date:</span>
                    <span>{formatDisplayDate(activeTerm.startDate)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Valid Through:</span>
                    <strong className="text-emerald-700">
                      {formatDisplayDate(activeTerm.validThrough)}
                    </strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">End Date (Exclusive):</span>
                    <span className="font-mono">{activeTerm.endDate}</span>
                  </div>
                  {activeTerm.totalPausedDays > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-amber-700">
                      <span>Total Extension from Pauses:</span>
                      <span>+{activeTerm.totalPausedDays} calendar days</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 pt-2 font-semibold">
                    <span>Sold Base Price:</span>
                    <span>{formatINR(activeTerm.finalPricePaiseSnapshot)}</span>
                  </div>
                </>
              ) : (
                <p className="text-slate-500 italic py-4 text-center">
                  No active membership term booked for this member.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Personal & Emergency Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Address:</span>
                <span className="text-right max-w-xs">{member.address || "Not provided"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Emergency Contact:</span>
                <span>{member.emergencyContactName || "Not provided"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Emergency Phone:</span>
                <span className="font-mono">{member.emergencyContactPhone || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Do Not Contact (DNC):</span>
                <span>{member.doNotContact ? "Yes (Flagged)" : "No"}</span>
              </div>
              <div className="flex justify-between py-1 pt-2">
                <span className="text-slate-500">Enrolled Since:</span>
                <span>{formatDisplayDate(member.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Memberships History */}
      {activeTab === "memberships" && (
        <Card className="overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Membership Terms History
            </h3>
            <Button size="sm" onClick={() => setShowRenewModal(true)} className="text-xs">
              + Add Term / Renew
            </Button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {terms.map((t: any) => (
              <div key={t.id} className="p-4 hover:bg-slate-50/50 flex flex-col sm:flex-row justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{t.planNameSnapshot}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="text-slate-600">
                    {formatDisplayDate(t.startDate)} → {formatDisplayDate(t.validThrough)}{" "}
                    <span className="text-slate-400">({t.durationQuantitySnapshot} {t.durationUnitSnapshot.toLowerCase()})</span>
                  </div>
                  {t.cancellationReason && (
                    <div className="text-rose-600 italic">
                      Cancelled on {formatDisplayDate(t.cancelledAt)}: {t.cancellationReason}
                    </div>
                  )}
                </div>
                <div className="text-right sm:text-right">
                  <div className="font-bold text-slate-900">
                    {formatINR(t.finalPricePaiseSnapshot)}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Base: {formatINR(t.basePricePaiseSnapshot)}
                    {t.discountPaiseSnapshot > 0 && ` | Disc: -${formatINR(t.discountPaiseSnapshot)}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 3: Payments & Receipts */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <Card>
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Issued Receipts & Money Received
              </h3>
              <Button size="sm" onClick={() => setShowPaymentModal(true)} className="text-xs">
                + Record Payment
              </Button>
            </div>
            {receipts.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">No receipts issued yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {receipts.map((r: any) => (
                  <div key={r.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{r.receiptNumber}</span>
                        <Badge variant="success">{r.paymentMethod}</Badge>
                      </div>
                      <div className="text-slate-500">
                        Issued on {formatDisplayDate(r.issuedAt)}
                        {r.externalReference && ` • Ref: ${r.externalReference}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-sm">
                          {formatINR(r.paymentAmountPaise)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Balance After: {formatINR(r.memberBalanceAfterPaise)}
                        </div>
                      </div>

                      <Link href={`/receipts/${r.id}/print`} target="_blank">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                          <Printer className="h-3.5 w-3.5" />
                          <span>Print</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Posted Charges & Balance Statement
              </CardTitle>
            </CardHeader>
            <div className="divide-y divide-slate-100 text-xs">
              {charges.map((c: any) => (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{c.title}</div>
                    <div className="text-slate-500 text-[11px]">
                      Due on {formatDisplayDate(c.dueDate)} • Allocated: {formatINR(c.allocatedPaymentPaise)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{formatINR(c.netAmountPaise)}</div>
                    <div>
                      {c.balancePaise > 0 ? (
                        <span className="text-amber-700 font-semibold">
                          {formatINR(c.balancePaise)} Due
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Cleared</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Attendance History */}
      {activeTab === "attendance" && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Attendance Check-in Logs (Last 50 Visits)
            </CardTitle>
            <Button size="sm" onClick={handleQuickCheckIn} className="text-xs">
              + Mark Visit Today
            </Button>
          </CardHeader>
          {attendance.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">No attendance recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {attendance.map((a: any) => (
                <div key={a.id} className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2
                      className={`h-4 w-4 ${a.isVoided ? "text-slate-300" : "text-emerald-600"}`}
                    />
                    <div>
                      <div className={`font-medium ${a.isVoided ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {formatDisplayDate(a.attendanceDate)}
                      </div>
                      {a.isException && (
                        <div className="text-[11px] text-amber-700">
                          Owner Exception: {a.exceptionReason}
                        </div>
                      )}
                      {a.isVoided && (
                        <div className="text-[11px] text-rose-600">
                          Voided: {a.voidReason}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-slate-400 text-[11px]">
                    {new Date(a.checkInTime).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 5: Notes & History */}
      {activeTab === "notes" && (
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Member Notes</h3>
            <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
              {member.notes || "No special notes recorded."}
            </p>
          </div>
        </Card>
      )}

      {/* MODAL 1: RECORD PAYMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Record Incoming Fee Payment
            </h3>
            {paymentError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {paymentError}
              </p>
            )}
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <Input
                label="Payment Amount (₹) *"
                type="number"
                required
                min="1"
                value={paymentAmountRupees}
                onChange={(e) => setPaymentAmountRupees(e.target.value)}
                placeholder="e.g. 500"
                helperText={`Outstanding balance: ${formatINR(totalDuePaise)}`}
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Mode *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                </select>
              </div>

              <Input
                label="External Reference / UTR (Optional)"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. UPI Txn ID"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={paymentLoading}>
                  Confirm & Issue Receipt
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: RENEW MEMBERSHIP */}
      {showRenewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Renew Membership Term
            </h3>
            {renewError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {renewError}
              </p>
            )}
            <form onSubmit={handleRenew} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Plan *
                </label>
                <select
                  value={renewPlanId}
                  onChange={(e) => setRenewPlanId(e.target.value)}
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
                label="Start Date *"
                type="date"
                required
                value={renewStartDate}
                onChange={(e) => setRenewStartDate(e.target.value)}
                helperText="Early renewals default to end of booked term to preserve remaining days"
              />

              {isOwner && (
                <>
                  <Input
                    label="Fee Discount (₹) (Owner Only)"
                    type="number"
                    min="0"
                    value={renewDiscountRupees}
                    onChange={(e) => setRenewDiscountRupees(e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    label="Discount Reason"
                    value={renewDiscountReason}
                    onChange={(e) => setRenewDiscountReason(e.target.value)}
                    placeholder="e.g. Loyalty concession"
                  />
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRenewModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={renewLoading}>
                  Confirm Renewal
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 3: PAUSE MEMBERSHIP */}
      {showPauseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Pause Current Membership Term
            </h3>
            {pauseError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {pauseError}
              </p>
            )}
            <form onSubmit={handlePause} className="space-y-4">
              <Input
                label="Pause Start Date (Inclusive) *"
                type="date"
                required
                value={pauseStartDate}
                onChange={(e) => setPauseStartDate(e.target.value)}
              />

              <Input
                label="Pause End Date (Exclusive) *"
                type="date"
                required
                value={pauseEndDate}
                onChange={(e) => setPauseEndDate(e.target.value)}
              />

              <Input
                label="Reason for Pause *"
                required
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="e.g. Medical recovery, travel"
              />

              <p className="text-[11px] text-slate-500">
                Pauses extend the term end date by exact paused calendar days and shift dependent renewals.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPauseModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={pauseLoading}>
                  Apply Pause
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 4: CANCEL TERM */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4 border-rose-200">
            <h3 className="text-base font-bold text-rose-800">
              Cancel Membership Term
            </h3>
            <p className="text-xs text-slate-600">
              Cancelling stops gym access immediately. Cancellation does NOT automatically refund payments or forgive debt.
            </p>
            {cancelError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {cancelError}
              </p>
            )}
            <form onSubmit={handleCancel} className="space-y-4">
              <Input
                label="Cancellation Reason *"
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Relocating to another city"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCancelModal(false)}
                >
                  Dismiss
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  isLoading={cancelLoading}
                >
                  Confirm Cancellation
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 5: EDIT PROFILE */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-md w-full p-6 shadow-xl space-y-4 my-8">
            <h3 className="text-base font-bold text-slate-900">
              Edit Member Details
            </h3>
            {editError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200">
                {editError}
              </p>
            )}
            <form onSubmit={handleEditProfile} className="space-y-3">
              <Input
                label="Full Name *"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />

              <Input
                label="Mobile Number *"
                required
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />

              <Input
                label="Email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />

              <Input
                label="Address"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />

              <Input
                label="Emergency Contact Name"
                value={editEmergencyName}
                onChange={(e) => setEditEmergencyName(e.target.value)}
              />

              <Input
                label="Emergency Contact Phone"
                value={editEmergencyPhone}
                onChange={(e) => setEditEmergencyPhone(e.target.value)}
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={editDoNotContact}
                  onChange={(e) => setEditDoNotContact(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded"
                />
                <span>Do Not Contact (DNC flag)</span>
              </label>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={editLoading}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
