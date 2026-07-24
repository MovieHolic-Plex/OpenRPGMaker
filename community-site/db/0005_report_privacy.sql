revoke select on public.openrpg_reports from anon, authenticated;
drop policy if exists openrpg_reports_read on public.openrpg_reports;
notify pgrst, 'reload schema';
