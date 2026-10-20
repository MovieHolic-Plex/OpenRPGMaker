// 스파이크 2: 동반 서비스 워커(/agent/run)를 거쳐 local-cli:claude 실행 — 편집기가 쓰는 같은 NDJSON 경로.
//   bun scripts/spike/claude-cli-worker-path.mts   (워커를 띄우고 읽기 전용 질문 한 턴을 보낸다)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHeadlessBlankProject } from "../../src/headless/index.ts";

const out = path.resolve("verify-shots/assistant-claude-p");
fs.mkdirSync(out, { recursive: true });
const worker = spawn("bun", ["scripts/oh-my-pi-worker.ts"], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, OPRN_OH_MY_PI_WORKER_PORT: "0" } });
const port = await new Promise<number>((resolve) => worker.stdout!.on("data", (b: Buffer) => { const m = /READY (\d+)/.exec(String(b)); if (m) resolve(Number(m[1])); }));
const project = createHeadlessBlankProject();
const response = await fetch(`http://127.0.0.1:${port}/agent/run`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ request: { provider: "local-cli:claude", model: "sonnet", readOnly: true, mapIds: [project.startMapId], currentMapId: project.startMapId,
    task: "이 프로젝트의 시작 맵 이름·크기·칩셋을 도구로 확인해서 한 줄로 알려줘. 아무것도 바꾸지 마.", project } }),
});
const lines: string[] = [];
const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === "done") { event.project = `<project ${Object.keys(event.project.maps).length} maps>`; }
    const text = JSON.stringify(event);
    lines.push(text.length > 600 ? text.slice(0, 600) + "…" : text);
    if (event.type !== "heartbeat") console.log(text.slice(0, 200));
  }
}
fs.writeFileSync(path.join(out, "worker-path.ndjson"), lines.join("\n").split(process.env.HOME ?? "/home/x").join("~") + "\n");
worker.kill();
