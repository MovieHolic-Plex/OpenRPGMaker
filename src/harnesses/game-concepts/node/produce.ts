// produce — 시드의 분류별 목표 수만큼 AI(claude -p)가 컨셉 JSON 을 쓴다. 형식·금지 이름·중복을 거른다.
import { spawn } from "node:child_process";
import { conceptForbiddenNameHits } from "../../../concepts/art";
import { CONCEPT_TAGS, conceptSlug, normalizeGameConcept, type ConceptTag, type GameConcept } from "../../../concepts/format";
import { GAME_PRESET_IDS } from "../../../project/gameDesignIds";
import { ensureDirs, listCandidates, log, pool, readSeed, saveCandidate, type Seed } from "./data";

const BATCH = 12;

export function runClaude(prompt: string, model = process.env.GC_WRITER_MODEL ?? "sonnet", timeoutMs = 600_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--model", model, "--output-format", "text"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("claude -p 시간 초과")); }, timeoutMs);
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude -p 종료 ${code}: ${err.slice(-400)}`));
    });
    child.stdin.end(prompt);
  });
}

/** 응답에서 첫 [ 부터 마지막 ] 까지를 배열로 읽는다(앞뒤 설명·코드 펜스 무시). */
export function parseJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("응답에 JSON 배열이 없습니다.");
  const value = JSON.parse(text.slice(start, end + 1)) as unknown;
  if (!Array.isArray(value)) throw new Error("응답이 배열이 아닙니다.");
  return value;
}

const titleKey = (title: string): string => title.replace(/[\s:·\-—!?.,"'「」『』]/gu, "").toLowerCase();

export function producePrompt(seed: Seed, tag: ConceptTag, count: number, existingTitles: readonly string[]): string {
  return [
    `RPG 제작 도구의 「새 게임」 피드에 올릴 게임 컨셉 카드 ${count}개를 한국어로 써라. 이번 묶음의 주 분류는 「${tag}」다.`,
    "사용자는 유튜브 홈처럼 썸네일과 제목을 보고 「이거 만들고 싶다」고 누른다. 제목이 재밌고 구체적이어야 한다.",
    `예시 제목(톤 참고, 그대로 쓰지 말 것): ${seed.examples.join(" / ")}`,
    "규칙:",
    ...seed.rules.map((rule) => `- ${rule}`),
    `- tags 는 1~4개, 첫 태그는 반드시 「${tag}」. 쓸 수 있는 분류: ${CONCEPT_TAGS.join(", ")}`,
    `- presetId 는 다음 중 하나: ${GAME_PRESET_IDS.map((id) => `${id}(${seed.presetGuide[id] ?? ""})`).join("; ")}`,
    `- tilesetHint 는 무대가 맞을 때만: ${Object.entries(seed.tilesetHints).map(([where, id]) => `${where} → ${id}`).join("; ")}. 아니면 빼라.`,
    "- locales 에 en/ja/zh 번역(title, hook, description)을 넣어라. 패러디 이름도 그 언어에서 자연스럽게.",
    `- 이미 있는 제목과 겹치지 마라: ${existingTitles.slice(-300).join(" / ") || "(없음)"}`,
    "",
    "출력은 JSON 배열 하나뿐. 설명·코드 펜스 금지. 각 항목 모양:",
    JSON.stringify({
      title: "…", hook: "…", description: "…", tags: [tag], presetId: "story-cutscene",
      protagonist: "…", stage: "…", firstScene: "…",
      brief: { experience: "…", activity: "…", progression: "…", detail: "…", scope: "…" },
      tilesetHint: "(선택)",
      locales: { en: { title: "…", hook: "…", description: "…" }, ja: { title: "…", hook: "…", description: "…" }, zh: { title: "…", hook: "…", description: "…" } },
    }),
  ].join("\n");
}

/** 원시 항목 하나를 후보로. 실패 사유는 문자열로 돌려준다. */
export function toCandidate(raw: unknown, takenSlugs: Set<string>): GameConcept | string {
  if (!raw || typeof raw !== "object") return "객체가 아님";
  const item = raw as Record<string, unknown>;
  const title = typeof item.title === "string" ? item.title.trim() : "";
  // 한글 제목은 로마자가 거의 없어 slug 가 해시뿐이 된다. 영어 번역 제목이 있으면 그걸로 읽히는 slug 를 만든다.
  const en = (item.locales as { en?: { title?: unknown } } | undefined)?.en?.title;
  const slugSource = typeof en === "string" && en.trim() ? en : title;
  let slug = conceptSlug(slugSource);
  for (let salt = 1; takenSlugs.has(slug); salt++) slug = conceptSlug(slugSource, String(salt));
  let concept: GameConcept;
  try {
    concept = normalizeGameConcept({
      ...item, slug, source: "official", aiGenerated: true,
      thumb: { full: `${slug}.full.webp`, card: `${slug}.card.webp` },
      ...(typeof item.tilesetHint === "string" && item.tilesetHint.startsWith("(") ? { tilesetHint: undefined } : {}),
    });
  } catch (error) {
    return `형식: ${error instanceof Error ? error.message : String(error)}`;
  }
  const hits = conceptForbiddenNameHits([concept.title, concept.hook, concept.description, concept.protagonist, concept.stage, concept.firstScene,
    ...Object.values(concept.locales ?? {}).flatMap((entry) => [entry.title, entry.hook, entry.description])].join(" "));
  if (hits.length > 0) return `원작 이름: ${hits.join(", ")}`;
  return concept;
}

export async function produce(argv: string[]): Promise<number> {
  ensureDirs();
  const seed = readSeed();
  const only = argv.includes("--tag") ? argv[argv.indexOf("--tag") + 1] : undefined;
  const limitTotal = argv.includes("--count") ? Number(argv[argv.indexOf("--count") + 1]) : Infinity;
  const parallel = argv.includes("--parallel") ? Number(argv[argv.indexOf("--parallel") + 1]) : 4;
  const existing = listCandidates();
  const titles = new Set(existing.map((concept) => titleKey(concept.title)));
  const slugs = new Set(existing.map((concept) => concept.slug));
  const jobs: { tag: ConceptTag; count: number }[] = [];
  let planned = 0;
  for (const [tag, target] of Object.entries(seed.targets) as [ConceptTag, number][]) {
    if (only && tag !== only) continue;
    let missing = target - existing.filter((concept) => concept.tags[0] === tag).length;
    while (missing > 0 && planned < limitTotal) {
      const count = Math.min(BATCH, missing, limitTotal - planned);
      jobs.push({ tag, count });
      missing -= count;
      planned += count;
    }
  }
  console.log(`[produce] 후보 ${existing.length}개, 새로 쓸 묶음 ${jobs.length}개(${planned}개)`);
  let added = 0;
  await pool(jobs, parallel, async (job) => {
    try {
      const reply = await runClaude(producePrompt(seed, job.tag, job.count, [...existing.map((concept) => concept.title)]));
      for (const raw of parseJsonArray(reply)) {
        const result = toCandidate(raw, slugs);
        if (typeof result === "string") { log("produce", `${job.tag} 버림 — ${result}`); continue; }
        const key = titleKey(result.title);
        if (titles.has(key)) { log("produce", `${job.tag} 버림 — 같은 제목 ${result.title}`); continue; }
        titles.add(key);
        slugs.add(result.slug);
        saveCandidate(result);
        added += 1;
      }
      console.log(`[produce] ${job.tag} 묶음 완료 (누적 +${added})`);
    } catch (error) {
      log("produce", `${job.tag} 묶음 실패 — ${error instanceof Error ? error.message : String(error)}`);
      console.warn(`[produce] ${job.tag} 묶음 실패`, error instanceof Error ? error.message : error);
    }
  });
  console.log(`[produce] 새 후보 ${added}개`);
  return 0;
}
