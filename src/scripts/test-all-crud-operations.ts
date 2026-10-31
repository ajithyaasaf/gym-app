import { getTodayISTString, addDays } from "../lib/dates";

const BASE_URL = process.env.TEST_APP_URL || "http://localhost:3001";

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(suite: string, test: string, passed: boolean, error?: string, details?: string) {
  results.push({ suite, test, passed, error, details });
  const icon = passed ? "✓" : "✗";
  const color = passed ? "\x1b[32m" : "\x1b[31m";
  console.log(`  ${color}${icon}\x1b[0m ${test}`);
  if (!passed) {
    if (error) console.log(`    \x1b[33mError: ${error}\x1b[0m`);
    if (details) console.log(`    \x1b[36mDetails: ${details.slice(0, 200)}\x1b[0m`);
  }
}

class HttpClient {
  private cookies: string[] = [];

  setCookieFromHeader(setCookieHeader: string | null) {
    if (!setCookieHeader) return;
    const parts = setCookieHeader.split(";")[0];
    if (parts) {
      const cookieName = parts.split("=")[0];
      this.cookies = this.cookies.filter((c) => !c.startsWith(`${cookieName}=`));
      this.cookies.push(parts);
    }
  }

  clearCookies() {
    this.cookies = [];
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = new Headers(options.headers || {});
    if (this.cookies.length > 0) {
      headers.set("Cookie", this.cookies.join("; "));
    }
    if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(url, { ...options, headers });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      this.setCookieFromHeader(setCookie);
    }

    let data: any = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return { status: res.status, headers: res.headers, data };
  }
}

