# IronPulse Gym — Business Rules & Domain Invariants Reference

This document provides the authoritative domain model, business rules, financial invariants, date calculation algorithms, and permission matrices for the IronPulse Gym management web application.

---

## 1. Timezone and Date Representation

### 1.1 Operating Timezone
* **Business Timezone:** `Asia/Kolkata` (IST, UTC+05:30).
* All business dates (such as term start date, valid through date, attendance date, expense date, follow-up due date) are strictly interpreted as calendar dates (`YYYY-MM-DD`) in `Asia/Kolkata`.
* All physical audit timestamps (`createdAt`, `receivedAt`, `refundedAt`, `voidedAt`) are recorded as UTC `TIMESTAMPTZ` in PostgreSQL.

### 1.2 Half-Open Date Intervals `[startDate, endDate)`
Membership terms use half-open intervals:
* `startDate`: Inclusive calendar date on which the membership privileges begin.
* `endDate`: Exclusive boundary date on which the membership has expired.
* `validThrough`: The last day the member is entitled to access the gym (`endDate - 1 day`).

**Membership Status Logic on Date `D`:**
* **ACTIVE:** `startDate <= D` AND `endDate > D` (and status is `ACTIVE`).
* **UPCOMING:** `startDate > D` (and status is `UPCOMING` or `ACTIVE`).
* **EXPIRED:** `endDate <= D` (status automatically marked or evaluated as `EXPIRED`).

### 1.3 Clamping Rule for Indian Calendar Months
When adding $N$ months to a start date $S$:
1. Compute the target month: `targetMonth = S.month + N`.
2. Compute the target year accordingly.
3. Clamp the day of month to the maximum days in `targetMonth`:
   * 31 January + 1 Month $\rightarrow$ **28 February** (or **29 February** in a leap year).
   * 31 March + 1 Month $\rightarrow$ **30 April**.
   * 31 May + 1 Month $\rightarrow$ **30 June**.
   * 31 August + 1 Month $\rightarrow$ **30 September**.
   * 31 October + 1 Month $\rightarrow$ **30 November**.
4. The exclusive `endDate` is this clamped date in the target month.
5. The inclusive `validThrough` date is `endDate - 1 day` (e.g. 31 Jan + 1 Month $\rightarrow$ `endDate = 2026-02-28`, `validThrough = 2026-02-27`).
6. Leap years (e.g., 2024, 2028) correctly yield 29 days for February.

### 1.4 Early Renewals vs Lapsed Renewals
* **Early Renewal:** If a member renews while having an active or upcoming term ending at date $E$, the new term begins seamlessly on $E$. No gaps and no overlapping intervals are created.
* **Lapsed Renewal:** If a member has expired ($E \le \text{today}$), the new term starts on `today` (or an explicit staff-chosen start date).

---

## 2. Membership Pauses & Term Shifts

1. **Duration Shift:**
   * When a term is paused from `pauseStartDate` (inclusive) to `pauseEndDate` (exclusive) for $D$ days ($D = \text{pauseEndDate} - \text{pauseStartDate}$):
   * `endDate` shifts forward by $+D$ days.
   * `validThrough` shifts forward by $+D$ days.
   * The nominal plan duration is **never altered**; the interval is simply extended.
2. **Attendance Integrity:**
   * A pause cannot be retroactively applied to dates on which attendance has already been recorded.
3. **Cascading Queued Terms:**
   * If any future upcoming renewal term is queued after the paused term, its `startDate`, `endDate`, and `validThrough` are atomically shifted forward by the same $+D$ days to prevent overlapping terms.
4. **Early Resume:**
   * If a paused membership is resumed early on date $R$ ($R < \text{scheduledEndDate}$), the actual pause duration is recalculated as $D_{\text{actual}} = R - \text{pauseStartDate}$. The term's `endDate` is updated to reflect only the actual days paused.

---

## 3. Financial Invariants & Currency Math

### 3.1 Integer Paise Storage
* All monetary amounts are stored strictly as 64-bit integer paise (`BIGINT` / `INTEGER` in paise) where $\text{₹}1.00 = 100\text{ paise}$.
* Floating-point calculations (`0.1 + 0.2 = 0.30000000000000004`) are forbidden in all financial math.
* Display formatting uses the Indian numbering system (`₹1,50,000.00`) via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

### 3.2 Immutability of Historical Sales (Snapshots)
* When a membership term is created, the plan's attributes are permanently snapshotted onto the term and charge records:
  * `soldPlanName`
  * `durationUnit`
  * `durationQuantity`
  * `planPricePaise`
  * `joiningFeePaise`
  * `discountPaise`
  * `discountReason`
  * `taxRateBps`
* Updating or archiving a membership plan in Settings **never modifies** past membership terms or historic charge amounts.

### 3.3 Oldest-Charge Payment Allocation Algorithm
When a payment is received:
1. Outstanding non-cancelled charges for the member are queried with pessimistic row-level locking (`SELECT ... FOR UPDATE`) sorted by `due_date ASC, created_at ASC`.
2. Available payment funds are allocated strictly to the oldest charge until its balance reaches zero, with any remainder cascading to subsequent charges.
3. If the payment exceeds the total outstanding debt across all member charges, the transaction is **rejected with an overpayment error**. IronPulse enforces intentional accounting and does not operate an unanchored general-purpose member wallet.
4. Separate payments for membership balance dues **never create duplicate membership terms or alter membership duration**.

