// 대사 흘림 속도·흘림 중 확인키·조사 한 번에 필요한 Enter 수 계측(2026-10-29 vm3 flash 방탈출 판정 「대사 한 글자씩 느리게, 조사 한 번에 Enter 여러 번」).
//
//   QA_OUT=<폴더> QA_STAND=x,y,dir [QA_MAP=…] node scripts/runtime-qa.mjs --scenario pacing-dialogue --project <web.json> --netns
//
// 1-type : QA_STAND 에서 조사 → 손 안 대고 창마다 글자가 다 나올 때까지(글자 수·ms·글자당 ms), 다 나온 뒤에만 확인키 — 창 수(조사 한 번에 Enter 몇 번).
// 2-skip : QA_STAND2 에서 다른 것을 조사 → 글자가 나오는 중(150ms 뒤) 확인키 한 번 → 그 직후 보이는 글자 비율(1 이면 전문 즉시 표시).
const OUT = process.env.QA_OUT ?? "/tmp/pacing-dialogue";
const [sx, sy, sdir] = (process.env.QA_STAND ?? "11,4,left").split(",");
const [kx, ky, kdir] = (process.env.QA_STAND2 ?? "11,5,left").split(",");
const MAP = process.env.QA_MAP ?? "map_blank_start";
const BOX = ".dialogue-overlay .dialogue-box";
const common = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = () => document.querySelector("${BOX}");
  const text = () => (box()?.querySelector(".dialogue-text, [data-testid='dialogue-text']") ?? box())?.textContent?.replace(/[▼■]|기록/g, "").replace(/\\s+/g, "") ?? "";
  const press = (key) => { for (const type of ["keydown", "keyup"]) document.dispatchEvent(new KeyboardEvent(type, { key, code: key === "Enter" ? "Enter" : key, bubbles: true })); };
  const waitBox = async () => { for (let i = 0; i < 300 && !box(); i += 1) await sleep(10); return !!box(); };
  const stable = async () => { let last = text(), since = performance.now(); const t0 = performance.now(); while (performance.now() - since < 500 && performance.now() - t0 < 20000) { await sleep(16); const now = text(); if (now !== last) { last = now; since = performance.now(); } } return { len: last.length, fullAt: Math.round(since - t0) }; };
`;
const examine = `press("Enter");`;
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const pacingDialogueScenario = {
  id: "pacing-dialogue",
  beats: [
    { id: "start", note: "새 게임 → 시작 대사 다 넘김", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 2500 },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "pressUntilJs", key: "Enter", fn: `() => !document.querySelector("${BOX}")`, maxPresses: 60, settleMs: 700 },
      { kind: "teleport", mapId: MAP, x: Number(sx), y: Number(sy) },
      { kind: "face", dir: sdir },
    ] },
    { id: "type", note: "손 안 대고 창마다 흘림, 다 나온 뒤에만 누름", ops: [{ kind: "action" }, { kind: "evalToFile", out: `${OUT}/1-type.json`, fn: `async () => { ${common}
      let t0 = performance.now(); let retried = false; if (!await waitBox()) { retried = true; press("Enter"); t0 = performance.now(); if (!await waitBox()) return { box: false }; }
      const pages = []; while (box() && pages.length < 30) { const s = await stable(); pages.push({ len: s.len, typeMs: s.fullAt, msPerChar: s.len ? Math.round(s.fullAt / s.len) : null, text: text().slice(0, 30) }); press("Enter"); await sleep(250); }
      return { retried, windows: pages.length, totalMs: Math.round(performance.now() - t0), pages }; }` }], shot: true },
    { id: "skip", note: "흘림 중 확인키 한 번", ops: [
      { kind: "teleport", mapId: MAP, x: Number(kx), y: Number(ky) }, { kind: "face", dir: kdir }, { kind: "action" },
      { kind: "evalToFile", out: `${OUT}/2-skip.json`, fn: `async () => { ${common}
      if (!await waitBox()) return { box: false }; await sleep(150); const before = text().length; press("Enter"); await sleep(40); const after = text().length;
      const s = await stable(); const r = { before, afterOnePress: after, full: s.len, shownRatio: s.len ? +(after / s.len).toFixed(2) : null, boxStillOpen: !!box(), sample: text().slice(0, 30) };
      let presses = 0; while (box() && presses < 40) { press("Enter"); presses += 1; await sleep(400); } return r; }` }] },
  ],
};
