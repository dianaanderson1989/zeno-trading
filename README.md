# Zeno — Crypto Trading Platform

Paper trading platform built with React + TypeScript + Supabase + Tailwind.

## Setup

### 1. Apply Supabase Schema
- Open your Supabase project → SQL Editor
- Paste the entire contents of `supabase_schema.sql` and run it

### 2. Install dependencies
```bash
npm install
```

### 3. Environment variables
Copy `.env.example` to `.env` and fill in your Supabase credentials (already done if you cloned from setup).

### 4. Run development server
```bash
npm run dev
```

## GitHub Push (first time)
```bash
git init
git add .
git commit -m "Initial scaffold — Phase 1"
git remote add origin https://github.com/YOUR_USERNAME/zeno-trading.git
git branch -M main
git push -u origin main
```

## Build Phases
- [x] Phase 1: Project scaffold + Supabase schema
- [ ] Phase 2: Dashboard
- [ ] Phase 3: Trading page
- [ ] Phase 4: Staking + Swap
- [ ] Phase 5: Admin panel

## Admin Access
Register with email `admin@zeno.com` — it auto-assigns `super_admin` role.
