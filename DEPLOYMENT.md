# NexCell — Deployment Guide

Complete step-by-step guide to go from zero to a live production deployment.
Estimated time: **25–35 minutes** (first time), **5 minutes** (subsequent deploys).

---

## Prerequisites

Before starting, make sure you have accounts on:
- [GitHub](https://github.com) — free
- [Vercel](https://vercel.com) — free (Hobby plan)
- [Neon](https://neon.tech) — free (10 GB)
- [Upstash](https://upstash.com) — free (10,000 commands/day)
- [Resend](https://resend.com) — free (3,000 emails/month)
- [Cloudinary](https://cloudinary.com) — free (25 GB)

Also install locally:
- Node.js 20+ (`node --version` to check)
- Git (`git --version` to check)

---

## Step 1 — Set up GitHub repository

```bash
# 1. Go to github.com → New repository
#    Name: nex-cell
#    Visibility: Private (recommended)
#    Do NOT initialise with README

# 2. In your project folder:
git init
git add .
git commit -m "Initial commit — NexCell platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nex-cell.git
git push -u origin main
```

---

## Step 2 — Set up Neon (PostgreSQL database)

1. Go to [neon.tech](https://neon.tech) → Sign up → **Create a project**
2. Project name: `nexcell`
3. Region: **Asia Pacific (Singapore)** — closest to India
4. After creation, go to **Connection Details**
5. Select **"Pooled connection"** from the dropdown
6. Copy the connection string — it looks like:
   ```
   postgresql://ayush:xxxx@ep-xxx.ap-southeast-1.aws.neon.tech/nexcell?sslmode=require
   ```
7. Save this — it's your `DATABASE_URL`

---

## Step 3 — Set up Upstash (Redis for rate limiting)

1. Go to [console.upstash.com](https://console.upstash.com) → Sign up → **Create Database**
2. Name: `nexcell-ratelimit`
3. Region: **AP-South-1** (Mumbai) or **AP-Southeast-1** (Singapore)
4. Type: **Regional** (not Global — cheaper for your use case)
5. After creation, go to **REST API** tab
6. Copy:
   - `UPSTASH_REDIS_REST_URL` (starts with `https://`)
   - `UPSTASH_REDIS_REST_TOKEN` (long token string)

---

## Step 4 — Set up Resend (Email)

1. Go to [resend.com](https://resend.com) → Sign up
2. Go to **API Keys** → **Create API Key**
   - Name: `nexcell-production`
   - Permission: **Full Access**
3. Copy the key — starts with `re_`
4. Save as `RESEND_API_KEY`

> **Note on the sender address:**
> Without a verified domain, Resend only allows sending to your own Resend account email.
> For production, you need a domain. A domain costs ₹700–800/year from GoDaddy or Namecheap.
>
> **For now (testing):** Use `onboarding@resend.dev` as `RESEND_FROM_EMAIL`.
> Only your own email will receive OTP codes — perfect for initial testing.
>
> **To upgrade later:** Buy a domain → go to Resend → Domains → Add Domain →
> Add the DNS records → Update `RESEND_FROM_EMAIL` to `noreply@yourdomain.com` on Vercel.

---

## Step 5 — Set up Cloudinary (File uploads)

1. Go to [cloudinary.com](https://cloudinary.com) → Sign up (free)
2. From the Dashboard, copy:
   - **Cloud name** → `CLOUDINARY_CLOUD_NAME`
   - **API Key** → `CLOUDINARY_API_KEY`
   - **API Secret** → `CLOUDINARY_API_SECRET`
3. Go to **Settings → Upload → Upload presets**
4. Click **Add upload preset**:
   - Preset name: `nexcell_uploads`
   - Signing mode: **Signed**
   - Folder: `nexcell`
   - Save

---

## Step 6 — Generate JWT secrets

Run these commands in your terminal to generate cryptographically random secrets:

```bash
# Generate JWT_ACCESS_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate JWT_REFRESH_SECRET (different from access secret!)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate CSRF_SECRET (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save all three outputs — you'll need them in the next step.

---

## Step 7 — Set up local environment

```bash
# Copy the example env file
cp .env.example .env.local

# Open .env.local in your editor and fill in every value:
# DATABASE_URL          → from Step 2
# JWT_ACCESS_SECRET     → from Step 6
# JWT_REFRESH_SECRET    → from Step 6
# CSRF_SECRET           → from Step 6
# UPSTASH_REDIS_REST_URL    → from Step 3
# UPSTASH_REDIS_REST_TOKEN  → from Step 3
# RESEND_API_KEY        → from Step 4
# RESEND_FROM_EMAIL     → onboarding@resend.dev (for now)
# CLOUDINARY_CLOUD_NAME → from Step 5
# CLOUDINARY_API_KEY    → from Step 5
# CLOUDINARY_API_SECRET → from Step 5
# NEXT_PUBLIC_APP_URL   → http://localhost:3000 (for local)
```

---

## Step 8 — Run database migrations

```bash
# Install dependencies
npm install

# Generate SQL migrations from your schema
npm run db:generate

# Apply migrations to Neon
npm run db:migrate

# Seed the database (admin emails, default config)
npm run db:seed
```

Expected output from seed:
```
🌱 Starting seed...

📋 Seeding predefined roles...
   ✓ admin        → ayushsingh1772004@gmail.com
   ✓ treasurer    → ayushkrsingh170708@gmail.com

⚙️  Seeding app config...
   ✓ app_name     = NexCell
   ✓ app_tagline  = Where Founders Are Made
   ... (13 config values)

✅ Seed complete!
```

---

## Step 9 — Test locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Test checklist:**
- [ ] Login page loads with NexCell logo
- [ ] Enter `ayushsingh1772004@gmail.com` → request OTP
- [ ] Check email for OTP (goes to your Resend account email in test mode)
- [ ] Enter OTP → redirected to dashboard
- [ ] Dashboard shows wallet balance (₥0) and empty event list
- [ ] Go to /admin — admin dashboard is accessible
- [ ] Go to /wallet — wallet page loads

---

## Step 10 — Deploy to Vercel

### 10a — Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New Project**
3. Import your `nex-cell` repository
4. Framework: **Next.js** (auto-detected)
5. Root directory: **./** (default)
6. Build command: `npm run build` (default)
7. Output directory: `.next` (default)

### 10b — Add environment variables on Vercel

Before clicking Deploy, go to **Environment Variables** and add ALL of these:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon pooled connection string |
| `JWT_ACCESS_SECRET` | Your generated 64-byte hex string |
| `JWT_REFRESH_SECRET` | Your different 64-byte hex string |
| `CSRF_SECRET` | Your 32-byte hex string |
| `UPSTASH_REDIS_REST_URL` | Your Upstash URL |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash token |
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` |
| `RESEND_FROM_NAME` | `NexCell` |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret |
| `CLOUDINARY_UPLOAD_PRESET` | `nexcell_uploads` |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` (fill after deploy) |
| `NEXT_PUBLIC_APP_NAME` | `NexCell` |

> Set all variables for **Production**, **Preview**, and **Development** environments.

### 10c — Deploy

Click **Deploy**. First deploy takes 3–5 minutes.

### 10d — Update APP_URL

After deployment, copy your Vercel URL (e.g. `https://nex-cell-xyz.vercel.app`) and:
1. Go to Vercel → Project → Settings → Environment Variables
2. Update `NEXT_PUBLIC_APP_URL` to your Vercel URL
3. Redeploy: Vercel Dashboard → Deployments → ⋯ → Redeploy

---

## Step 11 — All future deployments

```bash
# Make changes
git add .
git commit -m "Your commit message"
git push origin main
```

That's it. GitHub Actions runs CI (type check + lint + build). If it passes, Vercel auto-deploys. If CI fails, Vercel does not deploy. Zero manual steps.

---

## Rollback strategy

If a bad deployment reaches production:

```bash
# Option A — Vercel dashboard (30 seconds)
# Go to Vercel → Deployments → click any previous deployment → "Promote to Production"

# Option B — Git revert
git revert HEAD
git push origin main
# CI runs, Vercel deploys the reverted version
```

---

## Ongoing admin tasks

### Add a new member/admin email
1. Log in as admin → go to `/admin/users`
2. Find the user after they've logged in once
3. Click "Assign role" → select Member or Admin

OR before they log in:
1. Go to Neon dashboard → SQL Editor
2. Run:
```sql
INSERT INTO predefined_roles (id, email, role, note)
VALUES (gen_random_uuid(), 'newperson@email.com', 'member', 'New committee member 2025');
```

### Change the max payment limit
1. Log in as admin → go to `/admin/config`
2. Find `max_credit_per_request_inr`
3. Update the value → Save

### View audit logs
1. Log in as admin → go to `/admin/audit-logs`
2. See every financial action, role change, and config update

### Credit Mirai Bucks to a user (reward, event win, etc.)
1. Log in as admin → go to `/admin/users`
2. Find the user → "Credit wallet"
3. Enter amount in ₥ and description

---

## Upgrading to a custom domain (recommended)

1. Buy a domain from GoDaddy or Namecheap (~₹800/year for `.in` or ~₹1200/year for `.com`)
   - Suggested: `nexcell.in` or `nexcellmirai.com`
2. Vercel → Project → Settings → Domains → Add your domain
3. Add the DNS records Vercel shows you (takes 5–30 minutes to propagate)
4. Also add this domain to Resend:
   - Resend → Domains → Add Domain → follow DNS instructions
   - Update `RESEND_FROM_EMAIL` on Vercel to `noreply@yourdomain.com`
5. Update `NEXT_PUBLIC_APP_URL` on Vercel to `https://yourdomain.com`

---

## Security checklist before going live

- [ ] All env variables set on Vercel (none missing)
- [ ] `.env.local` is in `.gitignore` (never committed)
- [ ] JWT secrets are unique, 64+ bytes, generated fresh (not copied from examples)
- [ ] CSRF_SECRET is unique and generated fresh
- [ ] Neon database has SSL enabled (it does by default — do not remove `?sslmode=require`)
- [ ] Cloudinary upload preset is set to "Signed" (not unsigned)
- [ ] Rate limiting is working (test: request OTP 6 times in a minute — should get 429 on 6th)
- [ ] Admin route is protected (test: visit `/admin` logged out — should redirect to `/login`)
- [ ] HTTPS is enabled (Vercel does this automatically)

---

## Cost summary (monthly, at launch scale)

| Service | Free tier | Your usage | Cost |
|---------|-----------|------------|------|
| Vercel | 100 GB bandwidth | Well within | ₹0 |
| Neon | 10 GB storage | ~50 MB | ₹0 |
| Upstash | 10,000 commands/day | ~500/day | ₹0 |
| Resend | 3,000 emails/month | ~100/month | ₹0 |
| Cloudinary | 25 GB storage | ~1 GB | ₹0 |
| **Total** | | | **₹0/month** |

You only pay when you grow beyond these limits — and by then you'll have budget to cover it.

---

## Support

- NexCell contact: nexcell.mirai@gmail.com
- Instagram: [@nexcell.mirai](https://instagram.com/nexcell.mirai)
- Raise an issue on GitHub for bugs
