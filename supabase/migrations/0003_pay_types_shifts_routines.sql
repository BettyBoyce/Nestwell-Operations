-- Nestwell Operations · Crew — pay types, hourly shifts and daily routines
-- Run in Supabase: SQL Editor → paste ALL of this → Run. Safe to run again.

-- ───────────── Settings ─────────────
alter table public.families add column if not exists timezone text not null default 'America/Los_Angeles';

-- How each crew member is paid:
--   per_job  = paid for approved jobs (default)
--   hourly   = clocks in/out for scheduled shifts, paid weekly at hourly_rate
--   payroll  = on payroll; checks off daily routine work (no clock)
alter table public.profiles add column if not exists pay_type text not null default 'per_job';
alter table public.profiles drop constraint if exists profiles_pay_type_check;
alter table public.profiles add constraint profiles_pay_type_check check (pay_type in ('per_job','hourly','payroll'));
alter table public.profiles add column if not exists hourly_rate numeric(10,2);
alter table public.profiles add column if not exists work_days int[] not null default '{}';  -- ISO days: 1=Mon … 7=Sun
alter table public.profiles add column if not exists shift_start time;
alter table public.profiles add column if not exists shift_end time;
alter table public.profiles add column if not exists position_title text;

-- ───────────── Hourly shifts ─────────────
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  kid_id uuid not null references public.profiles on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  rate numeric(10,2) not null,
  amount numeric(10,2),
  note text,
  edited_by uuid references public.profiles on delete set null,
  check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists one_open_shift_per_person on public.shifts (kid_id) where ended_at is null;
create index if not exists shifts_family_started_idx on public.shifts (family_id, started_at);

-- ───────────── Daily routines ─────────────
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  kid_id uuid not null references public.profiles on delete cascade,
  title text not null,
  days int[] not null default '{1,2,3,4,5}',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.routine_checks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  routine_id uuid not null references public.routines on delete cascade,
  kid_id uuid not null references public.profiles on delete cascade,
  check_date date not null,
  checked_at timestamptz not null default now(),
  checked_by uuid references public.profiles on delete set null,
  unique (routine_id, check_date)
);
create index if not exists routine_checks_kid_date_idx on public.routine_checks (kid_id, check_date);

-- ───────────── Helpers ─────────────
create or replace function public.family_today(fam uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from families where id = fam), 'America/Los_Angeles'))::date
$$;

-- ───────────── Shift clock ─────────────
create or replace function public.shift_clock_in() returns void
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.pay_type <> 'hourly' or me.hourly_rate is null then
    raise exception 'Your account is not set up for hourly shifts yet. Ask a parent.';
  end if;
  if exists (select 1 from shifts where kid_id = me.id and ended_at is null) then
    raise exception 'You are already clocked in.';
  end if;
  insert into shifts (family_id, kid_id, rate) values (me.family_id, me.id, me.hourly_rate);
  perform notify_parents(me.family_id, me.display_name || ' clocked in');
end $$;

create or replace function public.shift_clock_out() returns void
language plpgsql security definer set search_path = public as $$
declare me profiles; s shifts;
begin
  select * into me from profiles where id = auth.uid();
  update shifts set ended_at = now(),
         amount = round(extract(epoch from (now() - started_at)) / 3600 * rate, 2)
   where kid_id = me.id and ended_at is null
  returning * into s;
  if s.id is null then raise exception 'You are not clocked in.'; end if;
  perform notify_parents(me.family_id, me.display_name || ' clocked out: ' ||
    to_char(extract(epoch from (s.ended_at - s.started_at)) / 3600, 'FM990.00') || ' hrs ($' || s.amount || ')');
end $$;

