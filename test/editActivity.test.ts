import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { EDIT_ACTIVITY_DISK_ENDPOINT } from "@/editor/editActivityEndpoint";
import { _resetEditActivityForTest, editActivityEntryCount, getEditActivityEntries, recordEditActivity, unlabeledEditActivityCount } from "@/editor/editActivityLog";
import { describeEventDiff, shortEventPath } from "@/editor/eventDiffLabel";
import { editorState } from "@/editor/editorState";
import { beginExistingEventDraft, createEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { setEventPageTextCommand, updateEventPage } from "@/editor/eventPages";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import { isolateTimers } from "./mergedTeardown";

describe("editActivityEndpoint", () => {
  isolateTimers();
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
});

// 편집 행위 기록 회귀 테스트.
//
// 2026-08-29 관측성 감사에서 라이브 프로브로 재현한 증상을 정식화한다. 당시 결과:
//   1. NPC 생성 → 기록 0건   2. 이름 변경 → 0건   3. 커맨드 추가 → 0건
//   4. 조건 변경 → 0건       5. 적용 → 1건, 라벨 "이벤트 편집", 어떤 NPC 인지 없음
// 이 테스트는 각 단계가 기록되고, 적용 기록이 **어떤 NPC의 어떤 필드**인지 담는 것을 고정한다.
describe("editActivityRecording", () => {
  isolateTimers();
  beforeEach(() => {
    _resetEventDraftVaultForTest();
    store.replaceProject(createBlankProject());
    editorState.set({ selectedEventId: null, selectedEventPageId: null });
    _resetEditActivityForTest();
  });
  function labels(): readonly string[] {
    return getEditActivityEntries().map((entry) => entry.label ?? "(라벨 없음)");
  }
  describe("store mutation 초크포인트", () => {
    it("모든 mutation 메서드가 행위를 기록한다", () => {
      const mapId = store.getCurrent().startMapId;

      store.update((project) => {
        project.meta.title = "제목 변경";
      }, { scope: "project", label: "제목 변경" });
      store.updateMap(mapId, (map) => {
        map.lowerTiles[0] = 5;
      }, { label: "타일 편집", cells: [{ x: 0, y: 0, layer: "lower" }] });

      const entries = getEditActivityEntries();
      expect(entries.map((entry) => entry.label)).toEqual(["타일 편집", "제목 변경"]);
      // updateMap 은 맵 스코프 + 셀 수를 남긴다 — 어느 맵의 몇 칸인지 알 수 있어야 한다.
      const tileEntry = entries[0]!;
      expect(tileEntry.scope).toBe("map");
      expect(tileEntry.mapId).toBe(mapId);
      expect(tileEntry.cellCount).toBe(1);
    });

    it("라벨 없는 mutation 을 별도로 집계한다", () => {
      store.update((project) => {
        project.meta.title = "라벨 없음";
      });
      expect(unlabeledEditActivityCount()).toBe(1);
      expect(getEditActivityEntries()[0]?.label).toBeNull();
    });

    it("database 스코프는 컬렉션 이름을 남긴다", () => {
      store.update((project) => {
        project.database.items = [];
      }, { scope: "database", collection: "items", label: "아이템 초기화" });
      const entry = getEditActivityEntries()[0]!;
      expect(entry.scope).toBe("database");
      expect(entry.collection).toBe("items");
    });
  });
  describe("NPC 편집 세션 (원래 증상 재현 시나리오)", () => {
    it("생성·이름변경·커맨드추가·적용이 각각 기록되고 적용 기록이 필드 경로를 담는다", () => {
      const mapId = store.getCurrent().startMapId;

      // 1. NPC 생성
      const eventId = createEventDraft(mapId, 4, 5);
      expect(eventId).not.toBe("");
      expect(editActivityEntryCount()).toBeGreaterThan(0);
      expect(labels()[0]).toContain("이벤트 생성");

      // 드래프트를 적용해 기존 이벤트로 만든다(이후 단계가 "수정" 이 되게).
      saveEventDraft(mapId, eventId);
      _resetEditActivityForTest();

      // 2. 편집 시작 → 3. 이름 변경 → 4. 커맨드 추가
      expect(beginExistingEventDraft(mapId, eventId)).toBe(true);
      const pageId = store.getCurrent().maps[mapId]!.events.find((e) => e.id === eventId)!.pages![0]!.id;
      updateEventPage(mapId, eventId, pageId, { name: "촌장" });
      setEventPageTextCommand(mapId, eventId, pageId, undefined, "안녕하세요");

      // 편집 중 단계들도 기록에 남아야 한다 — 예전에는 여기까지 0건이었다.
      const midSession = editActivityEntryCount();
      expect(midSession).toBeGreaterThan(1);

      // 5. 적용
      const diff = saveEventDraft(mapId, eventId);
      expect(diff).not.toBeNull();

      const applied = getEditActivityEntries().find((entry) => entry.label?.startsWith("이벤트 편집:"));
      expect(applied, "적용 기록이 있어야 한다").toBeDefined();
      // 핵심: 어떤 NPC 인지 라벨에 있어야 한다.
      expect(applied!.label).toContain("촌장");
      expect(applied!.eventId).toBe(eventId);
      // 핵심: 어느 필드가 바뀌었는지 경로가 남아야 한다.
      const paths = (applied!.fields ?? []).map((field) => field.path);
      expect(paths.some((path) => path.includes("name"))).toBe(true);
      expect(paths.some((path) => path.includes("commands"))).toBe(true);
    });

    it("편집 취소도 기록에 남는다", () => {
      const mapId = store.getCurrent().startMapId;
      const eventId = createEventDraft(mapId, 6, 6);
      saveEventDraft(mapId, eventId);
      beginExistingEventDraft(mapId, eventId);
      _resetEditActivityForTest();

      discardEventDraft(mapId, eventId);
      expect(labels().some((label) => label.includes("이벤트 편집 취소"))).toBe(true);
    });
  });
  describe("연속 편집 병합", () => {
    it("같은 라벨의 연속 맵 편집을 한 엔트리로 합치고 셀 수를 누적한다", () => {
      const mapId = store.getCurrent().startMapId;
      for (let x = 0; x < 12; x += 1) {
        store.updateMap(mapId, (map) => {
          map.lowerTiles[x] = 7;
        }, { label: "타일 편집", cells: [{ x, y: 0, layer: "lower" }] });
      }
      const entries = getEditActivityEntries({ scope: "map" });
      // 드래그 12칸이 12줄이 되면 로그가 스트로크 노이즈로 덮인다.
      expect(entries).toHaveLength(1);
      expect(entries[0]!.cellCount).toBe(12);
      expect(entries[0]!.mergedCount).toBe(12);
    });

    it("필드 상세가 붙은 엔트리는 병합하지 않는다", () => {
      recordEditActivity({ scope: "map", mapId: "m", label: "이벤트 편집", generation: 1, fields: [{ path: "a" }] });
      recordEditActivity({ scope: "map", mapId: "m", label: "이벤트 편집", generation: 2, fields: [{ path: "b" }] });
      expect(getEditActivityEntries()).toHaveLength(2);
    });
  });
  describe("EventDiff 라벨", () => {
    it("경로를 커맨드/페이지 단위까지 줄인다", () => {
      expect(shortEventPath("event.pages[0].commands[2].body.text")).toBe("pages[0].commands[2]");
      expect(shortEventPath("event.pages[0].name")).toBe("pages[0].name");
      expect(shortEventPath("event")).toBe("전체");
    });

    it("생성/수정을 구분하고 이름을 담는다", () => {
      expect(describeEventDiff({ mapId: "m", eventId: "e", kind: "created", changes: [] }, "촌장")).toBe("이벤트 생성: 촌장");
      const updated = describeEventDiff(
        {
          mapId: "m",
          eventId: "e",
          kind: "updated",
          changes: [
            { path: "event.pages[0].name", before: "페이지 1", after: "촌장" },
            { path: "event.pages[0].commands[0]", before: undefined, after: {} },
          ],
        },
        "촌장",
      );
      expect(updated).toContain("촌장");
      expect(updated).toContain("pages[0].name");
    });

    it("diff 가 없으면 일반 라벨로 떨어진다", () => {
      expect(describeEventDiff(null)).toBe("이벤트 편집");
    });
  });
});
