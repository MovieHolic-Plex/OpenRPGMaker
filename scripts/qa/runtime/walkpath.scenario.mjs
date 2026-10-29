// 실제 걸음으로 길 확인 — 2026-10-29 판정 «보이는데 닿지 못함» 재현용(텔레포트로는 막힘이 안 보인다).
//
//   WALKPATH='{"mapId":"map_…","from":{"x":18,"y":19},"switches":[],"legs":[["up",12],["right",6]],"face":"up","action":true}' \
//     node scripts/runtime-qa.mjs --scenario walkpath --netns --browser firefox --project <project.json> --out <dir>
//
// legs 마다 move 로 한 칸씩 걷고(막히면 그 자리에서 멈춘다) 한 장. notes 에 「moved n/m, blocked」가 남는다.
// closeDialogue:true 면 조사 뒤 대화를 넘긴 필드 화면(바뀐 목표 줄)을 한 장 더, afterLegs 는 그 뒤 걸음.
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats } from "./wholeGameStoryCommon.mjs";

const qa = JSON.parse(process.env.WALKPATH ?? '{"mapId":"map_blank_start","from":{"x":0,"y":0},"legs":[]}');

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "walkpath",
  viewport: { width: 960, height: 720 },
  beats: [
    ...openingBeats().slice(0, 1),
    {
      id: "new-game",
      note: "새 게임 — 맵이 뜰 때까지 Enter",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(window.__oprnDebug?.readState?.().currentMapId)`, maxPresses: 20, settleMs: 3000 }],
    },
    ...toFieldBeats({ firstDialogue: false }),
    { id: "field", note: "첫 필드", ops: [{ kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 }] },
    {
      id: "from",
      note: `${qa.mapId} (${qa.from.x},${qa.from.y}) 에서 출발`,
      ops: [
        ...(qa.switches ?? []).map((switchId) => ({ kind: "setSwitch", switchId, value: true })),
        ...(qa.items ?? []).map((itemId) => ({ kind: "giveItem", itemId })),
        { kind: "teleport", mapId: qa.from.mapId ?? qa.mapId, x: qa.from.x, y: qa.from.y },
        { kind: "waitForPosition", mapId: qa.from.mapId ?? qa.mapId, x: qa.from.x, y: qa.from.y },
        { kind: "hold", dir: null, ms: 900 },
      ],
      shot: true,
    },
    ...(qa.legs ?? []).map(([dir, steps], index) => ({
      id: `leg-${index + 1}`,
      note: `${dir} ${steps}칸`,
      ops: [{ kind: "move", dir, steps, stepTimeoutMs: 1500 }, { kind: "hold", dir: null, ms: 500 }],
      shot: true,
    })),
    ...(qa.face ? [{
      id: "arrive",
      note: `${qa.face} 보고${qa.action ? " 조사" : ""}`,
      ops: [{ kind: "face", dir: qa.face }, { kind: "hold", dir: null, ms: 400 }, ...(qa.action ? [{ kind: "action" }, { kind: "hold", dir: null, ms: 1200 }] : [])],
      shot: true,
    }] : []),
    // closeDialogue: 조사 뒤 대화를 넘겨 필드로 돌아온 화면(바뀐 목표 줄·화살표)을 한 장 더. afterLegs 는 그 뒤 걸음.
    ...(qa.closeDialogue ? [{
      id: "after",
      note: "대화 넘김 — 바뀐 목표",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    }] : []),
    ...(qa.afterLegs ?? []).map(([dir, steps], index) => ({
      id: `after-leg-${index + 1}`,
      note: `${dir} ${steps}칸`,
      ops: [{ kind: "move", dir, steps, stepTimeoutMs: 1500 }, { kind: "hold", dir: null, ms: 500 }],
      shot: true,
    })),
    // dump: 끝 화면의 body 글과 글을 가진 요소(태그·class·글) — 화면 밖 DOM 글 새기 확인용.
    ...(qa.dump ? [{
      id: "dump",
      note: `DOM 글 → ${qa.dump}`,
      ops: [{ kind: "evalToFile", out: qa.dump, fn: `() => ({ body: document.body.innerText, nodes: [...document.querySelectorAll("body *")].filter((el) => el.children.length === 0 && el.textContent.trim()).map((el) => ({ tag: el.tagName, cls: String(el.className), id: el.id, text: el.textContent.trim().slice(0, 120), shown: el.getClientRects().length > 0 })) })` }],
    }] : []),
  ],
};
