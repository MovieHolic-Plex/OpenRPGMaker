import { readFileSync, existsSync } from "node:fs";

const DEFAULT_BASE = process.env.OPRN_IMAGE_BASE_URL || "http://127.0.0.1:10200/v1";

const CANDIDATES = [
  process.env.OPRN_IMAGE_MODEL,
  "gpt-image-2.6",
  "gpt-image-2.5-sunburst",
  "gpt-image-2-codex",
  "gpt-image-2",
  "gpt-image-1",
].filter(Boolean);

function apiKey() {
  if (process.env.OPRN_IMAGE_API_KEY) return process.env.OPRN_IMAGE_API_KEY.trim();
  const storePath = process.env.OPRN_OPENAI_COMPAT_PATH
    || `${process.env.HOME}/.oprn-suite/openai-compat-endpoints.json`;
  if (existsSync(storePath)) {
    const store = JSON.parse(readFileSync(storePath, "utf8"));
    for (const endpoint of Object.values(store.endpoints ?? {})) {
      const allow = endpoint.allowModels ?? [];
      if (endpoint.baseUrl?.includes("opencodex") || allow.some((m) => /terra|gpt-/.test(m))) {
        if (endpoint.apiKey) return String(endpoint.apiKey);
      }
    }
    const first = Object.values(store.endpoints ?? {}).find((e) => e.apiKey);
    if (first?.apiKey) return String(first.apiKey);
  }
  return "";
}

export async function generateImage({ prompt, size = "1024x1024", model, baseUrl = DEFAULT_BASE, timeoutMs = 240_000, candidates = CANDIDATES }) {
  const key = apiKey();
  if (!key) throw new Error("이미지 생성 자격이 없습니다: OPRN_IMAGE_API_KEY 또는 $OPRN_OPENAI_COMPAT_PATH 의 엔드포인트 키가 필요합니다.");
  const order = model ? [model, ...candidates.filter((m) => m !== model)] : [...candidates];
  const failures = [];
  for (const candidate of order) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: candidate, prompt, n: 1, size }),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        failures.push(`${candidate}: HTTP ${response.status}`);
        continue;
      }
      const payload = JSON.parse(text);
      const b64 = payload?.data?.[0]?.b64_json;
      if (!b64) {
        failures.push(`${candidate}: no b64_json`);
        continue;
      }
      const bytes = Buffer.from(b64, "base64");
      if (bytes.length < 5000 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
        failures.push(`${candidate}: not a PNG (${bytes.length} bytes)`);
        continue;
      }
      const actualModel = typeof payload.model === "string" && payload.model.trim() ? payload.model : null;
      return { dataUrl: `data:image/png;base64,${b64}`, bytes: bytes.length,
               model: actualModel,
               modelVerified: actualModel !== null,
               requestedModel: candidate, provider: baseUrl,
               responseModelField: actualModel !== null };
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`이미지 생성 실패 — 시도한 모델 전부 실패: ${failures.join(" | ")}`);
}

export async function preflightImage() {
  const started = Date.now();
  try {
    const result = await generateImage({
      prompt: "a single small green leaf on a plain white background, 16-bit pixel art, no text",
      size: "1024x1024",
      timeoutMs: 200_000,
    });
    return { ok: true, ms: Date.now() - started, bytes: result.bytes,
             model: result.model, modelVerified: result.modelVerified,
             requestedModel: result.requestedModel, provider: result.provider };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

if (import.meta.main) {
  const result = await preflightImage();
  console.log(JSON.stringify(result, null, 1));
  process.exit(result.ok ? 0 : 3);
}
