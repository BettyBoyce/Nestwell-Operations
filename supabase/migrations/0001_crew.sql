-- Nestwell Operations · Crew (family jobs, time tracking, earnings)
-- Run in Supabase: SQL Editor → paste ALL of this → Run.
-- Safe to run again: it skips or replaces anything that already exists.

create extension if not exists pgcrypto;

-- ───────────── Tables ─────────────
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  role text not null check (role in ('parent','kid')),
  display_name text not null,
  username text unique,
  birth_year int,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  title text not null,
  description text,
  category text not null default 'General',
  pay_type text not null default 'flat' check (pay_type in ('flat','hourly')),
  pay_amount numeric(10,2) not null check (pay_amount >= 0),
  assigned_to uuid references public.profiles on delete set null,
  status text not null default 'open'
    check (status in ('open','claimed','submitted','approved')),
  due_date date,
  proof_path text,
  parent_note text,
  earned_amount numeric(10,2),
  submitted_at timestamptz,
  approved_at timestamptz,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists jobs_family_status_idx on public.jobs (family_id, status);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  job_id uuid not null references public.jobs on delete cascade,
  kid_id uuid not null references public.profiles on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists one_open_timer_per_kid on public.time_entries (kid_id) where ended_at is null;

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  kid_id uuid not null references public.profiles on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method text,
  note text,
  paid_at timestamptz not null default now(),
  created_by uuid references public.profiles on delete set null
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_read_idx on public.notifications (user_id, read_at);

-- ───────────── Helpers ─────────────
create or replace function public.my_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from profiles where id = auth.uid()
$$;

create or replace function public.is_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'parent')
$$;

