#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CPEN_BASE_URL = "https://cpenrouter.space/v1";
const DEFAULT_MODEL = "cpen/gpt-5-4-mini";
const DEFAULT_TOTAL_CONTENT_BUDGET = 120_000;
const DEFAULT_SINGLE_MESSAGE_BUDGET = 32_000;
const TOOL_RESULT_PLACEHOLDER_LIMIT = 240;

function parsePositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const totalContentBudget = parsePositiveInt(
  process.env.OPENWIKI_CPEN_TOTAL_CONTENT_CHARS,
  DEFAULT_TOTAL_CONTENT_BUDGET,
);
const singleMessageBudget = parsePositiveInt(
  process.env.OPENWIKI_CPEN_SINGLE_MESSAGE_CHARS,
  DEFAULT_SINGLE_MESSAGE_BUDGET,
);

function configureEnvironment() {
  const cpenApiKey = process.env.CPEN_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!cpenApiKey) {
    console.error("CPEN_API_KEY is required. Example: CPEN_API_KEY=... npm run openwiki:cpen -- -p \"...\"");
    process.exit(1);
  }

  process.env.OPENWIKI_PROVIDER = "openai";
  process.env.OPENWIKI_MODEL_ID = process.env.OPENWIKI_MODEL_ID ?? DEFAULT_MODEL;
  process.env.OPENAI_API_KEY = cpenApiKey;
  process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? CPEN_BASE_URL;
}

function installCpenFetchAdapter() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = getFetchUrl(input);
    if (url !== null && url.includes("/chat/completions") && typeof init?.body === "string") {
      const body = parseJsonObject(init.body);
      if (body !== null) {
        normalizeChatBody(body);
        init = {
          ...init,
          body: JSON.stringify(body),
        };
      }
    }
    return originalFetch(input, init);
  };
}

function getFetchUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input && typeof input === "object" && "url" in input && typeof input.url === "string"
    ? input.url
    : null;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeChatBody(body) {
  if (body.stream === true) {
    throw new Error("CPEN v1 does not support stream:true. Use non-stream OpenWiki runs.");
  }
  delete body.stream;
  delete body.stream_options;

  if (!Array.isArray(body.messages)) return;
  body.messages = body.messages.map(normalizeMessage);
  compactMessagesToBudget(body.messages, totalContentBudget);
}

function normalizeMessage(message) {
  if (message === null || typeof message !== "object" || Array.isArray(message)) return message;
  const next = { ...message };
  delete next.name;
  if (typeof next.content === "string" && next.content.length > singleMessageBudget) {
    next.content = truncateContent(next.content, singleMessageBudget, "single message");
  }
  return next;
}

function compactMessagesToBudget(messages, budget) {
  let total = totalContentLength(messages);
  if (total <= budget) return;

  for (const message of messages) {
    if (total <= budget) break;
    if (!isMessageObject(message) || message.role !== "tool" || typeof message.content !== "string") continue;
    const originalLength = message.content.length;
    const nextContent = createToolPlaceholder(message, originalLength);
    message.content = nextContent;
    total -= originalLength - nextContent.length;
  }

  for (const message of messages) {
    if (total <= budget) break;
    if (!isMessageObject(message) || typeof message.content !== "string") continue;
    const keep = Math.max(0, message.content.length - (total - budget));
    const nextContent = truncateContent(message.content, Math.max(TOOL_RESULT_PLACEHOLDER_LIMIT, keep), "total budget");
    total -= message.content.length - nextContent.length;
    message.content = nextContent;
  }
}

function isMessageObject(message) {
  return message !== null && typeof message === "object" && !Array.isArray(message);
}

function totalContentLength(messages) {
  return messages.reduce((total, message) => {
    return total + (isMessageObject(message) && typeof message.content === "string" ? message.content.length : 0);
  }, 0);
}

function createToolPlaceholder(message, originalLength) {
  const toolCallId =
    isMessageObject(message) && typeof message.tool_call_id === "string" ? `, tool_call_id=${message.tool_call_id}` : "";
  return `[trimmed older tool result for CPEN context limit: original content ${originalLength} chars${toolCallId}]`;
}

function truncateContent(content, limit, reason) {
  if (content.length <= limit) return content;
  const suffix = `\n\n[trimmed for CPEN ${reason} limit: original content ${content.length} chars]`;
  return `${content.slice(0, Math.max(0, limit - suffix.length))}${suffix}`;
}

function resolveOpenWikiCliPath() {
  const candidates = [];
  if (process.env.OPENWIKI_CLI_PATH) {
    candidates.push(process.env.OPENWIKI_CLI_PATH);
  }
  try {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const npmRoot = execFileSync(npmCommand, ["root", "-g"], { encoding: "utf8" }).trim();
    candidates.push(path.join(npmRoot, "openwiki", "dist", "cli.js"));
  } catch {
    // Fall through to the final error below.
  }
  if (process.platform === "win32" && process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, "npm", "node_modules", "openwiki", "dist", "cli.js"));
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  console.error("OpenWiki CLI was not found. Install it with: npm install --global openwiki");
  process.exit(1);
}

function ensureOpenWikiNonStreamingPatch(cliPath) {
  const agentPath = path.join(path.dirname(cliPath), "agent", "index.js");
  if (!existsSync(agentPath)) {
    console.error(`OpenWiki agent file was not found: ${agentPath}`);
    process.exit(1);
  }

  const source = readFileSync(agentPath, "utf8");
  if (source.includes("streaming: false") && source.includes("streamUsage: false")) return;

  const target = "        model: modelId,\n    });";
  const replacement = "        model: modelId,\n        streaming: false,\n        streamUsage: false,\n    });";
  if (!source.includes(target)) {
    console.error("OpenWiki agent model setup did not match the expected shape. Update scripts/openwiki-cpen.mjs.");
    process.exit(1);
  }
  writeFileSync(agentPath, source.replace(target, replacement), "utf8");
}

configureEnvironment();
installCpenFetchAdapter();

const cliPath = resolveOpenWikiCliPath();
ensureOpenWikiNonStreamingPatch(cliPath);
process.argv = [process.argv[0], cliPath, ...process.argv.slice(2)];
await import(pathToFileURL(cliPath).href);
