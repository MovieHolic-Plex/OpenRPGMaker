revoke insert on public.openrpg_assets from anon, authenticated;
revoke insert on public.openrpg_games from anon, authenticated;
revoke update (downloads) on public.openrpg_assets from anon, authenticated;
revoke update (downloads) on public.openrpg_games from anon, authenticated;

drop policy if exists openrpg_assets_insert on public.openrpg_assets;
drop policy if exists openrpg_assets_downloads on public.openrpg_assets;
drop policy if exists openrpg_games_insert on public.openrpg_games;
drop policy if exists openrpg_games_downloads on public.openrpg_games;

notify pgrst, 'reload schema';
