-- One-off: record Kyle's shifts for the pay week Sat Oct 31 – Fri Nov 6, 2026
-- (before the shift clock was available) and the check paid on Fri Nov 6.
--
--   Tue Nov 3  10:00 AM – 2:00 PM  4.00 hrs × $27 = $108.00
--   Fri Nov 6  10:00 AM – 2:00 PM  4.00 hrs × $27 = $108.00
--   Garage clean-up job (already approved)          $5.00
--   ─────────────────────────────────────────────────────
--   Paid by check, Fri Nov 6                        $221.00   → balance $0.00
--
-- Run AFTER 0003_pay_types_shifts_routines.sql.
-- Supabase → SQL Editor → paste ALL of this → Run. Safe to run again (it won't double-enter).

do $$
declare
  k public.profiles;
begin
  if to_regclass('public.shifts') is null then
    raise exception 'Run supabase/migrations/0003_pay_types_shifts_routines.sql first, then run this again.';
  end if;

  select * into k from public.profiles where lower(username) = 'kyleh';
  if k.id is null then
    raise exception 'No crew member with username kyleh was found.';
  end if;

  -- Tuesday, Nov 3 · 10 AM – 2 PM Pacific
  insert into public.shifts (family_id, kid_id, started_at, ended_at, rate, amount, note)
  select k.family_id, k.id, '2026-11-03 10:00 America/Los_Angeles', '2026-11-03 14:00 America/Los_Angeles', 27, 108.00,
         'Entered by parent (before shift clock)'
  where not exists (
    select 1 from public.shifts where kid_id = k.id and started_at = '2026-11-03 10:00 America/Los_Angeles'
  );

  -- Friday, Nov 6 · 10 AM – 2 PM Pacific
  insert into public.shifts (family_id, kid_id, started_at, ended_at, rate, amount, note)
  select k.family_id, k.id, '2026-11-06 10:00 America/Los_Angeles', '2026-11-06 14:00 America/Los_Angeles', 27, 108.00,
         'Entered by parent (before shift clock)'
  where not exists (
    select 1 from public.shifts where kid_id = k.id and started_at = '2026-11-06 10:00 America/Los_Angeles'
  );

  -- Check paid Friday, Nov 6: two shifts ($216) + garage job ($5)
  insert into public.payouts (family_id, kid_id, amount, method, note, paid_at)
  select k.family_id, k.id, 221.00, 'Check', 'Week of Oct 31 – Nov 6: 2 shifts ($216) + garage job ($5)',
         '2026-11-06 14:30 America/Los_Angeles'
  where not exists (
    select 1 from public.payouts where kid_id = k.id and amount = 221.00 and note like 'Week of Oct 31 – Nov 6%'
  );
end $$;

-- Show the result
select 'Shifts this pay week' as item, count(*)::text as value, sum(s.amount)::text as amount
  from public.shifts s join public.profiles p on p.id = s.kid_id
 where lower(p.username) = 'kyleh' and s.started_at >= '2026-10-31 00:00 America/Los_Angeles' and s.started_at < '2026-11-07 00:00 America/Los_Angeles'
union all
select 'Payouts recorded', count(*)::text, sum(po.amount)::text
  from public.payouts po join public.profiles p on p.id = po.kid_id
 where lower(p.username) = 'kyleh';
