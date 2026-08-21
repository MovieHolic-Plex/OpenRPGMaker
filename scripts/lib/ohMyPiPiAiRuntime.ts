// Node-only oh-my-pi login / refresh / complete. Loaded via tsx (package ships TypeScript).

import { complete, getOAuthApiKey, getProviderDefinition, refreshOAuthToken } from "@oh-my-pi/pi-ai";
import { getBundledModel, getBundledModels } from "@oh-my-pi/pi-catalog";
import { getOhMyPiProvider, OH_MY_PI_PROVIDERS } from "../../src/ai/ohMyPiProviders.ts";
import { createOhMyPiAuthStore, defaultOhMyPiAuthPath } from "./ohMyPiAuthStore.mjs";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const store = createOhMyPiAuthStore(defaultOhMyPiAuthPath());

function storeAs(provider: string): string {
  return getProviderDefinition(provider)?.storeCredentialsAs || provider;
}

function oauthCreds(row: { access?: string; refresh?: string; expires?: number } | undefined) {
  if (!row?.access && !row?.refresh) return undefined;
  return {
    access: String(row.access ?? ""),
    refresh: String(row.refresh ?? ""),
    expires: Number(row.expires) || 0,
  };
}

function testStub(): boolean {
  return process.env.RPG_ZZU_OH_MY_PI_TEST_STUB === "1";
}

export function listOhMyPiProviders() {
  return OH_MY_PI_PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    authKind: provider.authKind,
    defaultModel: provider.defaultModel,
    hasLogin: Boolean(getProviderDefinition(provider.id)?.login),
    hasRefresh: Boolean(getProviderDefinition(provider.id)?.refreshToken),
  }));
}

/**
 * Codex CLI 로그인(`~/.codex/auth.json`)을 pi-ai 자격 증명 슬롯으로 한 번 옮긴다.
 *
 * pi-ai 는 자체 저장소(`~/.rpg-zzu/oh-my-pi-auth.json`)를 쓰므로, 이 단계가 없으면 이미
 * `codex login` 이 끝난 PC 에서도 디바이스 코드를 다시 승인해야 한다. refresh 토큰만 있으면
 * pi-ai 의 refreshToken 정의가 나머지를 채우므로 그것만 옮긴다.
 *
 * 실패는 조용히 무시한다 — 파일이 없거나 형식이 다르면 그냥 device 로그인으로 가면 된다.
 */
function adoptCodexCliCredentials(provider: string): boolean {
  if (storeAs(provider) !== "openai-codex") return false;
  const path = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");
  try {
    const tokens = JSON.parse(readFileSync(path, "utf8"))?.tokens;
    const access = typeof tokens?.access_token === "string" ? tokens.access_token : "";
    const refresh = typeof tokens?.refresh_token === "string" ? tokens.refresh_token : "";
    if (!refresh) return false;
    // access 토큰의 exp 를 그대로 쓴다. 못 읽으면 만료로 두면 첫 사용에서 refresh 가 돈다.
    store.setOAuth("openai-codex", { access, refresh, expires: jwtExpiryMs(access) });
    return true;
  } catch {
    return false;
  }
}

function jwtExpiryMs(token: string): number {
  const payload = token.split(".")[1];
  if (!payload) return 0;
  try {
    const exp = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))?.exp;
    return typeof exp === "number" ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function publicProviderStatus(provider: string) {
  const envVars = getOhMyPiProvider(provider)?.envVars ?? [];
  const envHit = envVars.some((name) => Boolean(process.env[name]?.trim()));
  if (!store.has(storeAs(provider))) adoptCodexCliCredentials(provider);
  const disk = store.publicStatus(provider);
  if (disk.connected || envHit) {
    return { ...disk, connected: true, provider, env: envHit };
  }
  return { connected: false, provider };
}

export function seedOAuthForTests(provider: string, creds: { access: string; refresh: string; expires: number }) {
  store.setOAuth(storeAs(provider), creds);
}

export function saveProviderApiKey(provider: string, apiKey: string) {
  store.setApiKey(storeAs(provider), apiKey);
  return publicProviderStatus(provider);
}

async function resolveApiKey(provider: string): Promise<string | undefined> {
  const row = store.get(storeAs(provider));
  if (row?.kind === "apiKey" && row.apiKey) return String(row.apiKey);
  const envVars = getOhMyPiProvider(provider)?.envVars ?? [];
  for (const name of envVars) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  if (row?.kind === "oauth") {
    let creds = oauthCreds(row);
    if (!creds) return undefined;
    const def = getProviderDefinition(provider);
    if (def?.refreshToken && Date.now() >= creds.expires) {
      creds = await refreshOAuthToken(provider as never, creds);
      store.setOAuth(storeAs(provider), creds);
    }
    const got = await getOAuthApiKey(provider as never, { [provider]: creds, [storeAs(provider)]: creds });
    if (got?.newCredentials) store.setOAuth(storeAs(provider), got.newCredentials);
    if (got?.apiKey) return got.apiKey;
    return creds.access;
  }
  return undefined;
}

