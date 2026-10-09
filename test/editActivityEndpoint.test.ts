import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EDIT_ACTIVITY_DISK_ENDPOINT } from "@/editor/editActivityEndpoint";

// 왜 파일을 문자열로 읽어 정규식으로 보는가 (선례: test/aiActivityLogEndpoint.test.ts):
// 경로 상수는 순환 import 를 피하려고 **값만 복제**돼 있다 — 타입 검사가 드리프트를 못 본다.
// 그리고 404 는 fetch 가 throw 하지 않는다. 클라이언트는 첫 실패에 미러를 스스로 끄므로 경로가
// 어긋나면 로그가 조용히 0줄이 된다(2026-08-28 AI 미러 실측). 이 테스트가 방어선이다.
//
// 2026-09-16 (I3): 본체가 `vite.config.ts` 플러그인에서 `scripts/lib/activityMirror.mjs` 로
// 나왔다. 이제 앱·로컬 서버·vite 가 같은 파일을 쓰므로 계약도 **공용 본체**를 본다 —
// 껍데기 셋이 각자 미들웨어를 들고 있던 동안에는 이 계약이 vite 하나만 지켜봤다.
describe("edit activity disk mirror endpoint", () => {
  const core = readFileSync(new URL("../scripts/lib/activityMirror.mjs", import.meta.url), "utf8");
  const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/editor/editActivityLog.ts", import.meta.url), "utf8");
  const cli = readFileSync(new URL("../scripts/list-edit-activity.mjs", import.meta.url), "utf8");
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    scripts?: Record<string, string>;
  };

  it("공용 본체가 클라이언트와 같은 경로를 매칭한다", () => {
    expect(core).toContain(`export const EDIT_ACTIVITY_DISK_ENDPOINT = "${EDIT_ACTIVITY_DISK_ENDPOINT}"`);
    expect(core).toContain("pathname?.startsWith(EDIT_ACTIVITY_DISK_ENDPOINT)");
    expect(EDIT_ACTIVITY_DISK_ENDPOINT).toBe("/__oprn/edit-activity");
  });

  it("세 껍데기가 모두 같은 본체를 쓴다", () => {
    // 한 껍데기라도 빠지면 그 껍데기에서 로그가 조용히 0줄이 된다 — 이 증분의 존재 이유다.
    const vite = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
    const serve = readFileSync(new URL("../electron/serve/runtime.ts", import.meta.url), "utf8");
    for (const shell of [vite, serve]) {
      expect(shell).toContain("createActivityMirrorMiddleware");
    }
    // 앱은 app:// 프로토콜 핸들러가 페이지 출처 요청을 받는다(클라이언트는 상대 경로로 fetch 한다).
    const protocols = readFileSync(new URL("../electron/main/protocols.ts", import.meta.url), "utf8");
    expect(protocols).toContain("handleActivityMirror");
  });

  it("AI 미러 경로와 겹치지 않는다", () => {
    // 같은 파일에 append 하면 `npm run ai:log` 가 읽는 AI 턴 기록이 편집 노이즈에 묻힌다.
    expect(EDIT_ACTIVITY_DISK_ENDPOINT).not.toBe("/__oprn/ai-activity");
    expect(core).toContain('"output", kind === "ai" ? "ai-activity" : "edit-activity"');
  });

  it("클라이언트는 경로 문자열을 다시 적지 않고 상수를 쓴다", () => {
    expect(client).toContain("fetch(EDIT_ACTIVITY_DISK_ENDPOINT");
    expect(client).not.toMatch(/fetch\(\s*"\/__/);
  });

  it("dev 와 preview 양쪽에 붙는다", () => {
    // configureServer 만 있으면 `vite preview` 경로의 미러가 404 로 조용히 죽는다(AI 미러 실측).
    const plugin = viteConfig.slice(viteConfig.indexOf("function activityMirrorPlugin"));
    expect(plugin).toContain("configureServer(server)");
    expect(plugin).toContain("configurePreviewServer(server)");
    expect(plugin).toContain("server.middlewares.use(middleware)");
    expect(viteConfig).toMatch(/plugins:\s*\[[^\]]*activityMirrorPlugin\(\)/);
  });

  it("배치 본문을 읽고 고정 파일명만 쓴다", () => {
    // 클라이언트가 보내는 모양: { entries: EditActivityEntry[] }
    expect(client).toContain("JSON.stringify({ entries: batch })");
    expect(core).toContain("body.entries");
    // 경로 탈출 방어: **편집** 파일명에 클라이언트 값을 끼우지 않는다(템플릿 파일명 금지).
    // AI 분기는 `record.id` 를 파일명에 쓰므로 SAFE_ACTIVITY_ID_PATTERN 으로 막는다(아래 테스트).
    const editWriter = core.slice(core.indexOf("function writeEditActivity"));
    expect(editWriter).toContain('join(dir, "edits.jsonl")');
    expect(editWriter).toContain('join(dir, "latest.json")');
    expect(editWriter).toContain('join(dir, "index.json")');
    expect(editWriter).not.toMatch(/join\(dir, `/);
  });

  it("빈 배치를 400 으로 끊지 않는다", () => {
    // 400 을 주면 클라이언트가 미러를 영구히 끈다 — 조용한 유실의 시작점이다.
    expect(core).toContain("if (entries.length === 0) return 204");
  });

  it("CORS·OPTIONS·GET·본문 상한을 갖춘다", () => {
    const middleware = readFileSync(
      new URL("../scripts/lib/activityMirrorMiddleware.mjs", import.meta.url),
      "utf8",
    );
    expect(middleware).toContain("corsOrigin(req)");
    expect(middleware).toContain("access-control-allow-methods");
    expect(core).toContain("method not allowed");
    expect(core).toContain("payload too large");
    expect(core).toContain('url.includes("list")');
    expect(core).toContain("const EDIT_ACTIVITY_MAX_BODY_BYTES");
  });

  it("CLI 리더가 미들웨어와 같은 디렉터리·파일명을 읽는다", () => {
    // CLI 는 cwd 기준 개발 편의 도구다(앱·로컬 서버는 연 프로젝트 폴더 기준).
    expect(cli).toContain('join(process.cwd(), "output", "edit-activity")');
    expect(cli).toContain('join(DIR, "index.json")');
    expect(cli).toContain('join(DIR, "edits.jsonl")');
    expect(packageJson.scripts?.["edit:log"]).toBe("node scripts/list-edit-activity.mjs");
  });
});
