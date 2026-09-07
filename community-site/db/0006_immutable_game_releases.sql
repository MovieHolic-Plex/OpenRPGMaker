begin;

alter table public.openrpg_games alter column package_base64 drop not null;
alter table public.openrpg_games add column release_id text;
alter table public.openrpg_games add constraint openrpg_game_payload_kind check (
  (release_id is null and package_base64 is not null) or
  (release_id is not null and package_base64 is null)
);

create table public.openrpg_game_releases (
  listing_id uuid not null references public.openrpg_games(id),
  release_id text not null check (release_id ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  zip_bytes bytea not null check (octet_length(zip_bytes) between 22 and 100663296),
  zip_sha256 text not null check (zip_sha256 = encode(sha256(zip_bytes), 'hex')),
  created_at timestamptz not null default now(),
  primary key (listing_id, release_id),
  unique (listing_id),
  constraint openrpg_release_manifest check (
    jsonb_typeof(manifest) = 'object' and
    manifest->>'sentinel' is not distinct from 'oprn/game-release' and
    manifest->>'format' is not distinct from '1' and
    manifest->>'releaseId' is not distinct from release_id and
    manifest->>'entry' is not distinct from 'player.html' and
    manifest->>'project' is not distinct from 'project.json'
  )
);

-- Both halves are inserted in one transaction. A release cannot be attached to
-- another listing or left behind as an unassociated upload.
alter table public.openrpg_games add constraint openrpg_listing_release
  foreign key (id, release_id) references public.openrpg_game_releases(listing_id, release_id)
  deferrable initially deferred;
alter table public.openrpg_games add constraint openrpg_listing_identity unique (id, release_id);
alter table public.openrpg_game_releases add constraint openrpg_release_listing
  foreign key (listing_id, release_id) references public.openrpg_games(id, release_id)
  deferrable initially deferred;

create function public.openrpg_protect_release() returns trigger language plpgsql as $$
begin
  raise exception 'Published releases are immutable' using errcode = '23514';
end;
$$;
create trigger openrpg_release_immutable before update or delete on public.openrpg_game_releases
  for each row execute function public.openrpg_protect_release();
create trigger openrpg_release_no_truncate before truncate on public.openrpg_game_releases
  for each statement execute function public.openrpg_protect_release();

create function public.openrpg_protect_game_payload() returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id or new.slug is distinct from old.slug
    or new.release_id is distinct from old.release_id
    or new.package_base64 is distinct from old.package_base64 then
    raise exception 'Game payload association is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger openrpg_game_payload_immutable before update on public.openrpg_games
  for each row execute function public.openrpg_protect_game_payload();

alter table public.openrpg_game_releases enable row level security;
revoke all on public.openrpg_game_releases from public, anon, authenticated;
revoke all on function public.openrpg_protect_release() from public;
revoke all on function public.openrpg_protect_game_payload() from public;
notify pgrst, 'reload schema';
commit;
