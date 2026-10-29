# IronPulse Gym Management System — Essential Run Commands

This file lists the exact commands you need to set up, run, seed, test, and manage the application.

---

## 1. Quick Start (Development)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` (make sure `.env` is never committed to Git):
```bash
cp .env.example .env
```
Ensure your `.env` contains:
* `DATABASE_URL` — Neon pooled TCP connection string
* `DATABASE_MIGRATION_URL` — Neon unpooled connection string
* `SESSION_SECRET` — 64-character random string (e.g. `openssl rand -hex 32`)

---

## 2. Database Commands

### Apply Database Migrations
Creates or updates all 23 tables in Neon PostgreSQL:
```bash
npm run db:migrate
```

### Generate a New Migration (Schema Changes)
If you edit `src/db/schema.ts`:
```bash
npm run db:generate
```

### Bootstrap Initial Gym Owner
Creates the first Owner account (`owner@ironpulse.in`) and sets up default gym settings and expense categories:
```bash
npm run db:bootstrap-owner
```

### Seed Development Data (Optional)
Populates the database with realistic demo members, plans, attendance, expenses, and follow-ups:
```bash
npm run db:seed
```

---

## 3. Running the Application

### Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Build & Run Production Server
```bash
npm run build
npm start
```

---

## 4. Default Login Credentials (After Bootstrap & Seed)

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **OWNER** | `owner@ironpulse.in` | `Owner@12345` | Full gym access, owner financials, expenses, staff management, settings, refunds |
| **STAFF (Reception)** | `priya@ironpulse.in` | `Staff@12345` | Front-desk reception, member check-ins, fee collection, renewals, follow-ups |
| **STAFF (Reception)** | `rahul@ironpulse.in` | `Staff@12345` | Front-desk reception, member check-ins, fee collection, renewals, follow-ups |

---

## 5. Automated Tests

Run the complete 34-test Vitest suite covering domain rules, financial invariants, calendar clamping, concurrency, and RBAC:
```bash
npm test
```

---

## 6. Emergency Owner Recovery CLI

If the owner forgets their password or loses account access:
```bash
# Reset password for owner
npm run db:owner-recovery -- --email "owner@ironpulse.in" --new-password "MyNewStrongPassword#2026"

# Or promote an existing user to Owner
npm run db:owner-recovery -- --email "staff@ironpulse.in" --make-owner
```
