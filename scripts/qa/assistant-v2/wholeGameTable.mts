// 「게임 전체 요청」 판정표 — 스위트 12 프롬프트(suite/prompts.json)·방 과제(suite/rooms/tasks.json) 문구 전부로 wantsWholeGame 을 돌린다.
//   bun scripts/qa/assistant-v2/wholeGameTable.mts [suite 폴더]   → 기대와 다른 줄이 있으면 exit 1
// 방 과제 healing-store·delivery-bakery 문구는 suite 파일과 별도로 「기타」 줄에도 고정한다(청사진 관문이 이 둘을 0점으로 막았다, 2026-10-29).
// 게임 프롬프트(첫 요청·「끝까지 만들어 줘」 후속 차례)는 true, 방 과제(접미 「이 방 하나만 지어 줘」 포함/미포함·카드 답 차례)와 고치기 요청은 false.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { wantsWholeGame } from "../../../src/ai/v2/shipChecks.ts";
import { priorRequestsNote } from "../../../src/ai/v2/priorRequests.ts";
import { composePiTask } from "../../../src/ai/piAgent/executionRoute.ts";

const suite = process.argv[2] ?? path.join(os.homedir(), "z-project/assistant-whole-game/suite");
const prompts = JSON.parse(fs.readFileSync(path.join(suite, "prompts.json"), "utf8"));
const games: { id: string; text: string }[] = Array.isArray(prompts) ? prompts : prompts.prompts;
const rooms = JSON.parse(fs.readFileSync(path.join(suite, "rooms/tasks.json"), "utf8"));
const FOLLOW = "아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을 처음부터 엔딩까지 실제로 플레이할 수 있게 해 줘.";
const followTask = (first: string, next: string) => composePiTask(next, priorRequestsNote([{ kind: "user", text: first } as never], next));
const rows: { kind: string; id: string; text: string; want: boolean }[] = [];
for (const g of games) {
  rows.push({ kind: "게임", id: g.id, text: g.text, want: true });
  rows.push({ kind: "게임·후속", id: g.id, text: followTask(g.text, FOLLOW), want: true });
}
for (const t of rooms.tasks as { id: string; text: string }[]) {
  rows.push({ kind: "방", id: t.id, text: t.text + rooms.protocol.suffix, want: false });
  rows.push({ kind: "방·접미 없음", id: t.id, text: t.text, want: false });
  rows.push({ kind: "방·카드 답", id: t.id, text: followTask(t.text + rooms.protocol.suffix, rooms.protocol.card), want: false });
}
for (const [text, want] of [["검은 장미 저택 공포 게임 만들어 줘", true], ["촌장을 광장으로 옮겨 줘", false], ["버튼 효과 고쳐 (액션)", false], ["폐업 직전 태엽 장난감 가게, 밤마다 손님이 깨어난다 (회상 스토리)", true], ["엔딩까지 이어지게 해 줘", true], ["짧은 JRPG 하나 만들어 줘", true], ["방 하나만 있는 방탈출 게임 만들어 줘", true], ["이 맵 하나만 다시 지어 줘", false], ["힐링 게임의 시골 마을에 있는 작은 잡화점 실내를 만들어 줘. 다른 맵은 만들지 말고 이 방 하나만 지어 줘.", false], ["택배 배달 게임에서 소포를 받는 동네 빵집 실내를 만들어 줘. 다른 맵은 만들지 말고 이 방 하나만 지어 줘.", false], ["힐링 게임의 시골 마을에 있는 작은 잡화점 실내를 만들어 줘.", false], ["택배 배달 게임에서 소포를 받는 동네 빵집 실내를 만들어 줘.", false], ["여관 실내를 만들어 줘", false], ["힐링 게임 하나 만들어 줘. 잡화점 실내도 만들어 줘.", true], ["택배 배달 게임을 엔딩까지 만들어 줘", true]] as const)
  rows.push({ kind: "기타", id: "-", text, want });
let bad = 0;
for (const r of rows) {
  const got = wantsWholeGame(r.text);
  if (got !== r.want) bad += 1;
  console.log(`${got === r.want ? "  " : "✗ "}${r.kind.padEnd(8)} ${r.id.padEnd(16)} 기대 ${r.want ? "T" : "F"} 실제 ${got ? "T" : "F"}  ${r.text.replace(/\n/gu, " ⏎ ").slice(0, 90)}`);
}
console.log(`\n${rows.length}줄 · 어긋남 ${bad}`);
process.exit(bad ? 1 : 0);
