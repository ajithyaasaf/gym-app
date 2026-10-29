import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==========================================
// 1. USERS (STAFF & OWNER)
// ==========================================
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 32 }).notNull().default("STAFF"), // 'OWNER' | 'STAFF'
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    tempPasswordExpiresAt: timestamp("temp_password_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("users_role_idx").on(table.role),
    index("users_is_active_idx").on(table.isActive),
  ]
);

// ==========================================
// 2. SESSIONS (COOKIE SESSIONS)
// ==========================================
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ]
);

// ==========================================
// 3. GYM SETTINGS
// ==========================================
export const gymSettings = pgTable("gym_settings", {
  id: varchar("id", { length: 32 }).primaryKey().default("default"),
  gymName: varchar("gym_name", { length: 255 }).notNull().default("IronPulse Fitness"),
  phone: varchar("phone", { length: 32 }).notNull().default("+91 98765 43210"),
  email: varchar("email", { length: 255 }).notNull().default("contact@ironpulse.in"),
  address: text("address").notNull().default("123 MG Road, Bengaluru, Karnataka 560001"),
  receiptPrefix: varchar("receipt_prefix", { length: 32 }).notNull().default("REC"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
  absenceThresholdDays: integer("absence_threshold_days").notNull().default(10),
  taxEnabled: boolean("tax_enabled").notNull().default(false),
  taxName: varchar("tax_name", { length: 64 }).notNull().default("GST"),
  taxPercentageBasisPoints: integer("tax_percentage_basis_points").notNull().default(1800), // 1800 = 18.00%
  taxIdNumber: varchar("tax_id_number", { length: 64 }), // e.g. GSTIN
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================
// 4. MEMBERS
// ==========================================
export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    memberCode: varchar("member_code", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 32 }),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    doNotContact: boolean("do_not_contact").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedReason: text("archived_reason"),
    sharedPhoneAcknowledged: boolean("shared_phone_acknowledged").notNull().default(false),
    version: integer("version").notNull().default(1), // Optimistic locking
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("members_phone_idx").on(table.phone),
    index("members_name_idx").on(table.name),
    index("members_is_archived_idx").on(table.isArchived),
  ]
);

// ==========================================
// 5. MEMBERSHIP PLANS
// ==========================================
export const plans = pgTable(
  "plans",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    durationUnit: varchar("duration_unit", { length: 32 }).notNull(), // 'DAYS' | 'MONTHS'
    durationQuantity: integer("duration_quantity").notNull(),
    pricePaise: integer("price_paise").notNull(),
    joiningFeePaise: integer("joining_fee_paise").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("plans_is_active_idx").on(table.isActive),
  ]
);

// ==========================================
// 6. MEMBERSHIP TERMS
// ==========================================
export const membershipTerms = pgTable(
  "membership_terms",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    termNumber: integer("term_number").notNull().default(1),
    status: varchar("status", { length: 32 }).notNull(), // 'UPCOMING' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED'
    startDate: date("start_date").notNull(), // inclusive 'YYYY-MM-DD'
    endDate: date("end_date").notNull(), // exclusive 'YYYY-MM-DD'
    validThrough: date("valid_through").notNull(), // display date (end_date - 1 day)
    originalEndDate: date("original_end_date").notNull(),
    totalPausedDays: integer("total_paused_days").notNull().default(0),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    cancelledByUserId: text("cancelled_by_user_id").references(() => users.id),
    
    // Historical Snapshot of plan when purchased
    planNameSnapshot: varchar("plan_name_snapshot", { length: 255 }).notNull(),
    durationUnitSnapshot: varchar("duration_unit_snapshot", { length: 32 }).notNull(),
    durationQuantitySnapshot: integer("duration_quantity_snapshot").notNull(),
    basePricePaiseSnapshot: integer("base_price_paise_snapshot").notNull(),
    joiningFeePaiseSnapshot: integer("joining_fee_paise_snapshot").notNull().default(0),
    discountPaiseSnapshot: integer("discount_paise_snapshot").notNull().default(0),
    taxPaiseSnapshot: integer("tax_paise_snapshot").notNull().default(0),
    finalPricePaiseSnapshot: integer("final_price_paise_snapshot").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("terms_member_id_idx").on(table.memberId),
    index("terms_status_idx").on(table.status),
    index("terms_dates_idx").on(table.startDate, table.endDate),
  ]
);

