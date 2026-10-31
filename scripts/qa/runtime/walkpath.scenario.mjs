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
  // setVitals(__oprnSetActorVitals) 훅은 e2eVitals=1 일 때만 깔린다.
  ...(qa.vitals ? { query: { e2eVitals: "1" } } : {}),
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
        // vitals: 파티 HP·MP 를 그 값으로(진 뒤 돌아올 자리 확인 — 2026-10-30 씬 벤치 보스 패배 복귀).
        ...(qa.vitals ? [{ kind: "setVitals", hp: qa.vitals.hp, mp: qa.vitals.mp ?? 0 }] : []),
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
    // dialogueDump: 조사 직후 대사창 글 두 가지 — 창 전체 innerText(옛 판정 도구가 읽던 것: ▼·■ 쪽 표시와 「기록」 단추가 붙는다)와
    // 조작 칸을 뺀 대사(hplay.mjs ui() 가 지금 읽는 것). 2026-10-30 씬 벤치 「대사에 ▼ 기록이 섞인다」 확인용.
    ...(qa.dialogueDump ? [{
      id: "dialogue-dump",
      note: `대사창 글 → ${qa.dialogueDump}`,
      ops: [{ kind: "evalToFile", out: qa.dialogueDump, fn: `() => { const box = document.querySelector(".dialogue-box"); if (!box) return { box: false }; const c = box.cloneNode(true); c.querySelectorAll(".dialogue-page-cursor, .dialogue-log-button, button, [aria-hidden=\\"true\\"]").forEach((e) => e.remove()); document.body.append(c); c.style.position = "fixed"; c.style.left = "-9999px"; const clean = c.innerText; c.remove(); return { raw: box.innerText, clean, cursor: box.querySelector(".dialogue-page-cursor")?.textContent ?? null, logButton: box.querySelector(".dialogue-log-button")?.textContent ?? null }; }` }],
    }] : []),
    // nextLines: 걸음·조사 뒤 대화를 한 줄씩 넘기며 n 장(잠긴 문의 두 번째 줄 안내 확인용).
    ...Array.from({ length: Number(qa.nextLines ?? 0) }, (_, index) => ({
      id: `line-${index + 2}`,
      note: `대화 ${index + 2}번째 줄`,
      ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    })),
    // untilField: 대화·전투·게임 오버 화면을 Enter 로 넘겨 필드로 돌아올 때까지(진 전투의 돌아오기), 그 화면 한 장과 위치(stateDump 파일).
    ...(qa.untilField ? [{
      id: "until-field",
      note: "Enter 로 넘겨 필드로 — 돌아온 자리",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => { const s = window.__oprnDebug?.readState?.(); return Boolean(s && s.currentMapId && !document.querySelector(".battle-root, [data-testid=battle-screen], .game-over") && (${fieldReady})()); }`, maxPresses: 80, settleMs: 900 }, { kind: "hold", dir: null, ms: 1200 },
        // 게임 오버 검은 화면(돌아오기 글)은 대사창이 아니라 첫 조건이 먼저 선다 — 한 번 더 넘기고 돌아온 필드를 기다린다.
        { kind: "hold", dir: null, ms: 2500 }, { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 2500 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 20, settleMs: 900 }, { kind: "hold", dir: null, ms: 2000 },
        ...(qa.stateDump ? [{ kind: "evalToFile", out: qa.stateDump, fn: `() => { const s = window.__oprnDebug.readState(); return { mapId: s.currentMapId, x: s.player?.x ?? s.playerX, y: s.player?.y ?? s.playerY, state: s }; }` }] : [])],
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
    // afterFace/afterAction: afterLegs 뒤 그쪽을 보고 조사(안내 글을 따라 걸어간 곳이 실제로 반응하는지 — 2026-10-30 회귀 sl1 terra 보급품).
    ...(qa.afterFace ? [{
      id: "after-arrive",
      note: `${qa.afterFace} 보고${qa.afterAction ? " 조사" : ""}`,
      ops: [{ kind: "face", dir: qa.afterFace }, { kind: "hold", dir: null, ms: 400 }, ...(qa.afterAction ? [{ kind: "action" }, { kind: "hold", dir: null, ms: 1200 }] : [])],
      shot: true,
    }] : []),
    // dump: 끝 화면의 body 글과 글을 가진 요소(태그·class·글) — 화면 밖 DOM 글 새기 확인용.
    ...(qa.dump ? [{
      id: "dump",
      note: `DOM 글 → ${qa.dump}`,
      ops: [{ kind: "evalToFile", out: qa.dump, fn: `() => ({ body: document.body.innerText, nodes: [...document.querySelectorAll("body *")].filter((el) => el.children.length === 0 && el.textContent.trim()).map((el) => ({ tag: el.tagName, cls: String(el.className), id: el.id, text: el.textContent.trim().slice(0, 120), shown: el.getClientRects().length > 0 })) })` }],
    }] : []),
  ],
};
