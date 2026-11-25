-- bemyguest: database schema + row-level security.
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run: it drops and recreates its own policies and functions.

-- ─────────────────────────── tables ───────────────────────────

create table if not exists public.guests (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_url   text,
  blocked      boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.rsvps (
  guest_id      uuid primary key references public.guests (id) on delete cascade,
  attending     text check (attending in ('yes', 'no')),
  days          text check (days in ('both', 'day1', 'day2')),
  plus_one      boolean, -- false: just me; true: asked to bring someone (see plus_ones)
  meal          text check (meal in ('veg', 'nonveg', 'vegan', 'jain')),
  dietary_notes text not null default '' check (char_length(dietary_notes) <= 200),
  arrival_date  date,
  arrival_time  text not null default '' check (char_length(arrival_time) <= 40),
  travel_mode   text check (travel_mode in ('flight', 'train', 'road')),
  completed     boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- The fuller RSVP (October 2026): kids, a roommate preference, drinks, travel
-- both ways, WhatsApp and anything the couple should know. arrival_time is no
-- longer used (arrival_slot replaced it); meal is now veg or non-veg only (the
-- app checks that).
alter table public.rsvps
  add column if not exists kids           jsonb  not null default '[]'
    check (jsonb_typeof(kids) = 'array' and jsonb_array_length(kids) <= 6),
  add column if not exists roomie         text   check (roomie in ('plus_one', 'guest', 'pair_me')),
  add column if not exists roomie_guest_id uuid  references public.guests (id) on delete set null,
  add column if not exists roomie_name    text   not null default '' check (char_length(roomie_name) <= 80),
  add column if not exists drinks         text   check (drinks in ('yes', 'no')),
  add column if not exists drink_styles   text[] not null default '{}'
    check (drink_styles <@ array['cocktails', 'straight', 'beer', 'wine']),
  add column if not exists spirits        text[] not null default '{}'
    check (spirits <@ array['whisky', 'rum', 'vodka', 'gin', 'tequila']),
  add column if not exists cocktail_favs  text   not null default '' check (char_length(cocktail_favs) <= 80),
  add column if not exists arrival_slot   text   check (arrival_slot in ('morning', 'afternoon', 'evening', 'late')),
  add column if not exists arrival_point  text   check (arrival_point in ('GOI', 'GOX', 'VSG', 'MAO')),
  add column if not exists departure_date date,
  add column if not exists departure_slot text   check (departure_slot in ('morning', 'afternoon', 'evening', 'late')),
  add column if not exists ride_help      text   check (ride_help in ('sorted', 'help', 'share')),
  add column if not exists whatsapp       text   not null default '' check (whatsapp = '' or whatsapp ~ '^\+[0-9]{7,15}$'),
  add column if not exists needs          text[] not null default '{}'
    check (needs <@ array['stairs', 'ground_floor', 'medical']),
  add column if not exists notes          text   not null default '' check (char_length(notes) <= 300);

-- Plus-ones used to be a name and a meal on the RSVP; they're requests now (plus_ones below).
alter table public.rsvps drop column if exists plus_one_name;
alter table public.rsvps drop column if exists plus_one_meal;

-- A guest asking to bring someone. The couple approve or decline from the
-- dashboard; the +1 then signs in with this email and RSVPs for themselves.
-- Server-only: guests never read this table, so a "declined" stays private.
create table if not exists public.plus_ones (
  guest_id     uuid primary key references public.guests (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  email        text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz
);

create index if not exists plus_ones_email_idx on public.plus_ones (email);

create table if not exists public.notes (
  id          bigint generated always as identity primary key,
  guest_id    uuid not null references public.guests (id) on delete cascade,
  author_name text not null default '',
  body        text not null check (char_length(body) between 1 and 140),
  color       text not null default 'sun' check (color in ('sun', 'coral', 'sea', 'sky')),
  sticker     text not null default 'none' check (sticker in ('none', 'heart', 'shell', 'sun')),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notes_created_at_idx on public.notes (created_at desc);
create index if not exists notes_guest_idx on public.notes (guest_id);

-- ─────────────────────────── helpers ───────────────────────────

-- Create a guest row the first time someone signs in with Google.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guests (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed in before this script ran.
insert into public.guests (id, email, display_name, avatar_url)
select u.id,
       coalesce(u.email, ''),
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
       coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;

create or replace function public.is_blocked(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select g.blocked from public.guests g where g.id = uid), true);
$$;

-- Stamp notes with the author's current display name (so names can't be spoofed).
create or replace function public.stamp_note_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(nullif(split_part(g.display_name, ' ', 1), ''), 'A guest')
    into new.author_name
  from public.guests g
  where g.id = new.guest_id;
  return new;
end;
$$;

drop trigger if exists notes_stamp_author on public.notes;
create trigger notes_stamp_author
  before insert on public.notes
  for each row execute function public.stamp_note_author();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rsvps_touch on public.rsvps;
create trigger rsvps_touch
  before update on public.rsvps
  for each row execute function public.touch_updated_at();

-- "Who's coming": first names + photos of confirmed guests, nothing else.
create or replace function public.confirmed_guests()
returns table (display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(split_part(g.display_name, ' ', 1), ''), 'Guest'), g.avatar_url
  from public.guests g
  join public.rsvps r on r.guest_id = g.id
  where r.attending = 'yes' and r.completed and not g.blocked
  order by r.updated_at desc;
$$;

revoke all on function public.confirmed_guests() from public, anon;
grant execute on function public.confirmed_guests() to authenticated;
revoke all on function public.is_blocked(uuid) from public, anon;
grant execute on function public.is_blocked(uuid) to authenticated;
-- These two only ever run as triggers; nobody should be able to call them directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.stamp_note_author() from public, anon, authenticated;

-- ─────────────────────── row-level security ───────────────────────

alter table public.guests    enable row level security;
alter table public.rsvps     enable row level security;
alter table public.notes     enable row level security;
alter table public.plus_ones enable row level security;

-- Guests may only change their own name/photo, never the `blocked` flag.
revoke all on public.guests from anon, authenticated;
grant select on public.guests to authenticated;
grant update (display_name, avatar_url) on public.guests to authenticated;

revoke all on public.rsvps from anon, authenticated;
grant select, insert, update on public.rsvps to authenticated;

revoke all on public.plus_ones from anon, authenticated;

revoke all on public.notes from anon, authenticated;
grant select on public.notes to authenticated;
grant insert (guest_id, body, color, sticker) on public.notes to authenticated;
grant delete on public.notes to authenticated;

drop policy if exists "guests: read own" on public.guests;
create policy "guests: read own" on public.guests
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "guests: update own" on public.guests;
create policy "guests: update own" on public.guests
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "rsvps: read own" on public.rsvps;
create policy "rsvps: read own" on public.rsvps
  for select to authenticated using (guest_id = (select auth.uid()));

drop policy if exists "rsvps: insert own" on public.rsvps;
create policy "rsvps: insert own" on public.rsvps
  for insert to authenticated
  with check (guest_id = (select auth.uid()) and not public.is_blocked((select auth.uid())));

drop policy if exists "rsvps: update own" on public.rsvps;
create policy "rsvps: update own" on public.rsvps
  for update to authenticated
  using (guest_id = (select auth.uid()))
  with check (guest_id = (select auth.uid()) and not public.is_blocked((select auth.uid())));

drop policy if exists "notes: read visible" on public.notes;
create policy "notes: read visible" on public.notes
  for select to authenticated using (not hidden or guest_id = (select auth.uid()));

drop policy if exists "notes: insert own" on public.notes;
create policy "notes: insert own" on public.notes
  for insert to authenticated
  with check (guest_id = (select auth.uid()) and not public.is_blocked((select auth.uid())));

drop policy if exists "notes: delete own" on public.notes;
create policy "notes: delete own" on public.notes
  for delete to authenticated using (guest_id = (select auth.uid()));

-- The couple's dashboard uses the secret (service) key on the server, which
-- bypasses these policies; the app checks ADMIN_EMAILS before using it.

-- ─────────────────────────── photo booth ───────────────────────────
-- The photo files live on ImageKit (see SETUP.md); these tables only hold who
-- shared what, captions and hearts.

create table if not exists public.photos (
  id          uuid primary key,
  guest_id    uuid not null references public.guests (id) on delete cascade,
  author_name text not null default '',
  storage_key text not null unique check (storage_key ~ '^booth/[0-9a-f-]{36}$'),
  file_id     text not null default '',
  ext         text not null check (ext in ('webp', 'jpg')),
  width       int not null check (width between 1 and 10000),
  height      int not null check (height between 1 and 10000),
  bytes       int not null default 0 check (bytes >= 0),
  caption     text not null default '' check (char_length(caption) <= 140),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Columns added after the first version (no-ops on a fresh database).
alter table public.photos add column if not exists file_id text not null default '';
-- Archive to Google Drive: the original goes to Drive, ImageKit keeps a lighter copy.
alter table public.photos add column if not exists archived_at   timestamptz;
alter table public.photos add column if not exists drive_file_id text;
-- The original's ImageKit id, kept until it's actually deleted (retried if that fails).
alter table public.photos add column if not exists purge_file_id text;

create index if not exists photos_feed_idx on public.photos (created_at desc, id desc);
create index if not exists photos_guest_idx on public.photos (guest_id);

create table if not exists public.photo_hearts (
  photo_id   uuid not null references public.photos (id) on delete cascade,
  guest_id   uuid not null references public.guests (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, guest_id)
);

create index if not exists photo_hearts_guest_idx on public.photo_hearts (guest_id);

drop trigger if exists photos_stamp_author on public.photos;
create trigger photos_stamp_author
  before insert on public.photos
  for each row execute function public.stamp_note_author();

-- Photos are only ever added by the site's server (after it has checked the
-- file really landed on ImageKit), so guests get read + delete-own, nothing else.
alter table public.photos       enable row level security;
alter table public.photo_hearts enable row level security;

revoke all on public.photos from anon, authenticated;
grant select, delete on public.photos to authenticated;
revoke all on public.photo_hearts from anon, authenticated;

drop policy if exists "photos: read visible" on public.photos;
create policy "photos: read visible" on public.photos
  for select to authenticated using (not hidden or guest_id = (select auth.uid()));

drop policy if exists "photos: delete own" on public.photos;
create policy "photos: delete own" on public.photos
  for delete to authenticated using (guest_id = (select auth.uid()));

-- One page of the feed, newest first. Pass the last photo's created_at + id
-- to get the next page.
drop function if exists public.booth_feed(timestamptz, uuid, boolean, int);
create or replace function public.booth_feed(
  before_at timestamptz default null,
  before_id uuid default null,
  only_mine boolean default false,
  lim int default 24
)
returns table (
  id uuid, guest_id uuid, author_name text, author_avatar text, storage_key text, ext text,
  width int, height int, caption text, hidden boolean, created_at timestamptz, hearts int, hearted boolean,
  archived boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.guest_id, p.author_name, g.avatar_url, p.storage_key, p.ext,
         p.width, p.height, p.caption, p.hidden, p.created_at,
         (select count(*) from public.photo_hearts h where h.photo_id = p.id)::int,
         exists (select 1 from public.photo_hearts h where h.photo_id = p.id and h.guest_id = (select auth.uid())),
         p.archived_at is not null
  from public.photos p
  join public.guests g on g.id = p.guest_id
  where (select auth.uid()) is not null
    and (not p.hidden or p.guest_id = (select auth.uid()))
    and (not only_mine or p.guest_id = (select auth.uid()))
    and (before_at is null or (p.created_at, p.id) < (before_at, before_id))
  order by p.created_at desc, p.id desc
  limit least(greatest(lim, 1), 60);
$$;

-- One photo (for a shared link to a photo that isn't on the first page).
drop function if exists public.booth_photo(uuid);
create or replace function public.booth_photo(pid uuid)
returns table (
  id uuid, guest_id uuid, author_name text, author_avatar text, storage_key text, ext text,
  width int, height int, caption text, hidden boolean, created_at timestamptz, hearts int, hearted boolean,
  archived boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.guest_id, p.author_name, g.avatar_url, p.storage_key, p.ext,
         p.width, p.height, p.caption, p.hidden, p.created_at,
         (select count(*) from public.photo_hearts h where h.photo_id = p.id)::int,
         exists (select 1 from public.photo_hearts h where h.photo_id = p.id and h.guest_id = (select auth.uid())),
         p.archived_at is not null
  from public.photos p
  join public.guests g on g.id = p.guest_id
  where p.id = pid
    and (select auth.uid()) is not null
    and (not p.hidden or p.guest_id = (select auth.uid()));
$$;

-- How many photos (by other guests) arrived after `after_at`: the "new photos" pill.
drop function if exists public.booth_newer(timestamptz);
create or replace function public.booth_newer(after_at timestamptz)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.photos p
  where (select auth.uid()) is not null
    and not p.hidden
    and p.guest_id <> (select auth.uid())
    and p.created_at > after_at;
$$;

-- Top 3 in a time window: the most-hearted photos, one per person, at least one heart.
drop function if exists public.booth_top3(timestamptz, timestamptz);
create or replace function public.booth_top3(from_at timestamptz, to_at timestamptz)
returns table (
  id uuid, guest_id uuid, author_name text, author_avatar text, storage_key text, ext text,
  width int, height int, caption text, hidden boolean, created_at timestamptz, hearts int, hearted boolean,
  archived boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with scored as (
    select p.*, (select count(*) from public.photo_hearts h where h.photo_id = p.id)::int as n
    from public.photos p
    where not p.hidden and p.created_at >= from_at and p.created_at < to_at
  ),
  best as (
    select distinct on (s.guest_id) s.*
    from scored s
    where s.n > 0
    order by s.guest_id, s.n desc, s.created_at asc
  )
  select b.id, b.guest_id, b.author_name, g.avatar_url, b.storage_key, b.ext,
         b.width, b.height, b.caption, b.hidden, b.created_at, b.n,
         exists (select 1 from public.photo_hearts h where h.photo_id = b.id and h.guest_id = (select auth.uid())),
         b.archived_at is not null
  from best b
  join public.guests g on g.id = b.guest_id
  where (select auth.uid()) is not null
  order by b.n desc, b.created_at asc
  limit 3;
$$;

drop function if exists public.booth_stats();
create or replace function public.booth_stats()
returns table (photos int, snappers int)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int, count(distinct p.guest_id)::int
  from public.photos p
  where not p.hidden and (select auth.uid()) is not null;
$$;

-- Heart / un-heart a photo. Not your own, not hidden ones, not when blocked.
drop function if exists public.booth_toggle_heart(uuid);
create or replace function public.booth_toggle_heart(pid uuid)
returns table (hearts int, hearted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or public.is_blocked(me) then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from public.photos p where p.id = pid and not p.hidden and p.guest_id <> me) then
    raise exception 'photo not found';
  end if;
  if exists (select 1 from public.photo_hearts h where h.photo_id = pid and h.guest_id = me) then
    delete from public.photo_hearts h where h.photo_id = pid and h.guest_id = me;
  else
    insert into public.photo_hearts (photo_id, guest_id) values (pid, me) on conflict do nothing;
  end if;
  return query
    select (select count(*) from public.photo_hearts h where h.photo_id = pid)::int,
           exists (select 1 from public.photo_hearts h where h.photo_id = pid and h.guest_id = me);
end;
$$;

-- Total size of the booth's files (for the storage safety line). Server only.
drop function if exists public.booth_bytes();
create or replace function public.booth_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(p.bytes), 0)::bigint from public.photos p;
$$;

revoke all on function public.booth_bytes() from public, anon, authenticated;
grant execute on function public.booth_bytes() to service_role;
revoke all on function public.booth_feed(timestamptz, uuid, boolean, int) from public, anon;
revoke all on function public.booth_photo(uuid) from public, anon;
revoke all on function public.booth_newer(timestamptz) from public, anon;
revoke all on function public.booth_top3(timestamptz, timestamptz) from public, anon;
revoke all on function public.booth_stats() from public, anon;
revoke all on function public.booth_toggle_heart(uuid) from public, anon;
grant execute on function public.booth_feed(timestamptz, uuid, boolean, int) to authenticated;
grant execute on function public.booth_photo(uuid) to authenticated;
grant execute on function public.booth_newer(timestamptz) to authenticated;
grant execute on function public.booth_top3(timestamptz, timestamptz) to authenticated;
grant execute on function public.booth_stats() to authenticated;
grant execute on function public.booth_toggle_heart(uuid) to authenticated;

-- ─────────────────────────── site settings ───────────────────────────
-- Server-only key/value store (e.g. the Google Drive connection for the
-- archive). No guest can read or write it; only the secret key can.
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- ─────────────────────────── rehearsal ───────────────────────────
-- "Clear all data" on the dashboard (rehearsal mode only): every RSVP, +1
-- request, note, photo and heart, in one go. Guests' sign-ins are kept. Hands
-- back the photos' file ids so the server can delete them from ImageKit/Drive.
drop function if exists public.clear_site_data();
create or replace function public.clear_site_data()
returns table (ik_file text, ik_purge text, drive_file text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.plus_ones where true;
  delete from public.rsvps where true;
  delete from public.notes where true;
  return query
    with gone as (
      delete from public.photos p where true  -- hearts go with them (on delete cascade)
      returning p.file_id, p.purge_file_id, p.drive_file_id
    )
    select g.file_id, g.purge_file_id, g.drive_file_id from gone g;
end;
$$;

revoke all on function public.clear_site_data() from public, anon, authenticated;
grant execute on function public.clear_site_data() to service_role;
