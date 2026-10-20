/**
 * 「에디터에서 열기」 링크 판정(순수, Electron·DOM 비의존). 스토어 웹사이트의 단추가
 * `oprn://store/install?store=<스토어 출처>&slug=<slug>&version=<판본>` 를 연다.
 * 링크가 말하는 스토어가 에디터가 쓰는 스토어와 같은 출처일 때만 받는다 — 링크가 준 주소로는 절대 받지 않는다.
 * 위키: openwiki/asset-store.md 「에디터에서 열기 링크」.
 */
import { STORE_SLUG } from "./format";

export const STORE_DEEP_LINK_SCHEME = "oprn:" as const;

export type StoreDeepLink = { ok: true; slug: string; version?: number } | { ok: false; reason: string };

/** 링크 하나의 최대 길이. 정상 링크는 200자를 넘지 않는다. */
const MAX_LINK_LENGTH = 2048;

function originOf(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function parseStoreDeepLink(url: string, allowedStoreUrl: string): StoreDeepLink {
  if (typeof url !== "string" || url.length === 0 || url.length > MAX_LINK_LENGTH) return { ok: false, reason: "링크 형식이 올바르지 않습니다." };
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { ok: false, reason: "링크 형식이 올바르지 않습니다." };
  }
  if (parsed.protocol !== STORE_DEEP_LINK_SCHEME) return { ok: false, reason: "OPRN 링크가 아닙니다." };
  // `oprn://store/install` 은 host=store, pathname=/install 로, `oprn:store/install`·`oprn:///store/install` 은
  // host 없이 pathname 에 다 들어간다. 둘 다 같은 경로로 맞춘다.
  const route = `${parsed.host}/${parsed.pathname}`.toLowerCase().replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
  if (route !== "store/install") return { ok: false, reason: "모르는 OPRN 링크입니다." };
  if (parsed.username || parsed.password || parsed.port) return { ok: false, reason: "링크 형식이 올바르지 않습니다." };
  const params = parsed.searchParams;
  for (const key of ["store", "slug", "version"]) {
    if (params.getAll(key).length > 1) return { ok: false, reason: "링크 형식이 올바르지 않습니다." };
  }
  const allowedOrigin = originOf(allowedStoreUrl);
  const linkOrigin = originOf(params.get("store") ?? "");
  if (!allowedOrigin || !linkOrigin || linkOrigin !== allowedOrigin) {
    return { ok: false, reason: "다른 스토어 주소의 링크라 열지 않았습니다." };
  }
  const slug = params.get("slug") ?? "";
  if (!STORE_SLUG.test(slug)) return { ok: false, reason: "링크의 에셋 이름이 올바르지 않습니다." };
  const rawVersion = params.get("version");
  if (rawVersion === null || rawVersion === "") return { ok: true, slug };
  if (!/^[1-9]\d{0,15}$/.test(rawVersion)) return { ok: false, reason: "링크의 판본 번호가 올바르지 않습니다." };
  const version = Number(rawVersion);
  if (!Number.isSafeInteger(version)) return { ok: false, reason: "링크의 판본 번호가 올바르지 않습니다." };
  return { ok: true, slug, version };
}

/** 프로세스 인자(Windows·Linux 의 두 번째 실행, 첫 실행)에서 OPRN 링크를 찾는다. */
export function findStoreDeepLinkArg(argv: readonly string[]): string | null {
  for (const arg of argv) if (typeof arg === "string" && arg.toLowerCase().startsWith(STORE_DEEP_LINK_SCHEME)) return arg;
  return null;
}
