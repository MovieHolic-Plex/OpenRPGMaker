import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import type { SessionRegistry } from "../main/sessions";

/** 구독자가 있는 동안만 저장 행 리비전을 읽는 간격. 메타 한 줄 읽기라 싸다(문서 본문은 읽지 않는다). */
const WATCH_INTERVAL_MS = 250;
/** 프록시가 조용한 연결을 끊지 않게 보내는 주석 줄 간격. */
const KEEPALIVE_MS = 20_000;

/**
 * 프로젝트 폴더마다 저장 리비전이 바뀌면 열린 편집기 탭에 `revision` 이벤트를 민다(SSE).
 *
 * 누가 썼는지 묻지 않고 저장 행을 본다 — 코딩 에이전트의 브리지 저장, 다른 탭, 같은 폴더를 연 다른 프로세스의
 * 저장이 모두 같은 길로 알린다. 편집기는 이벤트를 받으면 바로 `team.status` 를 다시 묻고 `refreshFromHost` 로
 * 반영한다(src/editor/teamSession.ts). 3초 폴링은 그대로 두어 이벤트가 끊겨도 늦게라도 반영된다.
 */
export function createProjectEventHub(sessions: SessionRegistry) {
  type Watch = { readonly key: string; readonly clients: Set<ServerResponse>; revision: number; timer: ReturnType<typeof setInterval> };
  const watches = new Map<string, Watch>();

  const send = (response: ServerResponse, revision: number): void => {
    response.write(`event: revision\ndata: ${JSON.stringify({ revision })}\n\n`);
  };

  const stop = (projectDir: string): void => {
    const watch = watches.get(projectDir);
    if (!watch) return;
    clearInterval(watch.timer);
    watches.delete(projectDir);
    sessions.close(watch.key);
  };

  return {
    async subscribe(response: ServerResponse, projectDir: string): Promise<void> {
      let watch = watches.get(projectDir);
      if (!watch) {
        const key = `events:${randomUUID()}`;
        const session = await sessions.open(key, projectDir);
        const created: Watch = {
          key,
          clients: new Set(),
          revision: session.store.info().revision,
          timer: setInterval(() => {
            const revision = session.store.info().revision;
            if (revision === created.revision) return;
            created.revision = revision;
            for (const client of created.clients) send(client, revision);
          }, WATCH_INTERVAL_MS),
        };
        created.timer.unref();
        watches.set(projectDir, created);
        watch = created;
      }
      const current = watch;
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      send(response, current.revision);
      current.clients.add(response);
      const keepalive = setInterval(() => response.write(": keepalive\n\n"), KEEPALIVE_MS);
      keepalive.unref();
      response.on("close", () => {
        clearInterval(keepalive);
        current.clients.delete(response);
        if (current.clients.size === 0) stop(projectDir);
      });
    },
    close(): void {
      for (const [projectDir, watch] of [...watches]) {
        for (const client of watch.clients) client.end();
        stop(projectDir);
      }
    },
  };
}
