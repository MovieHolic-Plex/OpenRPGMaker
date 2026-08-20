// Shared companion router for vite middleware and the standalone OAuth process.
// Codex (openai-codex) stays on the existing session; every other id is adapter-driven.

const DEFAULT_PROVIDER = "openai-codex";

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
    || path === "/auth/login"
    || path === "/auth/providers"
    || path === "/auth/key"
    || path === "/auth/refresh"
    || path === "/v1/chat/completions"
  );
}

export function resolveCompanionProvider(req = {}) {
  const url = String(req.url ?? "");
  const query = url.includes("?") ? new URLSearchParams(url.slice(url.indexOf("?") + 1)) : new URLSearchParams();
  const fromQuery = query.get("provider");
  const headers = headerMap(req.headers);
  const fromHeader = headers["x-rpgzzu-provider"];
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

  if (method === "POST" && path === "/auth/login") {
    return json(200, await adapters.login(provider, body));
  }

  if (method === "POST" && path === "/auth/refresh") {
    return json(200, await adapters.refresh(provider));
  }

  if (method === "POST" && path === "/auth/key") {
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) return json(400, { error: "apiKey is required" });
    return json(200, await adapters.saveKey(provider, apiKey));
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
