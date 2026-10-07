// check — 형식 재검사 + 원작 이름 + 그림 비전 판정(원작 고유 의상·문장·로고, 글자, 도트 아님).
// 판정은 그림 해시에 묶는다. --redraw 면 실패한 그림을 한 번 다시 그리고 다시 본다.
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { conceptForbiddenNameHits } from "../../../concepts/art";
import type { GameConcept } from "../../../concepts/format";
import { currentImageSha, ensureDirs, imagePath, listCandidates, log, pool, readCheck, writeCheck } from "./data";
import { drawOne } from "./draw";

const VISION_PROMPT = (path: string, concept: GameConcept): string => [
  `Read the image file at ${path} and judge it as a thumbnail for a game concept titled ${JSON.stringify(concept.title)} (${concept.hook}).`,
  "Fail it if ANY of these is true:",
  "1. It is not pixel art (smooth painting, 3D render, photo, vector).",
  "2. It contains readable letters, words, numbers, logos or UI.",
  "3. It reproduces a recognizable existing franchise's character, costume, crest, school house color scheme (e.g. green-and-silver serpent house robes), mascot or logo.",
  "4. It is broken: garbled faces, extra limbs dominating the image, mostly empty.",
  'Answer with ONE line of JSON only: {"ok": true|false, "findings": ["short reason", ...]}',
].join("\n");

function runVision(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--model", process.env.GC_CHECK_MODEL ?? "sonnet", "--allowedTools", "Read", "--output-format", "text"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("비전 판정 시간 초과")); }, 300_000);
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new Error(`claude -p 종료 ${code}`)); });
    child.stdin.end(prompt);
  });
}

export function parseVerdict(text: string): { ok: boolean; findings: string[] } {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) throw new Error("판정 JSON 이 없습니다.");
  const value = JSON.parse(match[0]) as { ok?: unknown; findings?: unknown };
  if (typeof value.ok !== "boolean") throw new Error("판정 ok 가 없습니다.");
  const findings = Array.isArray(value.findings) ? value.findings.filter((item): item is string => typeof item === "string") : [];
  return { ok: value.ok, findings };
}

async function checkOne(concept: GameConcept): Promise<boolean> {
  const sha = currentImageSha(concept.slug);
  if (!sha) return false;
  const names = conceptForbiddenNameHits([concept.title, concept.hook, concept.description, concept.protagonist, concept.stage, concept.firstScene].join(" "));
  const verdict = names.length > 0
    ? { ok: false, findings: [`원작 이름: ${names.join(", ")}`] }
    : parseVerdict(await runVision(VISION_PROMPT(imagePath(concept.slug, "full"), concept)));
  writeCheck(concept.slug, { imageSha: sha, ok: verdict.ok, findings: verdict.findings, at: new Date().toISOString() });
  return verdict.ok;
}

export async function check(argv: string[]): Promise<number> {
  ensureDirs();
  const parallel = argv.includes("--parallel") ? Number(argv[argv.indexOf("--parallel") + 1]) : 4;
  const force = argv.includes("--force");
  const redraw = argv.includes("--redraw");
  const targets = listCandidates().filter((concept) => {
    if (!existsSync(imagePath(concept.slug, "full"))) return false;
    const previous = readCheck(concept.slug);
    return force || !previous || previous.imageSha !== currentImageSha(concept.slug);
  });
  console.log(`[check] 볼 컨셉 ${targets.length}개`);
  let failed = 0;
  await pool(targets, parallel, async (concept) => {
    try {
      let ok = await checkOne(concept);
      if (!ok && redraw) {
        rmSync(imagePath(concept.slug, "full"), { force: true });
        rmSync(imagePath(concept.slug, "card"), { force: true });
        await drawOne(concept);
        ok = await checkOne(concept);
      }
      if (!ok) failed += 1;
    } catch (error) {
      log("check", `${concept.slug} 실패 — ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  console.log(`[check] 끝 — 실패 ${failed}개`);
  return 0;
}
