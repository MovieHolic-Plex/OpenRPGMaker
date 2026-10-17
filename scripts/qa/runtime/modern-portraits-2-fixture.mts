// modern-portraits-2.scenario.mjs 픽스처 생성기 — 현대 연애 칩 NPC 둘이 같은 인물의 흉상·전신을 달고 말한다.
//
//   npx vite-node --script scripts/qa/runtime/modern-portraits-2-fixture.mts --out tmp/modern-portraits-2.json
//
//  2차 12종 시연(2026-10-17). 세 NPC 모두 칩만 놓았을 뿐이고 짝 초상은 대응표가 붙인다.
//  · (11,3) 하나 = Modern2 #5(분홍 후드티). 흉상 base → embarrassed → surprised → sad
//  · (9,3)  지호 = Modern3 #1(차콜 정장 남). 외형 레코드(칩만) + changeFace full → 짝 전신 base → happy
//  · (10,4) 유리 = Modern3 #4(남색 앞치마 카페 점원). 흉상 base → happy
import { writeFileSync } from "node:fs";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";

let out: string | null = null;
for (let i = 2; i < process.argv.length; i += 1) if (process.argv[i] === "--out") out = process.argv[++i] ?? null;
if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/modern-portraits-fixture.mts --out <경로.json>");

const project = createBlankProject();
project.meta.title = "Modern portraits 2 QA";
const ctx = { project };
const mapId = project.startMapId;
project.startPos = { x: 10, y: 3 };
project.database.characterAppearances = [
  { id: "app_jiho", name: "지호", description: "차콜 정장 남", charset: { resourceId: "oprn-charset-modern3", characterIndex: 1 } },
];
const place = (args: Record<string, unknown>) => {
  const r = runTool(ctx, "place_npc", args);
  if (!r.ok) throw new Error(`place_npc 실패: ${r.summary}`);
};
place({ mapId, id: "ev_hana", name: "하나", x: 11, y: 3,
  graphic: { textureKey: "tex_oprn_charset_modern2", characterIndex: 5 }, movement: "fixed",
  pages: [{ lines: ["선, 선배...! 안녕하세요.", "엇, 갑자기 말 걸면 놀라잖아요!", "...사실 오늘 좀 속상한 일이 있었어요.", "고마워요, 위로가 됐어요."] }] });
place({ mapId, id: "ev_jiho", name: "지호", x: 9, y: 3,
  graphic: { textureKey: "tex_oprn_charset_modern3", characterIndex: 1 }, movement: "fixed",
  pages: [{ lines: ["보고서는 검토 끝났습니다.", "오늘 저녁은 제가 사겠습니다."] }] });
place({ mapId, id: "ev_yuri", name: "유리", x: 10, y: 4,
  graphic: { textureKey: "tex_oprn_charset_modern3", characterIndex: 4 }, movement: "fixed",
  pages: [{ lines: ["어서 오세요! 오늘의 커피는 라테예요.", "단골이시니까 쿠키 하나 서비스!"] }] });

const map = ctx.project.maps[mapId]!; console.log("events", map.events.map((e) => e.id));
const setEmotions = (id: string, emo: (string | undefined)[]) => {
  const ev = map.events.find((e) => e.id === id)!; let k = 0;
  for (const c of ev.pages![0]!.commands as { kind: string; emotion?: string }[]) if (c.kind === "text") { c.emotion = emo[k]; k += 1; }
  return ev.pages![0]!.commands as { kind: string; emotion?: string }[];
};
setEmotions("ev_hana", [undefined, "embarrassed", "sad", "happy"]);
setEmotions("ev_yuri", [undefined, "happy"]);
const jiho = setEmotions("ev_jiho", [undefined, "happy"]);
const first = jiho.findIndex((c) => c.kind === "changeFace");
if (first >= 0) jiho.splice(first, 1);
jiho.unshift({ kind: "changeFace", appearanceId: "app_jiho", presentation: "full", resourceId: "", position: "left", flipHorizontally: false } as never);

const faceCmds = (id: string) => (map.events.find((e) => e.id === id)!.pages![0]!.commands as { kind: string; resourceId?: string; appearanceId?: string }[]).filter((c) => c.kind === "changeFace");
for (const id of ["ev_hana", "ev_jiho", "ev_yuri"]) console.log(id, "changeFace", JSON.stringify(faceCmds(id)));
writeFileSync(out, serialize(ctx.project), "utf8");
console.log(`픽스처: ${out}`);