create or replace function public.notify_parents(fam uuid, msg text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (family_id, user_id, message)
  select fam, id, msg from profiles where family_id = fam and role = 'parent'
$$;
revoke execute on function public.notify_parents(uuid, text) from public, anon, authenticated;

-- New job → notify the assigned kid, or every kid if it's an open extra job
create or replace function public.on_job_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null then
    insert into notifications (family_id, user_id, message)
    values (new.family_id, new.assigned_to, 'New job assigned to you: ' || new.title);
  else
    insert into notifications (family_id, user_id, message)
    select new.family_id, id, 'New extra job posted: ' || new.title || ' ($' || new.pay_amount
           || case when new.pay_type = 'hourly' then '/hr' else '' end || ')'
    from profiles where family_id = new.family_id and role = 'kid';
  end if;
  return new;
end $$;
drop trigger if exists job_created on public.jobs;
create trigger job_created after insert on public.jobs
  for each row execute function public.on_job_created();

-- ───────────── Kid actions (validated server-side) ─────────────
create or replace function public.claim_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs; me profiles;
begin
  select * into me from profiles where id = auth.uid();
  update jobs set assigned_to = me.id, status = 'claimed'
   where id = p_job and family_id = me.family_id and status = 'open' and assigned_to is null
  returning * into j;
  if j.id is null then raise exception 'Job is no longer available'; end if;
  perform notify_parents(j.family_id, me.display_name || ' claimed: ' || j.title);
end $$;

create or replace function public.clock_in(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs;
begin
  select * into j from jobs where id = p_job and assigned_to = auth.uid() and status = 'claimed';
  if j.id is null then raise exception 'You can only clock in on your own active jobs'; end if;
  update time_entries set ended_at = now() where kid_id = auth.uid() and ended_at is null;
  insert into time_entries (family_id, job_id, kid_id) values (j.family_id, j.id, auth.uid());
end $$;

create or replace function public.clock_out() returns void
language sql security definer set search_path = public as $$
  update time_entries set ended_at = now() where kid_id = auth.uid() and ended_at is null
$$;

create or replace function public.submit_job(p_job uuid, p_proof text) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs; me profiles;
begin
  select * into me from profiles where id = auth.uid();
  update time_entries set ended_at = now()
   where kid_id = me.id and job_id = p_job and ended_at is null;
  update jobs set status = 'submitted', submitted_at = now(),
         proof_path = coalesce(p_proof, proof_path)
   where id = p_job and assigned_to = me.id and status = 'claimed'
  returning * into j;
  if j.id is null then raise exception 'Job cannot be submitted'; end if;
  perform notify_parents(j.family_id, me.display_name || ' finished: ' || j.title || ' — ready for review');
end $$;

-- ───────────── Parent actions ─────────────
create or replace function public.approve_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs; hrs numeric;
begin
  if not is_parent() then raise exception 'Parents only'; end if;
  select * into j from jobs where id = p_job and family_id = my_family_id() and status = 'submitted';
  if j.id is null then raise exception 'Job is not awaiting review'; end if;
  select coalesce(sum(extract(epoch from (ended_at - started_at))) / 3600, 0) into hrs
    from time_entries where job_id = j.id and ended_at is not null;
  update jobs set status = 'approved', approved_at = now(),
         earned_amount = case when pay_type = 'hourly' then round(hrs * pay_amount, 2) else pay_amount end
   where id = j.id returning * into j;
  insert into notifications (family_id, user_id, message)
  values (j.family_id, j.assigned_to, 'Approved! You earned $' || j.earned_amount || ' for ' || j.title);
end $$;

create or replace function public.send_back_job(p_job uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs;
begin
  if not is_parent() then raise exception 'Parents only'; end if;
  update jobs set status = 'claimed', parent_note = p_note
   where id = p_job and family_id = my_family_id() and status = 'submitted'
  returning * into j;
  if j.id is null then raise exception 'Job is not awaiting review'; end if;
  insert into notifications (family_id, user_id, message)
  values (j.family_id, j.assigned_to, 'Needs a little more on ' || j.title || coalesce(': ' || p_note, ''));
end $$;

create or replace function public.record_payout() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (family_id, user_id, message)
  values (new.family_id, new.kid_id, 'Payday! $' || new.amount || ' paid' || coalesce(' via ' || new.method, ''));
  return new;
end $$;
drop trigger if exists payout_created on public.payouts;
create trigger payout_created after insert on public.payouts
  for each row execute function public.record_payout();

-- ───────────── Row Level Security ─────────────
alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.time_entries enable row level security;
alter table public.payouts enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "family read" on public.families;
create policy "family read" on public.families for select using (id = my_family_id());
drop policy if exists "parent update" on public.families;
create policy "parent update" on public.families for update using (id = my_family_id() and is_parent());

drop policy if exists "family read" on public.profiles;
create policy "family read" on public.profiles for select using (family_id = my_family_id());
drop policy if exists "parent update" on public.profiles;
create policy "parent update" on public.profiles for update using (family_id = my_family_id() and is_parent());

drop policy if exists "family read" on public.jobs;
create policy "family read" on public.jobs for select using (family_id = my_family_id());
drop policy if exists "parent insert" on public.jobs;
create policy "parent insert" on public.jobs for insert with check (family_id = my_family_id() and is_parent());
drop policy if exists "parent update" on public.jobs;
create policy "parent update" on public.jobs for update using (family_id = my_family_id() and is_parent());
drop policy if exists "parent delete" on public.jobs;
create policy "parent delete" on public.jobs for delete using (family_id = my_family_id() and is_parent());

drop policy if exists "read time" on public.time_entries;
create policy "read time" on public.time_entries for select
  using (family_id = my_family_id() and (is_parent() or kid_id = auth.uid()));
drop policy if exists "parent edit time" on public.time_entries;
create policy "parent edit time" on public.time_entries for all
  using (family_id = my_family_id() and is_parent()) with check (family_id = my_family_id() and is_parent());

drop policy if exists "read payouts" on public.payouts;
create policy "read payouts" on public.payouts for select
  using (family_id = my_family_id() and (is_parent() or kid_id = auth.uid()));
drop policy if exists "parent insert payouts" on public.payouts;
create policy "parent insert payouts" on public.payouts for insert
  with check (family_id = my_family_id() and is_parent());
drop policy if exists "parent delete payouts" on public.payouts;
create policy "parent delete payouts" on public.payouts for delete
  using (family_id = my_family_id() and is_parent());

drop policy if exists "own read" on public.notifications;
create policy "own read" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "own mark read" on public.notifications;
create policy "own mark read" on public.notifications for update using (user_id = auth.uid());

-- ───────────── Storage: proof photos ─────────────
insert into storage.buckets (id, name, public) values ('proof', 'proof', false)
  on conflict (id) do nothing;
drop policy if exists "family upload proof" on storage.objects;
create policy "family upload proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'proof' and (storage.foldername(name))[1] = my_family_id()::text);
drop policy if exists "family read proof" on storage.objects;
create policy "family read proof" on storage.objects for select to authenticated
  using (bucket_id = 'proof' and (storage.foldername(name))[1] = my_family_id()::text);

-- Refresh the API so the new functions are available immediately
notify pgrst, 'reload schema';
