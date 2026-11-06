-- Nestwell Operations · Crew — required completion photos
-- Run in Supabase: SQL Editor → paste ALL of this → Run. Safe to run again.

-- Every job requires a photo unless the parent turns it off when posting.
alter table public.jobs add column if not exists photo_required boolean not null default true;
-- Several photos per job (before / after, multiple rooms).
alter table public.jobs add column if not exists proof_paths text[] not null default '{}';

-- Carry over any single photo already submitted.
update public.jobs set proof_paths = array[proof_path]
 where proof_path is not null and cardinality(proof_paths) = 0;

-- Replace submit_job with a version that takes several photos and enforces the requirement.
drop function if exists public.submit_job(uuid, text);

create or replace function public.submit_job(p_job uuid, p_proofs text[]) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs; me profiles; photos text[];
begin
  select * into me from profiles where id = auth.uid();
  select * into j from jobs where id = p_job and assigned_to = me.id and status = 'claimed';
  if j.id is null then raise exception 'Job cannot be submitted'; end if;

  -- Only accept photos stored under this family's folder for this job.
  select coalesce(array_agg(p), '{}') into photos
    from unnest(coalesce(p_proofs, '{}')) p
   where p like me.family_id::text || '/' || j.id::text || '/%';

  if j.photo_required and cardinality(photos) = 0 then
    raise exception 'Add at least one photo of the finished work before sending it for review.';
  end if;

  update time_entries set ended_at = now()
   where kid_id = me.id and job_id = p_job and ended_at is null;

  update jobs set status = 'submitted', submitted_at = now(),
         proof_paths = case when cardinality(photos) > 0 then photos else proof_paths end,
         proof_path  = case when cardinality(photos) > 0 then photos[1] else proof_path end
   where id = j.id;

  perform notify_parents(j.family_id,
    me.display_name || ' finished: ' || j.title ||
    case when cardinality(photos) > 0 then ' (' || cardinality(photos) || ' photo' ||
         case when cardinality(photos) > 1 then 's' else '' end || ')' else '' end ||
    ' — ready for review');
end $$;

-- Refresh the API so the new function is available immediately
notify pgrst, 'reload schema';
