const DEV_FRESH_PROJECT_PARAM = "freshProject";
const CANONICAL_PROJECT_PARAM = "projectRecovered";

export function markProjectRecoveredLocation(): void {
  window.history.replaceState(null, "", projectRecoveredPathFromHref(window.location.href));
}

export function projectRecoveredPathFromHref(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(DEV_FRESH_PROJECT_PARAM);
  url.searchParams.set(CANONICAL_PROJECT_PARAM, "1");
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
