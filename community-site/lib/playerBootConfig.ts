import { EXPORT_SAVE_NAMESPACE_PREFIX } from "../../src/player/exportSaveNamespacePrefix";

export const PLAYER_HOST_FEATURES = ["exit", "fullscreen"] as const;

export type PlayerHostFeature = (typeof PLAYER_HOST_FEATURES)[number];
export type PlayerLanguage = "en" | "ko";

export type PlayerBootConfig = {
  readonly projectUrl: string;
  readonly saveNamespace: string;
  readonly returnUrl: string;
  readonly hostFeatures: readonly PlayerHostFeature[];
};

export type PlayerBootPaths = {
  readonly baseHref: string;
  readonly config: PlayerBootConfig;
};

export type CreatePlayerBootPathsOptions = {
  readonly slug: string;
  readonly lang: PlayerLanguage;
};

export class PlayerBootConfigError extends Error {
  readonly name = "PlayerBootConfigError";

  constructor() {
    super("player boot configuration is invalid");
  }
}

export function createPlayerBootPaths(options: CreatePlayerBootPathsOptions): PlayerBootPaths {
  const encodedSlug = encodeURIComponent(options.slug);
  const baseHref = `/play/${encodedSlug}/`;
  return {
    baseHref,
    config: {
      projectUrl: `${baseHref}project.json`,
      saveNamespace: `${EXPORT_SAVE_NAMESPACE_PREFIX}${options.slug}`,
      returnUrl: `/${options.lang}/games/${encodedSlug}`,
      hostFeatures: PLAYER_HOST_FEATURES,
    },
  };
}

export function injectPlayerBootConfig(html: string, paths: PlayerBootPaths): string {
  const bootJson = serializePlayerBootConfigForScript(paths.config);
  const safeBaseHref = escapeHtmlAttribute(paths.baseHref);
  const shim = `<base href="${safeBaseHref}">\n<script>window.__OPENRPG_BOOT__=${bootJson};</script>`;
  return html.replace("<head>", `<head>\n    ${shim}`);
}

export function serializePlayerBootConfigForScript(config: PlayerBootConfig): string {
  return JSON.stringify(config)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function parsePlayerBootConfigJson(text: string): PlayerBootConfig {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new PlayerBootConfigError();
  }
  if (!isRecord(value)) throw new PlayerBootConfigError();
  const projectUrl = value["projectUrl"];
  const saveNamespace = value["saveNamespace"];
  const returnUrl = value["returnUrl"];
  const hostFeatures = value["hostFeatures"];
  if (
    typeof projectUrl !== "string"
    || typeof saveNamespace !== "string"
    || typeof returnUrl !== "string"
    || !Array.isArray(hostFeatures)
    || !hostFeatures.every(isPlayerHostFeature)
  ) {
    throw new PlayerBootConfigError();
  }
  return { projectUrl, saveNamespace, returnUrl, hostFeatures };
}

export function resolvePlayerLanguage(request: Request): PlayerLanguage {
  const urlLanguage = new URL(request.url).searchParams.get("lang");
  if (urlLanguage === "ko" || urlLanguage === "en") return urlLanguage;
  const referer = request.headers.get("referer");
  if (referer && URL.canParse(referer)) {
    const match = /^\/(en|ko)\/games(?:\/|$)/.exec(new URL(referer).pathname);
    if (match?.[1] === "ko" || match?.[1] === "en") return match[1];
  }
  return request.headers.get("accept-language")?.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayerHostFeature(value: unknown): value is PlayerHostFeature {
  return value === "exit" || value === "fullscreen";
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
