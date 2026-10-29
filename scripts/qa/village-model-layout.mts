// 코드 지형 그림 + 요약 → 실제 모델이 마을 자리(layout)를 고른다. 결과 layouts.json(village-code-terrain-probe.mts --layouts 입력).
import fs from "node:fs";
const R = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const { villageArgs, villageMapSize, villageLayoutGuide } = await import(`${R}/src/ai/v2/builders/village.ts`);
const { codeTerrainFor } = await import(`${R}/src/editor/tools/authorBeodeulTown.ts`);
const { describeCodeTerrain } = await import(`${R}/src/editor/tools/beodeulTerrainGen.ts`);
const { terrainPreviewPng } = await import(`${R}/src/editor/tools/beodeulTerrainPreview.ts`);
const src = fs.readFileSync(`${R}/scripts/qa/village-code-terrain-probe.mts`, "utf8");
const CASES = eval(src.slice(src.indexOf("const CASES: any[] = ") + 21, src.indexOf("];", src.indexOf("const CASES")) + 1));
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const MODEL = arg("model", "gpt-6.1-terra"), OUT = arg("out", "/tmp/vh/ml"), salt = Number(arg("salt", "0"));
const only = arg("only", "").split(",").filter(Boolean).map(Number);
fs.mkdirSync(OUT, { recursive: true });
const eps = JSON.parse(fs.readFileSync(`${process.env.HOME}/.oprn-suite/openai-compat-endpoints.json`, "utf8"));
const list: any[] = Object.values(eps.endpoints ?? eps);
const ep = list.find((e) => (e.allowModels ?? []).includes(MODEL));
const out: Record<number, any> = fs.existsSync(`${OUT}/layouts.json`) ? JSON.parse(fs.readFileSync(`${OUT}/layouts.json`, "utf8")) : {};
await Promise.all(CASES.filter((c: any) => !only.length || only.includes(c.n)).map(async (c: any) => {
  const spec = { type: "village", ...c.spec };
  const va: any = { ...villageArgs(spec as any).args, ...(c.landform ? { landform: c.landform } : {}), ...(c.settle ? { settle: c.settle } : {}) };
  const [width, height] = villageMapSize(spec as any, va);
  const terrainSeed = c.seed + salt;
  const t = codeTerrainFor(String(va.theme ?? "river"), va, width, height, terrainSeed);
  const png = terrainPreviewPng(t, 8); fs.writeFileSync(`${OUT}/${c.n}-terrain.png`, png);
  const sys = "너는 RPG 마을 배치를 정하는 조수다. 땅은 코드가 만들었다. 그림(좌표 눈금: 위 x·왼쪽 y, 칸 단위, 단 번호가 클수록 높다, 검은 선=단 경계 절벽, 파랑=물, 흰 점=강 건널 자리)과 요약을 보고 마을 자리를 고른다.";
  const user = `요청: 「${c.ask}」 (마을 이름 ${c.spec.name}, ${width}×${height}).\n`
    + "hints.layout 을 JSON 하나로만 답한다(설명 없이): {\"gather\":{\"x\":..,\"y\":..,\"plaza\":true|false},\"landmark\":{x,y},\"anchor\":{x,y},\"work\":{x,y},\"houses\":[{x,y}...3~12],\"fields\":[{x,y}...],\"forests\":[{x,y}...],\"pastures\":[{x,y}...],\"exits\":[\"west\"|\"east\"|\"north\"|\"south\"]}.\n"
    + villageLayoutGuide(String(va.theme ?? "river"), va.fishing === true, va.form === "scatter") + " 요청 성격에 맞게 고르되 그림의 땅을 살려라.\n"
    + `요약: ${JSON.stringify(describeCodeTerrain(t))}`;
  const body = { model: MODEL, messages: [{ role: "system", content: sys }, { role: "user", content: [{ type: "text", text: user }, { type: "image_url", image_url: { url: `data:image/png;base64,${Buffer.from(png).toString("base64")}` } }] }], temperature: 0.7 };
  for (let tries = 0; tries < 3; tries += 1) {
    try {
      const r = await fetch(`${ep.baseUrl}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${ep.apiKey}`, ...(ep.headers ?? {}) }, body: JSON.stringify(body) });
      const j: any = await r.json(); const txt: string = j.choices?.[0]?.message?.content ?? "";
      const m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error(`no json: ${txt.slice(0, 200)} ${JSON.stringify(j).slice(0, 200)}`);
      const layout = JSON.parse(m[0]);
      out[c.n] = { layout: layout.layout ?? layout, terrainSeed, width, height, model: MODEL };
      fs.writeFileSync(`${OUT}/${c.n}-answer.txt`, txt);
      console.log(c.n, "ok", JSON.stringify(out[c.n].layout).slice(0, 200)); return;
    } catch (e) { console.log(c.n, "retry", String(e).slice(0, 200)); }
  }
}));
fs.writeFileSync(`${OUT}/layouts.json`, JSON.stringify(out, null, 1));
