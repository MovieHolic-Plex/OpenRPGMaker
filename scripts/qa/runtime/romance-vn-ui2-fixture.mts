// 런타임 QA 입력(2단계): 1단계 연애 픽스처 위에 갤러리 CG 칸 4개(기존 번들 그림, 새 그림 0장)·인물 전용 엔딩·본 엔딩 기록을 얹는다.
//   bun scripts/qa/runtime/romance-vn-ui2-fixture.mts <outDir> [language]
// 출력: <outDir>/project.json, proof.json (시나리오가 읽는다).
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serialize } from "../../../src/project/io.ts";
await import("./romance-vn-system-fixture.mts");
const outDir = process.argv[2]!;
const language = process.argv[3] ?? "ko";
const project: any = deserialize(readFileSync(`${outDir}/project.json`, "utf8"));
const proof = JSON.parse(readFileSync(`${outDir}/proof.json`, "utf8"));
const CG = ["oprn-title-field", "oprn-title-bright", "oprn-title-blue", "oprn-title-romance-campus"];
const show = (resourceId: string, n: number) => ({ kind: "showPicture", pictureId: `cg${n}`, resourceId, x: 0, y: 0, scale: 0.4, opacity: 1, recordInGallery: true });
// 서수현 첫 선택지가 CG 1 을 연다(실제 플레이로 해금). 나머지 셋은 아직 잠긴 칸.
const map = project.maps[proof.mapId];
const npc = map.events.find((e: { name: string }) => e.name === "서수현");
const first = npc.pages[0].commands.find((c: { kind: string }) => c.kind === "choices");
const yes = first.options[0];
yes.branch = [show(CG[0]!, 1), { kind: "erasePicture", pictureId: "cg1" }, ...yes.branch];
project.commonEvents.push({ id: "ce_cg_locked", name: "잠긴 CG", trigger: "none", commands: [show(CG[1]!, 2), show(CG[2]!, 3), show(CG[3]!, 4)] });
// 엔딩을 인물별로 갈리게(체크리스트가 서수현 행을 만든다).
for (const ending of project.endings) for (const c of ending.conditions) if (c.kind === "friendshipAtLeast") c.npcKey = "char_suhyun";
project.endings.find((e: { id: string }) => e.id === "ending_romance_happy").epilogue = [
  { kind: "say", speaker: "서수현", text: "그날 이후로 도서관 앞은 우리 자리가 됐어." },
  { kind: "say", speaker: "서수현", text: "다음 책은 내가 고를게. 같이 읽자." },
];
writeFileSync(`${outDir}/project.json`, serialize(project));
writeFileSync(`${outDir}/proof.json`, JSON.stringify({ ...proof, language, cg: CG, seenEnding: "ending_romance_normal" }, null, 1));
console.log(JSON.stringify({ cg: CG.length, endings: project.endings.map((e: { id: string; conditions: unknown[] }) => [e.id, e.conditions]) }));
