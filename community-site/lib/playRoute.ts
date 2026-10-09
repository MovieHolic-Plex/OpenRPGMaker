import {
  createPlayerBootPaths,
  injectPlayerBootConfig,
  resolvePlayerLanguage,
  type PlayerLanguage,
} from "./playerBootConfig";

export type PlayGameRecord = {
  readonly packageBase64: string;
};

export type CommunityPlayRouteOptions = {
  readonly loadGame: (slug: string) => Promise<PlayGameRecord | null>;
  readonly loadPlayerFile: (relativePath: string) => Promise<Response | null>;
  readonly loadRuntimeFile: (relativePath: string) => Promise<Response | null>;
  readonly readProjectJson: (bytes: Buffer) => string;
  readonly validateProjectJson: (json: string) => void;
};

export type CommunityPlayRouteParams = {
  readonly slug: string;
  readonly path?: readonly string[];
};

export function createCommunityPlayRouteHandler(options: CommunityPlayRouteOptions) {
  return async function handleCommunityPlayRoute(
    request: Request,
    params: CommunityPlayRouteParams,
  ): Promise<Response> {
    const lang = resolvePlayerLanguage(request);
    try {
      return await servePlayRoute(options, request, params, lang);
    } catch {
      return routeError("internal", lang, isProjectRequest(params));
    }
  };
}

async function servePlayRoute(
  options: CommunityPlayRouteOptions,
  _request: Request,
  params: CommunityPlayRouteParams,
  lang: PlayerLanguage,
): Promise<Response> {
  const slug = params.slug;
  const segments = params.path;

  if (!segments || segments.length === 0) {
    const game = await options.loadGame(slug);
    if (!game) return routeError("not-found", lang, false);
    if (!readProjectJson(options, game).ok) return routeError("corrupt", lang, false);
    const response = await options.loadPlayerFile("player.html");
    if (!response) return routeError("internal", lang, false);
    const html = injectPlayerBootConfig(
      await response.text(),
      createPlayerBootPaths({ slug, lang }),
    );
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }

  if (!isSafeRuntimePath(segments)) return routeError("bad-request", lang, true);
  const relativePath = segments.join("/");
  if (relativePath === "project.json") {
    const game = await options.loadGame(slug);
    if (!game) return routeError("not-found", lang, true);
    const projectJson = readProjectJson(options, game);
    if (!projectJson.ok) return routeError("corrupt", lang, true);
    return new Response(projectJson.value, {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }

  const fromBundle = await options.loadPlayerFile(relativePath);
  if (fromBundle) return fromBundle;
  const fromRuntime = await options.loadRuntimeFile(relativePath);
  if (fromRuntime) return fromRuntime;
  return routeError("not-found", lang, true);
}

type ProjectJsonResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false };

function readProjectJson(options: CommunityPlayRouteOptions, game: PlayGameRecord): ProjectJsonResult {
  try {
    const value = options.readProjectJson(Buffer.from(game.packageBase64, "base64"));
    options.validateProjectJson(value);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

function isSafeRuntimePath(segments: readonly string[]): boolean {
  return segments.length > 0 && segments.every((segment) => (
    segment.length > 0
    && segment !== "."
    && segment !== ".."
    && !segment.includes("/")
    && !segment.includes("\\")
    && !segment.includes("\0")
  ));
}

function isProjectRequest(params: CommunityPlayRouteParams): boolean {
  return params.path?.join("/") === "project.json";
}

type RouteErrorKind = "bad-request" | "not-found" | "corrupt" | "internal";

const PLAYER_ROUTE_ERROR_STYLE = `
:root{color-scheme:dark;--player-error-bg:#0b0d12;--player-error-panel:#242933;--player-error-line:rgba(255,255,255,.16);--player-error-text:#edf1f7;--player-error-accent:#2f8cff}
*{box-sizing:border-box}
html{min-height:100%}
body{min-height:100dvh;margin:0}
body{display:grid;place-items:center;padding:16px;background:var(--player-error-bg);color:var(--player-error-text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.player-route-error{width:min(100%,480px);padding:24px;border:1px solid var(--player-error-line);border-top:3px solid var(--player-error-accent);background:var(--player-error-panel)}
.player-route-error h1{margin:0;font-size:18px;line-height:1.5;font-weight:600;word-break:keep-all;overflow-wrap:anywhere}
`;

function routeError(
  kind: RouteErrorKind,
  lang: PlayerLanguage,
  resourceRequest: boolean,
): Response {
  const status = kind === "bad-request" ? 400 : kind === "not-found" ? 404 : 500;
  const message = errorMessage(kind, lang);
  const headers = { "Cache-Control": "no-store" };
  if (resourceRequest) return Response.json({ error: message }, { status, headers });
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${message}</title><style>${PLAYER_ROUTE_ERROR_STYLE}</style></head><body><main class="player-route-error" data-testid="player-route-error" role="alert"><h1>${message}</h1></main></body></html>`;
  return new Response(html, {
    status,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

function errorMessage(kind: RouteErrorKind, lang: PlayerLanguage): string {
  if (lang === "ko") {
    if (kind === "bad-request") return "잘못된 플레이 요청입니다.";
    if (kind === "not-found") return "게임을 찾을 수 없습니다.";
    return "게임을 불러올 수 없습니다.";
  }
  if (kind === "bad-request") return "Invalid player request.";
  if (kind === "not-found") return "Game not found.";
  return "The game could not be loaded.";
}