### 3.4 Separate Payment and Membership Statuses
* **Membership Status:** `ACTIVE`, `PAUSED`, `UPCOMING`, `EXPIRED`, `CANCELLED`.
* **Charge Status:** `UNPAID`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`.
* A member may be `ACTIVE` while having an unpaid balance (e.g. joined today, paid 50% deposit, balance due next week).
* A member may be `EXPIRED` while having paid 100% of their fees.
* Cancelling or archiving a member does **not erase** outstanding dues; historic debt remains fully visible in financial collection reports.

### 3.5 Atomic Sequential Receipt Numbering
* Receipts are numbered sequentially using an atomic sequence table (`receipt_sequence`) protected by PostgreSQL row locks: `REC-YYYY-XXXXX` (e.g., `REC-2026-00001`).
* Each receipt permanently snapshots the gym's name, address, phone number, GSTIN (if applicable), member details, payment breakdown, and remaining balance.
* Concurrency testing verifies that multiple staff members recording payments simultaneously never produce duplicate receipt numbers or gaps.

### 3.6 Refunds and Reversals
* **Authorisation:** Only users with the `OWNER` role can issue refunds or reverse payments.
* **Refund Constraints:**
  * Cannot exceed the unrefunded amount of the original payment.
  * Reverses the payment allocation from the affected charges, restoring the charge balance and marking the charge `PARTIALLY_PAID` or `UNPAID`.
  * Deducts from period net collections.
  * Does not delete historical invoice or receipt rows; inserts an immutable `refunds` record and an `audit_logs` record.
* **Payment Reversal:**
  * Used for bounced cheques or erroneous entries. Marks `is_reversed = true`, restores original charge balances, and logs who reversed the payment and why.

### 3.7 Cash Surplus vs Accounting Profit
IronPulse reports distinguish cash reality from accrual accounting:
* **Gross Collections:** Total cash/UPI/card payments received in the period.
* **Total Refunds:** Total cash/UPI refunded to members in the period.
* **Net Collections:** $\text{Gross Collections} - \text{Refunds}$.
* **Total Expenses:** Cash outlays paid for rent, utilities, salaries, maintenance, etc.
* **Cash Surplus:** $\text{Net Collections} - \text{Total Expenses}$.
* **Total Outstanding Dues:** Total unpaid balance on all active/past charges across all members.

---

## 4. Fixed Role-Based Access Control (RBAC)

IronPulse implements a fixed, dual-role access control model. No custom permission builder is needed.

| Capability | OWNER | STAFF |
| :--- | :---: | :---: |
| Reception Check-in & Mark Attendance | ✅ | ✅ |
| Add Member & Convert Enquiry | ✅ | ✅ |
| Record Payment & Print Receipt | ✅ | ✅ |
| View Individual Member Balance | ✅ | ✅ |
| View & Action Assigned Follow-ups | ✅ | ✅ |
| View Operational Dashboard (Attendance, Expiries) | ✅ | ✅ |
| **View Aggregate Financial Collections (Today / Month)** | ✅ | ❌ |
| **View Cash Surplus & Revenue Breakdown** | ✅ | ❌ |
| **View & Record Expenses / Expense Templates** | ✅ | ❌ |
| **Approve Membership Discounts** | ✅ | ❌ |
| **Issue Refunds & Reverse Payments** | ✅ | ❌ |
| **Override Membership Dates Manually** | ✅ | ❌ |
| **Manage Staff Accounts & Reset Passwords** | ✅ | ❌ |
| **Export Personal Data to CSV** | ✅ | ❌ |
| **Edit Gym Settings & Tax ID** | ✅ | ❌ |
| **View Security Audit Logs** | ✅ | ❌ |

**Enforcement:**
* Authorisation is verified server-side on every API route handler, server action, and report export.
* The actor and role are extracted exclusively from the authenticated database session cookie, never from client-submitted form bodies.
* If a `STAFF` member accesses financial endpoints or requests owner-only data, the server returns an HTTP 403 Forbidden error with a generic, safe response.

---

## 5. Concurrency & Data Protection

### 5.1 Optimistic Locking for Member Records
* Member records contain an integer `version` field.
* Updates check `WHERE id = :id AND version = :expectedVersion` and increment `version = version + 1`.
* If another staff member has modified the profile concurrently, the database returns 0 affected rows and the application presents a conflict resolution prompt rather than silently overwriting changes.

### 5.2 Idempotency Keys on Payment Submissions
* Payment and member creation requests support an `Idempotency-Key` header with client UUID and SHA-256 payload checksum.
* Network retries return the original cached receipt and payment details without double-charging or creating duplicate member entries.

### 5.3 Anti-Formula Injection in CSV Exports
* All user-supplied strings exported to CSV are sanitized. Any value starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is escaped with a leading single quote (`'`) to prevent spreadsheet formula injection attacks (CSV Injection / CWE-1236).
* CSV files are prefixed with the UTF-8 Byte Order Mark (`\uFEFF`) for clean rendering in Microsoft Excel and LibreOffice.

### 5.4 Private File Storage Validation
* Member photos and expense receipt attachments are validated against magic bytes (JPEG, PNG, WebP, PDF) to prevent malicious executable uploads.
* File sizes are capped at 5 MB.
* Files are stored in private object storage; no files are kept in server instance storage or encoded as base64 database blobs.

