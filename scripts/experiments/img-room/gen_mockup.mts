// img-room-test: one room mockup from the image model, given the chipset part sheet(s).
//   bun scripts/experiments/img-room/gen_mockup.mts <boss|inn> <refs dir> <out.png>
// Prints one JSON line {ms, model, provider, bytes}. QA_IMAGE_PROVIDER=codex for GPT Image when Google returns 429.
import { readFileSync, writeFileSync } from "node:fs";
import { headlessGenerateImage } from "../../qa-game/lib/headlessImage.mts";

const [task, refs, out] = process.argv.slice(2);
if (!task || !refs || !out) throw Error("gen_mockup.mts <boss|inn> <refs dir> <out.png>");
const png = (f: string) => ({ mimeType: "image/png" as const, data: readFileSync(`${refs}/${f}`).toString("base64") });
const COMMON = "Style: 16px-per-tile SNES-era JRPG map, 3/4 top-down view (you see the top face of furniture and the front face of walls), orthographic, crisp pixel art, no perspective, no isometric angle. " +
  "Show the WHOLE room as one map screenshot seen from above, with dark void outside the walls. No people, no characters, no monsters, no text, no labels, no UI, no grid lines. " +
  "The attached image is only a PALETTE of the chipset pieces (floors, walls, furniture) — build the room out of those pieces with the same colours, pixel style and 16px proportions, and do not invent other furniture. " +
  "Never reproduce the palette sheet itself, never put the loose pieces in rows beside the room, never write any words or labels anywhere in the picture. The output is the finished room only.";