// ==========================================
// 7. MEMBERSHIP PAUSES
// ==========================================
export const membershipPauses = pgTable(
  "membership_pauses",
  {
    id: text("id").primaryKey(),
    termId: text("term_id")
      .notNull()
      .references(() => membershipTerms.id),
    startDate: date("start_date").notNull(), // inclusive
    endDate: date("end_date").notNull(), // exclusive
    daysPaused: integer("days_paused").notNull(),
    reason: text("reason").notNull(),
    approvedByUserId: text("approved_by_user_id")
      .notNull()
      .references(() => users.id),
    resumedAt: date("resumed_at"),
    isResumedEarly: boolean("is_resumed_early").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("pauses_term_id_idx").on(table.termId),
  ]
);

// ==========================================
// 8. CHARGES (DEBTS / BILLS)
// ==========================================
export const charges = pgTable(
  "charges",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    termId: text("term_id").references(() => membershipTerms.id),
    chargeType: varchar("charge_type", { length: 32 }).notNull(), // 'MEMBERSHIP' | 'JOINING_FEE' | 'ADJUSTMENT' | 'OTHER'
    title: varchar("title", { length: 255 }).notNull(),
    baseAmountPaise: integer("base_amount_paise").notNull(),
    discountPaise: integer("discount_paise").notNull().default(0),
    discountReason: text("discount_reason"),
    discountApprovedBy: text("discount_approved_by").references(() => users.id),
    taxAmountPaise: integer("tax_amount_paise").notNull().default(0),
    netAmountPaise: integer("net_amount_paise").notNull(), // (base - discount + tax)
    allocatedPaymentPaise: integer("allocated_payment_paise").notNull().default(0),
    balancePaise: integer("balance_paise").notNull(), // (netAmount - allocatedPayment)
    dueDate: date("due_date"),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"), // 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("charges_member_id_idx").on(table.memberId),
    index("charges_status_idx").on(table.status),
    index("charges_due_date_idx").on(table.dueDate),
  ]
);

// ==========================================
// 9. PAYMENTS (MONEY RECEIVED)
// ==========================================
export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    paymentNumber: varchar("payment_number", { length: 64 }).notNull().unique(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    amountPaise: integer("amount_paise").notNull(),
    paymentMethod: varchar("payment_method", { length: 32 }).notNull(), // 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER'
    externalReference: varchar("external_reference", { length: 255 }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    receivedByUserId: text("received_by_user_id")
      .notNull()
      .references(() => users.id),
    notes: text("notes"),
    isReversed: boolean("is_reversed").notNull().default(false),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    reversedByUserId: text("reversed_by_user_id").references(() => users.id),
    unallocatedAmountPaise: integer("unallocated_amount_paise").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payments_member_id_idx").on(table.memberId),
    index("payments_received_at_idx").on(table.receivedAt),
    index("payments_is_reversed_idx").on(table.isReversed),
  ]
);

// ==========================================
// 10. PAYMENT ALLOCATIONS (SPLITS TO CHARGES)
// ==========================================
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id),
    chargeId: text("charge_id")
      .notNull()
      .references(() => charges.id),
    allocatedAmountPaise: integer("allocated_amount_paise").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("allocations_payment_id_idx").on(table.paymentId),
    index("allocations_charge_id_idx").on(table.chargeId),
  ]
);

// ==========================================
// 11. RECEIPTS & SEQUENCE (PRINTABLE PROOF)
// ==========================================
export const receipts = pgTable(
  "receipts",
  {
    id: text("id").primaryKey(),
    receiptNumber: varchar("receipt_number", { length: 64 }).notNull().unique(),
    sequenceNumber: integer("sequence_number").notNull(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    issuedByUserId: text("issued_by_user_id")
      .notNull()
      .references(() => users.id),
    
    // Receipt Snapshot
    gymNameSnapshot: varchar("gym_name_snapshot", { length: 255 }).notNull(),
    gymAddressSnapshot: text("gym_address_snapshot").notNull(),
    gymPhoneSnapshot: varchar("gym_phone_snapshot", { length: 64 }).notNull(),
    gymTaxIdSnapshot: varchar("gym_tax_id_snapshot", { length: 64 }),
    memberCodeSnapshot: varchar("member_code_snapshot", { length: 64 }).notNull(),
    memberNameSnapshot: varchar("member_name_snapshot", { length: 255 }).notNull(),
    memberPhoneSnapshot: varchar("member_phone_snapshot", { length: 64 }).notNull(),
    paymentAmountPaise: integer("payment_amount_paise").notNull(),
    paymentMethod: varchar("payment_method", { length: 32 }).notNull(),
    externalReference: varchar("external_reference", { length: 255 }),
    allocatedBreakdownJson: text("allocated_breakdown_json").notNull(),
    memberBalanceAfterPaise: integer("member_balance_after_paise").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("receipts_payment_id_idx").on(table.paymentId),
    index("receipts_member_id_idx").on(table.memberId),
    index("receipts_issued_at_idx").on(table.issuedAt),
  ]
);

export const receiptSequence = pgTable("receipt_sequence", {
  id: varchar("id", { length: 32 }).primaryKey().default("receipt_seq"),
  currentNumber: integer("current_number").notNull().default(0),
  year: integer("year").notNull().default(2026),
});

// ==========================================
// 12. REFUNDS
// ==========================================
export const refunds = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    amountPaise: integer("amount_paise").notNull(),
    reason: text("reason").notNull(),
    approvedByUserId: text("approved_by_user_id")
      .notNull()
      .references(() => users.id),
    refundedAt: timestamp("refunded_at", { withTimezone: true }).notNull().defaultNow(),
    paymentMethod: varchar("payment_method", { length: 32 }).notNull().default("CASH"),
    externalReference: varchar("external_reference", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("refunds_payment_id_idx").on(table.paymentId),
    index("refunds_member_id_idx").on(table.memberId),
    index("refunds_refunded_at_idx").on(table.refundedAt),
  ]
);

