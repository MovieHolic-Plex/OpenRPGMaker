// serve — 사람이 컨셉을 받기/버리기로 고르는 화면. 판정은 현재 그림 해시에 묶는다(그림이 바뀌면 다시 고른다).
// 감독 에이전트는 이 화면을 대신 누르지 않는다.
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, resolve } from "node:path";
import { currentImageSha, imagePath, listCandidates, paths, readCheck, readDecisions, writeDecision, type Verdict } from "./data";

const PAGE = resolve("src/harnesses/game-concepts/web/index.html");

function state() {
  const decisions = readDecisions();
  return listCandidates().flatMap((concept) => {
    const imageSha = currentImageSha(concept.slug);
    if (!imageSha) return [];
    const decision = decisions[concept.slug];
    const checked = readCheck(concept.slug);
    return [{
      concept,
      imageSha,
      decision: decision && decision.imageSha === imageSha ? decision.verdict : null,
      check: checked && checked.imageSha === imageSha ? { ok: checked.ok, findings: checked.findings } : null,
    }];
  });
}

export async function serve(argv: string[]): Promise<number> {
  const port = argv.includes("--port") ? Number(argv[argv.indexOf("--port") + 1]) : 18321;
  const host = argv.includes("--host") ? argv[argv.indexOf("--host") + 1]! : "0.0.0.0";
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://local");
    const send = (status: number, body: string, type = "application/json; charset=utf-8") => {
      res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
      res.end(body);
    };
    try {
      if (req.method === "GET" && url.pathname === "/") return send(200, readFileSync(PAGE, "utf8"), "text/html; charset=utf-8");
      if (req.method === "GET" && url.pathname === "/api/state") return send(200, JSON.stringify({ items: state() }));
      if (req.method === "GET" && url.pathname.startsWith("/img/")) {
        const file = basename(decodeURIComponent(url.pathname.slice(5)));
        const match = /^([a-z0-9-]+)\.(full|card)\.webp$/.exec(file);
        const path = match ? imagePath(match[1]!, match[2] as "full" | "card") : "";
        if (!path || !existsSync(path)) return send(404, "{}");
        res.writeHead(200, { "content-type": "image/webp", "cache-control": "no-store" });
        createReadStream(path).pipe(res);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/decide") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; if (body.length > 10_000) req.destroy(); });
        req.on("end", () => {
          try {
            const input = JSON.parse(body) as { slug?: string; verdict?: Verdict; imageSha?: string };
            if (!input.slug || (input.verdict !== "accept" && input.verdict !== "reject") || !input.imageSha) return send(400, JSON.stringify({ error: "slug·verdict·imageSha 가 필요합니다." }));
            const current = currentImageSha(input.slug);
            if (!current) return send(404, JSON.stringify({ error: "그림이 없습니다." }));
            if (current !== input.imageSha) return send(409, JSON.stringify({ error: "그림이 바뀌었습니다. 새로고침 후 다시 골라 주세요.", imageSha: current }));
            send(200, JSON.stringify(writeDecision(input.slug, input.verdict, current)));
          } catch (error) {
            send(400, JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
        });
        return;
      }
      send(404, "{}");
    } catch (error) {
      send(500, JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
  await new Promise<void>((done) => server.listen(port, host, done));
  console.log(`[serve] 컨셉 고르기 화면 http://mdc-server:${port}/  (데이터 ${paths.decisions})`);
  await new Promise(() => { /* 계속 띄워 둔다 — Ctrl+C 로 끈다. */ });
  return 0;
}
