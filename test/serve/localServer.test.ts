import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { initLocalProjectStore } from "../../electron/local-store/store";
import { OPRN_CHANNELS } from "../../electron/shared/channels";
import { startLocalProjectServer, type LocalProjectServer } from "../../electron/serve/runtime";

const BRIDGE_SOURCE = "/* browser bridge placeholder */";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

let projectDir: string;
let distDir: string;
let server: LocalProjectServer;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "oprn-serve-project-"));
  distDir = await mkdtemp(join(tmpdir(), "oprn-serve-dist-"));
  await writeFile(
    join(distDir, "index.html"),
    "<!doctype html><html><head><title>OPRN Studio</title></head><body><div id=\"app\"></div></body></html>",
  );
  await writeFile(join(distDir, "asset.txt"), "hello asset");
  const store = await initLocalProjectStore({ projectDir });
  await store.saveProject(projectWithoutEventDrafts(createScarloxyDemoProject()));
  store.close();
  server = await startLocalProjectServer({ projectDir, distDir, browserBridgeSource: BRIDGE_SOURCE });
});

afterEach(async () => {
  await server.close();
  await rm(projectDir, { force: true, recursive: true });
  await rm(distDir, { force: true, recursive: true });
});

async function bridge(channel: string, payload?: unknown, token: string | null = server.token): Promise<Response> {
  return await fetch(`${server.url}/__oprn/bridge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token === null ? {} : { "x-oprn-bridge-token": token }),
    },
    body: JSON.stringify({ channel, payload }),
  });
}

describe("로컬 서버가 브라우저에 로컬 정본을 연다", () => {
  it("index.html 에 브리지 설정과 스크립트를 주입하고 브리지 원문을 준다", async () => {
    const html = await (await fetch(`${server.url}/`)).text();

    expect(html).toContain(`window.__OPRN_BRIDGE__={"endpoint":"/__oprn/bridge","token":"${server.token}","companionToken":"`);
    expect(html).toContain('<script src="/__oprn/bridge.js"></script>');
    expect(html).toContain('<div id="app">');

    const script = await fetch(`${server.url}/__oprn/bridge.js`);
    expect(await script.text()).toBe(BRIDGE_SOURCE);
  });

  it("퍼센트 인코딩된 정적 경로를 디코드해 서빙한다 — 번들 BGM 「Town 1.mid」", async () => {
    // 2026-09-23 도그푸딩: `/assets/easyrpg/music/Town%201.mid` 가 디코드 없이 디스크를 찾아 404 였다.
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(distDir, "music"));
    await writeFile(join(distDir, "music", "Town 1.mid"), "MThd");
    const response = await fetch(`${server.url}/music/Town%201.mid`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/midi");
    expect(await response.text()).toBe("MThd");
    // 디코드 뒤에도 탈출·숨김 경로 방어는 그대로다.
    expect((await fetch(`${server.url}/%2e%2e%2fetc%2fpasswd`)).status).toBeGreaterThanOrEqual(400);
    expect((await fetch(`${server.url}/%2eenv`)).status).toBe(403);
    expect((await fetch(`${server.url}/%E0%A4%A`)).status).toBe(400);
  });

  it("내보내기 SDK HTML의 해시 대상 바이트를 바꾸지 않는다", async () => {
    const html = '<!doctype html><head><script>window.player=true</script></head><body>player</body>';
    await mkdir(join(distDir, "export-player"));
    await writeFile(join(distDir, "export-player", "player.html"), html);
    const response = await fetch(`${server.url}/export-player/player.html`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe(html);
  });

  it("토큰이 없으면 브리지 호출을 거절한다", async () => {
    const response = await bridge(OPRN_CHANNELS.projectStatus, undefined, null);

    expect(response.status).toBe(403);
  });

  it("동반 서비스(AI)도 실행별 토큰을 요구한다 — 페이지 출처라도 예외가 아니다", async () => {
    const denied = await fetch(`${server.url}/auth/status?provider=google-antigravity`);
    expect(denied.status).toBe(403);

    const allowed = await fetch(`${server.url}/auth/status?provider=google-antigravity`, {
      headers: { "x-oprn-companion-token": server.companionToken },
    });
    // 제공자가 없어 핸들러 자체는 실패해도 된다 — 403 만 아니면 잠금을 통과한 것이다.
    expect(allowed.status).not.toBe(403);
  });

  it("정적 파일 경로 탈출을 막는다", async () => {
    const response = await fetch(`${server.url}/../package.json`);

    expect([403, 404]).toContain(response.status);
  });

  it("status 가 열린 폴더를 알려 주고 load 가 정본 문서를 준다", async () => {
    const status = await (await bridge(OPRN_CHANNELS.projectStatus)).json();
    expect(status).toMatchObject({ kind: "ready", projectDir: server.projectDir });
    expect(status.projectId).toMatch(/^[0-9a-f-]{36}$/);

    const loaded = await (await bridge(OPRN_CHANNELS.projectLoad, { projectDir })).json();
    expect(loaded.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(loaded.serialized).meta.title).toBe(createScarloxyDemoProject().meta.title);
  });

  it("저장이 폴더의 SQLite 정본에 그대로 반영된다 — 별도 커넥션으로 확인", async () => {
    const loaded = await (await bridge(OPRN_CHANNELS.projectLoad, { projectDir })).json();
    const edited = JSON.parse(loaded.serialized) as { meta: { title: string } };
    edited.meta.title = "브라우저가 바꾼 제목";

    const saved = await (
      await bridge(OPRN_CHANNELS.projectSave, { projectDir, serialized: JSON.stringify(edited), expectedSha: loaded.sha256 })
    ).json();
    expect(saved.kind).toBe("saved");

    const foreign = new DatabaseSync(join(projectDir, "project.sqlite"));
    try {
      const row = foreign.prepare("SELECT title FROM project WHERE id = 1").get() as { title?: string } | undefined;
      expect(row?.title).toBe("브라우저가 바꾼 제목");
    } finally {
      foreign.close();
    }
  });

  it("자산은 base64 로 건너가고 다시 바이트로 돌아온다", async () => {
    const put = await (
      await bridge(OPRN_CHANNELS.assetsPut, {
        projectDir,
        mime: "image/png",
        extension: "png",
        kind: "sprite",
        bytes: Buffer.from(PNG_BYTES).toString("base64"),
      })
    ).json();
    expect(put.ref.sha256).toMatch(/^[0-9a-f]{64}$/);

    const read = await (await bridge(OPRN_CHANNELS.assetsRead, { projectDir, sha256: put.ref.sha256 })).json();
    expect(new Uint8Array(Buffer.from(read, "base64"))).toEqual(PNG_BYTES);
  });

  it("다른 폴더를 요구해도 고정된 폴더만 연다", async () => {
    const other = await mkdtemp(join(tmpdir(), "oprn-serve-other-"));
    try {
      const opened = await (await bridge(OPRN_CHANNELS.projectOpen, { projectDir: other })).json();

      expect(opened.projectDir ?? server.projectDir).toBe(server.projectDir);
    } finally {
      await rm(other, { force: true, recursive: true });
    }
  });

  it("백업을 HTTP 로 만들 수 있다", async () => {
    const backup = await (await bridge(OPRN_CHANNELS.projectBackup, { projectDir })).json();

    expect(String(backup)).toContain("backups");
  });

  it("동반 서비스 경로가 로컬 서버에도 붙는다 — 정적 404 로 떨어지지 않는다", async () => {
    const status = await fetch(`${server.url}/auth/status`);

    expect(status.status).not.toBe(404);
    expect(status.headers.get("content-type")).toContain("application/json");
  });

  it("모르는 채널은 400 이다", async () => {
    const response = await bridge("oprn:없는채널", {});

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("알 수 없는 채널");
  });

  it("내용 주소 자산을 HTTP 로 서빙한다 — 브라우저가 맵 타일을 그릴 수 있는 경로", async () => {
    const put = await (
      await bridge(OPRN_CHANNELS.assetsPut, {
        projectDir,
        mime: "image/png",
        extension: "png",
        kind: "sprite",
        bytes: Buffer.from(PNG_BYTES).toString("base64"),
      })
    ).json();

    const served = await fetch(`${server.url}/__oprn/asset/${put.ref.sha256}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG_BYTES);

    const missing = await fetch(`${server.url}/__oprn/asset/${"f".repeat(64)}`);
    expect(missing.status).toBe(404);
  });
});

describe("일렉트론과 같은 어댑터 계약을 쓴다", () => {
  it("직렬화 텍스트를 그대로 저장해 sha 가 유지된다", async () => {
    const loaded = await (await bridge(OPRN_CHANNELS.projectLoad, { projectDir })).json();
    const roundTripped = await (
      await bridge(OPRN_CHANNELS.projectSave, { projectDir, serialized: loaded.serialized, expectedSha: loaded.sha256 })
    ).json();

    expect(roundTripped.kind).toBe("saved");
    const reloaded = await (await bridge(OPRN_CHANNELS.projectLoad, { projectDir })).json();
    expect(reloaded.serialized).toBe(loaded.serialized);
  });
});
