// #2586-1: run the real playAudio/stopAudio bridge bodies from playSceneBattle.ts with recording audio helpers.
import { readFileSync } from "node:fs";
const source = readFileSync("src/player/playSceneBattle.ts", "utf8");
const start = source.search(/\n\s+playAudio: \(/);
const end = source.indexOf("\n    });", start);
if (start < 0 || end < 0) throw new Error("bridge not found");
const calls = [];
const session = { audio: { bgm: { resourceId: "field-bgm", loop: true } } };
// Same semantics as src/project/session.ts setAudioState/clearAudioState (copied so the probe needs no bundler).
const setAudioState = (s, st) => { const ch = st.channel ?? (st.loop ? "bgm" : "se"); s.audio[ch] = { resourceId: st.resourceId, loop: st.loop, ...(st.volume === undefined ? {} : { volume: st.volume }), ...(st.fadeInMs === undefined ? {} : { fadeInMs: st.fadeInMs }) }; };
const clearAudioState = (s, ch) => { if (ch === undefined) { s.audio = {}; return; } s.audio[ch] = undefined; };
const bridge = Function("current", "project", "session", "playAudioCommand", "stopAudioCommand", "stopAudioChannel", "setAudioState", "clearAudioState",
  `return ({${source.slice(start, end)}})`)(
  () => true, {}, session,
  (step) => calls.push({ fn: "playAudioCommand", step }),
  () => calls.push({ fn: "stopAudioCommand -> engine.stopAll(true)" }),
  (channel) => calls.push({ fn: "stopAudioChannel", channel }),
  setAudioState, clearAudioState);
const bgs = { kind: "playAudio", resourceId: "rain-bgs", loop: true, channel: "bgs", volume: 25, fadeInMs: 500 };
bridge.playAudio(bgs.resourceId, bgs.loop, bgs);
console.log("play BGS  ->", JSON.stringify(calls.at(-1)), "| session.audio =", JSON.stringify(session.audio));
const se = { kind: "playAudio", resourceId: "hit-se", loop: false, channel: "se", volume: 10 };
bridge.playAudio(se.resourceId, se.loop, se);
console.log("play SE   ->", JSON.stringify(calls.at(-1)), "| session.audio =", JSON.stringify(session.audio));
bridge.stopAudio("bgs");
console.log("stop bgs  ->", JSON.stringify(calls.at(-1)), "| session.audio =", JSON.stringify(session.audio));
bridge.stopAudio();
console.log("stop all  ->", JSON.stringify(calls.at(-1)), "| session.audio =", JSON.stringify(session.audio));