// ==========================================
// 13. ATTENDANCE
// ==========================================
export const attendance = pgTable(
  "attendance",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    attendanceDate: date("attendance_date").notNull(), // 'YYYY-MM-DD' in Asia/Kolkata
    checkInTime: timestamp("check_in_time", { withTimezone: true }).notNull().defaultNow(),
    markedByUserId: text("marked_by_user_id")
      .notNull()
      .references(() => users.id),
    isException: boolean("is_exception").notNull().default(false),
    exceptionReason: text("exception_reason"),
    isVoided: boolean("is_voided").notNull().default(false),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUserId: text("voided_by_user_id").references(() => users.id),
    voidReason: text("void_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("attendance_member_id_idx").on(table.memberId),
    index("attendance_date_idx").on(table.attendanceDate),
    index("attendance_is_voided_idx").on(table.isVoided),
  ]
);

// ==========================================
// 14. ENQUIRIES
// ==========================================
export const enquiries = pgTable(
  "enquiries",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    interestNotes: text("interest_notes"),
    trialDate: date("trial_date"),
    assignedStaffId: text("assigned_staff_id").references(() => users.id),
    status: varchar("status", { length: 32 }).notNull().default("NEW"), // 'NEW' | 'CONTACTED' | 'TRIAL_BOOKED' | 'JOINED' | 'NOT_INTERESTED'
    nextFollowUpDate: date("next_follow_up_date"),
    convertedMemberId: text("converted_member_id").references(() => members.id),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    convertedByUserId: text("converted_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("enquiries_phone_idx").on(table.phone),
    index("enquiries_status_idx").on(table.status),
    index("enquiries_next_follow_up_idx").on(table.nextFollowUpDate),
  ]
);

// ==========================================
// 15. FOLLOW-UPS & LOGS
// ==========================================
export const followUps = pgTable(
  "follow_ups",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id").references(() => members.id),
    enquiryId: text("enquiry_id").references(() => enquiries.id),
    reasonType: varchar("reason_type", { length: 32 }).notNull(), // 'RENEWAL_UPCOMING' | 'MEMBERSHIP_EXPIRED' | 'OVERDUE_BALANCE' | 'ABSENCE' | 'ENQUIRY' | 'MANUAL_CALLBACK'
    title: varchar("title", { length: 255 }).notNull(),
    notes: text("notes"),
    dueDate: date("due_date").notNull(),
    assignedStaffId: text("assigned_staff_id").references(() => users.id),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"), // 'PENDING' | 'CONTACTED' | 'RESOLVED' | 'DISMISSED'
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    lastOutcome: varchar("last_outcome", { length: 32 }), // 'CONTACTED' | 'NO_ANSWER' | 'PROMISED_PAYMENT' | 'RENEWED_RESOLVED' | 'NOT_INTERESTED'
    promiseDate: date("promise_date"),
    outcomeNotes: text("outcome_notes"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("follow_ups_member_id_idx").on(table.memberId),
    index("follow_ups_enquiry_id_idx").on(table.enquiryId),
    index("follow_ups_due_date_idx").on(table.dueDate),
    index("follow_ups_status_idx").on(table.status),
  ]
);

