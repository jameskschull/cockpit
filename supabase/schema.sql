-- Cockpit schema for Supabase / Postgres.
-- Paste into the Supabase SQL Editor and run once.

-- ── tables ────────────────────────────────────────────────────────────────────

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  deadline date,
  scheduled_date date,
  completed_at timestamptz,
  priority_rank bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_rank_idx
  on public.tasks (user_id, priority_rank);
create index if not exists tasks_user_completed_idx
  on public.tasks (user_id, completed_at);
create index if not exists tasks_user_scheduled_idx
  on public.tasks (user_id, scheduled_date);
create index if not exists tasks_user_deadline_idx
  on public.tasks (user_id, deadline);
create unique index if not exists tasks_user_rank_incomplete_uniq
  on public.tasks (user_id, priority_rank) where completed_at is null;

create table if not exists public.priorities (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create table if not exists public.settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  primary key (user_id, key)
);

-- ── row-level security ───────────────────────────────────────────────────────

alter table public.tasks      enable row level security;
alter table public.priorities enable row level security;
alter table public.settings   enable row level security;

drop policy if exists tasks_owner      on public.tasks;
drop policy if exists priorities_owner on public.priorities;
drop policy if exists settings_owner   on public.settings;

create policy tasks_owner on public.tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy priorities_owner on public.priorities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy settings_owner on public.settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── helpers: auto-fill user_id on insert ─────────────────────────────────────

create or replace function public.set_user_id()
returns trigger language plpgsql security invoker as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_set_user_id      on public.tasks;
drop trigger if exists priorities_set_user_id on public.priorities;
drop trigger if exists settings_set_user_id   on public.settings;

create trigger tasks_set_user_id      before insert on public.tasks
  for each row execute function public.set_user_id();
create trigger priorities_set_user_id before insert on public.priorities
  for each row execute function public.set_user_id();
create trigger settings_set_user_id   before insert on public.settings
  for each row execute function public.set_user_id();

-- ── rank tuning constants ────────────────────────────────────────────────────

-- Mirror of the original Rust constants. Picking a fresh rank keeps gaps wide
-- enough to bisect repeatedly; rebalance only fires when neighbors are adjacent.
-- 1_000 step / 2 minimum-gap matches the desktop build.

-- ── create_task ──────────────────────────────────────────────────────────────