-- Parent corrects a shift (forgot to clock out, wrong time, etc.)
create or replace function public.fix_shift(p_shift uuid, p_start timestamptz, p_end timestamptz, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_parent() then raise exception 'Parents only'; end if;
  if p_end is not null and p_end < p_start then raise exception 'Clock-out must be after clock-in'; end if;
  update shifts set started_at = p_start, ended_at = p_end, note = p_note, edited_by = auth.uid(),
         amount = case when p_end is null then null
                       else round(extract(epoch from (p_end - p_start)) / 3600 * rate, 2) end
   where id = p_shift and family_id = my_family_id();
  if not found then raise exception 'Shift not found'; end if;
end $$;

-- Parent adds a shift that was never clocked (forgot to clock in)
create or replace function public.add_shift(p_kid uuid, p_start timestamptz, p_end timestamptz, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare k profiles;
begin
  if not is_parent() then raise exception 'Parents only'; end if;
  select * into k from profiles where id = p_kid and family_id = my_family_id();
  if k.id is null then raise exception 'Crew member not found'; end if;
  if k.hourly_rate is null then raise exception 'Set an hourly rate for this person first'; end if;
  if p_end <= p_start then raise exception 'Clock-out must be after clock-in'; end if;
  insert into shifts (family_id, kid_id, started_at, ended_at, rate, amount, note, edited_by)
  values (k.family_id, k.id, p_start, p_end, k.hourly_rate,
          round(extract(epoch from (p_end - p_start)) / 3600 * k.hourly_rate, 2),
          coalesce(p_note, 'Added by parent'), auth.uid());
end $$;

-- ───────────── Routine check-off ─────────────
-- Crew members can check off today or earlier days this week; parents can mark any day.
create or replace function public.toggle_routine(p_routine uuid, p_date date) returns boolean
language plpgsql security definer set search_path = public as $$
declare r routines; me profiles; today date; d date; done_all boolean; checked boolean;
begin
  select * into me from profiles where id = auth.uid();
  select * into r from routines where id = p_routine and family_id = me.family_id and active;
  if r.id is null then raise exception 'Routine not found'; end if;
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

  -- Tell parents when a crew member finishes everything for today
  if checked and me.role <> 'parent' and d = today then
    select not exists (
      select 1 from routines x
       where x.kid_id = me.id and x.active and extract(isodow from d)::int = any (x.days)
         and not exists (select 1 from routine_checks c where c.routine_id = x.id and c.check_date = d)
    ) into done_all;
    if done_all then
      perform notify_parents(me.family_id, me.display_name || ' finished today''s routine ✓');
    end if;
  end if;
  return checked;
end $$;

-- ───────────── Row Level Security ─────────────
alter table public.shifts enable row level security;
alter table public.routines enable row level security;
alter table public.routine_checks enable row level security;

drop policy if exists "read shifts" on public.shifts;
create policy "read shifts" on public.shifts for select
  using (family_id = my_family_id() and (is_parent() or kid_id = auth.uid()));
drop policy if exists "parent delete shifts" on public.shifts;
create policy "parent delete shifts" on public.shifts for delete
  using (family_id = my_family_id() and is_parent());

drop policy if exists "read routines" on public.routines;
create policy "read routines" on public.routines for select
  using (family_id = my_family_id() and (is_parent() or kid_id = auth.uid()));
drop policy if exists "parent manage routines" on public.routines;
create policy "parent manage routines" on public.routines for all
  using (family_id = my_family_id() and is_parent())
  with check (family_id = my_family_id() and is_parent());

drop policy if exists "read routine checks" on public.routine_checks;
create policy "read routine checks" on public.routine_checks for select
  using (family_id = my_family_id() and (is_parent() or kid_id = auth.uid()));

-- ───────────── Nestwell crew setup ─────────────
-- Kyle: hourly, $27/hr, Tuesdays & Fridays 10:00–2:00, paid Fridays
update public.profiles
   set pay_type = 'hourly', hourly_rate = 27, work_days = '{2,5}', shift_start = '10:00', shift_end = '14:00'
 where lower(username) = 'kyleh';

-- Landon, Maxine, Renlee: payroll with Monday–Friday routine check-offs
update public.profiles set pay_type = 'payroll' where lower(username) in ('landonb','maxineb','renleeb');

insert into public.routines (family_id, kid_id, title, days, sort)
select p.family_id, p.id, v.title, '{1,2,3,4,5}', v.sort
  from public.profiles p
  join (values
    ('landonb', 'Garbage & recycling service', 1),
    ('landonb', 'Lawn care', 2),
    ('maxineb', 'Dishes: unload & reload the dishwasher', 1),
    ('renleeb', 'Dust the baseboards & wood screens', 1)
  ) as v(username, title, sort) on lower(p.username) = v.username
 where not exists (select 1 from public.routines r where r.kid_id = p.id and r.title = v.title);

-- Position titles (from docs/positions)
update public.profiles set position_title = 'Maintenance & Finance Lead' where lower(username) = 'brandonb' and position_title is null;
update public.profiles set position_title = 'Property Maintenance & Operations Assistant' where lower(username) = 'landonb' and position_title is null;
update public.profiles set position_title = 'Property Cleaning & Guest Experience Assistant' where lower(username) = 'maxineb' and position_title is null;
update public.profiles set position_title = 'Guest Experience Artist & Hospitality Apprentice' where lower(username) = 'renleeb' and position_title is null;

notify pgrst, 'reload schema';
