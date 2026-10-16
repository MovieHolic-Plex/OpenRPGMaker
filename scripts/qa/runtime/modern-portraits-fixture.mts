// modern-portraits.scenario.mjs 픽스처 생성기 — 현대 연애 칩 NPC 둘이 같은 인물의 흉상·전신을 달고 말한다.
//
//   npx vite-node --script scripts/qa/runtime/modern-portraits-fixture.mts --out tmp/modern-portraits.json
//
//  · (11,8) 서연 = Modern1 #4(여학생 남색 블레이저). place_npc 가 칩의 검토된 짝(대응표)에서 **흉상 base** 를 자동으로 붙인다.
//    대사 emotion: 없음 → happy → sad → angry(그려져 있지 않음 → 기본 그림에 머문다)
//  · (9,8) 민준 = Modern3 #0(정장 남). 외형 레코드는 **칩만** 있고(face·bust·full 비어 있음) changeFace(appearanceId, presentation full)
//    → resolveAppearancePortrait 가 칩의 짝 전신을 채운다. emotion: 없음 → surprised
import { writeFileSync } from "node:fs";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";

let out: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i] === "--out") out = process.argv[++i] ?? null;
if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/modern-portraits-fixture.mts --out <경로.json>");

const project = createBlankProject();
project.meta.title = "Modern portraits QA";
const ctx = { project };
const mapId = project.startMapId;
project.startPos = { x: 10, y: 3 }; // 주인공을 화면 위쪽에 두면 대사 상자가 아래에 선다(preventObscuringPlayer) — 입상이 상자 뒤로 서는 정상 배치
project.database.characterAppearances = [
  { id: "app_minjun", name: "민준", description: "정장 남", charset: { resourceId: "oprn-charset-modern3", characterIndex: 0 } },
];
const place = (args: Record<string, unknown>) => {
  const r = runTool(ctx, "place_npc", args);
  if (!r.ok) throw new Error(`place_npc 실패: ${r.summary}`);
};
place({ mapId, id: "ev_seoyeon", name: "서연", x: 11, y: 3,
  graphic: { textureKey: "tex_oprn_charset_modern1", characterIndex: 4 }, movement: "fixed",
  pages: [{ lines: ["안녕하세요, 선배.", "오늘 같이 점심 먹을래요?", "그건... 조금 슬프네요.", "정말 화가 나요!"] }] });
place({ mapId, id: "ev_minjun", name: "민준", x: 9, y: 3,
  graphic: { textureKey: "tex_oprn_charset_modern3", characterIndex: 0 }, movement: "fixed",
  pages: [{ lines: ["회의는 끝났습니다.", "어, 벌써 퇴근 시간이네요?"] }] });

const map = ctx.project.maps[mapId]!; console.log("events", map.events.map((e) => e.id));
const seoyeon = map.events.find((e) => e.id === "ev_seoyeon")!;
const emo = ["happy", "happy", "sad", "angry"];
let k = 0;
for (const c of seoyeon.pages![0]!.commands as { kind: string; emotion?: string }[]) if (c.kind === "text") { c.emotion = emo[k]; k += 1; }
const minjun = map.events.find((e) => e.id === "ev_minjun")!;
const cmds = minjun.pages![0]!.commands as { kind: string; emotion?: string }[];
const first = cmds.findIndex((c) => c.kind === "changeFace");
if (first >= 0) cmds.splice(first, 1);
cmds.unshift({ kind: "changeFace", appearanceId: "app_minjun", presentation: "full", resourceId: "", position: "left", flipHorizontally: false } as never);
let j = 0;
for (const c of cmds) if (c.kind === "text") { c.emotion = j === 1 ? "surprised" : undefined; j += 1; }

const faceCmds = (id: string) => (map.events.find((e) => e.id === id)!.pages![0]!.commands as { kind: string; resourceId?: string; appearanceId?: string }[]).filter((c) => c.kind === "changeFace");
console.log("서연 changeFace", JSON.stringify(faceCmds("ev_seoyeon")));
console.log("민준 changeFace", JSON.stringify(faceCmds("ev_minjun")));
writeFileSync(out, serialize(ctx.project), "utf8");
console.log(`픽스처: ${out}`);
