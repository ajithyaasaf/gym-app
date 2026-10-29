# IronPulse Gym — Owner and Staff Workflow Guide

This guide walks gym owners and reception staff through daily workflows, reception desk operations, fee collections, membership renewals, and financial reconciliation.

---

## 1. Quick Reception Check-in (Staff & Owner)

The Attendance screen is optimized for lightning-fast reception check-in during morning and evening rush hours:

1. Click **Attendance** from the navigation bar.
2. In the search box, start typing the member's:
   * **Member Code** (e.g., `MEM-1001`)
   * **Phone Number** (e.g., `9876543210`)
   * **Full Name** (e.g., `Amit Sharma`)
3. **Instant Visual Feedback:**
   * 🟢 **Active & Fully Paid:** Check-in succeeds immediately with a clear confirmation sound/badge.
   * 🟡 **Active with Balance Due:** Check-in is recorded, but an **amber alert badge** appears stating: `"Member has an outstanding balance of ₹X.XX"`. A 1-click **Collect Fee** button allows reception staff to collect payment right at the turnstile.
   * 🔴 **Expired / Paused:** Check-in is blocked. A modal alerts the staff that the member's term has ended or is paused. If the member insists on working out, an Owner exception reason must be logged.
4. **Duplicate Prevention:** Checking in the same member twice on the same calendar day returns their existing check-in time without creating duplicate records.
5. **Voiding Mistaken Check-ins:** If staff accidentally checked in the wrong member, click the trash/void icon in the Daily Attendance table to mark the record void with an explanation.

---

## 2. Enrolling a New Member & Initial Payment

1. Click **Add Member** from the top bar or Members menu.
2. **Step 1: Enter Member Details**
   * Full Name (required)
   * Mobile Number (required, 10-digit Indian phone normalized to `+91`)
   * Email, Address, Emergency Contact (optional)
   * *Duplicate Warning:* If the phone number matches an existing member, an alert offers to open the existing member. If siblings or a couple share a family phone, check the explicit **"Family member sharing phone"** acknowledgement checkbox.
3. **Step 2: Select Membership Plan**
   * Choose from configured plans (e.g., *1 Month Fitness*, *3 Month Strength*, *1 Year Annual*).
   * The start date defaults to `Today`. You can select an upcoming start date if the member is joining next week.
   * The system automatically calculates the exact **Valid Through** date using Indian calendar clamping rules.
4. **Step 3: Preview Price & Initial Payment**
   * The system displays the Plan Price + Joining Fee.
   * If a discount is applied, select an Owner-approved discount reason.
   * Choose initial payment amount:
     * **Full Payment:** Balance becomes ₹0.
     * **Partial Payment:** (e.g., ₹1,000 paid towards a ₹2,500 plan). The remaining ₹1,500 balance is recorded as an active balance due.
     * **Pay Later:** Member is enrolled with ₹0 paid and full amount as balance due.
   * Select Payment Method: **Cash**, **UPI** (enter UPI Ref/UTR number), **Card**, or **Bank Transfer**.
5. **Step 4: Save & Print Receipt**
   * Click **Save & Enroll**.
   * A thermal or standard browser-printable receipt modal appears immediately. Click **Print Receipt** to give to the member or save as PDF.

---

## 3. Collecting Balance Dues & Early Renewals

### 3.1 Collecting Outstanding Balance
1. Open the member's profile by searching in **Members** or clicking from Attendance.
2. Notice the prominent red/amber **Balance Due** card showing the exact pending paise.
3. Click **Record Payment**.
4. Enter the amount being paid. The system automatically applies the funds to the oldest unpaid charge first.
5. Click **Confirm Payment**. A sequential receipt (`REC-2026-XXXXX`) is generated and opened for printing.

### 3.2 Early Membership Renewal
1. On the member's profile, click **Renew Membership**.
2. Select the renewal plan.
3. **Seamless Date Chaining:** If the current term is valid until `2026-11-15`, the renewed term automatically begins on `2026-11-15` without any gaps or overlaps!
4. Collect the renewal payment (or record as balance due) and confirm.

---

## 4. Daily Follow-ups & Lead Management

1. Click **Follow-ups** in the navigation bar.
2. Select the filter:
   * **Due Today / Overdue:** Members with balance promises or upcoming renewals due today.
   * **Follow-up Type:** Payment Due, Membership Expiring, Enquiry Trial, Absence (inactive for 14+ days).
3. **Actioning a Follow-up:**
   * Click the **WhatsApp** icon next to the phone number. This opens `wa.me` with a polite, pre-composed message in English (e.g., *"Hi Rajesh, your IronPulse gym membership is expiring on 31 Oct. Please visit the reception to renew."*).
   * After calling or messaging, click **Log Outcome**:
     * Mark as `CONTACTED` with notes (e.g. *"Spoke to member, promised to clear dues on Saturday"*).
     * Set a new **Next Follow-up Date** (e.g. Saturday).
     * Or mark as `RESOLVED` once paid or renewed.

---

## 5. Converting Walk-in Enquiries

1. Click **Enquiries**.
2. When a visitor walks into the gym, click **New Enquiry**, record their Name, Phone, and Interested Plan.
3. Once they decide to join:
   * Click **Convert to Member** on their enquiry row.
   * Their name, phone number, and selected plan are automatically carried over into the Member Admission form.
   * Complete the plan enrollment. The enquiry is atomically marked `CONVERTED` and linked to the new member ID.

---

## 6. Financial Reports & Expense Tracking (Owner Only)

*Staff accounts cannot access these screens. All numbers are confidential to the gym owner.*

### 6.1 Daily and Monthly Collections
1. Navigate to **Reports**.
2. Select your date filter: **Today**, **This Month**, **Last Month**, or **Custom Date Range**.
3. Review key metrics:
   * **Gross Collections:** Total money received at reception.
   * **Total Refunds:** Any returned fees.
   * **Net Collections:** Actual net incoming cash.
   * **Total Operating Expenses:** Rent, electricity, equipment maintenance, salaries.
   * **Cash Surplus:** $\text{Net Collections} - \text{Expenses}$.
   * **Outstanding Member Debt:** Total unpaid balance on active member records.
4. **Staff Performance Breakdown:** View exactly how much cash and UPI each front-desk staff member received during their shift.
5. **Export to CSV:** Click **Export to CSV** for spreadsheet reconciliation. All values are automatically sanitized against formula injection attacks.

### 6.2 Managing Expenses & Monthly Recurring Templates
1. Navigate to **Money > Expenses**.
2. **Recording One-off Expenses:**
   * Click **Add Expense**.
   * Select Category (e.g., *Equipment Repair*, *Cleaning Supplies*, *Water Bottles*).
   * Enter Amount in Rupees, Date, and Payment Method.
   * Upload optional receipt photo or invoice PDF.
3. **Recurring Monthly Bills (Rent, Salaries, Electricity):**
   * Under **Recurring Expense Templates**, predefined bills exist for Rent (₹35,000), Electricity (₹12,000), Trainer Salaries (₹45,000).
   * At the beginning of each month, click **Post for Month**.
   * The system atomically posts the expense for the current month. If already posted for that month, the system protects against double-posting.

### 6.3 Issuing Refunds
1. In **Money > Payments**, locate the original payment transaction.
2. Click **Issue Refund**.
3. Enter the refund amount (cannot exceed the remaining unrefunded payment) and mandatory business reason.
4. Confirm. The system deducts the refunded amount from net collections, restores the member's balance, and writes a permanent audit record.

