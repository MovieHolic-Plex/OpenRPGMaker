// safety-stop.scenario.mjs 가 쓰는 픽스처 — 끝나지 않는 자동 실행과 탈출 없는 반복을 일부러 넣은 빈 프로젝트.
//
//   npx vite-node --script scripts/qa/runtime/safety-stop-fixture.mts --out /tmp/safety-stop.json
//
// 엔진 계약 픽스처다. 데모 콘텐츠로 싣지 않고 원격에 저장하지 않는다.
import { writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import { serializePretty } from "@/project/io";
import type { GameEvent } from "@/project/types";

const out = process.argv[process.argv.indexOf("--out") + 1];
if (!out || out === "--out") throw new Error("사용법: vite-node --script scripts/qa/runtime/safety-stop-fixture.mts --out <경로.json>");

const project = createBlankProject();
project.meta.title = "테스트 안전 레일";
project.startPos = { x: 4, y: 4 };
if (project.system.opening) project.system.opening = { ...project.system.opening, enabled: false };
const map = project.maps[project.startMapId]!;
// 같은 맵 같은 칸으로 옮기는 자동 실행. 맵을 다시 읽을 때마다 시작 기록이 지워져 예전에는 영원히 다시 돌았다.
map.events.push({ id: "ev_autorun_loop", name: "끝나지 않는 자동 실행", x: 1, y: 1, trigger: { kind: "auto" },
  commands: [{ kind: "transfer", mapId: map.id, x: 4, y: 4 }] } as GameEvent);
// 조사하면 탈출 없는 반복을 도는 표지판.
map.events.push({ id: "ev_endless_loop", name: "탈출 없는 반복", x: 4, y: 3, trigger: { kind: "action" },
  commands: [{ kind: "loop", body: [{ kind: "setVariable", variableId: "var_spin", op: "+", value: 1 }] }] } as GameEvent);
project.variables.push({ id: "var_spin", name: "spin" });
writeFileSync(out, serializePretty(project));
