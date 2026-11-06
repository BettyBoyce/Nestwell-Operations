# Roadmap

## Crew

### ✅ Built
**v0.1: Foundation**
- Parent and crew logins (crew use a username, no email needed)
- Job board: assigned jobs plus claimable extra jobs, flat or hourly pay, categories and due dates
- Review: approve, or send back with a note
- In-app notifications, balances, payout log and a yearly CSV export for the CPA
- Nestwell branding, home screen icon, mobile layout

**v0.2: Proof of work**
- Required completion photos (up to 6 per job), shrunk on the phone before upload
- Photo gallery for parent review

**v0.3: Pay types & weekly view**
- Pay types for each person: per job, hourly, payroll
- Hourly shift clock with schedule, Saturday–Friday pay week and one-tap "Mark paid"
- Parent timesheet to fix or delete shifts
- Daily routine check-offs for payroll crew, with a week strip, catch-up and a "finished" alert
- Weekly activity page for each crew member (6 weeks of history)
- Position titles; CPA export includes shifts, routines and positions
- Payment methods: Venmo, Check, Cash, Payroll
- [SOP](SOP.md) for crew, parents and the administrator

### Next
- [ ] **Password reset** on Team & Pay (today this needs SQL; see SOP 9.4)
- [ ] **Phone notifications** (web push), e.g. a "clock in" reminder at 10 AM on Kyle's shift days and an end-of-day routine reminder
- [ ] **Manager role**, so another adult can approve work and record pay
- [ ] **Self-logged work**: "Log work I did" for unplanned repairs, bill pay and contractor visits
- [ ] **Job templates** for each position (e.g. "Trash to curb," "Welcome card for incoming guest")
- [ ] **Properties list**, so jobs and routines can be tagged by unit
- [ ] Parent can mark a routine done for a past week

### Later
- [ ] Savings goals, badges and streaks
- [ ] Money Lab: spend / save / invest split, Roth IRA calculator
- [ ] Year-end summary for each crew member

## Other Nestwell products
- [ ] **Turnover Checklists**: checklist templates for each property, linked to Crew jobs
- [ ] **Inventory & Restock**: per-unit par levels and a shopping list
- [ ] **Guest Welcome Kits**: kit builder and tracking for each stay

## Open items
- [ ] Run migrations `0002` and `0003` in Supabase (see SOP 9.5)
- [ ] Set `ALLOW_SIGNUP=false` in Vercel once all accounts exist
- [ ] Finish Landon's position description (Performance Expectations onward)
- [ ] Decide whether the GitHub repo should be private
