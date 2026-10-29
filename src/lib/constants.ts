export const APP_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";

export const USER_ROLES = {
  OWNER: "OWNER",
  STAFF: "STAFF",
} as const;
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const DURATION_UNITS = {
  DAYS: "DAYS",
  MONTHS: "MONTHS",
} as const;
export type DurationUnit = (typeof DURATION_UNITS)[keyof typeof DURATION_UNITS];

export const MEMBERSHIP_STATUSES = {
  UPCOMING: "UPCOMING",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const;
export type MembershipStatus =
  (typeof MEMBERSHIP_STATUSES)[keyof typeof MEMBERSHIP_STATUSES];

export const PAYMENT_METHODS = {
  CASH: "CASH",
  UPI: "UPI",
  CARD: "CARD",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const CHARGE_TYPES = {
  MEMBERSHIP: "MEMBERSHIP",
  JOINING_FEE: "JOINING_FEE",
  ADJUSTMENT: "ADJUSTMENT",
  OTHER: "OTHER",
} as const;
export type ChargeType = (typeof CHARGE_TYPES)[keyof typeof CHARGE_TYPES];

export const CHARGE_STATUSES = {
  PENDING: "PENDING",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[keyof typeof CHARGE_STATUSES];

export const ENQUIRY_STATUSES = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  TRIAL_BOOKED: "TRIAL_BOOKED",
  JOINED: "JOINED",
  NOT_INTERESTED: "NOT_INTERESTED",
} as const;
export type EnquiryStatus =
  (typeof ENQUIRY_STATUSES)[keyof typeof ENQUIRY_STATUSES];

export const FOLLOW_UP_REASONS = {
  RENEWAL_UPCOMING: "RENEWAL_UPCOMING",
  MEMBERSHIP_EXPIRED: "MEMBERSHIP_EXPIRED",
  OVERDUE_BALANCE: "OVERDUE_BALANCE",
  ABSENCE: "ABSENCE",
  ENQUIRY: "ENQUIRY",
  MANUAL_CALLBACK: "MANUAL_CALLBACK",
} as const;
export type FollowUpReason =
  (typeof FOLLOW_UP_REASONS)[keyof typeof FOLLOW_UP_REASONS];

export const FOLLOW_UP_STATUSES = {
  PENDING: "PENDING",
  CONTACTED: "CONTACTED",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;
export type FollowUpStatus =
  (typeof FOLLOW_UP_STATUSES)[keyof typeof FOLLOW_UP_STATUSES];

export const FOLLOW_UP_OUTCOMES = {
  CONTACTED: "CONTACTED",
  NO_ANSWER: "NO_ANSWER",
  PROMISED_PAYMENT: "PROMISED_PAYMENT",
  RENEWED_RESOLVED: "RENEWED_RESOLVED",
  NOT_INTERESTED: "NOT_INTERESTED",
} as const;
export type FollowUpOutcome =
  (typeof FOLLOW_UP_OUTCOMES)[keyof typeof FOLLOW_UP_OUTCOMES];

export const DEFAULT_ABSENCE_THRESHOLD_DAYS = 10;
export const RENEWAL_WARNING_DAYS = 7;
