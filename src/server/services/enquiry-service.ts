import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { enquiries, members } from "@/db/schema";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/lib/constants";
import { normalizeIndianPhone } from "@/lib/phone";
import { createMember, type CreateMemberInput } from "./member-service";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

export interface CreateEnquiryInput {
  name: string;
  phone: string;
  interestNotes?: string | null;
  trialDate?: string | null;
  assignedStaffId?: string | null;
  nextFollowUpDate?: string | null;
  performedByUserId: string;
}

export async function createEnquiry(params: CreateEnquiryInput) {
  const trimmedName = params.name.trim();
  if (!trimmedName) throw new Error("Name is required");

  const normalizedPhone = normalizeIndianPhone(params.phone);
  const enquiryId = crypto.randomUUID();

  await db.insert(enquiries).values({
    id: enquiryId,
    name: trimmedName,
    phone: normalizedPhone,
    interestNotes: params.interestNotes ? params.interestNotes.trim() : null,
    trialDate: params.trialDate || null,
    assignedStaffId: params.assignedStaffId || null,
    status: ENQUIRY_STATUSES.NEW,
    nextFollowUpDate: params.nextFollowUpDate || null,
  });

  await logAuditEvent({
    userId: params.performedByUserId,
    action: "ENQUIRY_CREATE",
    entityType: "ENQUIRY",
    entityId: enquiryId,
    details: {
      name: trimmedName,
      phone: normalizedPhone,
    },
  });

  return { enquiryId };
}

/**
 * Converts an enquiry to a gym member:
 * - Reuses captured name and phone.
 * - Prevents duplicate conversion (throws if already converted).
 * - Creates member atomically and links enquiry record.
 */
export async function convertEnquiryToMember(params: {
  enquiryId: string;
  enrollment?: CreateMemberInput["enrollment"];
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  sharedPhoneAcknowledged?: boolean;
  performedByUserId: string;
}) {
  return db.transaction(async (tx) => {
    const enquiryRows = await tx
      .select()
      .from(enquiries)
      .where(eq(enquiries.id, params.enquiryId))
      .limit(1);

    if (enquiryRows.length === 0) {
      throw new Error("Enquiry not found");
    }
    const enquiry = enquiryRows[0];

    // Prevent duplicate conversion!
    if (enquiry.convertedMemberId || enquiry.status === ENQUIRY_STATUSES.JOINED) {
      throw new Error(
        `This enquiry has already been converted to member ID: ${enquiry.convertedMemberId}`
      );
    }

    // Create member using enquiry details
    const memberResult = await createMember({
      name: enquiry.name,
      phone: enquiry.phone,
      email: params.email,
      address: params.address,
      emergencyContactName: params.emergencyContactName,
      emergencyContactPhone: params.emergencyContactPhone,
      notes: enquiry.interestNotes ? `Converted from enquiry: ${enquiry.interestNotes}` : null,
      sharedPhoneAcknowledged: params.sharedPhoneAcknowledged,
      enrollment: params.enrollment,
      performedByUserId: params.performedByUserId,
    });

    // Update enquiry record to JOINED with converted member reference
    await tx
      .update(enquiries)
      .set({
        status: ENQUIRY_STATUSES.JOINED,
        convertedMemberId: memberResult.memberId,
        convertedAt: new Date(),
        convertedByUserId: params.performedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(enquiries.id, enquiry.id));

    await logAuditEvent({
      userId: params.performedByUserId,
      action: "ENQUIRY_CONVERT_TO_MEMBER",
      entityType: "ENQUIRY",
      entityId: enquiry.id,
      details: {
        convertedMemberId: memberResult.memberId,
        memberCode: memberResult.memberCode,
      },
      tx,
    });

    return {
      memberId: memberResult.memberId,
      memberCode: memberResult.memberCode,
      enquiryId: enquiry.id,
    };
  });
}