const PROMPTS: Record<string, { prompt: string; refs: string[] }> = {
  boss: {
    refs: ["boss-palette.png"],
    prompt: "Design a mockup of a dungeon BOSS ROOM deep under a demon lord's castle. " + COMMON +
      " Layout: not a plain rectangle. An entrance corridor from the south opens into an antechamber with side alcoves (a few sarcophagi, an armor stand, candelabras), " +
      "then a portcullis gate leads to the main throne hall: a long royal red carpet runner up the middle, pillars on both sides, purple braziers, and at the far north end a raised dais with the demon lord's throne as the landmark. " +
      "One small side room off the hall holds treasure. Floors: dark demon-realm stone. Walls: demon wall front faces with carved bands. Roughly 30x24 tiles.",
  },
  inn: {
    refs: ["inn-palette.png"],
    prompt: "Design a mockup of the GROUND FLOOR OF A SMALL VILLAGE INN: a reception counter that greets guests and a dining area where people eat. " + COMMON +
      " Layout: not a plain rectangle — an L-shaped or two-part room. Entrance door on the south wall with a doormat. Near the entrance the inn reception counter with a room key board and an inn sign on the wall behind it. " +
      "The main dining hall has several dining tables with chairs around them and benches, a fireplace on the north wall as the landmark with a rug in front, a wooden staircase up to the guest rooms in one corner, " +
      "and a small kitchen alcove behind a counter (kitchen range, sink, barrels, crates). Plank floor, plaster or log walls with windows and pictures. Roughly 22x16 tiles.",
  },
};
// 칩셋에 묶인 목업(3단계): 실제 조각 시트(이름 = 조각 id, 16px 격자, 2배)만 주고, 그 조각만으로 16px 격자에 짜게 한다.
if (process.env.MOCKUP_BOUND === "1") {
  const ids = readFileSync(`${refs}/${task}-pieces.txt`, "utf8").trim().split("\n");
  const room = task === "boss"
    ? "a dungeon BOSS ROOM deep under a demon lord's castle: an entrance from the south, an antechamber with side alcoves (crypt pieces), then the main throne hall with a long carpet runner up the middle, columns on both sides, braziers, and at the far north end the throne as the landmark; one small side room with treasure. Roughly 30x24 cells."
    : "the GROUND FLOOR OF A SMALL VILLAGE INN: entrance door on the south wall with a doormat, the inn reception counter with the room key board and inn sign near the entrance, a dining hall with several dining tables, chairs and benches, a fireplace on the north wall as the landmark, a wooden staircase up in one corner, and a small kitchen alcove behind a counter. Not a plain rectangle (L-shaped or two-part). Roughly 22x16 cells.";
  const fb = process.env.MOCKUP_FEEDBACK ? ` A previous attempt drew things that are NOT in the sheet: ${process.env.MOCKUP_FEEDBACK}. Do not draw those again.` : "";
  PROMPTS[task] = { refs: [`${task}-pieces.png`], prompt:
    `Design a mockup of ${room} ` +
    "Style: 16px-per-tile SNES-era JRPG map, 3/4 top-down view, orthographic, crisp pixel art, whole room on a dark void, no people, no text, no labels, no UI, no grid lines in the output. " +
    "HARD RULE: the attached sheet is the COMPLETE chipset. Every floor, wall and object in your picture must be one of these labelled pieces, copied at its exact size on a 16px grid (each grid square in the sheet is one 16px cell), with the same colours. " +
    "Do not invent any material, furniture, decoration or effect that is not on the sheet — no extra statues, no flames, lava, water, plants, rugs, lights or props unless that exact piece is on the sheet. Floors and walls only from the floor:/wall: swatches. Plain doorways/doors in walls are fine (the builder adds them). " +
    `Allowed piece ids: ${ids.join(", ")}. Never reproduce the sheet itself or put loose pieces beside the room.${fb}` };
}
if (process.env.MOCKUP_FREE === "1") {
  // 조건 O: 자유 목업 — 칩셋 판은 화풍·크기 기준일 뿐, 방에 필요한 물건은 칩셋에 없어도 같은 화풍으로 그린다(없는 물건은 object-gen 이 만든다).
  const room = task === "boss"
    ? "a dungeon BOSS ROOM deep under a demon lord's castle: an entrance from the south, an antechamber with side alcoves, then the main throne hall with a long carpet runner up the middle, columns on both sides, fire braziers, dramatic hazards or relics, and at the far north end the demon lord's throne as the landmark; one small side room with treasure. Roughly 30x24 cells."
    : "the GROUND FLOOR OF A SMALL VILLAGE INN: entrance door on the south wall, the inn reception counter with a room-key board near the entrance, a dining hall with several dining tables, chairs and benches, a fireplace on the north wall as the landmark, a wooden staircase up in one corner, a small kitchen alcove behind a counter, and the cosy clutter a real inn has. Not a plain rectangle (L-shaped or two-part). Roughly 22x16 cells.";
  PROMPTS[task] = { refs: [`${task}-pieces.png`], prompt:
    `Design a mockup of ${room} ` +
    "Style: 16px-per-tile SNES-era JRPG map, 3/4 top-down view (tops of objects visible, short front faces, no side faces), orthographic, crisp pixel art, whole room on a dark void, no people, no text, no labels, no UI, no grid lines in the output. " +
    "The attached labelled sheet shows this game's chipset: use its floors, walls and pieces wherever they fit, at their exact size on the 16px grid and in the same colours. " +
    "You are free to imagine: draw any other furniture, relics or set pieces this room needs to feel rich and specific, in exactly the same pixel style, palette, outline and scale (a chair is one cell, a person would be 1x2 cells). Keep every object grid-aligned and clearly separated so each can be redrawn as a chipset piece. " +
    "Never reproduce the sheet itself or put loose pieces beside the room." };
}
const p = PROMPTS[task];
if (!p) throw Error(`unknown task ${task}`);
const t0 = Date.now();
if (process.env.MOCKUP_PROVIDER === "gpt") {
  // GPT Image: god-tibo-imagen 과 같은 Codex /responses 호출(scripts/lib/codexImageRuntime.ts 와 같은 요청)을 직접 해서
  // 응답이 밝힌 모델(response.model · tools[].model · image_generation_call)을 그대로 남긴다 — 앱 경로는 설정 이름만 돌려준다.
  const { buildResponsesRequest, extractImageGeneration, loadCodexSession, parseSseText, resolveConfig } = await import("god-tibo-imagen");
  const config = resolveConfig(); const s = await loadCodexSession(config);
  if (!s?.accessToken) throw Error("codex login 없음");
  const req = buildResponsesRequest({ baseUrl: config.baseUrl, session: { accessToken: s.accessToken, accountId: s.accountId, installationId: s.installationId }, prompt: p.prompt,
    model: config.defaultModel, originator: config.defaultOriginator, images: p.refs.map((f) => `data:image/png;base64,${png(f).data}`), size: "auto", imageModel: config.defaultImageModel });
  const r = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(300_000) });
  const text = await r.text();
  if (!r.ok) throw Error(`codex HTTP ${r.status}`);
  const parsed = parseSseText(text);
  const b64 = extractImageGeneration(parsed).resultBase64;
  const done = (parsed.events as any[]).find((e) => e?.data?.type === "response.completed")?.data?.response ?? {};
  const call = (parsed.items as any[]).find((i) => i?.type === "image_generation_call") ?? {};
  const buf = Buffer.from(b64, "base64"); writeFileSync(out, buf);
  console.log(JSON.stringify({ ms: Date.now() - t0, model: (done.tools ?? []).find((t: any) => t.type === "image_generation")?.model ?? "?", provider: "openai-codex (god-tibo-imagen /responses)",
    requested: { model: config.defaultModel, imageModel: config.defaultImageModel }, responseModel: done.model, imageCall: { size: call.size, quality: call.quality, revised_prompt: call.revised_prompt },
    imageTokens: done.tool_usage?.image_gen, bytes: buf.length, prompt: p.prompt }));
  process.exit(0);
}
const img = await headlessGenerateImage({ prompt: p.prompt, referenceImages: p.refs.map(png) });
const buf = Buffer.from(img.dataUrl.slice(img.dataUrl.indexOf(",") + 1), "base64");
writeFileSync(out, buf);
console.log(JSON.stringify({ ms: Date.now() - t0, model: img.model, provider: img.provider, bytes: buf.length, prompt: p.prompt }));
process.exit(0);
