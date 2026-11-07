-- Nestwell Operations · Crew — routine daily rate + "routine first" rule for extra jobs
-- Run AFTER 0003. Supabase → SQL Editor → paste ALL of this → Run. Safe to run again.

-- ───────────── Daily rate for payroll crew ─────────────
-- Completing ALL of a day's routine tasks earns this amount for that day.
alter table public.profiles add column if not exists daily_rate numeric(10,2);

-- One row per fully-completed routine day; the rate is locked in when the day is completed.
create table if not exists public.routine_days (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  kid_id uuid not null references public.profiles on delete cascade,
  day date not null,
  rate numeric(10,2) not null,
  amount numeric(10,2) not null,
  completed_at timestamptz not null default now(),
  unique (kid_id, day)
);
create index if not exists routine_days_family_day_idx on public.routine_days (family_id, day);

alter table public.routine_days enable row level security;
drop policy if exists "read routine days" on public.routine_days;
create policy "read routine days" on public.routine_days for select
  using (family_id = my_family_id() and (is_parent() or kid_id = auth.uid()));

-- Recalculate whether a crew member finished every routine task due on a day, and record/remove that day's pay.
create or replace function public.refresh_routine_day(p_kid uuid, p_day date) returns boolean
language plpgsql security definer set search_path = public as $$
declare k profiles; due int; done int;
begin
  select * into k from profiles where id = p_kid;
  select count(*) into due from routines r
   where r.kid_id = p_kid and r.active and extract(isodow from p_day)::int = any (r.days);
  select count(*) into done from routines r
   where r.kid_id = p_kid and r.active and extract(isodow from p_day)::int = any (r.days)
     and exists (select 1 from routine_checks c where c.routine_id = r.id and c.check_date = p_day);

  if due > 0 and done = due then
    if coalesce(k.daily_rate, 0) > 0 then
      insert into routine_days (family_id, kid_id, day, rate, amount)
      values (k.family_id, k.id, p_day, k.daily_rate, k.daily_rate)
      on conflict (kid_id, day) do nothing;
    end if;
    return true;
  else
    delete from routine_days where kid_id = p_kid and day = p_day;
    return false;
  end if;
end $$;
revoke execute on function public.refresh_routine_day(uuid, date) from public, anon, authenticated;

-- Routine check-off (replaces 0003's version): same rules, plus daily pay bookkeeping.
create or replace function public.toggle_routine(p_routine uuid, p_date date) returns boolean
language plpgsql security definer set search_path = public as $$
declare r routines; me profiles; k profiles; today date; d date; checked boolean; complete boolean;
begin
  select * into me from profiles where id = auth.uid();
  select * into r from routines where id = p_routine and family_id = me.family_id and active;
  if r.id is null then raise exception 'Routine not found'; end if;
  select * into k from profiles where id = r.kid_id;
  today := family_today(me.family_id);
  d := coalesce(p_date, today);

  if me.role <> 'parent' then
    if r.kid_id <> me.id then raise exception 'That is not your routine'; end if;
    if d > today then raise exception 'You can''t check off a future day'; end if;
    if d < today - 6 then raise exception 'That day is too far back — ask a parent'; end if;
  end if;

  if exists (select 1 from routine_checks where routine_id = r.id and check_date = d) then
    delete from routine_checks where routine_id = r.id and check_date = d;
    checked := false;
  else
    insert into routine_checks (family_id, routine_id, kid_id, check_date, checked_by)
    values (r.family_id, r.id, r.kid_id, d, me.id);
    checked := true;
  end if;

  complete := refresh_routine_day(r.kid_id, d);

  if checked and complete and me.role <> 'parent' then
    perform notify_parents(me.family_id, me.display_name || ' finished ' ||
      case when d = today then 'today''s' else to_char(d, 'Dy Mon DD') || '''s' end || ' routine ✓' ||
      case when coalesce(k.daily_rate, 0) > 0 then ' (+$' || k.daily_rate || ')' else '' end);
  end if;
  return checked;
end $$;

-- ───────────── Rule: finish today's routine before claiming extra jobs ─────────────
create or replace function public.claim_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs; me profiles; today date;
begin
  select * into me from profiles where id = auth.uid();
  today := family_today(me.family_id);

  if exists (
    select 1 from routines r
     where r.kid_id = me.id and r.active and extract(isodow from today)::int = any (r.days)
       and not exists (select 1 from routine_checks c where c.routine_id = r.id and c.check_date = today)
  ) then
    raise exception 'Finish today''s routine first, then you can claim extra jobs.';
  end if;

  update jobs set assigned_to = me.id, status = 'claimed'
   where id = p_job and family_id = me.family_id and status = 'open' and assigned_to is null
  returning * into j;
  if j.id is null then raise exception 'Job is no longer available'; end if;
  perform notify_parents(j.family_id, me.display_name || ' claimed: ' || j.title);
end $$;

-- ───────────── Nestwell rates ─────────────
-- Landon & Maxine: $125/month ÷ 20 weekdays = $6.25/day · Renlee: $50/month ÷ 20 = $2.50/day
update public.profiles set daily_rate = 6.25 where lower(username) in ('landonb', 'maxineb');
update public.profiles set daily_rate = 2.50 where lower(username) = 'renleeb';

-- Credit any days already fully completed before this update.
do $$
declare x record;
begin
  for x in select distinct c.kid_id, c.check_date from routine_checks c loop
    perform refresh_routine_day(x.kid_id, x.check_date);
  end loop;
end $$;

notify pgrst, 'reload schema';
