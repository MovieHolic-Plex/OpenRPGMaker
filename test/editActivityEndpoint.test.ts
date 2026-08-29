import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EDIT_ACTIVITY_DISK_ENDPOINT } from "@/editor/editActivityEndpoint";

// 왜 파일을 문자열로 읽어 정규식으로 보는가 (선례: test/aiActivityLogEndpoint.test.ts):
// `vite.config.ts` 는 vitest 프로세스에서 import 할 수 없고(플러그인이 dev 서버 부팅을 끌고 온다),
// 경로 상수는 순환 import 를 피하려고 **값만 복제**돼 있다. 즉 타입 검사가 이 드리프트를 못 본다.
// 그리고 404 는 fetch 가 throw 하지 않는다 — 클라이언트는 첫 실패에 미러를 스스로 끄므로
// 경로가 어긋나면 로그가 조용히 0줄이 된다(2026-08-28 AI 미러 실측). 이 테스트가 유일한 방어선이다.
describe("edit activity disk mirror endpoint", () => {
  const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/editor/editActivityLog.ts", import.meta.url), "utf8");
  const cli = readFileSync(new URL("../scripts/list-edit-activity.mjs", import.meta.url), "utf8");
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    scripts?: Record<string, string>;
  };

  it("vite 미들웨어가 클라이언트와 같은 경로를 매칭한다", () => {
    expect(viteConfig).toContain(`const EDIT_ACTIVITY_DISK_ENDPOINT = "${EDIT_ACTIVITY_DISK_ENDPOINT}"`);
    expect(viteConfig).toContain("req.url?.startsWith(EDIT_ACTIVITY_DISK_ENDPOINT)");
    expect(EDIT_ACTIVITY_DISK_ENDPOINT).toBe("/__oprn/edit-activity");
  });

  it("AI 미러 경로와 겹치지 않는다", () => {
    // 같은 파일에 append 하면 `npm run ai:log` 가 읽는 AI 턴 기록이 편집 노이즈에 묻힌다.
    expect(EDIT_ACTIVITY_DISK_ENDPOINT).not.toBe("/__oprn/ai-activity");
    expect(viteConfig).toContain('join(process.cwd(), "output", "edit-activity")');
    expect(viteConfig).toContain('join(process.cwd(), "output", "ai-activity")');
  });

  it("클라이언트는 경로 문자열을 다시 적지 않고 상수를 쓴다", () => {
    expect(client).toContain("fetch(EDIT_ACTIVITY_DISK_ENDPOINT");
    expect(client).not.toMatch(/fetch\(\s*"\/__/);
  });

  it("dev 와 preview 양쪽에 붙는다", () => {
    // configureServer 만 있으면 `vite preview` 경로의 미러가 404 로 조용히 죽는다(AI 미러 실측).
    const plugin = viteConfig.slice(viteConfig.indexOf("function editActivityDiskPlugin"));
    expect(plugin).toContain("configureServer(server)");
    expect(plugin).toContain("configurePreviewServer(server)");
    expect(plugin).toContain("attachEditMirror(server)");
    expect(viteConfig).toMatch(/plugins:\s*\[[^\]]*editActivityDiskPlugin\(\)/);
  });

  it("배치 본문을 읽고 고정 파일명만 쓴다", () => {
    const plugin = viteConfig.slice(viteConfig.indexOf("function editActivityDiskPlugin"));
    // 클라이언트가 보내는 모양: { entries: EditActivityEntry[] }
    expect(client).toContain("JSON.stringify({ entries: batch })");
    expect(plugin).toContain("body.entries");
    // 경로 탈출 방어: 파일명에 클라이언트 값을 끼우지 않는다(템플릿 파일명 금지).
    expect(plugin).toContain('join(dir, "edits.jsonl")');
    expect(plugin).toContain('join(dir, "latest.json")');
    expect(plugin).toContain('join(dir, "index.json")');
    expect(plugin).not.toMatch(/join\(dir, `/);
  });

  it("CORS·OPTIONS·GET·본문 상한을 갖춘다", () => {
    const plugin = viteConfig.slice(viteConfig.indexOf("function editActivityDiskPlugin"));
    expect(plugin).toContain("devCorsOrigin(req)");
    expect(plugin).toContain("res.statusCode = 204");
    expect(plugin).toContain("res.statusCode = 413");
    expect(plugin).toContain('req.url.includes("list")');
    expect(viteConfig).toContain("const EDIT_ACTIVITY_MAX_BODY_BYTES");
  });

  it("CLI 리더가 미들웨어와 같은 디렉터리·파일명을 읽는다", () => {
    expect(cli).toContain('join(process.cwd(), "output", "edit-activity")');
    expect(cli).toContain('join(DIR, "index.json")');
    expect(cli).toContain('join(DIR, "edits.jsonl")');
    expect(packageJson.scripts?.["edit:log"]).toBe("node scripts/list-edit-activity.mjs");
  });
});
