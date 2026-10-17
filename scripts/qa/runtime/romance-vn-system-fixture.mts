// 런타임 QA 입력: 연애 프로젝트에 대사 읽기 보조(백로그·오토·스킵·숨기기) 시험용 인물과 대화를 얹는다(헤드리스 도구 경로, 모델 없음).
//   bun scripts/qa/runtime/romance-vn-system-fixture.mts <outDir> [language] [windowOpacity] [bustSide: left|right]
// 출력: <outDir>/project.json, <outDir>/proof.json (시나리오가 읽는다).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createNewProjectSeed } from "../../../src/editor/genrePacks.ts";
import { newProjectChoiceById } from "../../../src/editor/newProjectChoices.ts";
import { normalizeGameDesignBrief } from "../../../src/project/gameDesignBrief.ts";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { applyRomanceDefaults } from "../../../src/project/romancePreset.ts";
import { runTool } from "../../../src/editor/tools/index.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import { mergeDialogueSystem, resolveDialogueSystem } from "../../../src/project/dialogueSystem.ts";
import { withVerifiedPlayableSegment } from "../../../src/project/playableSegment.ts";
import type { Project } from "../../../src/project/types.ts";
const [outDir, language = "ko", opacityArg, bustSide] = process.argv.slice(2) as [string, string?, string?, string?];
mkdirSync(outDir, { recursive: true });
const input = JSON.parse(readFileSync("scripts/qa-game/briefs/campus-reunion-romance.json", "utf8"));
const choice = newProjectChoiceById(input.presetId)!;
const seed = createNewProjectSeed(choice.packId, "봄의 교정");
seed.gameDesignBrief = normalizeGameDesignBrief({ ...input.brief, version: 1, presetId: input.presetId });
const raw = deserialize(serialize(seed)) as Project;
// 구성기로 깐 캠퍼스에서 시작한다(빈 맵이 아니라 실제 연애 첫 화면).
const project = (withVerifiedPlayableSegment(raw) ?? raw) as Project;
const applied = applyRomanceDefaults(project);
const ctx = { project, assistantRun: true } as never;
const map = project.maps[project.startMapId]!;
const dirs = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]] as const;
const key = (x: number, y: number) => y * map.width + x;
const prev = new Map<number, { from: number; dir: string; d: number }>();
const queue = [key(project.startPos.x, project.startPos.y)];
prev.set(queue[0]!, { from: -1, dir: "", d: 0 });
for (let head = 0; head < queue.length; head++) {
  const cell = queue[head]!; const cx = cell % map.width, cy = Math.floor(cell / map.width);
  for (const [dir, dx, dy] of dirs) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height || prev.has(key(x, y))) continue;
    if (!isPassable(project, map, x, y) || !canMove(project, map, cx, cy, x, y)) continue;
    prev.set(key(x, y), { from: cell, dir, d: prev.get(cell)!.d + 1 }); queue.push(key(x, y));
  }
}
const far = [...prev.entries()].filter(([, v]) => v.d >= 3).sort((a, b) => a[1].d - b[1].d)[0]![0];
const npcCell = { x: far % map.width, y: Math.floor(far / map.width) };
const lines = [
  "어, 그 책… 나도 그 작가 좋아하는데.",
  "서수현이야. 도서관 동아리 회장을 맡고 있어. 신입 부원을 찾고 있었거든.",
  "사실은 오늘 아침부터 계속 이 앞을 서성였어. 말을 걸 용기가 안 나서.",
  "그런데 네가 먼저 책을 펼치고 있길래, 이건 기회다 싶었지.",
  "혹시 괜찮다면, 같이 한 줄만 읽어 줄래?",
];
let r: any = runTool(ctx, "place_npc", { mapId: map.id, x: npcCell.x, y: npcCell.y, name: "서수현", movement: "fixed", characterId: "char_suhyun", talkFriendship: false,
  pages: [{ lines, choices: [
    { text: "같이 읽어 볼래요?", commands: [{ kind: "changeFriendship", delta: 10 }, { kind: "text", body: "수현이 반가운 듯 웃었다. 「좋아, 다음엔 내가 추천할게.」" }] },
    { text: "그냥 지나가던 길이에요.", commands: [{ kind: "text", body: "수현이 조금 아쉬운 표정으로 고개를 끄덕였다." }] },
  ] }] });
if (!r.ok) throw new Error(JSON.stringify(r));
const live = (ctx as any).project as Project;
if (language !== "ko" || opacityArg) live.meta.oprnDialogueSystem = mergeDialogueSystem(resolveDialogueSystem(live), { language: language as never, ...(opacityArg ? { defaults: { windowOpacity: Number(opacityArg) } } : {}) });
const npc = live.maps[map.id]!.events.find((e) => e.name === "서수현")!;
// 네 번째 인자 right 면 흉상을 오른쪽에 둔다(단추 줄과 겹침 확인용).
if (bustSide === "right") for (const page of (npc as any).pages ?? []) for (const cmd of page.commands) if (cmd.kind === "changeFace") cmd.position = "right";
const adj = dirs.map(([d, dx, dy]) => ({ d, x: npc.x - dx, y: npc.y - dy })).find((a) => prev.has(key(a.x, a.y)) && !(a.x === npc.x && a.y === npc.y))!;
const moves: { kind: "move"; dir: string }[] = [];
for (let c = key(adj.x, adj.y); prev.get(c)!.from >= 0; c = prev.get(c)!.from) moves.unshift({ kind: "move", dir: prev.get(c)!.dir });
const face = (["up", "down", "left", "right"] as const).find((_d, i) => adj.x + dirs[i]![1] === npc.x && adj.y + dirs[i]![2] === npc.y)!;
writeFileSync(`${outDir}/project.json`, serialize(live));
writeFileSync(`${outDir}/proof.json`, JSON.stringify({ mapId: map.id, start: project.startPos, npc: { x: npc.x, y: npc.y }, at: { x: adj.x, y: adj.y }, face, moves, applied, lines, language }, null, 1));
console.log(JSON.stringify({ applied, steps: moves.length, at: adj, npc: { x: npc.x, y: npc.y }, face, mapName: map.name, size: [map.width, map.height], dialogueSystem: live.meta.oprnDialogueSystem?.language }));
