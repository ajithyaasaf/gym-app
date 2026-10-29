CREATE SEQUENCE IF NOT EXISTS "member_code_seq" START WITH 1100;
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" text,
	"fileName" varchar(255) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"attendance_date" date NOT NULL,
	"check_in_time" timestamp with time zone DEFAULT now() NOT NULL,
	"marked_by_user_id" text NOT NULL,
	"is_exception" boolean DEFAULT false NOT NULL,
	"exception_reason" text,
	"is_voided" boolean DEFAULT false NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" text,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" text NOT NULL,
	"reason" text,
	"details_json" text,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"term_id" text,
	"charge_type" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"base_amount_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"discount_reason" text,
	"discount_approved_by" text,
	"tax_amount_paise" integer DEFAULT 0 NOT NULL,
	"net_amount_paise" integer NOT NULL,
	"allocated_payment_paise" integer DEFAULT 0 NOT NULL,
	"balance_paise" integer NOT NULL,
	"due_date" date,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"interest_notes" text,
	"trial_date" date,
	"assigned_staff_id" text,
	"status" varchar(32) DEFAULT 'NEW' NOT NULL,
	"next_follow_up_date" date,
	"converted_member_id" text,
	"converted_at" timestamp with time zone,
	"converted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expense_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"amount_paise" integer NOT NULL,
	"default_payment_method" varchar(32) DEFAULT 'BANK_TRANSFER' NOT NULL,
	"payee" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"expense_template_id" text,
	"template_month_key" varchar(16),
	"expense_date" date NOT NULL,
	"title" varchar(255) NOT NULL,
	"payee" varchar(255) NOT NULL,
	"amount_paise" integer NOT NULL,
	"payment_method" varchar(32) NOT NULL,
	"reference_number" varchar(255),
	"notes" text,
	"attachment_id" text,
	"recorded_by_user_id" text NOT NULL,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"follow_up_id" text NOT NULL,
	"contacted_by_user_id" text NOT NULL,
	"outcome" varchar(32) NOT NULL,
	"promise_date" date,
	"notes" text,
	"contacted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text,
	"enquiry_id" text,
	"reason_type" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"notes" text,
	"due_date" date NOT NULL,
	"assigned_staff_id" text,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"last_outcome" varchar(32),
	"promise_date" date,
	"outcome_notes" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_settings" (
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"gym_name" varchar(255) DEFAULT 'IronPulse Fitness' NOT NULL,
	"phone" varchar(32) DEFAULT '+91 98765 43210' NOT NULL,
	"email" varchar(255) DEFAULT 'contact@ironpulse.in' NOT NULL,
	"address" text DEFAULT '123 MG Road, Bengaluru, Karnataka 560001' NOT NULL,
	"receipt_prefix" varchar(32) DEFAULT 'REC' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL,
	"absence_threshold_days" integer DEFAULT 10 NOT NULL,
	"tax_enabled" boolean DEFAULT false NOT NULL,
	"tax_name" varchar(64) DEFAULT 'GST' NOT NULL,
	"tax_percentage_basis_points" integer DEFAULT 1800 NOT NULL,
	"tax_id_number" varchar(64),
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"action" varchar(64) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"response_json" text,
	"response_status" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"member_code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"email" varchar(255),
	"address" text,
	"emergency_contact_name" varchar(255),
	"emergency_contact_phone" varchar(32),
	"photo_url" text,
	"notes" text,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_reason" text,
	"shared_phone_acknowledged" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_member_code_unique" UNIQUE("member_code")
);
--> statement-breakpoint
CREATE TABLE "membership_pauses" (
	"id" text PRIMARY KEY NOT NULL,
	"term_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_paused" integer NOT NULL,
	"reason" text NOT NULL,
	"approved_by_user_id" text NOT NULL,
	"resumed_at" date,
	"is_resumed_early" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_terms" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"term_number" integer DEFAULT 1 NOT NULL,
	"status" varchar(32) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"valid_through" date NOT NULL,
	"original_end_date" date NOT NULL,
	"total_paused_days" integer DEFAULT 0 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"cancelled_by_user_id" text,
	"plan_name_snapshot" varchar(255) NOT NULL,
	"duration_unit_snapshot" varchar(32) NOT NULL,
	"duration_quantity_snapshot" integer NOT NULL,
	"base_price_paise_snapshot" integer NOT NULL,
	"joining_fee_paise_snapshot" integer DEFAULT 0 NOT NULL,
	"discount_paise_snapshot" integer DEFAULT 0 NOT NULL,
	"tax_paise_snapshot" integer DEFAULT 0 NOT NULL,
	"final_price_paise_snapshot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"charge_id" text NOT NULL,
	"allocated_amount_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_number" varchar(64) NOT NULL,
	"member_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"payment_method" varchar(32) NOT NULL,
	"external_reference" varchar(255),
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_by_user_id" text NOT NULL,
	"notes" text,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	"reversed_by_user_id" text,
	"unallocated_amount_paise" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"duration_unit" varchar(32) NOT NULL,
	"duration_quantity" integer NOT NULL,
	"price_paise" integer NOT NULL,
	"joining_fee_paise" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_sequence" (
	"id" varchar(32) PRIMARY KEY DEFAULT 'receipt_seq' NOT NULL,
	"current_number" integer DEFAULT 0 NOT NULL,
	"year" integer DEFAULT 2026 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_number" varchar(64) NOT NULL,
	"sequence_number" integer NOT NULL,
	"payment_id" text NOT NULL,
	"member_id" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by_user_id" text NOT NULL,
	"gym_name_snapshot" varchar(255) NOT NULL,
	"gym_address_snapshot" text NOT NULL,
	"gym_phone_snapshot" varchar(64) NOT NULL,
	"gym_tax_id_snapshot" varchar(64),
	"member_code_snapshot" varchar(64) NOT NULL,
	"member_name_snapshot" varchar(255) NOT NULL,
	"member_phone_snapshot" varchar(64) NOT NULL,
	"payment_amount_paise" integer NOT NULL,
	"payment_method" varchar(32) NOT NULL,
	"external_reference" varchar(255),
	"allocated_breakdown_json" text NOT NULL,
	"member_balance_after_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"member_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"reason" text NOT NULL,
	"approved_by_user_id" text NOT NULL,
	"refunded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_method" varchar(32) DEFAULT 'CASH' NOT NULL,
	"external_reference" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(32) DEFAULT 'STAFF' NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"temp_password_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_user_id_users_id_fk" FOREIGN KEY ("marked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_term_id_membership_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."membership_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_discount_approved_by_users_id_fk" FOREIGN KEY ("discount_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_converted_member_id_members_id_fk" FOREIGN KEY ("converted_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_converted_by_user_id_users_id_fk" FOREIGN KEY ("converted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_templates" ADD CONSTRAINT "expense_templates_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_template_id_expense_templates_id_fk" FOREIGN KEY ("expense_template_id") REFERENCES "public"."expense_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_logs" ADD CONSTRAINT "follow_up_logs_follow_up_id_follow_ups_id_fk" FOREIGN KEY ("follow_up_id") REFERENCES "public"."follow_ups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_logs" ADD CONSTRAINT "follow_up_logs_contacted_by_user_id_users_id_fk" FOREIGN KEY ("contacted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_pauses" ADD CONSTRAINT "membership_pauses_term_id_membership_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."membership_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_pauses" ADD CONSTRAINT "membership_pauses_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_terms" ADD CONSTRAINT "membership_terms_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_terms" ADD CONSTRAINT "membership_terms_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_terms" ADD CONSTRAINT "membership_terms_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_user_id_users_id_fk" FOREIGN KEY ("reversed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "attendance_member_id_idx" ON "attendance" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "attendance_is_voided_idx" ON "attendance" USING btree ("is_voided");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "charges_member_id_idx" ON "charges" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "charges_status_idx" ON "charges" USING btree ("status");--> statement-breakpoint
CREATE INDEX "charges_due_date_idx" ON "charges" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "enquiries_phone_idx" ON "enquiries" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enquiries_next_follow_up_idx" ON "enquiries" USING btree ("next_follow_up_date");--> statement-breakpoint
CREATE INDEX "expenses_category_id_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "expenses_template_month_idx" ON "expenses" USING btree ("expense_template_id","template_month_key");--> statement-breakpoint
CREATE INDEX "follow_up_logs_follow_up_id_idx" ON "follow_up_logs" USING btree ("follow_up_id");--> statement-breakpoint
CREATE INDEX "follow_ups_member_id_idx" ON "follow_ups" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "follow_ups_enquiry_id_idx" ON "follow_ups" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "follow_ups_due_date_idx" ON "follow_ups" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "follow_ups_status_idx" ON "follow_ups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idempotency_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "members_phone_idx" ON "members" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "members_name_idx" ON "members" USING btree ("name");--> statement-breakpoint
CREATE INDEX "members_is_archived_idx" ON "members" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "pauses_term_id_idx" ON "membership_pauses" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "terms_member_id_idx" ON "membership_terms" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "terms_status_idx" ON "membership_terms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "terms_dates_idx" ON "membership_terms" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "allocations_payment_id_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "allocations_charge_id_idx" ON "payment_allocations" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "payments_member_id_idx" ON "payments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "payments_received_at_idx" ON "payments" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "payments_is_reversed_idx" ON "payments" USING btree ("is_reversed");--> statement-breakpoint
CREATE INDEX "plans_is_active_idx" ON "plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "receipts_payment_id_idx" ON "receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "receipts_member_id_idx" ON "receipts" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "receipts_issued_at_idx" ON "receipts" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "refunds_payment_id_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_member_id_idx" ON "refunds" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "refunds_refunded_at_idx" ON "refunds" USING btree ("refunded_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_is_active_idx" ON "users" USING btree ("is_active");