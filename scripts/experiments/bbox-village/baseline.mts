// bbox-village baseline = the current v2 way: the model sees the code-terrain preview + summary (Korean, as in production village-model-layout.mts),
// answers hints.layout (gather/landmark/houses/fields/...), and author_beodeul_town places, snaps, routes and decorates by itself.
//   bun scripts/experiments/bbox-village/baseline.mts <port|hill> <sol|terra> <out dir>
import fs from "node:fs";
const R = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const { villageArgs, villageMapSize, villageLayoutGuide } = await import(`${R}/src/ai/v2/builders/village.ts`);
const { codeTerrainFor } = await import(`${R}/src/editor/tools/authorBeodeulTown.ts`);
const { describeCodeTerrain } = await import(`${R}/src/editor/tools/beodeulTerrainGen.ts`);
const { terrainPreviewPng } = await import(`${R}/src/editor/tools/beodeulTerrainPreview.ts`);
const { runTool } = await import(`${R}/src/editor/tools/index.ts`);
const { ensureBundledTilesets } = await import(`${R}/src/project/defaults/defaultAssets.ts`);
const { createBlankProject } = await import(`${R}/src/project/defaults.ts`);
const { renderMapPng } = await import(`${R}/scripts/qa-game/render.mts`);
const [brief, arm, OUT] = process.argv.slice(2);
const MODEL = arm === "sol" ? "gpt-6.1-sol" : "gpt-6.1-terra";
fs.mkdirSync(OUT!, { recursive: true });
const B = JSON.parse(fs.readFileSync(`${R}/scripts/experiments/bbox-village/briefs.json`, "utf8"))[brief!];
const spec = { type: "village", ...B.spec };
const va: any = { ...villageArgs(spec as any).args, ...(B.landform ? { landform: B.landform } : {}) };
const [width, height] = villageMapSize(spec as any, va);
const t = codeTerrainFor(String(va.theme ?? "river"), va, width, height, B.seed);
const png = terrainPreviewPng(t, 8);
const sys = "너는 RPG 마을 배치를 정하는 조수다. 땅은 코드가 만들었다. 그림(좌표 눈금: 위 x·왼쪽 y, 칸 단위, 단 번호가 클수록 높다, 검은 선=단 경계 절벽, 파랑=물, 흰 점=강 건널 자리)과 요약을 보고 마을 자리를 고른다.";
const user = `요청: 「${B.ko}」 (마을 이름 ${B.spec.name}, ${width}×${height}).\n`
  + "hints.layout 을 JSON 하나로만 답한다(설명 없이): {\"gather\":{\"x\":..,\"y\":..,\"plaza\":true|false},\"landmark\":{x,y},\"anchor\":{x,y},\"work\":{x,y},\"houses\":[{x,y,kind:\"small\"|\"medium\"|\"large\"}...3~12],\"fields\":[{x,y}...],\"orchards\":[{x,y}...],\"pastures\":[{x,y}...],\"forests\":[{x,y}...],\"props\":[{x,y}...],\"exits\":[\"west\"|\"east\"|\"north\"|\"south\"]}.\n"
  + villageLayoutGuide(String(va.theme ?? "river"), va.fishing === true, va.form === "scatter") + " 요청 성격에 맞게 고르되 그림의 땅을 살려라.\n"
  + `요약: ${JSON.stringify(describeCodeTerrain(t))}`;
const body = { model: MODEL, reasoning_effort: "high", messages: [{ role: "system", content: sys }, { role: "user", content: [{ type: "text", text: user }, { type: "image_url", image_url: { url: `data:image/png;base64,${Buffer.from(png).toString("base64")}` } }] }] };
const t0 = Date.now();
let layout: any = null, txt = "";
for (let tries = 0; tries < 3 && !layout; tries += 1) {
  try {
    const r = await fetch("http://127.0.0.1:10200/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(1200000) });
    const j: any = await r.json(); txt = j.choices?.[0]?.message?.content ?? "";
    const m = txt.match(/\{[\s\S]*\}/); if (m) { const o = JSON.parse(m[0]); layout = o.layout ?? o; }
  } catch (e) { console.log("retry", String(e).slice(0, 200)); }
}
const secs = Math.round((Date.now() - t0) / 100) / 10;
fs.writeFileSync(`${OUT}/answer.txt`, txt);
const base = createBlankProject() as any; ensureBundledTilesets(base);
const ctx = { project: base };
const args: any = { ...va, seed: B.seed, id: `base-${brief}`, name: B.spec.name, layout, terrainSeed: B.seed, width, height };
const r = runTool(ctx as any, "author_beodeul_town", args);
const res: any = { brief, arm, model: MODEL, secs, ok: r.ok, summary: String(r.summary).slice(0, 400) };
if (r.ok) {
  const d = r.data as any; const map = ctx.project.maps[d.mapId]!;
  fs.writeFileSync(`${OUT}/map.png`, renderMapPng(ctx.project, map).png);
  const same = Array.from(t.levels).every((v: number, i: number) => true) && map.width === width;
  res.houses = d.houses; res.layoutReport = d.layout && { moved: d.layout.moved, failed: d.layout.failed, roadsFailed: d.layout.roadsFailed }; res.size = `${map.width}x${map.height}`; res.sameSize = same;
}
fs.writeFileSync(`${OUT}/RUN.json`, JSON.stringify({ ...res, layout }, null, 1));
console.log(JSON.stringify(res).slice(0, 500));
