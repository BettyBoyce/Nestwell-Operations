# Nestwell Operations

The operations hub for [Nestwell](https://www.staynestwell.com), a family-run business offering furnished mid-term rentals in Salem, including insurance housing. Every Nestwell tool is a product in this one repo.

## Products

| Product | Status | What it does |
|---|---|---|
| **Crew** (`/crew`) | ✅ v0.1 | The kids work in the business: they get jobs, claim paid extra jobs, clock in and out, send proof photos and track their earnings. Parents approve work, record payouts and export records for the CPA. |
| Turnover Checklists | Planned | Move-in and move-out checklists for each property, with photo proof |
| Inventory & Restock | Planned | Linen and supply counts that build the shopping list |
| Guest Welcome Kits | Planned | Welcome kits for traveling nurses and insurance-housing families |

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.

## How Crew works

```
Parent posts job ──► kid notified ──► kid claims / clocks in ──► kid marks done + photo
        ▲                                                              │
        └──── payout recorded ◄── kid notified "Approved! +$" ◄── parent approves
```

- **Assigned jobs** go to one kid. **Extra jobs** are open to every kid, and the first to claim one gets it.
- **Pay** is either a flat amount or hourly. Hourly pay is calculated from the time clock when the job is approved.
- **Balances:** owed = approved earnings − payouts recorded. You pay outside the app (Venmo, check, cash or payroll) and then log the payout.
- **Records:** `/crew/export?year=2026` downloads a CSV of each approved job (date, hours, rate, amount) and each payout. This is the paperwork for wages paid to your kids.
- **Security:** kids can only act through checks that run in the database. They can't approve their own work or edit amounts, and each family sees only its own data.

## Tech

- **Next.js 15** (App Router, server actions) and **Tailwind 4**, styled with Nestwell's brand: forest green `#2F4E3D`, gold `#D4A017`, bronze `#8F6D43`, DM Serif Display and DM Sans
- **Supabase**: Postgres, auth, row-level security and photo storage. The schema is in `supabase/migrations/`.
- **Vercel** hosting. The app can be installed on phones from the browser (add it to the home screen).

## Getting started

Full step-by-step setup: **[docs/SETUP.md](docs/SETUP.md)**

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # http://localhost:3000
```