create or replace function public.create_task(
  p_title text,
  p_notes text default null,
  p_deadline date default null,
  p_scheduled_date date default null
) returns public.tasks
language plpgsql security invoker as $$
declare
  v_uid uuid := auth.uid();
  v_max bigint;
  v_row public.tasks;
  v_title text := btrim(p_title);
  v_notes text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_title is null or v_title = '' then
    raise exception 'title is required';
  end if;
  if p_notes is not null and btrim(p_notes) <> '' then
    v_notes := btrim(p_notes);
  end if;

  select coalesce(max(priority_rank), 0) into v_max
    from public.tasks
    where user_id = v_uid and completed_at is null;

  insert into public.tasks (
    user_id, title, notes, deadline, scheduled_date, priority_rank
  ) values (
    v_uid, v_title, v_notes, p_deadline, p_scheduled_date, v_max + 1000
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- ── complete_task ────────────────────────────────────────────────────────────

create or replace function public.complete_task(p_id uuid)
returns public.tasks
language plpgsql security invoker as $$
declare
  v_row public.tasks;
begin
  update public.tasks
    set completed_at = now(), updated_at = now()
    where id = p_id and user_id = auth.uid() and completed_at is null;

  select * into v_row from public.tasks
    where id = p_id and user_id = auth.uid();
  if not found then raise exception 'not found'; end if;
  return v_row;
end;
$$;

-- ── uncomplete_task ──────────────────────────────────────────────────────────

create or replace function public.uncomplete_task(p_id uuid)
returns public.tasks
language plpgsql security invoker as $$
declare
  v_uid uuid := auth.uid();
  v_row public.tasks;
  v_rank bigint;
  v_collision uuid;
  v_max bigint;
begin
  select * into v_row from public.tasks
    where id = p_id and user_id = v_uid;
  if not found then raise exception 'not found'; end if;

  v_rank := v_row.priority_rank;

  -- If the stored rank now collides with a live incomplete task, shift to the tail.
  select id into v_collision from public.tasks
    where user_id = v_uid
      and completed_at is null
      and priority_rank = v_rank
      and id <> p_id
    limit 1;

  if v_collision is not null then
    select coalesce(max(priority_rank), 0) into v_max
      from public.tasks
      where user_id = v_uid and completed_at is null;
    v_rank := v_max + 1000;
  end if;

  update public.tasks
    set completed_at = null,
        priority_rank = v_rank,
        updated_at = now()
    where id = p_id and user_id = v_uid
    returning * into v_row;
  return v_row;
end;
$$;

-- ── schedule_for_today ───────────────────────────────────────────────────────

create or replace function public.schedule_for_today(p_id uuid)
returns public.tasks
language plpgsql security invoker as $$
declare
  v_row public.tasks;
begin
  update public.tasks
    set scheduled_date = (now() at time zone 'utc')::date,
        updated_at = now()
    where id = p_id and user_id = auth.uid()
    returning * into v_row;
  if not found then raise exception 'not found'; end if;
  return v_row;
end;
$$;

-- ── reorder_task ─────────────────────────────────────────────────────────────
-- Picks a rank in the tight gap adjacent to `before_id` (preferred) or `after_id`,
-- bisecting when possible and full-rebalancing the user's incomplete list when not.

create or replace function public.reorder_task(
  p_id uuid,
  p_before_id uuid default null,
  p_after_id  uuid default null
) returns setof public.tasks
language plpgsql security invoker as $$
declare
  v_uid uuid := auth.uid();
  v_rank bigint;
  v_before_rank bigint;
  v_after_rank bigint;
  v_neighbor bigint;
  v_attempt int := 0;
  v_resolved boolean := false;
begin
  perform 1 from public.tasks
    where id = p_id and user_id = v_uid and completed_at is null;
  if not found then raise exception 'not found'; end if;

  -- Up to two passes: first try to bisect, otherwise rebalance and retry.
  while v_attempt < 2 and not v_resolved loop
    v_attempt := v_attempt + 1;
    v_before_rank := null;
    v_after_rank  := null;
    if p_before_id is not null then
      select priority_rank into v_before_rank from public.tasks
        where id = p_before_id and user_id = v_uid and completed_at is null;
    end if;
    if p_after_id is not null then
      select priority_rank into v_after_rank from public.tasks
        where id = p_after_id and user_id = v_uid and completed_at is null;
    end if;

    if v_before_rank is not null then
      select min(priority_rank) into v_neighbor from public.tasks
        where user_id = v_uid and completed_at is null
          and id <> p_id and priority_rank > v_before_rank;
      if v_neighbor is null then
        v_rank := v_before_rank + 1000;
        v_resolved := true;
      elsif v_neighbor - v_before_rank >= 2 then
        v_rank := v_before_rank + (v_neighbor - v_before_rank) / 2;
        v_resolved := true;
      end if;
    elsif v_after_rank is not null then
      select max(priority_rank) into v_neighbor from public.tasks
        where user_id = v_uid and completed_at is null
          and id <> p_id and priority_rank < v_after_rank;
      if v_neighbor is null then
        v_rank := v_after_rank - 1000;
        v_resolved := true;
      elsif v_after_rank - v_neighbor >= 2 then
        v_rank := v_neighbor + (v_after_rank - v_neighbor) / 2;
        v_resolved := true;
      end if;
    else
      select priority_rank into v_rank from public.tasks
        where id = p_id and user_id = v_uid;
      v_resolved := true;
    end if;

    if not v_resolved then
      perform public.rebalance_ranks(v_uid);
    end if;
  end loop;

  if not v_resolved then
    raise exception 'unable to allocate rank after rebalance';
  end if;

  update public.tasks
    set priority_rank = v_rank, updated_at = now()
    where id = p_id and user_id = v_uid;

  return query
    select * from public.tasks
      where user_id = v_uid and completed_at is null
      order by priority_rank asc;
end;
$$;

create or replace function public.rebalance_ranks(p_uid uuid)
returns void language plpgsql security invoker as $$
declare
  v_max bigint;
  v_count bigint;
  v_bump bigint;
begin
  select coalesce(max(priority_rank), 0), count(*)
    into v_max, v_count
    from public.tasks
    where user_id = p_uid and completed_at is null;

  v_bump := v_max + (v_count + 2) * 1000;

  -- Lift everyone out of the way so neither the bump nor the per-row rewrite
  -- collides with an already-rewritten rank.
  update public.tasks
    set priority_rank = priority_rank + v_bump
    where user_id = p_uid and completed_at is null;

  with ordered as (
    select id, row_number() over (order by priority_rank asc) as rn
    from public.tasks
    where user_id = p_uid and completed_at is null
  )
  update public.tasks t
    set priority_rank = ordered.rn * 1000,
        updated_at = now()
    from ordered
    where t.id = ordered.id;
end;
$$;

-- ── upsert_priority ──────────────────────────────────────────────────────────

create or replace function public.upsert_priority(p_week_start date, p_text text)
returns public.priorities
language plpgsql security invoker as $$
declare
  v_uid uuid := auth.uid();
  v_row public.priorities;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'week_start must fall on a Monday';
  end if;

  if btrim(coalesce(p_text, '')) = '' then
    delete from public.priorities
      where user_id = v_uid and week_start = p_week_start;
    return null;
  end if;

  insert into public.priorities (user_id, week_start, text)
    values (v_uid, p_week_start, p_text)
    on conflict (user_id, week_start)
    do update set text = excluded.text, updated_at = now()
    returning * into v_row;
  return v_row;
end;
$$;
