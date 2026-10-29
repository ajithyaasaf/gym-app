"use client";

import React, { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  IndianRupee,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Printer,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { calculateTermDates, getTodayISTString, formatDisplayDate } from "@/lib/dates";

interface PlanItem {
  id: string;
  name: string;
  durationUnit: string;
  durationQuantity: number;
  pricePaise: number;
  joiningFeePaise: number;
}

interface AddMemberFormProps {
  plans: PlanItem[];
  userRole: string;
}

export default function AddMemberForm({ plans, userRole }: AddMemberFormProps) {
  const router = useRouter();
  const idempotencyKey = useId();

  // Step 1: Member Info
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [sharedPhoneAck, setSharedPhoneAck] = useState(false);

  // Step 2: Plan Selection
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || "");
  const [startDate, setStartDate] = useState(getTodayISTString());
  const [discountRupees, setDiscountRupees] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  // Step 3: Payment
  const [initialPaymentRupees, setInitialPaymentRupees] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentReference, setPaymentReference] = useState("");

  // Form State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    memberId: string;
    memberCode: string;
    receiptId?: string;
  } | null>(null);

  const isOwner = userRole === "OWNER";
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // Live term interval calculation
  let termDates = null;
  if (selectedPlan) {
    try {
      termDates = calculateTermDates(
        startDate,
        selectedPlan.durationUnit as "DAYS" | "MONTHS",
        selectedPlan.durationQuantity
      );
    } catch {
      // invalid date
    }
  }

  // Pricing calculations
  const basePricePaise = selectedPlan ? selectedPlan.pricePaise : 0;
  const joiningFeePaise = selectedPlan ? selectedPlan.joiningFeePaise : 0;
  const discountPaise = discountRupees ? rupeesToPaise(discountRupees) : 0;
  const finalPricePaise = Math.max(0, basePricePaise + joiningFeePaise - discountPaise);

  const initialPaymentPaise = initialPaymentRupees
    ? rupeesToPaise(initialPaymentRupees)
    : 0;
  const balanceDuePaise = Math.max(0, finalPricePaise - initialPaymentPaise);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicateWarning(null);
    setLoading(true);

    try {
      const payload = {
        name,
        phone,
        email: email || null,
        address: address || null,
        emergencyContactName: emergencyName || null,
        emergencyContactPhone: emergencyPhone || null,
        notes: notes || null,
        sharedPhoneAcknowledged: sharedPhoneAck,
        enrollment: selectedPlan
          ? {
              planId: selectedPlan.id,
              startDate,
              discountPaise,
              discountReason: discountReason || undefined,
              discountApprovedByUserId: discountPaise > 0 && isOwner ? "owner" : undefined,
              initialPaymentPaise,
              paymentMethod: initialPaymentPaise > 0 ? paymentMethod : undefined,
              paymentReference: paymentReference || undefined,
            }
          : undefined,
      };

      const res = await fetch("/api/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `member_create_${Date.now()}_${name.slice(0, 4)}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error && data.error.includes("already exists with phone number")) {
          setDuplicateWarning(data.error);
        } else {
          setError(data.error || "Failed to create member record.");
        }
        setLoading(false);
        return;
      }

      setSuccessResult({
        memberId: data.memberId,
        memberCode: data.memberCode,
        receiptId: data.paymentResult?.receiptId,
      });
    } catch (err) {
      setError("Network or server connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (successResult) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40 p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <div className="inline-flex h-12 w-12 rounded-full bg-emerald-100 items-center justify-center text-emerald-600 mx-auto">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          Member Registered Successfully!
        </h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Member record created with ID{" "}
          <strong className="text-slate-900 font-mono text-sm">
            {successResult.memberCode}
          </strong>
          . Membership term and payment breakdown have been atomically posted.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          {successResult.receiptId && (
            <Link
              href={`/receipts/${successResult.receiptId}/print`}
              target="_blank"
            >
              <Button size="sm" className="gap-1.5 shadow-sm">
                <Printer className="h-4 w-4" />
                <span>Print Official Receipt</span>
              </Button>
            </Link>
          )}

          <Link href={`/members/${successResult.memberId}`}>
            <Button variant="outline" size="sm">
              Open Member Profile
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSuccessResult(null);
              setName("");
              setPhone("");
              setInitialPaymentRupees("");
              setDiscountRupees("");
            }}
          >
            + Enroll Another Member
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {duplicateWarning && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg space-y-2 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <span className="font-semibold">{duplicateWarning}</span>
          </div>
          <label className="flex items-center gap-2 pt-1 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={sharedPhoneAck}
              onChange={(e) => setSharedPhoneAck(e.target.checked)}
              className="h-4 w-4 text-indigo-600 rounded"
            />
            <span>
              I confirm this is a shared family/household phone number for this new member.
            </span>
          </label>
        </div>
      )}

      {/* Section 1: Member Personal Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1. Member Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Chandra"
            />

            <Input
              label="Mobile Number (10 digits) *"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              helperText="Indian mobile number (will be formatted to +91)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address (Optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ramesh@example.in"
            />

            <Input
              label="Residential Address (Optional)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Flat 102, MG Road, Bengaluru"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Emergency Contact Name (Optional)"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="e.g. Sunita Chandra (Spouse)"
            />

            <Input
              label="Emergency Contact Phone (Optional)"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="e.g. 9876500000"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              General Notes & Fitness Goals (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Morning timings preference, focus on strength & posture"
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Membership Plan Selection & Dates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">2. Membership Plan & Dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Plan *
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatINR(p.pricePaise)} ({p.durationQuantity} {p.durationUnit.toLowerCase()})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Membership Start Date (IST) *"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Dates & Interval Preview */}
          {termDates && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-500">Duration: </span>
                <strong className="text-slate-800">
                  {selectedPlan?.durationQuantity} {selectedPlan?.durationUnit.toLowerCase()}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">End Date (Exclusive): </span>
                <span className="font-mono text-slate-700">{termDates.endDate}</span>
              </div>
              <div className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-semibold">
                Valid Through: {formatDisplayDate(termDates.validThrough)}
              </div>
            </div>
          )}

          {/* Optional Owner Discount */}
          <div className="pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Fee Discount (₹) — Requires Owner Permission"
                type="number"
                min="0"
                value={discountRupees}
                onChange={(e) => setDiscountRupees(e.target.value)}
                placeholder="0"
                disabled={!isOwner}
                helperText={!isOwner ? "Only owners can apply fee discounts" : ""}
              />

              <Input
                label="Discount Reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g. Inaugural offer, student ID"
                disabled={!isOwner}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Pricing Summary & Payment Recording */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">3. Pricing Preview & Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Price Summary Calculation Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Plan Base Price:</span>
              <span>{formatINR(basePricePaise)}</span>
            </div>
            {joiningFeePaise > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>One-time Joining Fee:</span>
                <span>{formatINR(joiningFeePaise)}</span>
              </div>
            )}
            {discountPaise > 0 && (
              <div className="flex justify-between text-rose-600 font-medium">
                <span>Approved Discount:</span>
                <span>- {formatINR(discountPaise)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
              <span>Total Payable Amount:</span>
              <span>{formatINR(finalPricePaise)}</span>
            </div>
          </div>

          {/* Payment Input */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <Input
              label="Amount Paid Now (₹)"
              type="number"
              min="0"
              max={finalPricePaise / 100}
              value={initialPaymentRupees}
              onChange={(e) => setInitialPaymentRupees(e.target.value)}
              placeholder={`Max ${finalPricePaise / 100}`}
              helperText="Enter 0 for full balance due, full amount, or partial"
            />

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="flex h-10 w-full min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="CARD">Debit / Credit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
              </select>
            </div>

            <Input
              label="External Reference / UTR (Optional)"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. UPI Ref / Cheque No."
            />
          </div>

          {/* Real-time Balance Preview */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
            <span className="text-amber-900 font-medium">
              Remaining Balance Due After Registration:
            </span>
            <span className="font-bold text-sm text-amber-950">
              {formatINR(balanceDuePaise)}
            </span>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={loading} className="gap-2">
              <span>Save & Issue Receipt</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
