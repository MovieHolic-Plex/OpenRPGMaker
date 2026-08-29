// golem-fixture.mjs 가 구운 픽스처를 **프로덕션 린트**로 검사한다.
//
//   npx vite-node scripts/qa/runtime/golem-fixture-lint.mts /tmp/golem-3x3.json
//
// 왜 생성기 안에서 안 하는가: 타일 통행성 판정(passageMarkForTile)은 타일 접목·star 마크까지
// 보는 로직이라, 순수 .mjs 에 옮겨 적으면 프로덕션과 갈라진다. 갈라진 판정으로 "통행 가능" 을
// 확인하면 QA 는 통과하는데 게임에서는 골렘이 벽에 박혀 있을 수 있다.
//
// 여기서 잡히는 것(둘 다 2차에서 사각으로 올린 검사다):
//   - event-footprint-impassable : 골렘의 **통행 사각**이 통행 불가 칸을 덮었다(걸어서 못 닿는 자리)
//   - duplicate-event           : 골렘 **몸 사각**이 기존 이벤트와 겹쳤다
// 앞의 것은 생성기가 판정할 수 없고, 뒤의 것은 생성기도 보지만 여기서 한 번 더 확인된다.

import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io";
import { projectLint } from "@/project/lint/projectLint";

const path = process.argv[2];
if (!path) throw new Error("사용법: vite-node golem-fixture-lint.mts <픽스처.json>");

const project = deserialize(readFileSync(path, "utf8"));

// 골렘이 실제로 심겼는지 먼저 확인한다 — 대조군(--no-golem) 파일을 실수로 검사하면
// "경고 없음" 이 나오는데 그건 골렘이 없어서일 뿐, 자리가 좋다는 증거가 아니다.
const map = project.maps[project.startMapId];
const golem = map?.events.find((event) => event.id === "ev_golem_demo");
console.log(`픽스처: ${path}`);
console.log(`  시작맵: ${project.startMapId} (${map?.width}x${map?.height})`);
if (golem) {
  const page = golem.pages?.[0];
  const fp = page?.footprint ?? { width: 1, height: 1 };
  console.log(`  골렘: 앵커 (${golem.x},${golem.y}) 몸 ${fp.width}x${fp.height} 통행행 ${page?.passRows ?? fp.height}`);
} else {
  console.log("  골렘: 없음 (대조군 픽스처다 — 통행 검사는 아무것도 증명하지 않는다)");
}
console.log(`  startPos: (${project.startPos.x},${project.startPos.y})`);

// 세 코드만 본다. 픽스처 원본(editor-authored-demo-v3)에 원래 있던 다른 경고까지 실패로
// 세면 골렘과 무관한 이유로 붉어져 신호가 죽는다.
// start-position 을 넣는 이유: `--start` 가 벽이면 플레이어가 애초에 그 자리에 없거나 못 움직이고,
// 그러면 "막혔다" 단정이 골렘과 무관하게 헛통과한다. 시나리오가 겨냥하는 칸 못지않게 중요하다.
const RELEVANT = new Set(["event-footprint-impassable", "duplicate-event", "start-position"]);
const issues = projectLint(project).filter((issue) => RELEVANT.has(issue.code));

if (issues.length === 0) {
  console.log("\n통과 — 골렘 자리에 통행/겹침 경고가 없다.");
  process.exit(0);
}

console.log(`\n실패 — 경고 ${issues.length}건:`);
for (const issue of issues) console.log(`  [${issue.code}] ${issue.message}`);
process.exit(1);
