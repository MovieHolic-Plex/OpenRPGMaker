#!/usr/bin/env node
// `@/project/defaults` 배럴의 **수출 계약**을 지키는 게이트.
//
// 왜 필요한가 (2026-09-17):
//   이 배럴은 원래 335모듈·6.8MB 를 끌었다. 마지막 몇 줄의 통과용 re-export 가
//   `@/editor/content/*` → dbExtractedHouseTemplate → houseKit ↔ houseInteriors(에디터
//   인테리어 파이프라인 전체)를 물고 있었기 때문이다. 배럴을 import 하는 테스트가 1,244개라
//   그 그래프를 파일마다 다시 평가했다(파일당 collect 1.40 s).
//   데모·쇼케이스 빌더를 배럴에서 빼서 126모듈·1.4MB 로 줄였다.
//
//   그런데 그 뒤로 **새 코드가 머지될 때마다 같은 실수가 재발한다**. 실제로 #882/#883 이
//   머지되면서 e2e 스펙 2개가 `createScarloxyPokemonDemoProject` 를 배럴에서 가져왔다.
//   src 는 `npm run typecheck:app` 이 잡지만, **test/ · scripts/ · evals/ 는 아무도 안 잡는다**
//   (`npx tsc --noEmit` 전체는 이 저장소에서 4GB 힙으로 OOM 이라 게이트로 못 쓴다).
//   그 빈틈이 이 스크립트다.
//
// 하는 일: 배럴에서 가져오는 이름이 배럴이 실제로 내보내는 목록에 있는지만 본다.
//          없으면 어디로 가야 하는지까지 알려준다.
//
// 사용: node scripts/check-barrel-imports.mjs        (위반 있으면 exit 1)
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const BARREL = "src/project/defaults.ts";
// 배럴이 더 이상 안 내보내는 심볼의 새 주소. 위반을 찍을 때 안내로 쓴다.
const NEW_HOMES = [
  ["src/editor/content/townShowcaseMaps.ts", "@/editor/content/townShowcaseMaps"],
  ["src/editor/content/skyStairGame.ts", "@/editor/content/skyStairGame"],
  ["src/project/defaults/modernNocturneGame.ts", "@/project/defaults/modernNocturneGame"],
  ["src/project/defaults/marketTownMap.ts", "@/project/defaults/marketTownMap"],
  ["src/project/defaults/defaultProject.ts", "@/project/defaults/defaultProject"],
];

/** 파일이 내보내는 이름들. `export function X`, `export { a, b }`, `export type { T }` 를 본다. */
function exportedNames(path) {
  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    return new Set();
  }
  const names = new Set();
  for (const match of source.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm,
  )) names.add(match[1]);
  for (const match of source.matchAll(/^export\s*(?:type\s*)?\{([^}]*)\}/gms)) {
    for (const piece of match[1].split(",")) {
      const cleaned = piece.trim().replace(/^type\s+/, "");
      if (cleaned) names.add(cleaned.split(/\s+as\s+/).at(-1).trim());
    }
  }
  return names;
}

const exported = exportedNames(BARREL);
if (exported.size === 0) {
  console.error(`배럴을 읽지 못했다: ${BARREL}`);
  process.exit(2);
}
const homes = NEW_HOMES.map(([file, spec]) => [spec, exportedNames(file)]);
const homeFor = (name) => homes.find(([, names]) => names.has(name))?.[0] ?? null;

// 별칭(@/…)뿐 아니라 상대경로로 배럴을 가리키는 형태까지 본다 — 실제로 놓쳤던 형태다
// (`scripts/verify-ice-grand-expanse.mts` 가 `../src/project/defaults` 를 썼다).
const SPEC = String.raw`(?:@/project/defaults|(?:\.\./)+src/project/defaults|\./defaults|\.\./defaults)`;
const IMPORT_RE = new RegExp(String.raw`import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"${SPEC}";`, "gs");

// grep 에는 **고정 문자열**만 준다. 정밀 판정은 위의 JS 정규식이 파일별로 한다.
// (처음엔 SPEC 을 그대로 `grep -E` 에 넘겼는데, `(?:…)` 는 POSIX ERE 가 아니라서
//  1,361파일 중 2파일만 훑고 위반을 놓쳤다. 실측으로 확인된 함정이다.)
const listed = spawnSync("grep", [
  "-rl", "--fixed-strings", "project/defaults",
  "test", "src", "scripts", "evals",
  "--include=*.ts", "--include=*.tsx", "--include=*.mts", "--include=*.mjs",
], { encoding: "utf8" });
const files = (listed.stdout ?? "").split("\n").map((line) => line.trim()).filter(Boolean);

const violations = [];
for (const file of files) {
  if (file.endsWith(BARREL)) continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(IMPORT_RE)) {
    for (const piece of match[1].split(",")) {
      const name = piece.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (!name || exported.has(name)) continue;
      violations.push({ file, name, home: homeFor(name) });
    }
  }
}

if (violations.length > 0) {
  console.error(`\n@/project/defaults 배럴이 내보내지 않는 심볼을 ${violations.length}건 가져온다:\n`);
  for (const { file, name, home } of violations) {
    console.error(`  ${file}`);
    console.error(`    ${name} → ${home ? `"${home}" 에서 가져와라` : "출처를 찾을 수 없다 — 이름을 확인하라"}`);
  }
  console.error(
    "\n배럴에 다시 추가하지 마라. 데모·쇼케이스 빌더가 배럴에 있으면 에디터 인테리어 파이프라인이\n" +
    "따라 들어와 배럴을 쓰는 테스트 1,244개가 파일마다 그 그래프를 다시 평가한다\n" +
    "(실측 2026-09-17: 335모듈·6.8MB → 126모듈·1.4MB). 자세한 내용은 src/project/defaults.ts 주석.\n",
  );
  process.exit(1);
}

console.log(`배럴 수출 계약 통과: ${files.length}파일 검사 / @/project/defaults 수출 ${exported.size}종`);
