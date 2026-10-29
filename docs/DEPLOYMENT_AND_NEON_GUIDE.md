# Deployment and Neon PostgreSQL Infrastructure Guide

This guide details the production deployment architecture, Neon PostgreSQL connection setup, environment variables, hosting tier evaluations, and private object storage for IronPulse Gym.

---

## 1. Architecture Overview

* **Frontend & Backend:** Next.js 15 App Router (TypeScript, Node.js Server Runtime, Tailwind CSS v3).
* **Database:** Neon Serverless PostgreSQL with pgvector/pgcrypto extensions.
* **ORM & Migrations:** Drizzle ORM v0.40+ with versioned SQL migrations (`drizzle/`).
* **Hosting Platform:** Vercel (App Router deployed to Edge/Node serverless functions).
* **Session Storage:** Database-backed sessions in Neon via secure HttpOnly, SameSite, Secure cookies.
* **Storage:** Private object storage for optional member photos and expense receipt documents.

---

## 2. Neon PostgreSQL Configuration

### 2.1 Connection Arrangement: Pooled TCP vs Unpooled vs HTTP
Neon provides three distinct connection endpoints. Choosing the correct one is vital for multi-statement ACID transactions:

1. **Pooled TCP Connection (`-pooler` endpoint on port 5432):**
   * Format: `postgresql://user:password@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   * **Selected Implementation in IronPulse:** Connected via `pg.Pool` (`NodePgDatabase`).
   * **Why:** PgBouncer in transaction mode supports standard multi-statement ACID transactions (`BEGIN ... COMMIT / ROLLBACK`) executed on the same checked-out client. This enables IronPulse to run atomic enrollment, payment allocation, and sequence number generation inside `db.transaction(async (tx) => { ... })`.
2. **Unpooled Direct TCP Connection (port 5432 without `-pooler`):**
   * Format: `postgresql://user:password@ep-xyz.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   * Used primarily for schema migrations (`npm run db:migrate`), DDL changes, and direct administrative tools where connection pooling is undesirable.
3. **HTTP Serverless Driver (`@neondatabase/serverless` HTTP mode):**
   * Best for single read-only queries from lightweight edge runtimes, but does not support interactive multi-statement client transactions without the WebSocket proxy.

### 2.2 Region Alignment
To minimize network round-trip time between Vercel Serverless Functions and Neon PostgreSQL:
* **Neon Region:** Choose `ap-south-1` (AWS Mumbai) or `ap-southeast-1` (AWS Singapore).
* **Vercel Function Region:** Configure `regions: ["bom1"]` (Mumbai) or `regions: ["sin1"]` (Singapore) in `vercel.json` or project settings.
* Keeping latency under 15ms is essential for fast front-desk reception check-ins.

---

## 3. Commercial Hosting Tier Evaluation (No Free-Tier Illusions)

### 3.1 Neon PostgreSQL Evaluation

| Tier | Cost | Suitability for Commercial Gym | Notes & Limits |
| :--- | :---: | :---: | :--- |
| **Neon Free** | $0/mo | **Development & Staging Only** | 0.5 GB storage cap. Compute suspends after 5 minutes of inactivity; first request encounters a **cold start delay of 1.5–3 seconds**, which degrades reception check-in. Point-in-time restore is limited to 24 hours. |
| **Neon Launch** | $19/mo | **Recommended for Single Gym Production** | Includes 10 GB storage, always-on compute (zero cold starts during gym operating hours 05:00–23:00 IST), 7-day point-in-time recovery (PITR), up to 10,000 connection pooler limit, and automated backups. |
| **Neon Scale** | $69/mo | Multi-branch or high-volume gyms | 50 GB storage, 14-day PITR, dedicated support SLA. |

> **Operational Recommendation:** Deploy production on the **Neon Launch ($19/mo)** plan to ensure instantaneous member lookups at front-desk reception without compute suspension delays.

### 3.2 Vercel Hosting Evaluation

| Tier | Cost | Suitability | Notes |
| :--- | :---: | :---: | :--- |
| **Vercel Hobby** | $0/mo | **Personal/Evaluation Only** | **Violation of Terms of Service:** Section 2 of Vercel Terms prohibits using Hobby accounts for commercial business operations. Functions also have cold-start throttling and lower execution caps. |
| **Vercel Pro** | $20/seat/month | **Production Commercial Requirement** | Commercial license, 99.99% uptime SLA, 300-second serverless execution limits, custom domain SSL, integrated team access, and private environment variable isolation. |

