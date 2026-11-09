#!/usr/bin/env node
// Cheap vision observer (oc/deepseek-v4.1-flash-free, effort high) over the frames the deterministic stage
// selected. The DOM text of the same moment is given as ground truth so pixel-font misreads are caught at source.
//
// usage: node vm/observe.mjs --frames <observe-frames.json> --run <runDir> --out <observations.jsonl> [--pool 16]
// env:   OC_JSON=/root/vqa-sinkiru/oc-exempt.json (baseUrl, apiKey). This is OUR key (omo provider `oc`,
//        sha256 prefix 0e4b4369), not the shared /root/vqa-sinkiru/oc.json that hits the daily cap. The file is mode 600;
//        the key never reaches this log, the run directory or any error string.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { extractJson, ocClient, pool, usageLedger } from "../lib/models.mjs";

const { values } = parseArgs({
  options: {
    frames: { type: "string" },
    run: { type: "string" },
    out: { type: "string" },
    pool: { type: "string", default: "16" },
    model: { type: "string", default: "deepseek-v4.1-flash-free" },
    // deepseek-v4.1-flash-free allows 32k output. At 16k the reply was truncated mid-answer on most frames
    // (measured 2026-11-07: 12 of 22 capped and unparsable), which silently dropped half the VQA track.
    "max-tokens": { type: "string", default: "24000" },
    // effort max spent the whole budget on reasoning: in the 1.39 run 234 of 1443 replies stopped at the 16k cap and
    // 270 retries at the old 8k cap, so the JSON never arrived (360 of 812 frames unparsable). high leaves room for it.
    effort: { type: "string", default: "high" },
  },
});
const KEY_FILE = process.env.OC_JSON ?? "/root/vqa-sinkiru/oc-exempt.json";
const oc = JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
const mode = fs.statSync(KEY_FILE).mode & 0o777;
if (mode & 0o077) throw new Error(`${KEY_FILE} must not be readable by group/other (mode ${mode.toString(8)})`);
const keyId = oc.keyId ?? "unknown";
const log = usageLedger(path.join(values.run, "usage.jsonl"));
const chat = ocClient({ baseUrl: oc.baseUrl, apiKey: oc.apiKey, model: values.model, effort: values.effort, log, stage: "observe" });
console.log(JSON.stringify({ stage: "observe", keyFile: KEY_FILE, keyId, mode: mode.toString(8), base: oc.baseUrl }));
const frames = JSON.parse(fs.readFileSync(values.frames, "utf8"));
const done = new Set(fs.existsSync(values.out) ? fs.readFileSync(values.out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).key) : []);
const todo = frames.filter((f) => !done.has(`${f.jobId}/${f.seq}`));

export const CHECKS = {
  C01: "글자 잘림(상자·창 경계에서 문장/라벨이 잘림)",
  C02: "UI 창이 잘못 겹침",
  C03: "캐릭터·물체 층 순서 오류(지붕 위로 걷기 등)",
  C04: "그림이 없거나 반쯤 그려진 캐릭터·물체·초상",
  C05: "대사와 화면 상황 모순",
  C08: "검은/빈 영역이 화면을 가림(맵에 구멍, 빈 타일 덩어리)",
  C09: "HUD·버튼이 화면 밖으로 나가거나 어긋남",
  C10: "깨진 글자·외계어·뜻 없는 문자열",
  C13: "전투 HUD 오류(HP 바·수치·이름 불일치)",
  C14: "메뉴·목록 잘림/스크롤 오류",
  C15: "캐릭터가 벽·물 위·맵 밖에 있음",
  C16: "컷신 구도(초상이 인물을 가림, 대사창이 주인공을 가림)",
};
const SYS = "너는 게임 화면 QA 관찰자다. 이미지와 함께 주어진 'DOM 글자'는 그 순간 화면에 실제로 출력된 글자다. 화면의 글자를 인용할 때는 반드시 DOM 글자와 대조하고, DOM 글자와 다르게 읽었다면 그것은 너의 오독이니 보고하지 마라. 도트 그림체, 의도된 어두운 연출, 비활성 회색 항목, 화면 가장자리 여백은 결함이 아니다. 확실히 보이는 결함만 보고한다.\n\n**도구를 부르지 마라.** 어떤 명령도 실행하지 않고, <tool_call>·<invoke>·<function_call>·마크다운 코드블록·설명문을 쓰지 않는다. 너의 답은 JSON 객체 하나뿐이며, 그 앞뒤에 다른 글자를 붙이지 않는다.";
// Why: deepseek-v4.1-flash-free sometimes answers with a tool-call envelope instead of the JSON, which reads as an
// unparsable observation and silently drops that frame from the VQA track (measured 2026-11-07: 244 of 400).
const SYS_RETRY = "출력은 JSON 객체 하나다. 도구 호출·XML 태그·코드블록·설명 금지. 첫 글자는 { 이고 마지막 글자는 } 다.";

