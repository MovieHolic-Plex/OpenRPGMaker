// Shared companion router for vite middleware and the standalone OAuth process.
// Missing provider falls back to Antigravity (same factory default as src/ai/ohMyPiProviders.ts).

import { applyLegacyEnvAliases } from "./oprnEnv.mjs";

applyLegacyEnvAliases();

const DEFAULT_PROVIDER = "google-antigravity";

function headerMap(headers) {
  if (!headers || typeof headers !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") out[key.toLowerCase()] = value;
  }
  return out;
}

export function companionPathname(url = "") {
  const path = String(url).split("?")[0] ?? "";
  return path;
}

export function isCompanionPath(url = "") {
  const path = companionPathname(url);
  return (
    path === "/auth/status"
    || path === "/auth/env-scan"
    || path === "/auth/login"
    || path === "/auth/providers"
    || path === "/auth/key"
    || path === "/auth/logout"
    || path === "/auth/refresh"
    || path === "/auth/oauth-paste"
    || path === "/oauth/launch"
    || path === "/v1/chat/completions"
    || path === "/v1/images/generations"
    || path === "/v1/agent/run"
    || path === "/v1/agent/render"
    || path === "/v1/agent/checkpoint"
  );
}

/**
 * Antigravity OAuth 는 Google 데스크톱 클라라 redirect_uri 가 127.0.0.1 만 통과한다.
 * 원격 preview(mdc-server:9888) 에서는 /launch 만 페이지 origin 으로 바꾸고,
 * Google·OpenAI 인가 URL 은 그대로 둔 채 편집기에 콜백 붙여넣기를 연다.
 * 돌아온 localhost 콜백 URL 은 서버가 대신 받아 완료한다.
 */
const LOOPBACK_LAUNCH = new Map();

/**
 * 붙여넣기로 되돌려받을 수 있는 루프백 콜백 경로. Antigravity 는 /oauth-callback,
 * Codex 브라우저 흐름은 OpenAI 허용목록 값인 /auth/callback 을 쓴다.
 */
const LOOPBACK_CALLBACK_PATHS = new Set(["/oauth-callback", "/auth/callback"]);

export function companionPublicOrigin(req = {}, env = process.env) {
  const fromEnv = String(env.OPRN_PUBLIC_ORIGIN ?? "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const headers = headerMap(req.headers);
  const origin = (headers.origin ?? "").trim().replace(/\/$/, "");
  if (/^https?:\/\/(?!127\.|localhost\b)/u.test(origin)) return origin;
  const host = (headers.host ?? "").trim();
  if (host && !host.startsWith("127.") && host !== "localhost" && !host.startsWith("localhost:")) {
    const proto = headers["x-forwarded-proto"] || "http";
    return `${proto}://${host}`;
  }
  return "";
}

/** 인가 URL 의 redirect_uri 가 우리 루프백 콜백이면 그 주소. 아니면 빈 문자열. */
function loopbackRedirectOf(authorizationUrl) {
  let parsed;
  try {
    parsed = new URL(String(authorizationUrl ?? ""));
  } catch {
    return "";
  }
  const redirect = parsed.searchParams.get("redirect_uri");
  if (!redirect) return "";
  let target;
  try {
    target = new URL(redirect);
  } catch {
    return "";
  }
  if (target.protocol !== "http:") return "";
  if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") return "";
  if (!LOOPBACK_CALLBACK_PATHS.has(target.pathname)) return "";
  return target.toString();
}

export function publishLoopbackLaunch(payload, publicOrigin) {
  const url = String(payload?.verificationUrl ?? "");
  const match = /^http:\/\/127\.0\.0\.1:(\d+)\/launch\/?$/u.exec(url);
  if (match && publicOrigin) {
    const port = match[1];
    LOOPBACK_LAUNCH.set(port, url);
    return {
      ...payload,
      verificationUrl: `${publicOrigin}/oauth/launch?port=${port}`,
      pasteCallback: true,
    };
  }
  // Antigravity·Codex 브라우저 로그인은 Google/OpenAI 인가 URL 을 바로 연다.
  // /launch 재작성은 없지만, 원격 브라우저는 redirect_uri 의 localhost 에 닿지 못한다.
  // 편집기가 콜백 붙여넣기를 보여 주게 pasteCallback 만 켠다.
  if (publicOrigin && loopbackRedirectOf(url)) {
    return { ...payload, pasteCallback: true };
  }
  return payload;
}

function loopbackCallbackUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw ?? ""));
  } catch {
    return "";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") return "";
  if (!LOOPBACK_CALLBACK_PATHS.has(parsed.pathname)) return "";
  if (!parsed.searchParams.get("code")) return "";
  return parsed.toString();
}

