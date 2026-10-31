-- SacVerde League — 011: penalties switch (off during the side-by-side test with the Google Sheet)
-- Turn on when the site becomes official:  update public.seasons set enforce_penalties = true where year = 2026;
alter table public.seasons add column if not exists enforce_penalties boolean not null default false;

create or replace function public.enforce_compliance() returns void
language plpgsql security definer set search_path = public as $$
declare yr int := public.current_season(); lw int; dl timestamptz; prev timestamptz; on_ boolean;
begin
  if yr is null then return; end if;
  select enforce_penalties into on_ from public.seasons where year = yr;
  if not coalesce(on_, false) then return; end if;     -- test mode: flags only, no forfeits or forced drops
  perform public.process_deferred_drops();
  lw := public.league_week(yr);
  dl := public.compliance_deadline(yr, lw);
  if dl is null or now() < dl then return; end if;
  prev := coalesce(public.compliance_deadline(yr, lw - 1), '-infinity'::timestamptz);
  perform public.enforce_compliance_for(yr, lw, prev);
end $$;
revoke execute on function public.enforce_compliance() from public, anon, authenticated;
