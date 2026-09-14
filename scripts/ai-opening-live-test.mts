/**
 * 라이브 검증: 에디터 AI 가 "커스텀 오프닝" 요청을 실제 system.opening 으로 저작하는가.
 *
 *   npx tsx scripts/ai-opening-live-test.mts --label live
 *
 * 실제 AssistantSession 툴 루프에 사용자가 실제로 말하는 문장을 그대로 먹이고, 세션이 만든
 * draft 의 system.opening·미디어 참조·저장 왕복을 기계적으로 판정한다.
 * 키는 env/.env.local 에서만 읽고 출력하지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { AssistantSession } from "../src/ai/assistantSession.ts";
import { chatCompletion, type AiConfig } from "../src/ai/llmClient.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { deserialize, serialize } from "../src/project/io.ts";
import type { Project } from "../src/project/types.ts";

const FIXTURE_MEDIA = {
  picture: "ai-opening-picture",
  video: "ai-opening-video",
  voice: "ai-opening-voice",
} as const;

const USER_REQUEST = [
  "새 게임을 시작할 때 나오는 커스텀 오프닝을 만들어줘.",
  "첫 장면은 글자만 나오는 내레이션: '폭풍우 치던 밤, 편지 한 장이 남았다.'",
  `둘째 장면은 첨부한 그림 ${FIXTURE_MEDIA.picture} 를 천천히 확대(zoom)하면서 '그날의 사진' 이라고 보여줘.`,
  `셋째 장면은 첨부한 영상 ${FIXTURE_MEDIA.video} 를 재생해. 내레이션 음성 ${FIXTURE_MEDIA.voice} 도 쓸 수 있으면 써줘.`,
  "실제로 새 게임에서 재생돼야 해.",
].join(" ");

function parseFlags(argv: readonly string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const next = argv[index + 1];
      flags[token.slice(2)] = next && !next.startsWith("--") ? (index += 1, next) : "true";
    }
  }
  return flags;
}

function loadEnvFile(): Record<string, string> {
  const envPath = path.resolve(import.meta.dirname, "..", ".env.local");
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function mediaProject(): Project {
  const project = createBlankProject();
  project.meta.title = "AI opening live contract";
  project.startPos = { x: 4, y: 4 };
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
  project.assets.uploaded[FIXTURE_MEDIA.picture] = {
    id: FIXTURE_MEDIA.picture, name: "폭풍우 사진", kind: "picture",
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    meta: { width: 1, height: 1 },
  };
  project.assets.uploaded[FIXTURE_MEDIA.video] = {
    id: FIXTURE_MEDIA.video, name: "인트로 영상", kind: "movie",
    dataUrl: "data:video/webm;base64,",
    meta: { width: 32, height: 24 },
  };
  project.assets.uploaded[FIXTURE_MEDIA.voice] = {
    id: FIXTURE_MEDIA.voice, name: "내레이션 음성", kind: "sound",
    dataUrl: "data:audio/wav;base64,", meta: { width: 0, height: 0 },
  };
  return project;
}

function judge(project: Project) {
  const opening = project.system.opening;
  const scenes = opening?.scenes ?? [];
  const mediaIds = scenes.flatMap(scene => (scene.kind === "text" ? [] : [scene.resourceId]));
  const uploaded = new Set(Object.keys(project.assets.uploaded));
  let reloadMatches = false;
  try {
    reloadMatches = JSON.stringify(deserialize(serialize(project)).system.opening) === JSON.stringify(opening);
  } catch {
    reloadMatches = false;
  }
  return {
    hasOpening: opening !== undefined,
    enabled: opening?.enabled === true,
    sceneKinds: scenes.map(scene => scene.kind),
    mediaIds,
    allMediaIdsKnown: mediaIds.every(id => uploaded.has(id)),
    usesPicture: mediaIds.includes(FIXTURE_MEDIA.picture),
    usesVideo: mediaIds.includes(FIXTURE_MEDIA.video),
    usesVoice: scenes.some(scene => scene.narrationAudioResourceId === FIXTURE_MEDIA.voice),
    firstNarration: scenes[0]?.narration ?? "",
    reloadMatches,
  };
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const label = flags.label ?? "live";
  const env = loadEnvFile();
  const apiKey = (process.env.OPENROUTER_API_KEY ?? env.OPENROUTER_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY 가 없습니다(.env.local 포함).");
  const model = flags.model ?? process.env.OPENROUTER_MODEL ?? env.OPENROUTER_MODEL ?? "google/gemini-3.1-flash-lite";
  const config: AiConfig = {
    authMode: "apiKey",
    baseUrl: (process.env.OPENROUTER_BASE_URL ?? env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").trim(),
    model,
    liteModel: model,
    apiKey,
    maxToolCalls: 24,
    maxTokens: 8000,
    reasoningEffort: "low",
  } as AiConfig;

  const baseline = mediaProject();
  const session = new AssistantSession(structuredClone(baseline), { config, chat: chatCompletion });
  const startedAt = Date.now();
  const turn = await session.sendUserMessage(USER_REQUEST, () => {}, undefined, { autonomous: false });
  const proposed = session.getProposedProject();
  const audit = JSON.parse(session.exportAudit()) as {
    entries?: { kind: string; name?: string; ok?: boolean; summary?: string }[];
  };
  const toolEntries = (audit.entries ?? []).filter(entry => entry.kind === "tool");
  const verdict = judge(proposed);
  const pass = verdict.hasOpening && verdict.enabled && verdict.usesPicture && verdict.usesVideo && verdict.reloadMatches;

  const outDir = path.resolve(flags.out ?? path.join("reports", "ai-opening-live"));
  fs.mkdirSync(outDir, { recursive: true });
  const projectFile = path.join(outDir, `${label}-project.json`);
  fs.writeFileSync(projectFile, JSON.stringify(proposed, null, 2));
  const report = {
    label, model, startedAt: new Date().toISOString(), durationMs: Date.now() - startedAt,
    stoppedReason: turn.stoppedReason, error: turn.error ?? null,
    assistantText: turn.assistantText.slice(0, 1500),
    toolCalls: toolEntries.map(entry => ({ name: entry.name ?? "?", ok: entry.ok, summary: entry.summary })),
    verdict, pass, projectFile,
  };
  fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(report, null, 2));

  process.stdout.write(`[${label}] model=${model} stopped=${turn.stoppedReason} pass=${pass}\n`);
  process.stdout.write(`[${label}] tools=${JSON.stringify(toolEntries.map(entry => entry.name))}\n`);
  process.stdout.write(`[${label}] verdict=${JSON.stringify(verdict)}\n`);
  process.stdout.write(`[${label}] assistant=${turn.assistantText.replace(/\s+/gu, " ").slice(0, 300)}\n`);
  process.stdout.write(`[${label}] wrote ${projectFile}\n`);
  if (!pass) process.exitCode = 1;
}

await main();