export function resolveCompanionProvider(req = {}) {
  const url = String(req.url ?? "");
  const query = url.includes("?") ? new URLSearchParams(url.slice(url.indexOf("?") + 1)) : new URLSearchParams();
  const fromQuery = query.get("provider");
  const headers = headerMap(req.headers);
  const fromHeader = headers["x-oprn-provider"];
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const fromBody = typeof body.provider === "string" ? body.provider : "";
  const raw = (fromQuery || fromHeader || fromBody || "").trim();
  return raw || DEFAULT_PROVIDER;
}

function json(status, body) {
  return { status, body };
}

export async function handleCompanionRequest(req, adapters) {
  const method = String(req.method ?? "GET").toUpperCase();
  const path = companionPathname(req.url);
  const provider = resolveCompanionProvider(req);
  const body = req.body && typeof req.body === "object" ? req.body : {};

  if (method === "OPTIONS") return json(204, {});

  if (method === "GET" && path === "/auth/providers") {
    const providers = typeof adapters.listProviders === "function" ? await adapters.listProviders() : [];
    return json(200, { providers });
  }

  if (method === "GET" && path === "/auth/status") {
    return json(200, await adapters.status(provider));
  }

  if (method === "POST" && path === "/auth/env-scan") {
    const decision = body.decision;
    if (decision !== "allow" && decision !== "deny") return json(400, { error: "decision must be allow or deny" });
    if (typeof adapters.setEnvScan !== "function") return json(501, { error: "env scan consent is unavailable" });
    await adapters.setEnvScan(decision);
    return json(200, await adapters.status(provider));
  }

  if (method === "POST" && path === "/auth/login") {
    const publicOrigin = companionPublicOrigin(req);
    const payload = await adapters.login(provider, body, { remote: !!publicOrigin });
    return json(200, publishLoopbackLaunch(payload, publicOrigin));
  }

  if (method === "GET" && path === "/oauth/launch") {
    const port = new URL(req.url ?? "", "http://companion.local").searchParams.get("port") ?? "";
    const launch = LOOPBACK_LAUNCH.get(port);
    if (!launch) return json(404, { error: "OAuth launch expired" });
    try {
      const response = await fetch(launch, { redirect: "manual" });
      const location = response.headers.get("location");
      if (!location) return json(502, { error: "OAuth launch had no Location" });
      return { status: 302, headers: { Location: location }, body: null };
    } catch (error) {
      return json(502, { error: error instanceof Error ? error.message : "OAuth launch failed" });
    }
  }

  if (method === "POST" && path === "/auth/oauth-paste") {
    const url = loopbackCallbackUrl(body.url);
    if (!url) return json(400, { error: "127.0.0.1 oauth-callback URL with code is required" });
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 400) {
        return json(response.status, { error: `loopback callback returned ${response.status}` });
      }
      return json(200, { ok: true });
    } catch (error) {
      return json(502, { error: error instanceof Error ? error.message : "oauth paste failed" });
    }
  }

  if (method === "POST" && path === "/auth/refresh") {
    return json(200, await adapters.refresh(provider));
  }

  if (method === "POST" && path === "/auth/key") {
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) return json(400, { error: "apiKey is required" });
    return json(200, await adapters.saveKey(provider, apiKey));
  }

  if (method === "POST" && path === "/auth/logout") {
    return json(200, await adapters.logout(provider));
  }

  if (method === "POST" && path === "/v1/images/generations") {
    if (typeof adapters.generateImage !== "function") {
      return json(501, { error: "이 동반 서비스는 이미지 생성을 지원하지 않습니다." });
    }
    const image = await adapters.generateImage(provider, body);
    return json(200, {
      image: {
        provider: image.provider,
        model: image.model,
        mimeType: image.mimeType,
        dataUrl: `data:${image.mimeType};base64,${image.base64}`,
      },
    });
  }

  if (method === "POST" && path === "/v1/agent/render") {
    if (typeof adapters.resolveRender !== "function") return json(501, { error: "맵 이미지 응답을 지원하지 않습니다." });
    return json(200, await adapters.resolveRender(body));
  }
  if (method === "POST" && path === "/v1/agent/checkpoint") {
    if (typeof adapters.resolveCheckpoint !== "function") return json(501, { error: "적용 응답을 지원하지 않습니다." });
    return json(200, await adapters.resolveCheckpoint(body));
  }

  if (method === "POST" && path === "/v1/agent/run") {
    if (typeof adapters.runAgent !== "function") {
      return json(501, { error: "이 동반 서비스는 Pi 에이전트 실행을 지원하지 않습니다." });
    }
    const result = await adapters.runAgent(provider, body, req.signal ? { signal: req.signal } : {});
    return { status: 200, stream: true, ndjson: result.ndjson, body: null };
  }

  if (method === "POST" && path === "/v1/chat/completions") {
    const result = await adapters.complete(provider, body);
    if (result?.stream) {
      return { status: 200, stream: true, chunks: result.chunks ?? [], body: null };
    }
    return { status: 200, stream: false, body: result?.completion ?? result };
  }

  return json(404, { error: "Not found" });
}
