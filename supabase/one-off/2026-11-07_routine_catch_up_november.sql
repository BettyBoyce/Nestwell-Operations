-- One-off: catch up payroll crew's routines for November 2026 so far.
-- Marks every routine task complete on each past weekday this month (Mon Nov 2 – Fri Nov 6)
-- and credits that day's pay at each person's daily rate:
--   Landon  5 days × $6.25 = $31.25
--   Maxine  5 days × $6.25 = $31.25
--   Renlee  5 days × $2.50 = $12.50
--
-- Check-offs keep today's timestamp, so records honestly show they were entered as a catch-up.
-- Run AFTER 0004_daily_rate_and_claim_rule.sql.
-- Supabase → SQL Editor → paste ALL of this → Run. Safe to run again (it won't double-enter).

do $$
declare
  fam uuid;
  today date;
  r record;
  d date;
begin
  if to_regclass('public.routine_days') is null then
    raise exception 'Run supabase/migrations/0004_daily_rate_and_claim_rule.sql first, then run this again.';
  end if;

  for fam in select distinct p.family_id from public.profiles p
              where lower(p.username) in ('landonb', 'maxineb', 'renleeb') loop
    today := public.family_today(fam);

    -- Routines were set up today; date them to the 1st so earlier November days count as due.
    update public.routines rt set created_at = least(rt.created_at, date_trunc('month', today::timestamp) at time zone 'America/Los_Angeles')
      from public.profiles p
     where rt.kid_id = p.id and p.family_id = fam and lower(p.username) in ('landonb', 'maxineb', 'renleeb');

    -- Every past weekday this month, every active routine task due that day
    for r in
      select rt.id as routine_id, rt.kid_id, rt.family_id, rt.days
        from public.routines rt join public.profiles p on p.id = rt.kid_id
       where p.family_id = fam and rt.active and lower(p.username) in ('landonb', 'maxineb', 'renleeb')
    loop
      for d in select g::date from generate_series(date_trunc('month', today::timestamp), today - 1, interval '1 day') g loop
        if extract(isodow from d)::int <= 5 and extract(isodow from d)::int = any (r.days) then
          insert into public.routine_checks (family_id, routine_id, kid_id, check_date)
          values (r.family_id, r.routine_id, r.kid_id, d)
          on conflict (routine_id, check_date) do nothing;
        end if;
      end loop;
    end loop;

    -- Credit each completed day at the daily rate
    for r in
      select distinct c.kid_id, c.check_date from public.routine_checks c join public.profiles p on p.id = c.kid_id
       where p.family_id = fam and lower(p.username) in ('landonb', 'maxineb', 'renleeb')
         and c.check_date >= date_trunc('month', today::timestamp)::date and c.check_date < today
    loop
      perform public.refresh_routine_day(r.kid_id, r.check_date);
    end loop;
  end loop;
end $$;

-- Show the result
select p.display_name as crew_member,
       p.daily_rate,
       count(rd.id) as days_credited,
       coalesce(sum(rd.amount), 0) as earned_this_month
  from public.profiles p
  left join public.routine_days rd on rd.kid_id = p.id and rd.day >= '2026-11-01' and rd.day < '2026-12-01'
 where lower(p.username) in ('landonb', 'maxineb', 'renleeb')
 group by p.display_name, p.daily_rate
 order by p.display_name;
