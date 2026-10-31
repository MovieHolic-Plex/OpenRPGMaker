// ai/scriptAssist.ts — the event editor's "AI에게 고쳐 달라고 하기" box and "요약 다시 쓰기" for script commands.
//
// One focused model call (no agent loop, no tools): the model gets the game API cheat sheet, the project's ids
// with names, the current script and the user's request, and returns JSON { source, summary[], examples[] }.
// The editor compiles the new source (self-correction: compile errors go back to the model, at most two more
// tries), runs the examples headless before and after, and shows a diff for the user to accept. Nothing is
// written here. Model-facing text is English; the summary is written in the editor's language.
// Wiki: openwiki/script-sandbox.md 「편집기 스크립트 카드」.
import { compileScript, formatScriptDiagnostics, prepareScriptCompiler, type ScriptCompileResult } from "@/editor/script/compile";
import { scriptApiCheatSheet } from "@/project/script/dts";
import { normalizeScriptExample, type ScriptExample } from "@/project/script/types";
import type { Project } from "@/project/types";
import { resolveSurfaceAiConfig } from "./assistantEndpoint";
import { chatCompletion, type AiConfig, type ChatMessage } from "./llmClient";

export type ScriptAssistMode = "edit" | "explain";

export interface ScriptAssistRequest {
  readonly config: AiConfig;
  readonly project: Project;
  readonly mapId?: string;
  readonly eventId?: string;
  readonly source: string;
  /** What to change (edit mode). Ignored in explain mode. */
  readonly request: string;
  readonly mode: ScriptAssistMode;
  /** Editor language for the summary sentences and example labels. */
  readonly locale: "ko" | "en" | "ja" | "zh";
  readonly signal?: AbortSignal;
  readonly chat?: typeof chatCompletion;
}

export interface ScriptAssistResult {
  readonly source: string;
  readonly compile: ScriptCompileResult;
  readonly lines: string[];
  readonly examples: ScriptExample[];
  readonly attempts: number;
}

const MAX_ATTEMPTS = 3;
const LANGUAGE: Record<ScriptAssistRequest["locale"], string> = { ko: "Korean", en: "English", ja: "Japanese", zh: "Simplified Chinese" };

function idTable(project: Project, mapId?: string): string {
  const rows: string[] = [];
  const list = (label: string, entries: readonly { id: string; name?: string }[], limit = 60): void => {
    if (!entries.length) return;
    const shown = entries.slice(0, limit).map((entry) => `${entry.id}${entry.name?.trim() ? `="${entry.name.trim().slice(0, 40)}"` : ""}`);
    rows.push(`${label}: ${shown.join(", ")}${entries.length > limit ? ` … (+${entries.length - limit})` : ""}`);
  };
  list("switches", project.switches);
  list("variables", project.variables);
  list("items", project.database.items);
  list("actors", project.database.actors, 30);
  list("commonEvents", project.commonEvents, 30);
  list("troops", project.database.troops, 30);
  const map = mapId ? project.maps[mapId] : undefined;
  if (map) list(`events on map ${map.id}`, map.events, 40);
  if (project.scriptLibrary?.length) rows.push(`library modules: ${project.scriptLibrary.map((entry) => `@lib/${entry.id}`).join(", ")}`);
  return rows.join("\n");
}

export function scriptAssistSystemPrompt(input: { project: Project; mapId?: string; mode: ScriptAssistMode; locale: ScriptAssistRequest["locale"] }): string {
  const language = LANGUAGE[input.locale] ?? "Korean";
  return [
    "You edit one sandboxed TypeScript event script of a 2D RPG made in OPRN Studio. The script talks to the game only through the `game` API below; awaited calls (dialogue, choices, waits, battles, movement) run like event commands. Local variables are not saved; persistent state lives in switches/variables.",
    input.mode === "edit"
      ? "Change ONLY what the user asks. Keep everything else byte-identical where possible (names, ids, messages, comments, formatting). Do not rewrite the script into event commands and do not add features."
      : "Do NOT change the code. Return the source exactly as given; your job is the summary and examples.",
    `Then describe the RESULTING script for a non-programmer game author in ${language}: 1 to 3 short plain sentences (no code words, no ids — use the names), what the player experiences and when. Mention concrete numbers that matter (prices, orders, limits).`,
    "Also give 2 to 4 example situations that together cover the main branches. Each example is ONLY a setup (preset state and answers); the editor runs the script to get the outcome, so never write outcomes. Labels are short (max ~20 characters) in the same language.",
    "Example fields (all optional except label): label, switches [{id, value:boolean}], variables [{id, value:number}], gold, items [{id, count}], hour, minute (in-game clock), choices [0-based answers in order, -1 = cancel], numbers [number-input answers], battleResults [\"victory\"|\"defeat\"|\"escape\"].",
    "Reply with ONE JSON object and nothing else: {\"source\": string, \"summary\": string[], \"examples\": object[]}.",
    "",
    "## game API",
    scriptApiCheatSheet(),
    "",
    "## Project ids (id=\"name\")",
    idTable(input.project, input.mapId),
  ].join("\n");
}

function parseReply(content: string): { source?: string; summary: string[]; examples: ScriptExample[] } | undefined {
  const text = content.trim().replace(/^```(?:json)?\s*/u, "").replace(/```\s*$/u, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const summary = Array.isArray(raw.summary) ? raw.summary.filter((line): line is string => typeof line === "string" && line.trim().length > 0).map((line) => line.trim()).slice(0, 4) : [];
    const examples = Array.isArray(raw.examples) ? raw.examples.map(normalizeScriptExample).filter((entry): entry is ScriptExample => !!entry).slice(0, 6) : [];
    return { ...(typeof raw.source === "string" ? { source: raw.source } : {}), summary, examples };
  } catch {
    return undefined;
  }
}

/** Runs the one-shot script assist. Throws on model/parse failure after the retries. */
export async function runScriptAssist(request: ScriptAssistRequest): Promise<ScriptAssistResult> {
  await prepareScriptCompiler();
  const config = resolveSurfaceAiConfig("event-command", request.config);
  const chat = request.chat ?? chatCompletion;
  const messages: ChatMessage[] = [
    { role: "system", content: scriptAssistSystemPrompt(request) },
    {
      role: "user",
      content: [
        "Current script:",
        "```ts",
        request.source,
        "```",
        request.mode === "edit" ? `Request: ${request.request.trim()}` : "Request: write the summary and examples for this script (do not change the code).",
      ].join("\n"),
    },
  ];
  let lastProblem = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const reply = await chat(config, { messages, signal: request.signal });
    const content = typeof reply.message.content === "string" ? reply.message.content : "";
    const parsed = parseReply(content);
    if (!parsed) {
      lastProblem = "The reply was not one JSON object with source, summary and examples.";
    } else {
      const source = request.mode === "explain" ? request.source : (parsed.source ?? "");
      if (!source.trim()) {
        lastProblem = "source is empty.";
      } else if (!parsed.summary.length) {
        lastProblem = "summary is empty.";
      } else {
        const compile = compileScript(source, { project: request.project, ...(request.mapId ? { mapId: request.mapId } : {}) });
        if (compile.ok) return { source, compile, lines: parsed.summary, examples: parsed.examples, attempts: attempt };
        lastProblem = `The script does not compile:\n${formatScriptDiagnostics(compile.diagnostics.filter((entry) => entry.severity === "error"), 12)}`;
      }
    }
    messages.push({ role: "assistant", content }, { role: "user", content: `${lastProblem}\nFix it and reply with the full JSON object again.` });
  }
  throw new Error(`AI could not produce a working script: ${lastProblem}`);
}