async function small(file) {
  return sharp(file).resize({ width: 960, withoutEnlargement: true }).jpeg({ quality: 76 }).toBuffer();
}

async function observe(f) {
  const file = path.join(values.run, "jobs", f.jobId, "shots", f.file);
  const img = await small(file);
  const st = f.state ?? {};
  const prompt = [
    `게임: ${f.game} · 화면: ${st.screen} · 맵: ${st.mapId ?? "-"} · 입력: ${f.input} · 뷰포트: ${f.viewport}`,
    `직전 입력: ${(f.inputs ?? []).slice(-5).join(" > ") || "-"}`,
    `DOM 글자(정답): ${(f.domText ?? "").slice(0, 900) || "(없음)"}`,
    `점검 항목: ${Object.entries(CHECKS).map(([k, v]) => `${k} ${v}`).join(" / ")}`,
    '형식: {"issues":[{"check":"C01","where":"화면 위치","desc":"무엇이 어떻게 잘못됐는지(근거)","quote":"관련 화면 글자 그대로 또는 빈칸","confidence":0.0-1.0}]} 결함이 없으면 {"issues":[]}',
  ].join("\n");
  const messages = [{ role: "system", content: SYS }, { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${img.toString("base64")}` } }] }];
  let res = await chat(messages, { maxTokens: Number(values["max-tokens"]) });
  let parsed = res.ok ? extractJson(res.text, ["issues"]) : null;
  if (res.ok && !parsed) {
    // Retry with the hard no-tools system message: the usual failure is a tool-call envelope or prose before the JSON.
    res = await chat([{ role: "system", content: SYS_RETRY }, ...messages.slice(1), { role: "user", content: "위 프레임을 다시 판정해 JSON 하나만 출력해." }], { maxTokens: Number(values["max-tokens"]) });
    parsed = res.ok ? extractJson(res.text, ["issues"]) : null;
  }
  return { key: `${f.jobId}/${f.seq}`, ok: !!parsed, error: res.ok ? (parsed ? null : "unparsed") : res.error, issues: (parsed?.issues ?? []).filter((i) => CHECKS[i.check]).slice(0, 4) };
}

const t0 = Date.now();
console.log(JSON.stringify({ stage: "observe", frames: frames.length, todo: todo.length, pool: Number(values.pool) }));
let n = 0;
await pool(todo, Number(values.pool), async (f) => {
  const row = await observe(f).catch((e) => ({ key: `${f.jobId}/${f.seq}`, ok: false, error: String(e).slice(0, 200), issues: [] }));
  fs.appendFileSync(values.out, JSON.stringify(row) + "\n");
  n += 1;
  if (n % 25 === 0) console.log(JSON.stringify({ stage: "observe", n, of: todo.length, sec: Math.round((Date.now() - t0) / 1000) }));
});
console.log("OBSERVE DONE " + JSON.stringify({ n, sec: Math.round((Date.now() - t0) / 1000) }));
