// 타이틀 조립 재생(모델 없음): 저장된 조수 게임에서 타이틀 제목·부제를 «아무도 안 지은» 상태로 돌린 사본에 지금 코드의
// applyBlueprintAssembly 를 걸어, 저장본(전)과 지금 결과(후)를 나란히 적는다. 프로젝트 id 슬러그 제목은 그대로 둔다(그게 결함이다).
//   bun scripts/qa/assistant-v2/titleAssemblyCheck.mts <run-dir>... [--out <log.txt>]
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { applyBlueprintAssembly, blueprintPlaceName, isPlaceholderTitle } from "../../../src/project/blueprintAssembly.ts";

const argv = process.argv.slice(2);
const outAt = argv.indexOf("--out");
const out = outAt >= 0 ? argv[outAt + 1] : undefined;
const dirs = argv.filter((_, i) => outAt < 0 || (i !== outAt && i !== outAt + 1));
const lines: string[] = [];
const say = (line: string) => { lines.push(line); console.log(line); };
for (const dir of dirs) {
  const project = readProjectSqlite(path.join(dir, "project"));
  const title = project.system.titleScreen!;
  say(`### ${dir.replace(/^.*\/runs\//u, "")} — 청사진 제목 「${project.gameBlueprint?.title}」 장르 「${project.gameBlueprint?.genre}」`);
  say(`  전: 제목 「${title.title}」 · 부제 「${title.logoSubtitle ?? ""}」 · meta 「${project.meta.title}」`);
  const copy = structuredClone(project);
  const t = copy.system.titleScreen!;
  // 조수가 직접 지은 제목은 남기고(placeholder 만 조립 대상), 부제는 조립이 깐 것이라 지운다.
  if (isPlaceholderTitle(t.title)) t.title = project.meta.title;
  // 부제는 지난 조립 규칙(「장르 · 장소」)이 깐 것일 때만 지운다 — 조수가 직접 쓴 부제(「카페 모퉁이에서 보낸 7일」)는 둔다.
  const bp = project.gameBlueprint!;
  const g = bp.genre.trim();
  const place = blueprintPlaceName(project, bp);
  const oldRule = (!place ? g : /[·,/]/u.test(g) || g.length > 10 || place.includes(g) ? place : `${g} · ${place}`).slice(0, 60);
  if (t.logoSubtitle === oldRule) delete t.logoSubtitle;
  const applied = applyBlueprintAssembly(copy);
  say(`  후: 제목 「${t.title}」 · 부제 「${t.logoSubtitle ?? "(기본 문구)"}」 · meta 「${copy.meta.title}」`);
  say(`      적용: ${applied.filter((a) => /제목|부제/u.test(a)).join(" / ") || "-"}`);
}
if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, lines.join("\n") + "\n"); }