---

## 4. Private Object Storage Setup

IronPulse requires private object storage for optional member photos and expense receipt scans. Files are never stored on temporary serverless container disks or as base64 database text.

### Implementation Options:
1. **Private Vercel Blob Storage:**
   * Configure `BLOB_READ_WRITE_TOKEN` in Vercel project environment variables.
   * Uploads are performed server-side with strict magic bytes verification (JPEG, PNG, WebP, PDF) and max size limit (5 MB).
   * Files are stored privately; signed download tokens are generated for authorized sessions.
2. **Private S3-Compatible Storage (AWS S3, Cloudflare R2, or MinIO):**
   * Configure `STORAGE_PROVIDER=s3`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, and `STORAGE_SECRET_ACCESS_KEY`.
   * Signed URLs (`getSignedUrlPromise`) with a 15-minute expiration are returned to authorized clients.

---

## 5. Production Environment Variables Reference

Create a `.env` or configure variables in the Vercel Project Dashboard under **Settings > Environment Variables**:

```bash
# -------------------------------------------------------------
# Database Configuration (Neon PostgreSQL)
# -------------------------------------------------------------
# Pooled TCP connection string for application runtime (pg.Pool)
DATABASE_URL=postgresql://ironpulse_owner:SECRET_PASSWORD@ep-wispy-lake-b4t8rpqw-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Direct unpooled connection string for running migrations
DATABASE_MIGRATION_URL=postgresql://ironpulse_owner:SECRET_PASSWORD@ep-wispy-lake-b4t8rpqw.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# -------------------------------------------------------------
# Application Environment & Timezone
# -------------------------------------------------------------
NODE_ENV=production
NEXT_PUBLIC_APP_TIMEZONE=Asia/Kolkata
APP_BASE_URL=https://gym.ironpulse.in

# -------------------------------------------------------------
# Session Security
# -------------------------------------------------------------
# Random 64-character hex secret for cookie signature
SESSION_SECRET=e7b415a782b3a123f8c8d34e9a0123456789abcdef0123456789abcdef012345

# -------------------------------------------------------------
# Private Object Storage (Optional for photos/attachments)
# -------------------------------------------------------------
STORAGE_PROVIDER=local
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token_xyz

# -------------------------------------------------------------
# Initial Owner Bootstrap Setup (Used only on first initialization)
# -------------------------------------------------------------
BOOTSTRAP_OWNER_EMAIL=owner@ironpulse.in
BOOTSTRAP_OWNER_NAME=IronPulse Gym Owner
BOOTSTRAP_OWNER_PHONE=+919876543210
BOOTSTRAP_OWNER_PASSWORD=ReplaceWithStrongPassword#2026
```

---

## 6. Step-by-Step Vercel Deployment

1. **Push Code to Private Git Repository:**
   ```bash
   git add .
   git commit -m "feat: complete IronPulse gym production application"
   git push origin main
   ```
2. **Import Project into Vercel:**
   * Select Next.js framework preset.
   * Configure root directory as `./`.
   * Set Build Command: `npm run build`.
   * Set Output Directory: `.next`.
3. **Configure Environment Variables:**
   * Add `DATABASE_URL` (Neon Pooled connection).
   * Add `SESSION_SECRET` (generate with `openssl rand -hex 32`).
   * Add `APP_BASE_URL` (e.g. `https://gym.ironpulse.in`).
4. **Deploy Migrations to Neon:**
   * In local terminal or CI/CD runner:
   ```bash
   npm run db:migrate
   ```
5. **Run Owner Bootstrap Script:**
   * Run the secure bootstrap script to create the first owner account:
   ```bash
   npm run db:bootstrap-owner
   ```
6. **Assign Custom Domain and Test SSL:**
   * Point your domain CNAME / A-records to Vercel DNS (`cname.vercel-dns.com`).
   * Verify HTTPS certificate generation.
   * Sign in at `https://gym.ironpulse.in/login` with your bootstrapped owner credentials.

