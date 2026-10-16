// 로컬 모의 서버: /chat(의도 라우팅·감사) + /run(Pi 에이전트 NDJSON). 모델 호출 없음.
import { createServer } from "node:http";
import { gunzipSync } from "node:zlib";
export const PORT = Number(process.env.AIUI_MOCK_PORT ?? 39871);
export const log = [];
const heavyCache = new Map();
const wait = (ms) => new Promise(r => setTimeout(r, ms));
export function startMock(scenarios = {}) {
  const server = createServer((req, res) => {
    const chunks = []; req.on("data", c => chunks.push(c)); req.on("end", async () => {
      let raw = Buffer.concat(chunks); if (req.headers["content-encoding"] === "gzip") { try { raw = gunzipSync(raw); } catch {} } const body = raw.toString("utf8");
      const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"POST, OPTIONS"};
      if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
      let j = {}; try { j = JSON.parse(body); } catch {}
      if (req.url.startsWith("/chat")) {
        if (scenarios.chatDelay) await wait(scenarios.chatDelay);
        const msgs = JSON.stringify(j.messages ?? "");
        if (/You turn ONE short Korean map-editing sentence/.test(j.messages?.[0]?.content ?? "")) {
          if (scenarios.stampDelay) await wait(scenarios.stampDelay);
          let tgt = { x: 1, y: 1, w: 3, h: 3 }; try { tgt = JSON.parse(j.messages[1].content).target; } catch {}
          log.push({ kind: "stamp", target: tgt });
          const content = JSON.stringify({ steps: [{ tool: "fill_region", args: { rect: { x: tgt.x, y: tgt.y, w: tgt.w, h: tgt.h }, material: "버들항 모랫길" }, label: "모랫길 깔기" }] });
          res.writeHead(200, {...cors, "Content-Type":"application/json"});
          res.end(JSON.stringify({id:"x",object:"chat.completion",choices:[{index:0,finish_reason:"stop",message:{role:"assistant",content}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));
          return;
        }
        const isAudit = /coverage|커버리지|requirements/i.test((j.messages?.[0]?.content ?? "").slice(0, 600)) && !/"mode"/.test((j.messages?.[0]?.content ?? "").slice(0, 300));
        const userText = (() => { try { const u = j.messages.at(-1).content; const m = /"userText"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(u); return m ? JSON.parse('"' + m[1] + '"') : ""; } catch { return ""; } })();
        log.push({ kind: "chat", userText, audit: isAudit });
        let content;
        const mode = scenarios.modeFor?.(userText) ?? "modify";
        if (isAudit) content = JSON.stringify({ requirements: [{ text: userText, criteria: [] }], clarifies: [] });
        else content = JSON.stringify({ mode, space: scenarios.space ?? "none", tools: [], needsPlan: !!scenarios.needsPlan, clarify: null, clarifyOptions: [] });
        res.writeHead(200, {...cors, "Content-Type":"application/json"});
        res.end(JSON.stringify({id:"x",object:"chat.completion",choices:[{index:0,finish_reason:"stop",message:{role:"assistant",content}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));
        return;
      }
      // /run — heavy-wire: 호스트 캐시 흉내(해시→내용). 모르는 해시는 409 heavy-missing.
      if (j.heavyBlobs) for (const [h, t] of Object.entries(j.heavyBlobs)) heavyCache.set(h, t);
      if (j.heavy) {
        const missing = Object.values(j.heavy).filter(h => !heavyCache.has(h));
        if (missing.length) { res.writeHead(409, {...cors, "Content-Type":"application/json"}); res.end(JSON.stringify({ error: "heavy-missing", missing })); return; }
        const rebuilt = { ...j.project };
        for (const [k, h] of Object.entries(j.heavy)) rebuilt[k] = JSON.parse(heavyCache.get(h));
        j.project = rebuilt;
      }
      const task = (j.task ?? "").toString();
      log.push({ kind: "run", task: task.slice(0, 80), mapIds: j.mapIds, keys: Object.keys(j) });
      res.writeHead(200, {...cors, "Access-Control-Expose-Headers":"X-Oprn-Run-Id", "X-Oprn-Run-Id": j.runId ?? "", "Content-Type":"application/x-ndjson", "Cache-Control":"no-cache"});
      const send = (e) => { if (!res.destroyed) res.write(JSON.stringify(e) + "\n"); };
      await (scenarios.run ?? (async () => {}))({ j, send, wait, res, req, task });
    });
  });
  return new Promise(r => server.listen(PORT, "127.0.0.1", () => r(server)));
}
export async function routeMock(page) {
  const cj = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
  await page.route(/\/auth\/status/, r => r.fulfill({ status: 200, headers: cj, json: { connected: true, authKind: "oauth", expired: false, env: false } }));
  await page.route(/\/auth\/providers/, r => r.fulfill({ status: 200, headers: cj, json: { providers: [{ id: "google", label: "Google", authKind: "oauth", defaultModel: "gemini-4-argon", hasLogin: true, hasRefresh: true }] } }));
  await page.route(/\/v1\/agent\/run/, r => r.continue({ url: `http://127.0.0.1:${PORT}/run` }));
  await page.route(/\/v1\/chat\/completions/, r => r.continue({ url: `http://127.0.0.1:${PORT}/chat` }));
}
// 지도에 칸을 칠하는 변경(모의 결과)
export function patchCells(map, n, tile) {
  const cells = []; const lower = [...map.lowerTiles];
  const x0 = Math.floor(map.width * 0.45), y0 = Math.floor(map.height * 0.4);
  for (let k = 0; k < n; k++) { const i = (y0 + Math.floor(k / 3)) * map.width + x0 + (k % 3); if (lower[i] !== tile) { lower[i] = tile; cells.push({ i, t: tile }); } }
  return { lower, cells };
}
export function pickOtherTile(map) {
  const counts = new Map(); for (const t of map.lowerTiles) if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  const base = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
  return base === 100 ? 101 : 100;
}
