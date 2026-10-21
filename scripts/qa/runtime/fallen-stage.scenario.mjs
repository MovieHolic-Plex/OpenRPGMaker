// 폴른 스타 장면 배치 탐침 — fallen-audit 를 그대로 돌리며 동료 둘 이상이 함께 선 대사 비트마다
// 주인공·동료·이벤트 칸을 /tmp/fs-stage/<비트>.json 에 남긴다(겹침 판정용). 가혹 검수 r8 major(같은 칸에 겹쳐 선 장면) 확인.
import audit from "./fallen-audit.scenario.mjs";
const fn = `() => { const s = window.__oprnDebug.readState(); const c = window.__oprnCharacterSprites(); return { map: s.currentMapId, x: s.x, y: s.y, facing: s.facing, followers: c.followers, events: c.events, player: c.player }; }`;
const want = new Set(["proclamation", "hanel-ask", "bram", "iris-wakes", "iris-key", "iris-joined", "back-to-hub", "plaza-after", "hanel-hint", "hatch", "tablet", "brazier-wrong", "save-crystal", "valen-enters", "valen", "battle-end", "signal", "report"]);
export default { ...audit, id: "fallen-stage", beats: audit.beats.map((b) => want.has(b.id) ? { ...b, ops: [...b.ops, { kind: "evalToFile", fn, out: `/tmp/fs-stage/${b.id}.json` }] } : b) };