export async function refreshProvider(provider: string) {
  const row = store.get(storeAs(provider));
  if (!row || row.kind !== "oauth") return publicProviderStatus(provider);
  if (testStub()) {
    store.setOAuth(storeAs(provider), {
      access: "stub-refreshed",
      refresh: String(row.refresh ?? "r"),
      expires: Date.now() + 60_000,
    });
    return { ...publicProviderStatus(provider), refreshed: true };
  }
  let creds = oauthCreds(row);
  if (!creds) return publicProviderStatus(provider);
  creds = await refreshOAuthToken(provider as never, creds);
  store.setOAuth(storeAs(provider), creds);
  return { ...publicProviderStatus(provider), refreshed: true };
}

/**
 * 브라우저 UI 에서 완결 가능한 로그인 정의를 고른다.
 *
 * pi-ai 의 `openai-codex` 정의는 `pasteCodeFlow` + `callbackPort: 1455` 인 브라우저 흐름이라
 * 사용자가 리다이렉트 URL 을 복사해 되돌려 줘야 한다. 우리 화면은 `verificationUrl` + `userCode`
 * 만 보여주므로 그 왕복을 태울 자리가 없고, `onPrompt` 가 던져 로그인이 죽는다.
 * device 변형(`openai-codex-device`)은 같은 자격 증명 슬롯(`storeCredentialsAs: "openai-codex"`)
 * 에 쓰면서 verificationUrl + userCode 만으로 끝나므로 이쪽을 쓴다.
 */
const LOGIN_ALIAS: Record<string, string> = { "openai-codex": "openai-codex-device" };

function loginDefinition(provider: string) {
  const alias = LOGIN_ALIAS[provider];
  return (alias ? getProviderDefinition(alias) : undefined) ?? getProviderDefinition(provider);
}

export async function startProviderLogin(provider: string, body: { apiKey?: string } = {}) {
  const supplied = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const def = loginDefinition(provider);
  if (testStub() && def?.login) {
    return {
      connected: false,
      provider,
      verificationUrl: `https://oauth.example.test/${provider}`,
      userCode: "TEST-OK",
    };
  }
  if (!def?.login) {
    if (supplied) return { ...saveProviderApiKey(provider, supplied), verificationUrl: "", userCode: "" };
    return { connected: false, provider, needsApiKey: true, verificationUrl: "", userCode: "" };
  }

  let announced = false;
  return await new Promise((resolve, reject) => {
    const pending = def.login!({
      onAuth(info) {
        if (announced) return;
        announced = true;
        resolve({
          connected: false,
          provider,
          verificationUrl: info.launchUrl || info.url,
          userCode: extractUserCode(info.url, info.instructions),
          instructions: info.instructions,
        });
      },
      async onPrompt(prompt) {
        if (supplied) return supplied;
        if (prompt.allowEmpty) return "";
        throw new Error(prompt.message || "이 제공자는 API 키가 필요합니다.");
      },
    });
    pending
      .then((creds) => {
        if (typeof creds === "string") store.setApiKey(storeAs(provider), creds);
        else store.setOAuth(storeAs(provider), creds);
        if (!announced) {
          announced = true;
          resolve({ connected: true, provider, verificationUrl: "", userCode: "" });
        }
      })
      .catch((error: unknown) => {
        if (!announced) reject(error);
      });
  });
}

function extractUserCode(url: string, instructions?: string): string {
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("user_code") || parsed.searchParams.get("code");
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }
  const fromInstructions = (instructions ?? "").match(/Enter code:\s*([A-Z0-9-]+)/i);
  if (fromInstructions?.[1]) return fromInstructions[1];
  const match = (instructions ?? "").match(/\b[A-Z0-9]{4,8}(?:-[A-Z0-9]{4,8})?\b/);
  return match?.[0] ?? "";
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const rec = part as { type?: string; text?: string };
      return rec.type === "text" ? String(rec.text ?? "") : "";
    })
    .join("");
}