export const followUpLogs = pgTable(
  "follow_up_logs",
  {
    id: text("id").primaryKey(),
    followUpId: text("follow_up_id")
      .notNull()
      .references(() => followUps.id, { onDelete: "cascade" }),
    contactedByUserId: text("contacted_by_user_id")
      .notNull()
      .references(() => users.id),
    outcome: varchar("outcome", { length: 32 }).notNull(),
    promiseDate: date("promise_date"),
    notes: text("notes"),
    contactedAt: timestamp("contacted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("follow_up_logs_follow_up_id_idx").on(table.followUpId),
  ]
);

// ==========================================
// 16. EXPENSES & TEMPLATES
// ==========================================
export const expenseCategories = pgTable("expense_categories", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expenseTemplates = pgTable("expense_templates", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => expenseCategories.id),
  title: varchar("title", { length: 255 }).notNull(),
  amountPaise: integer("amount_paise").notNull(),
  defaultPaymentMethod: varchar("default_payment_method", { length: 32 })
    .notNull()
    .default("BANK_TRANSFER"),
  payee: varchar("payee", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => expenseCategories.id),
    expenseTemplateId: text("expense_template_id").references(
      () => expenseTemplates.id
    ),
    templateMonthKey: varchar("template_month_key", { length: 16 }), // e.g. '2026-10' to prevent duplicate postings
    expenseDate: date("expense_date").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    payee: varchar("payee", { length: 255 }).notNull(),
    amountPaise: integer("amount_paise").notNull(),
    paymentMethod: varchar("payment_method", { length: 32 }).notNull(), // 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER'
    referenceNumber: varchar("reference_number", { length: 255 }),
    notes: text("notes"),
    attachmentId: text("attachment_id"),
    recordedByUserId: text("recorded_by_user_id")
      .notNull()
      .references(() => users.id),
    isReversed: boolean("is_reversed").notNull().default(false),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("expenses_category_id_idx").on(table.categoryId),
    index("expenses_date_idx").on(table.expenseDate),
    index("expenses_template_month_idx").on(table.expenseTemplateId, table.templateMonthKey),
  ]
);

// ==========================================
// 17. ATTACHMENTS
// ==========================================
export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    entityType: varchar("entity_type", { length: 32 }).notNull(), // 'MEMBER_PHOTO' | 'EXPENSE_RECEIPT'
    entityId: text("entity_id"),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    storageKey: varchar("storage_key", { length: 512 }).notNull().unique(),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("attachments_entity_idx").on(table.entityType, table.entityId),
  ]
);

// ==========================================
// 18. IDEMPOTENCY KEYS
// ==========================================
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: varchar("key", { length: 128 }).primaryKey(),
    action: varchar("action", { length: 64 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    responseJson: text("response_json"),
    responseStatus: integer("response_status"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("idempotency_expires_at_idx").on(table.expiresAt),
  ]
);

// ==========================================
// 19. AUDIT LOGS
// ==========================================
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    action: varchar("action", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: text("entity_id").notNull(),
    reason: text("reason"),
    detailsJson: text("details_json"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_user_id_idx").on(table.userId),
  ]
);

// ==========================================
// RELATIONS
// ==========================================
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  recordedPayments: many(payments),
  markedAttendance: many(attendance),
  assignedFollowUps: many(followUps),
  auditLogs: many(auditLogs),
}));

export const membersRelations = relations(members, ({ many }) => ({
  terms: many(membershipTerms),
  charges: many(charges),
  payments: many(payments),
  receipts: many(receipts),
  attendance: many(attendance),
  followUps: many(followUps),
}));

export const membershipTermsRelations = relations(membershipTerms, ({ one, many }) => ({
  member: one(members, {
    fields: [membershipTerms.memberId],
    references: [members.id],
  }),
  plan: one(plans, {
    fields: [membershipTerms.planId],
    references: [plans.id],
  }),
  pauses: many(membershipPauses),
  charges: many(charges),
}));

export const chargesRelations = relations(charges, ({ one, many }) => ({
  member: one(members, {
    fields: [charges.memberId],
    references: [members.id],
  }),
  term: one(membershipTerms, {
    fields: [charges.termId],
    references: [membershipTerms.id],
  }),
  allocations: many(paymentAllocations),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  member: one(members, {
    fields: [payments.memberId],
    references: [members.id],
  }),
  allocations: many(paymentAllocations),
  receipts: many(receipts),
  refunds: many(refunds),
  receivedBy: one(users, {
    fields: [payments.receivedByUserId],
    references: [users.id],
  }),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentAllocations.paymentId],
    references: [payments.id],
  }),
  charge: one(charges, {
    fields: [paymentAllocations.chargeId],
    references: [charges.id],
  }),
}));

export const followUpsRelations = relations(followUps, ({ one, many }) => ({
  member: one(members, {
    fields: [followUps.memberId],
    references: [members.id],
  }),
  enquiry: one(enquiries, {
    fields: [followUps.enquiryId],
    references: [enquiries.id],
  }),
  assignedStaff: one(users, {
    fields: [followUps.assignedStaffId],
    references: [users.id],
  }),
  logs: many(followUpLogs),
}));

