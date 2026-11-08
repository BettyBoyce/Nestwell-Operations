# Nestwell Operations

The operations hub for [Nestwell Stays LLC](https://www.staynestwell.com), a family-run business offering furnished mid-term rentals in Salem, Oregon, including insurance housing. Every Nestwell tool is a product in this one repo.

**Live app:** https://nestwell-operations.vercel.app

## Documentation
| Document | For |
|---|---|
| **[SOP: how to use the app & troubleshooting](docs/SOP.md)** | Everyone: crew, parents and the administrator |
| [Setup guide](docs/SETUP.md) | Setting up Supabase and Vercel from scratch |
| [Crew position descriptions](docs/positions/README.md) | Official roles for each crew member |
| [Brand kit](public/brand/README.md) | Logo files, colors and fonts |
| [Roadmap](docs/ROADMAP.md) | What's built and what's next |
| [Website summary](docs/WEBSITE.md) | What staynestwell.com says: guests served, amenities, fixes needed |

## Products

| Product | Status | What it does |
|---|---|---|
| **Crew** (`/crew`) | ✅ v0.3 | The family crew works in the business. Jobs and claimable extra jobs with required photo proof, an hourly shift clock with weekly pay, daily routine check-offs for payroll crew, parent review and approval, pay tracking, weekly activity pages and a CPA export. |
| Turnover Checklists | Planned | Move-in and move-out checklists for each property, with photo proof |
| Inventory & Restock | Planned | Linen and supply counts that build the shopping list |
| Guest Welcome Kits | Planned | Welcome kits for traveling nurses and insurance-housing families |

## How Crew works

Three ways to work, set for each person on **Team & Pay**:

| Pay type | Who | In the app |
|---|---|---|
| **Hourly** | Kyle | Clock in / clock out each shift; Saturday–Friday pay week at the hourly rate |
| **Payroll** | Landon, Maxine, Renlee | Tap to check off the daily (Mon–Fri) routine |
| **Per job** | Brandon, plus extra jobs for anyone | Claim a job → do it → add photos → send for review → parent approves |

```
Parent posts job ──► crew notified ──► claim ──► do the work ──► photos ──► send for review
        ▲                                                                       │
        └── payout recorded ◄── "Approved! +$" ◄──────────── parent reviews photos & approves
```

- **Balances:** owed = approved jobs + completed shifts − payouts recorded. Pay outside the app (Venmo, Check, Cash or Payroll), then log the payout.
- **Records:** `/crew/export?year=2026` downloads a CSV of every job, shift, routine check-off and payout, with each person's position.
- **Security:** crew can only act through checks that run in the database. They can't approve their own work or edit amounts, and each family sees only its own data.

## Tech

- **Next.js 15** (App Router, server actions) and **Tailwind 4**, styled with the Nestwell brand: forest green `#2F4E3D`, copper `#B87333`, gold `#D4A017`, DM Serif Display and DM Sans
- **Supabase** (connected through Vercel): Postgres, auth, row-level security and photo storage. The schema is in `supabase/migrations/`.
- **Vercel** hosting, with automatic deploys from `main`. The app installs on phones from the browser (Add to Home Screen).

## Getting started (developers)

Full step-by-step setup: **[docs/SETUP.md](docs/SETUP.md)**

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # http://localhost:3000
```
