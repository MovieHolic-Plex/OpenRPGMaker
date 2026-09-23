/** 제작자 페이지를 앱 안에서 열 때 허용하는 호스트. 파일은 그 페이지에서 사용자가 직접 받는다. */
const ASSET_PAGE_HOSTS = ["itch.io", "itch.zone"] as const;

export function assetPageUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  const host = url.hostname.toLowerCase();
  const allowed = ASSET_PAGE_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  return allowed ? url : null;
}