function openaiToContext(provider: string, body: Record<string, unknown>) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const systemPrompt: string[] = [];
  const converted: unknown[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as { role?: string; content?: unknown; tool_call_id?: string; name?: string; tool_calls?: unknown };
    if (msg.role === "system") {
      const text = textOf(msg.content);
      if (text) systemPrompt.push(text);
      continue;
    }
    if (msg.role === "user") {
      converted.push({ role: "user", content: [{ type: "text", text: textOf(msg.content) }], timestamp: Date.now() });
      continue;
    }
    if (msg.role === "assistant") {
      const content: unknown[] = [];
      const text = textOf(msg.content);
      if (text) content.push({ type: "text", text });
      if (Array.isArray(msg.tool_calls)) {
        for (const call of msg.tool_calls) {
          if (!call || typeof call !== "object") continue;
          const rec = call as { id?: string; function?: { name?: string; arguments?: string } };
          content.push({
            type: "toolCall",
            id: rec.id ?? "call",
            name: rec.function?.name ?? "tool",
            arguments: rec.function?.arguments ?? {},
          });
        }
      }
      converted.push({
        role: "assistant",
        content,
        api: "openai-completions",
        provider,
        model: String(body.model ?? ""),
        usage: {},
        stopReason: "stop",
        timestamp: Date.now(),
      });
      continue;
    }
    if (msg.role === "tool") {
      converted.push({
        role: "toolResult",
        toolCallId: String(msg.tool_call_id ?? ""),
        toolName: String(msg.name ?? "tool"),
        content: [{ type: "text", text: textOf(msg.content) }],
        isError: false,
        timestamp: Date.now(),
      });
    }
  }
  const tools = Array.isArray(body.tools)
    ? body.tools.map((tool) => {
        const rec = tool as { function?: { name?: string; description?: string; parameters?: unknown } };
        return {
          name: rec.function?.name ?? "tool",
          description: rec.function?.description ?? "",
          parameters: rec.function?.parameters ?? { type: "object", properties: {} },
        };
      })
    : undefined;
  return { systemPrompt, messages: converted as never[], tools };
}

function resolveModel(provider: string, modelId: string) {
  const exact = getBundledModel(provider as never, modelId);
  if (exact && typeof exact === "object" && "id" in exact) return exact;
  const fallbackId = getOhMyPiProvider(provider)?.defaultModel;
  if (fallbackId) {
    const fallback = getBundledModel(provider as never, fallbackId);
    if (fallback && typeof fallback === "object" && "id" in fallback) return fallback;
  }
  return getBundledModels(provider as never)[0];
}

function assistantToOpenAI(message: {
  content?: unknown[];
  errorMessage?: string;
  errorStatus?: number;
  stopReason?: string;
  model?: string;
}) {
  if (message.errorMessage) {
    const err = new Error(message.errorMessage) as Error & { status?: number };
    err.status = message.errorStatus || 500;
    throw err;
  }
  const texts: string[] = [];
  const tool_calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
  for (const part of message.content ?? []) {
    if (!part || typeof part !== "object") continue;
    const rec = part as { type?: string; text?: string; id?: string; name?: string; arguments?: unknown };
    if (rec.type === "text" && rec.text) texts.push(rec.text);
    if (rec.type === "toolCall") {
      tool_calls.push({
        id: rec.id ?? "call",
        type: "function",
        function: {
          name: rec.name ?? "tool",
          arguments: typeof rec.arguments === "string" ? rec.arguments : JSON.stringify(rec.arguments ?? {}),
        },
      });
    }
  }
  const finish = message.stopReason === "toolUse" ? "tool_calls" : "stop";
  return {
    id: `oh-my-pi-${Date.now()}`,
    object: "chat.completion",
    model: message.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: texts.join("") || null,
          tool_calls: tool_calls.length ? tool_calls : undefined,
        },
        finish_reason: finish,
      },
    ],
  };
}

export async function completeProvider(
  provider: string,
  body: Record<string, unknown>,
  options?: { fetch?: typeof fetch },
) {
  const modelId = typeof body.model === "string" ? body.model : getOhMyPiProvider(provider)?.defaultModel ?? "";
  const model = resolveModel(provider, modelId);
  if (!model) {
    const err = new Error(`oh-my-pi 카탈로그에 ${provider} 모델이 없습니다`);
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  if (testStub()) {
    return {
      stream: false,
      completion: {
        id: "oh-my-pi-stub",
        object: "chat.completion",
        model: (model as { id?: string }).id ?? modelId,
        provider,
        choices: [{
          index: 0,
          message: { role: "assistant", content: `stub:${provider}` },
          finish_reason: "stop",
        }],
      },
    };
  }
  const apiKey = await resolveApiKey(provider);
  const context = openaiToContext(provider, body);
  const message = await complete(model as never, context as never, {
    ...(apiKey ? { apiKey } : {}),
    fetch: options?.fetch,
  } as never);
  return { stream: false, completion: assistantToOpenAI(message) };
}
