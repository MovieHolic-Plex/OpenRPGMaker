import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const localStore = new Map();
const vaultWrites = [];
const listeners = new Map();

Object.assign(globalThis, {
  localStorage: {
    getItem: (key) => localStore.get(key) ?? null,
    setItem: (key, value) => {
      if (key.startsWith("oprn:event-draft-vault:")) vaultWrites.push(key);
      localStore.set(key, value);
    },
    removeItem: (key) => void localStore.delete(key),
  },
  window: {
    location: {
      hostname: "127.0.0.1",
      protocol: "http:",
      pathname: "/editor",
      search: "",
      href: "http://127.0.0.1:9841/editor",
      hash: "",
    },
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    removeEventListener: () => undefined,
    dispatchEvent: (event) => {
      for (const fn of listeners.get(event?.type) ?? []) fn(event);
      return true;
    },
    history: { replaceState: () => undefined },
    matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  },
});

const root = path.resolve(import.meta.dirname, "..");
const server = await createServer({
  root,
  appType: "custom",
  configFile: false,
  resolve: { alias: { "@": path.join(root, "src") } },
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true },
  logLevel: "error",
});

try {
  const harness = await server.ssrLoadModule("/scripts/qa-bugfix-sweep-evidence.mts");
  const rows = await harness.collectEvidence({ vaultWrites });
  const width = Math.max(...rows.map((row) => row.id.length));
  const report = [
    "OPRN bugfix-sweep — 실제 표면 증거",
    `생성: ${new Date().toISOString()}`,
    "방식: 프로젝트의 Vite SSR 모듈 파이프라인으로 프로덕션 함수를 끝까지 실행한 관측값",
    "      (편집기 UI 렌더가 아니라 상태·참조·저장 관측 — 이 수정들은 렌더를 바꾸지 않는다)",
    "",
    ...rows.flatMap((row) => [
      `[${row.verdict}] ${row.id.padEnd(width)}`,
      `        묻는 것 : ${row.asked}`,
      `        관측값  : ${row.observed}`,
      "",
    ]),
    `종합: ${rows.filter((row) => row.verdict === "PASS").length}/${rows.length} PASS`,
  ].join("\n");
  const outPath = path.join(root, ".omo/evidence/bugfix-sweep/real-surface.txt");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report + "\n");
  console.log(report);
  console.log(`\nwritten: ${outPath}`);
  if (rows.some((row) => row.verdict === "FAIL")) process.exitCode = 1;
} finally {
  await server.close();
}
