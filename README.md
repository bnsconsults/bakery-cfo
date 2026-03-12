# 🧁 Bakery CFO Command Center — SaaS Edition

## What's Built
- ✅ Login / Signup with email (Supabase Auth)
- ✅ Each bakery owner sees ONLY their own data (Row Level Security)
- ✅ Dashboard with real KPIs pulled from database
- ✅ Daily Entry — log revenue, costs, labor, waste
- ✅ Inventory Manager — full CRUD with low-stock alerts
- 🔨 Coming next: Waste Tracker, Sales, Labor, Cash Flow, Customers

---

## DEPLOYMENT STEPS (Non-Technical Guide)

### STEP 1 — Set Up Supabase Database (15 min)

1. Go to supabase.com → Sign in
2. Click "New Project" → name it `bakery-cfo`
3. Wait ~2 minutes for it to create
4. Go to **SQL Editor** (left sidebar)
5. Copy EVERYTHING inside the big comment block in `src/lib/supabase.js`
6. Paste into the SQL Editor and click **Run**
7. Go to **Project Settings → API**
8. Copy your **Project URL** and **anon public key** — you'll need these next

---

### STEP 2 — Upload Code to GitHub (10 min)

1. Go to github.com → click **+** → **New repository**
2. Name: `bakery-cfo` → set to **Public** → click **Create repository**
3. On the next screen, click **"uploading an existing file"**
4. Drag ALL files from this folder into the upload box
5. Click **Commit changes**

---

### STEP 3 — Deploy on Vercel (5 min)

1. Go to vercel.com → click **Add New Project**
2. Click **Import** next to your `bakery-cfo` repo
3. Before clicking Deploy, scroll to **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `REACT_APP_SUPABASE_URL` | your Supabase Project URL |
   | `REACT_APP_SUPABASE_ANON_KEY` | your Supabase anon key |

4. Click **Deploy** → wait ~2 minutes
5. Your app is LIVE at: `bakery-cfo.vercel.app` 🎉

---

### STEP 4 — First Login

1. Open your live URL
2. Click **Sign Up**
3. Enter your bakery name, email, and password
4. Check your email → click the confirmation link
5. Log in → you're inside your personal Bakery CFO dashboard!

---

## Local Development (Optional)

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
# Edit .env.local with your Supabase keys

# Start development server
npm start
# Opens at http://localhost:3000
```

---

## Tech Stack
- **React** — frontend framework
- **Supabase** — database + authentication (free tier)
- **Vercel** — hosting (free tier)
- **Row Level Security** — each user sees ONLY their own bakery's data

---

## Pricing Your SaaS
Suggested pricing for Ugandan bakery owners:
- **Free tier**: 30-day trial, 3 modules
- **Pro**: UGX 50,000/month — all modules, unlimited entries
- **Multi-branch**: UGX 120,000/month — multiple locations

Collect payments via MTN Mobile Money or Airtel Money manually, then grant access via Supabase admin panel.
