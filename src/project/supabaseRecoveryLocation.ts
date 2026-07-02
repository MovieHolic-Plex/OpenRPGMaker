const DEV_FRESH_PROJECT_PARAM = "freshProject";
const SUPABASE_CANONICAL_PROJECT_PARAM = "supabaseRecovered";

export function markSupabaseRecoveredLocation(): void {
  window.history.replaceState(null, "", supabaseRecoveredPathFromHref(window.location.href));
}

export function supabaseRecoveredPathFromHref(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(DEV_FRESH_PROJECT_PARAM);
  url.searchParams.set(SUPABASE_CANONICAL_PROJECT_PARAM, "1");
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
