// Model clients for the QA pipeline: one cheap OpenAI-compatible observer (oc/deepseek) and one
// Anthropic reviewer (Opus). Every call appends one usage row so a run can report tokens per model.
import fs from "node:fs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Append-only usage ledger: { stage, model, in, out, cacheRead, ms, ok } per call. */
export function usageLedger(file) {
  return (row) => fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...row }) + "\n");
}

export function readUsage(file) {
  if (!fs.existsSync(file)) return {};
  const byKey = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    const key = `${row.stage}|${row.model}`;
    const acc = (byKey[key] ??= { stage: row.stage, model: row.model, calls: 0, failed: 0, in: 0, out: 0, cacheRead: 0, ms: 0 });
    acc.calls += 1;
    if (!row.ok) acc.failed += 1;
    acc.in += row.in ?? 0;
    acc.out += row.out ?? 0;
    acc.cacheRead += row.cacheRead ?? 0;
    acc.ms += row.ms ?? 0;
  }
  return byKey;
}

/** Last balanced JSON object in a model reply that starts with one of the given keys. */
export function extractJson(text, keys) {
  const s = String(text ?? "");
  const head = new RegExp(`^\\{\\s*"(${keys.join("|")})"`);
  for (let i = s.length - 1; i >= 0; i -= 1) {
    if (s[i] !== "{") continue;
    const tail = s.slice(i);
    if (!head.test(tail)) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let k = 0; k < tail.length; k += 1) {
      const ch = tail[k];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(tail.slice(0, k + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Cheap observer: OpenAI-compatible chat completions (oc gateway, deepseek-v4.1-flash-free, effort max).
 * Honors retry-after on 429/503 instead of hammering the shared key.
 */
export function ocClient({ baseUrl, apiKey, model = "deepseek-v4.1-flash-free", effort = "max", log, stage = "observe" }) {
  if (!baseUrl || !apiKey) throw new Error("oc client needs baseUrl and apiKey (OC_BASE_URL / OC_API_KEY)");
  return async function chat(messages, { maxTokens = 12000, tries = 6, timeoutMs = 240000 } = {}) {
    let last = null;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const t0 = Date.now();
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.1, reasoning_effort: effort, messages }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 200) {
          const body = await res.json();
          const usage = body.usage ?? {};
          log?.({ stage, model, in: usage.prompt_tokens ?? 0, out: usage.completion_tokens ?? 0, ms: Date.now() - t0, ok: true });
          return { ok: true, text: body.choices?.[0]?.message?.content ?? "" };
        }
        last = `${res.status} ${(await res.text()).slice(0, 160)}`;
        const retryAfter = Number(res.headers.get("retry-after") ?? 0) * 1000;
        await sleep(Math.max(retryAfter, Math.min(60000, 4000 * 1.5 ** attempt)) + Math.random() * 1500);
      } catch (error) {
        last = String(error).slice(0, 160);
        await sleep(3000 * (attempt + 1));
      }
    }
    log?.({ stage, model, ms: 0, ok: false, error: last });
    return { ok: false, error: last };
  };
}

/** Reviewer: Anthropic Messages API (local proxy by default, same env as the claude CLI). */
export function anthropicClient({ baseUrl, apiKey, model = "claude-opus-5-5", log, stage = "review" }) {
  if (!baseUrl || !apiKey) throw new Error("reviewer needs ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN (or --reviewer-*)");
  return async function messages(content, { system, maxTokens = 4000, tries = 5, timeoutMs = 300000 } = {}) {
    let last = null;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const t0 = Date.now();
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            authorization: `Bearer ${apiKey}`,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({ model, max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: "user", content }] }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 200) {
          const body = await res.json();
          const usage = body.usage ?? {};
          log?.({
            stage, model: body.model ?? model,
            in: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
            cacheRead: usage.cache_read_input_tokens ?? 0,
            out: usage.output_tokens ?? 0, ms: Date.now() - t0, ok: true,
          });
          return { ok: true, text: (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n") };
        }
        last = `${res.status} ${(await res.text()).slice(0, 160)}`;
        const retryAfter = Number(res.headers.get("retry-after") ?? 0) * 1000;
        await sleep(Math.max(retryAfter, 5000 * (attempt + 1)));
      } catch (error) {
        last = String(error).slice(0, 160);
        await sleep(4000 * (attempt + 1));
      }
    }
    log?.({ stage, model, ms: 0, ok: false, error: last });
    return { ok: false, error: last };
  };
}

export function imageBlockAnthropic(file) {
  const media = /\.png$/i.test(file) ? "image/png" : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: media, data: fs.readFileSync(file).toString("base64") } };
}

export function imageBlockOpenAI(file) {
  const media = /\.png$/i.test(file) ? "image/png" : "image/jpeg";
  return { type: "image_url", image_url: { url: `data:${media};base64,${fs.readFileSync(file).toString("base64")}` } };
}

/** Bounded-concurrency map that keeps input order and never drops a failed item. */
export async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try {
        out[index] = await fn(items[index], index);
      } catch (error) {
        out[index] = { error: String(error?.message ?? error).slice(0, 300) };
      }
    }
  });
  await Promise.all(workers);
  return out;
}
