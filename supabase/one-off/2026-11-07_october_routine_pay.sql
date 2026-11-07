-- One-off: record October 2026 routine pay (earned before the app existed) for payroll crew.
--
-- The payroll payments already recorded for Landon, Maxine and Renlee were for OCTOBER's routines
-- (routine pay is paid on the 1st of the following month). The app had no October earnings to match,
-- so those payments showed as "Paid ahead" against November.
--
-- This adds one approved "October 2026 routine pay" entry per person equal to what was recorded as paid,
-- and labels those payments as October pay. Result: October nets to $0 and November starts clean.
--
-- Supabase → SQL Editor → paste ALL of this → Run. Safe to run again (it won't double-enter).

do $$
declare
  k record;
begin
  for k in
    select p.id, p.family_id, p.display_name,
           coalesce(sum(po.amount), 0) as paid
      from public.profiles p
      join public.payouts po on po.kid_id = p.id and po.paid_at < '2026-11-08'
     where lower(p.username) in ('landonb', 'maxineb', 'renleeb')
     group by p.id, p.family_id, p.display_name
  loop
    if not exists (
      select 1 from public.jobs where assigned_to = k.id and title = 'October 2026 routine pay (before the app)'
    ) then
      insert into public.jobs (family_id, title, description, category, pay_type, pay_amount, assigned_to,
                               status, photo_required, earned_amount, submitted_at, approved_at)
      values (k.family_id, 'October 2026 routine pay (before the app)',
              'Monthly routine salary for October 2026, earned before Nestwell Crew was set up. Paid Nov 1.',
              'Payroll', 'flat', k.paid, k.id, 'approved', false, k.paid,
              '2026-10-31 18:00 America/Los_Angeles', '2026-10-31 18:00 America/Los_Angeles');
    end if;

    update public.payouts
       set note = coalesce(nullif(note, ''), 'October 2026 routine pay')
     where kid_id = k.id and paid_at < '2026-11-08' and (note is null or note = '');
  end loop;
end $$;

-- Show the result: October earned should equal paid for each person
select p.display_name as crew_member,
       (select coalesce(sum(j.earned_amount), 0) from public.jobs j
         where j.assigned_to = p.id and j.title = 'October 2026 routine pay (before the app)') as october_earned,
       (select coalesce(sum(po.amount), 0) from public.payouts po
         where po.kid_id = p.id and po.paid_at < '2026-11-08') as paid
  from public.profiles p
 where lower(p.username) in ('landonb', 'maxineb', 'renleeb')
 order by p.display_name;