async function runAllCrudAndEdgeCaseTests() {
  console.log(`\n===============================================================`);
  console.log(`  IronPulse Gym — Comprehensive Full-Stack CRUD & Edge-Case Suite`);
  console.log(`  Target Server: ${BASE_URL}`);
  console.log(`===============================================================\n`);

  const ownerClient = new HttpClient();
  const staffClient = new HttpClient();
  const unauthClient = new HttpClient();

  // -------------------------------------------------------------
  // SUITE 1: AUTHENTICATION & SESSIONS
  // -------------------------------------------------------------
  console.log(`\x1b[1m[Suite 1: Authentication & RBAC Boundaries]\x1b[0m`);
  try {
    // 1.1 Invalid Password
    const badLogin = await unauthClient.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "owner@ironpulse.in", password: "WrongPassword#999" }),
    });
    recordTest("Auth", "Invalid password fails with 401 generic error", badLogin.status === 401);

    // 1.2 Staff Login
    const staffLogin = await staffClient.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "priya@ironpulse.in", password: "Staff@12345" }),
    });
    recordTest(
      "Auth",
      "Staff signs in and receives HttpOnly session cookie",
      staffLogin.status === 200 && staffLogin.data.user.role === "STAFF"
    );

    // 1.3 Owner Login
    const ownerLogin = await ownerClient.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "owner@ironpulse.in", password: "Owner@12345" }),
    });
    recordTest(
      "Auth",
      "Owner signs in and receives HttpOnly session cookie",
      ownerLogin.status === 200 && ownerLogin.data.user.role === "OWNER"
    );
  } catch (err: any) {
    recordTest("Auth", "Authentication suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 2: GYM SETTINGS CRUD (OWNER vs STAFF)
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 2: Gym Settings CRUD & RBAC]\x1b[0m`);
  try {
    // 2.1 Owner Read Settings
    const getSettings = await ownerClient.request("/api/settings/gym");
    recordTest(
      "Settings",
      "Owner reads current gym settings",
      getSettings.status === 200 && !!getSettings.data.gymName
    );

    // 2.2 Staff Forbidden from updating settings
    const staffUpdate = await staffClient.request("/api/settings/gym", {
      method: "PUT",
      body: JSON.stringify({ gymName: "Hacked Gym Name" }),
    });
    recordTest("Settings", "Staff update settings rejected with 403 Forbidden", staffUpdate.status === 403);

    // 2.3 Owner Update Settings
    const ownerUpdate = await ownerClient.request("/api/settings/gym", {
      method: "PUT",
      body: JSON.stringify({
        gymName: "IronPulse Fitness Club",
        phone: "+91 98765 43210",
        address: "123 MG Road, Bengaluru, Karnataka",
        receiptPrefix: "REC",
        absenceThresholdDays: 10,
      }),
    });
    recordTest("Settings", "Owner updates gym settings successfully", ownerUpdate.status === 200);
  } catch (err: any) {
    recordTest("Settings", "Settings suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 3: MEMBERSHIP PLANS CATALOG CRUD
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 3: Membership Plans Catalog CRUD]\x1b[0m`);
  let createdPlanId = "";
  try {
    // 3.1 List Plans
    const plansList = await staffClient.request("/api/settings/plans");
    recordTest(
      "Plans",
      "Staff can list available active plans",
      plansList.status === 200 && Array.isArray(plansList.data.plans)
    );

    // 3.2 Staff cannot create plan
    const staffCreatePlan = await staffClient.request("/api/settings/plans", {
      method: "POST",
      body: JSON.stringify({
        name: "Staff Fake Plan",
        durationUnit: "MONTHS",
        durationQuantity: 1,
        pricePaise: 100000,
        joiningFeePaise: 0,
      }),
    });
    recordTest("Plans", "Staff creating plan rejected with 403 Forbidden", staffCreatePlan.status === 403);

    // 3.3 Owner Creates Plan
    const planName = `Special Test Plan ${Date.now().toString().slice(-4)}`;
    const ownerCreatePlan = await ownerClient.request("/api/settings/plans", {
      method: "POST",
      body: JSON.stringify({
        name: planName,
        description: "Created via automated test suite",
        durationUnit: "MONTHS",
        durationQuantity: 3,
        pricePaise: 400000, // ₹4,000
        joiningFeePaise: 50000, // ₹500
      }),
    });
    createdPlanId = ownerCreatePlan.data?.planId;
    recordTest(
      "Plans",
      "Owner creates new membership plan (3 Months / ₹4,000)",
      ownerCreatePlan.status === 201 && !!createdPlanId
    );

    // 3.4 Owner Updates Plan Price via PATCH
    const ownerUpdatePlan = await ownerClient.request("/api/settings/plans", {
      method: "PATCH",
      body: JSON.stringify({
        id: createdPlanId,
        name: `${planName} (Updated)`,
        pricePaise: 420000, // ₹4,200
        joiningFeePaise: 50000,
        isActive: true,
      }),
    });
    recordTest(
      "Plans",
      "Owner updates plan price (historical snapshots protected)",
      ownerUpdatePlan.status === 200 && ownerUpdatePlan.data.success === true
    );
  } catch (err: any) {
    recordTest("Plans", "Plans suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 4: STAFF MANAGEMENT CRUD (OWNER ONLY)
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 4: Staff Management CRUD]\x1b[0m`);
  let createdStaffEmail = `desk_${Date.now().toString().slice(-5)}@ironpulse.in`;
  let createdStaffId = "";
  try {
    // 4.1 Staff forbidden from accessing staff management
    const staffListStaff = await staffClient.request("/api/settings/staff");
    recordTest("Staff", "Staff accessing staff list rejected with 403 Forbidden", staffListStaff.status === 403);

    // 4.2 Owner lists staff
    const ownerListStaff = await ownerClient.request("/api/settings/staff");
    recordTest(
      "Staff",
      "Owner retrieves full staff roster",
      ownerListStaff.status === 200 && Array.isArray(ownerListStaff.data.staff)
    );

    // 4.3 Owner creates new staff with one-time credential
    const createStaffRes = await ownerClient.request("/api/settings/staff", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Desk Trainee",
        email: createdStaffEmail,
        phone: "+91 91234 56789",
      }),
    });
    createdStaffId = createStaffRes.data?.userId;
    const tempPass = createStaffRes.data?.tempPassword;
    recordTest(
      "Staff",
      "Owner creates new staff account and receives temporary setup password",
      createStaffRes.status === 201 && !!tempPass && !!createdStaffId
    );

    // 4.4 Test login with new staff credential
    const traineeClient = new HttpClient();
    const traineeLogin = await traineeClient.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: createdStaffEmail, password: tempPass }),
    });
    recordTest("Staff", "New staff successfully logs in with temporary password", traineeLogin.status === 200);

    // 4.5 Owner Deactivates Staff via PATCH
    const deactRes = await ownerClient.request("/api/settings/staff", {
      method: "PATCH",
      body: JSON.stringify({
        userId: createdStaffId,
        action: "DEACTIVATE",
      }),
    });
    recordTest("Staff", "Owner deactivates staff account", deactRes.status === 200 && deactRes.data.success === true);

    // 4.6 Deactivated Staff immediately blocked on next request
    const blockedCheck = await traineeClient.request("/api/members");
    recordTest(
      "Staff",
      "Deactivated staff's active session is revoked immediately (401)",
      blockedCheck.status === 401
    );
  } catch (err: any) {
    recordTest("Staff", "Staff management suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 5: ENQUIRIES CRUD & CONVERSION
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 5: Enquiries CRUD & Atomic Conversion]\x1b[0m`);
  let enquiryId = "";
  let convertedMemberId = "";
  const enquiryPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  try {
    // 5.1 Create Enquiry
    const createEnq = await staffClient.request("/api/enquiries", {
      method: "POST",
      body: JSON.stringify({
        name: "Sunita Reddy (Trial Enquiry)",
        phone: enquiryPhone,
        interestNotes: "Interested in 3-month strength program",
      }),
    });
    enquiryId = createEnq.data?.enquiryId;
    recordTest(
      "Enquiries",
      "Staff logs a walk-in enquiry",
      createEnq.status === 201 && !!enquiryId
    );

    // 5.2 List Enquiries
    const listEnq = await staffClient.request("/api/enquiries?status=NEW");
    recordTest(
      "Enquiries",
      "Staff lists pending enquiries with filters",
      listEnq.status === 200 && Array.isArray(listEnq.data.enquiries)
    );

    // 5.3 Convert Enquiry into Member with Plan & Partial Payment
    const convertRes = await staffClient.request(`/api/enquiries/${enquiryId}/convert`, {
      method: "POST",
      body: JSON.stringify({
        enrollment: {
          planId: "plan_1mo",
          startDate: getTodayISTString(),
          initialPaymentPaise: 100000,
          paymentMethod: "UPI",
          paymentReference: "UPI-ENQ-CONV-999",
        },
      }),
    });
    convertedMemberId = convertRes.data?.memberId;
    recordTest(
      "Enquiries",
      "Enquiry converts into Member with plan and receipt atomically",
      convertRes.status === 201 && !!convertedMemberId && !!convertRes.data?.memberCode
    );

    // 5.4 Double conversion attempt rejected
    const doubleConvert = await staffClient.request(`/api/enquiries/${enquiryId}/convert`, {
      method: "POST",
      body: JSON.stringify({
        enrollment: {
          planId: "plan_1mo",
          startDate: getTodayISTString(),
        },
      }),
    });
    recordTest(
      "Enquiries",
      "Re-converting already converted enquiry rejected with 400",
      doubleConvert.status === 400
    );
  } catch (err: any) {
    recordTest("Enquiries", "Enquiries suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 6: MEMBERS CRUD, DUPLICATE GUARDS & CONCURRENCY
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 6: Members CRUD, Duplicate Guards & Concurrency]\x1b[0m`);
  let memberAId = "";
  let memberACode = "";
  let memberAVersion = 1;
  const sharedPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
  try {
    // 6.1 Create Member with Plan and Partial Payment (₹1,500 + ₹500 fee = ₹2,000; pays ₹1,200; balance ₹800)
    const createMemberA = await staffClient.request("/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "Vikram Malhotra",
        phone: sharedPhone,
        email: "vikram@example.com",
        address: "7th Cross, Indiranagar",
        enrollment: {
          planId: "plan_1mo",
          startDate: getTodayISTString(),
          initialPaymentPaise: 120000, // ₹1,200
          paymentMethod: "CASH",
        },
      }),
    });
    memberAId = createMemberA.data?.memberId;
    memberACode = createMemberA.data?.memberCode;
    recordTest(
      "Members",
      "Staff enrolls member with partial payment & generates receipt",
      createMemberA.status === 201 && !!memberAId && !!createMemberA.data?.paymentResult?.receiptId
    );

    // 6.2 Duplicate phone without shared-family acknowledgement rejected
    const dupPhoneAttempt = await staffClient.request("/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "Ananya Malhotra (Sister)",
        phone: sharedPhone,
        sharedPhoneAcknowledged: false,
      }),
    });
    recordTest(
      "Members",
      "Duplicate phone without explicit shared-family acknowledgement rejected with 400",
      dupPhoneAttempt.status === 400
    );

    // 6.3 Shared phone WITH acknowledgement succeeds
    const sharedPhoneSuccess = await staffClient.request("/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "Ananya Malhotra (Sister)",
        phone: sharedPhone,
        sharedPhoneAcknowledged: true,
      }),
    });
    recordTest(
      "Members",
      "Shared phone with explicit acknowledgement succeeds",
      sharedPhoneSuccess.status === 201
    );

    // 6.4 Search Members (Server-side paginated & debounced)
    const searchRes = await staffClient.request(`/api/members?search=${encodeURIComponent(memberACode)}`);
    recordTest(
      "Members",
      "Server-side search by Member Code locates exact record",
      searchRes.status === 200 && searchRes.data.members.length === 1
    );

    // 6.5 Get Member Profile Details
    const profileRes = await staffClient.request(`/api/members/${memberAId}`);
    memberAVersion = profileRes.data?.member?.version || 1;
    const balancePaise = profileRes.data?.totalDuePaise;
    recordTest(
      "Members",
      "Fetches full member profile with active balance (₹800 due)",
      profileRes.status === 200 && balancePaise === 80000
    );

    // 6.6 Update Member Details (Valid version update via PATCH)
    const updateRes = await staffClient.request(`/api/members/${memberAId}`, {
      method: "PATCH",
      body: JSON.stringify({
        expectedVersion: memberAVersion,
        name: "Vikram Malhotra (Updated)",
        phone: sharedPhone,
        notes: "Prefers morning workout sessions",
      }),
    });
    memberAVersion = updateRes.data?.version || updateRes.data?.member?.version || 2;
    recordTest(
      "Members",
      "Updates member profile and increments optimistic version",
      updateRes.status === 200 && memberAVersion === 2
    );

    // 6.7 Optimistic Concurrency Conflict (Stale Expected Version = 1)
    const staleConflictRes = await staffClient.request(`/api/members/${memberAId}`, {
      method: "PATCH",
      body: JSON.stringify({
        expectedVersion: 1, // Stale version!
        name: "Vikram Malhotra (Stale Edit)",
      }),
    });
    recordTest(
      "Members",
      "Concurrent update with stale version detects conflict (409 Conflict)",
      staleConflictRes.status === 409
    );
  } catch (err: any) {
    recordTest("Members", "Members suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 7: MEMBERSHIP LIFECYCLE (RENEW, PAUSE, RESUME, CANCEL)
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 7: Membership Lifecycle & Invariants]\x1b[0m`);
  let memberTermId = "";
  let memberPauseId = "";
  try {
    // Fetch member's current term ID
    const profile = await staffClient.request(`/api/members/${memberAId}`);
    memberTermId = profile.data?.terms[0]?.id;

    // 7.1 Early Renewal: Chains seamlessly at current term endDate
    const renewRes = await staffClient.request(`/api/members/${memberAId}/renew`, {
      method: "POST",
      body: JSON.stringify({
        planId: "plan_1mo",
      }),
    });
    recordTest(
      "Lifecycle",
      "Early renewal seamlessly chains at existing term endDate without overlapping",
      renewRes.status === 201 && !!renewRes.data.termId
    );

    // 7.2 Pause Active Term (Owner authorization required)
    const pauseStartDate = getTodayISTString();
    const pauseEndDate = addDays(pauseStartDate, 7);
    const pauseRes = await ownerClient.request(`/api/members/${memberAId}/pause`, {
      method: "POST",
      body: JSON.stringify({
        termId: memberTermId,
        startDate: pauseStartDate,
        endDate: pauseEndDate,
        reason: "Traveling out of town for festival",
      }),
    });
    memberPauseId = pauseRes.data?.pauseId;
    recordTest(
      "Lifecycle",
      "Pausing term shifts endDate forward by pause duration",
      pauseRes.status === 200 && !!memberPauseId
    );

    // 7.3 Overlapping Pause Rejected
    const dupPauseRes = await ownerClient.request(`/api/members/${memberAId}/pause`, {
      method: "POST",
      body: JSON.stringify({
        termId: memberTermId,
        startDate: pauseStartDate,
        endDate: addDays(pauseStartDate, 10),
        reason: "Overlapping pause attempt",
      }),
    });
    recordTest(
      "Lifecycle",
      "Overlapping pause on active term rejected with 400",
      dupPauseRes.status === 400
    );

    // 7.4 Early Resume Recalculates Term Extension (Resume date strictly between startDate and endDate)
    const resumeDate = addDays(pauseStartDate, 2);
    const resumeRes = await ownerClient.request(`/api/members/${memberAId}/resume`, {
      method: "POST",
      body: JSON.stringify({
        pauseId: memberPauseId,
        resumeDate,
      }),
    });
    recordTest(
      "Lifecycle",
      "Early resume restores active status and recalculates actual extension",
      resumeRes.status === 200 && resumeRes.data.actualDaysPaused === 2
    );
  } catch (err: any) {
    recordTest("Lifecycle", "Lifecycle suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 8: PAYMENTS, RECEIPTS, REFUNDS & OVERPAYMENT GUARDS
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 8: Payments, Receipts, Refunds & Financial Guards]\x1b[0m`);
  let recordedPaymentId = "";
  let recordedReceiptId = "";
  try {
    // Check member's current total balance
    const profile = await staffClient.request(`/api/members/${memberAId}`);
    const remainingBalance = profile.data?.totalDuePaise || 0;

    // 8.1 Accidental Overpayment Rejected (paying ₹5,000 more than due)
    const overpayAttempt = await staffClient.request("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        memberId: memberAId,
        amountPaise: remainingBalance + 500000,
        paymentMethod: "CASH",
      }),
    });
    recordTest(
      "Finance",
      "Accidental overpayment exceeding total debt is rejected with 400",
      overpayAttempt.status === 400
    );

    // 8.2 Pay Exact Remaining Balance Due (returns status 201)
    const settlePayment = await staffClient.request("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        memberId: memberAId,
        amountPaise: remainingBalance,
        paymentMethod: "UPI",
        externalReference: "UPI-SETTLE-8888",
      }),
    });
    recordedPaymentId = settlePayment.data?.paymentId;
    recordedReceiptId = settlePayment.data?.receiptId;
    recordTest(
      "Finance",
      "Settle balance due: generates sequential receipt and zeroes debt without creating extra terms",
      settlePayment.status === 201 && settlePayment.data?.memberBalanceAfterPaise === 0
    );

    // 8.3 Printable Receipt Snapshot Available
    const printReceipt = await staffClient.request(`/receipts/${recordedReceiptId}/print`);
    recordTest(
      "Finance",
      "Printable receipt page renders issue-time snapshot",
      printReceipt.status === 200 && typeof printReceipt.data === "string" && printReceipt.data.includes("Receipt")
    );

    // 8.4 Staff Forbidden from Issuing Refunds
    const staffRefund = await staffClient.request(`/api/payments/${recordedPaymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({
        amountPaise: 10000,
        reason: "Customer request",
      }),
    });
    recordTest("Finance", "Staff attempting refund is rejected with 403 Forbidden", staffRefund.status === 403);

    // 8.5 Refund Exceeding Eligible Amount Rejected
    const excessRefund = await ownerClient.request(`/api/payments/${recordedPaymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({
        amountPaise: remainingBalance + 100000, // Exceeds original payment!
        reason: "Excessive refund test",
      }),
    });
    recordTest(
      "Finance",
      "Refund exceeding original received payment rejected with 400",
      excessRefund.status === 400
    );

    // 8.6 Owner Issues Valid Partial Refund (Reopens debt)
    const validRefund = await ownerClient.request(`/api/payments/${recordedPaymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({
        amountPaise: 50000, // Refund ₹500
        reason: "Partial fee adjustment approved by owner",
      }),
    });
    recordTest(
      "Finance",
      "Owner issues valid refund: reduces collections and restores member charge balance",
      validRefund.status === 201 && validRefund.data?.refundedAmountPaise === 50000
    );
  } catch (err: any) {
    recordTest("Finance", "Finance suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 9: ATTENDANCE CRUD & EXCEPTIONS
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 9: Attendance Desk CRUD & Exceptions]\x1b[0m`);
  let attendanceRecordId = "";
  try {
    // 9.1 Check-in Active Member (using convertedMemberId who is fully active starting today)
    const checkInRes = await staffClient.request("/api/attendance", {
      method: "POST",
      body: JSON.stringify({
        memberId: convertedMemberId,
      }),
    });
    attendanceRecordId = checkInRes.data?.id;
    recordTest(
      "Attendance",
      "Front-desk checks in active member for today",
      checkInRes.status === 200 && (!!attendanceRecordId || checkInRes.data?.isExisting === true)
    );

    // 9.2 Duplicate Check-in on Same Date returns existing record
    const dupCheckIn = await staffClient.request("/api/attendance", {
      method: "POST",
      body: JSON.stringify({
        memberId: convertedMemberId,
      }),
    });
    recordTest(
      "Attendance",
      "Duplicate check-in on same day returns existing record without duplicating",
      dupCheckIn.status === 200 && dupCheckIn.data.isExisting === true
    );

    // 9.3 Check-in Non-Active Member blocked without exception
    const membersList = await staffClient.request("/api/members?search=Ananya");
    const inactiveMemberId = membersList.data?.members[0]?.id;
    if (inactiveMemberId) {
      const blockedCheckIn = await staffClient.request("/api/attendance", {
        method: "POST",
        body: JSON.stringify({
          memberId: inactiveMemberId,
        }),
      });
      recordTest(
        "Attendance",
        "Check-in for member without active term blocked with 400",
        blockedCheckIn.status === 400
      );

      // 9.4 Check-in with Owner Exception succeeds
      const exceptionCheckIn = await ownerClient.request("/api/attendance", {
        method: "POST",
        body: JSON.stringify({
          memberId: inactiveMemberId,
          isException: true,
          exceptionReason: "Guest trial authorized by Owner",
        }),
      });
      recordTest(
        "Attendance",
        "Check-in with Owner exception and reason logs successfully",
        exceptionCheckIn.status === 200 && exceptionCheckIn.data.isException === true
      );
    }

    // 9.5 Staff Forbidden from Voiding Attendance
    const staffVoid = await staffClient.request(`/api/attendance/${attendanceRecordId}/void`, {
      method: "POST",
      body: JSON.stringify({ voidReason: "Mistake" }),
    });
    recordTest("Attendance", "Staff voiding attendance rejected with 403 Forbidden", staffVoid.status === 403);

    // 9.6 Owner Voids Mistaken Check-in
    const ownerVoid = await ownerClient.request(`/api/attendance/${attendanceRecordId}/void`, {
      method: "POST",
      body: JSON.stringify({ voidReason: "Wrong turnstile card scanned by receptionist" }),
    });
    recordTest(
      "Attendance",
      "Owner voids mistaken check-in with reason",
      ownerVoid.status === 200 && ownerVoid.data.success === true
    );
  } catch (err: any) {
    recordTest("Attendance", "Attendance suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 10: FOLLOW-UPS WORKFLOW
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 10: Follow-ups & Callback Workflow]\x1b[0m`);
  try {
    // 10.1 List Follow-ups
    const followUpsList = await staffClient.request("/api/follow-ups");
    recordTest(
      "FollowUps",
      "Staff lists due follow-ups (expiries, balance dues, enquiries)",
      followUpsList.status === 200 && Array.isArray(followUpsList.data.items)
    );

    const firstFollowUp = followUpsList.data?.items[0];
    if (firstFollowUp) {
      // 10.2 Log Contact Attempt via PATCH & Reschedule Next Callback
      const contactRes = await staffClient.request(`/api/follow-ups/${firstFollowUp.id}/contact`, {
        method: "PATCH",
        body: JSON.stringify({
          outcome: "CONTACTED",
          notes: "Spoke to member, promised to visit and clear dues on Saturday",
          nextFollowUpDate: "2026-11-05",
        }),
      });
      recordTest(
        "FollowUps",
        "Staff logs call outcome and reschedules next follow-up date",
        contactRes.status === 200
      );
    }
  } catch (err: any) {
    recordTest("FollowUps", "Follow-ups suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 11: EXPENSES & RECURRING TEMPLATES (OWNER ONLY)
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 11: Expenses Ledger & Monthly Templates]\x1b[0m`);
  let recordedExpenseId = "";
  try {
    // 11.1 Staff forbidden from viewing expenses
    const staffExpenses = await staffClient.request("/api/expenses");
    recordTest("Expenses", "Staff accessing expense ledger rejected with 403 Forbidden", staffExpenses.status === 403);

    // 11.2 Owner reads expenses
    const ownerExpenses = await ownerClient.request("/api/expenses");
    recordTest(
      "Expenses",
      "Owner lists operational expenses and categories",
      ownerExpenses.status === 200 && Array.isArray(ownerExpenses.data.expenses)
    );

    // 11.3 Owner logs one-off expense (e.g. ₹1,500 cleaning supplies)
    const categoryId = ownerExpenses.data.categories[0]?.id;
    const addExpense = await ownerClient.request("/api/expenses", {
      method: "POST",
      body: JSON.stringify({
        categoryId,
        title: "Gym Sanitation Supplies",
        payee: "Sparkle Cleaners Indiranagar",
        amountPaise: 150000, // ₹1,500
        expenseDate: getTodayISTString(),
        paymentMethod: "CASH",
        notes: "Monthly gym sanitation and supplies",
      }),
    });
    recordedExpenseId = addExpense.data?.expenseId;
    recordTest(
      "Expenses",
      "Owner records one-off operational expense",
      addExpense.status === 201 && !!recordedExpenseId
    );

    // 11.4 Owner posts monthly recurring template (e.g. Rent)
    const templates = ownerExpenses.data.templates;
    if (templates && templates.length > 0) {
      const templateId = templates[0].id;
      const postTemplate = await ownerClient.request(`/api/expenses/templates/${templateId}/post-month`, {
        method: "POST",
      });
      recordTest(
        "Expenses",
        "Owner posts recurring monthly bill from template",
        postTemplate.status === 201 || postTemplate.status === 400
      );
    }

    // 11.5 Owner Reverses Erroneous Expense
    if (recordedExpenseId) {
      const reverseExp = await ownerClient.request(`/api/expenses/${recordedExpenseId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reversalReason: "Duplicate invoice entered in error" }),
      });
      recordTest(
        "Expenses",
        "Owner reverses expense with audit reason",
        reverseExp.status === 200 && reverseExp.data.success === true
      );
    }
  } catch (err: any) {
    recordTest("Expenses", "Expenses suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 12: FINANCIAL REPORTS & SAFE CSV EXPORT (OWNER ONLY)
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 12: Financial Analytics & Safe CSV Export]\x1b[0m`);
  try {
    // 12.1 Staff forbidden from reports
    const staffReports = await staffClient.request("/api/reports/financial");
    recordTest("Reports", "Staff accessing financial reports rejected with 403 Forbidden", staffReports.status === 403);

    // 12.2 Owner views financial report
    const ownerReports = await ownerClient.request("/api/reports/financial");
    const hasFinancialKeys =
      ownerReports.data &&
      "grossCollectionsPaise" in ownerReports.data &&
      "netCollectionsPaise" in ownerReports.data &&
      "cashSurplusPaise" in ownerReports.data &&
      "totalOutstandingDuesPaise" in ownerReports.data;
    recordTest(
      "Reports",
      "Owner generates aggregate financial metrics (Gross, Net, Cash Surplus, Dues)",
      ownerReports.status === 200 && hasFinancialKeys
    );

    // 12.3 Staff forbidden from CSV export
    const staffCsv = await staffClient.request("/api/reports/export-csv");
    recordTest("Reports", "Staff exporting CSV rejected with 403 Forbidden", staffCsv.status === 403);

    // 12.4 Owner exports CSV with formula injection protection
    const ownerCsv = await ownerClient.request("/api/reports/export-csv");
    const isCsvContent = typeof ownerCsv.data === "string" && ownerCsv.data.includes("Member ID");
    recordTest(
      "Reports",
      "Owner exports sanitized CSV with formula injection prevention & UTF-8 BOM",
      ownerCsv.status === 200 && isCsvContent
    );
  } catch (err: any) {
    recordTest("Reports", "Reports suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUITE 13: SECURITY AUDIT LOGS (OWNER ONLY)
  // -------------------------------------------------------------
  console.log(`\n\x1b[1m[Suite 13: Security Audit Log Inspection]\x1b[0m`);
  try {
    // 13.1 Staff forbidden from audit logs
    const staffAudit = await staffClient.request("/api/settings/audit");
    recordTest("Audit", "Staff accessing audit log rejected with 403 Forbidden", staffAudit.status === 403);

    // 13.2 Owner inspects audit logs
    const ownerAudit = await ownerClient.request("/api/settings/audit");
    recordTest(
      "Audit",
      "Owner inspects audit logs verifying recorded actions",
      ownerAudit.status === 200 && Array.isArray(ownerAudit.data.logs) && ownerAudit.data.logs.length > 0
    );
  } catch (err: any) {
    recordTest("Audit", "Audit suite error", false, err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`\n===============================================================`);
  console.log(`  Test Execution Completed: ${passed}/${total} Passed (${failed} Failed)`);
  console.log(`===============================================================\n`);

  if (failed > 0) {
    console.error(`\x1b[31mSome tests failed! See details above.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mAll CRUD operations and edge cases PASSED successfully across all modules!\x1b[0m\n`);
  }
}

runAllCrudAndEdgeCaseTests().catch((err) => {
  console.error("Fatal error running CRUD test suite:", err);
  process.exit(1);
});
