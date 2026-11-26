// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { playInn } from "@/player/playSceneCommerce";
import { itemToGoods } from "@/player/playSceneShopGoods";
import { formationDetail } from "@/player/playerFormationDetail";
import { updatePlayerPreferences } from "@/player/playerPreferences";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { recoveryPreview } from "@/player/shopPartyFit";
import { createBlankProject } from "@/project/defaults";
import { equipmentSlots } from "@/project/equipmentSlots";
import { deserialize, serialize } from "@/project/io";
import { listPartyBondEntries } from "@/project/partyBonds";
import { startSession, type PlaySession } from "@/project/session";
import { store } from "@/project/store";
import { closeGalleryViewer, openGalleryViewer, stepGalleryViewer } from "@/player/galleryViewer";
import { hostExitReturnUrl, isSafeReturnUrl, mountHostFullscreenToggle, parseHostBridge, parseHostFeatures, type HostBridge } from "@/player/hostBridge";
import { createLifeLedgerDetail } from "@/player/lifeLedger";
import { createLifePlacementLiveReader, readLifePlacementLiveContext, type LifePlacementSceneSource, placementBlockedByRenderedBodies } from "@/player/lifePlacementScene";
import { adjacentSpatialPosition, type SpatialLiveActor, type SpatialLiveContextReader } from "@/project/spatialOccupancy";
import { resolvePlayerBody } from "@/project/playerFootprint";
import { event, page } from "./runtimeEventPageFixtures";
import type { Project, Dir, SpatialFootprint, Command } from "@/project/types";
import type { StatusMenuDetail } from "@/player/playerStatusMenuDetailTypes";
import { createPlayerStatusMenuController } from "@/player/playerStatusMenuController";
import type { PlayScene } from "@/player/PlayScene";
import { showNumberInput } from "@/player/dialogueNumberInput";
import { createObjectiveCard, readingMs, syncObjectiveCard } from "@/player/objectiveCard";
import { isolateTimers } from "./mergedTeardown";
import { runCommands } from "@/player/playSceneInterpreter";
import { applyNonBlockingStep, updateParallelEvents } from "@/player/playSceneSchedulers";
import { openEventMenu } from "@/player/playerEventMenus";

describe("playerSuite3", () => {
  isolateTimers();
  // 2026-11-14 폴른 스타 QA 에서 고친 작은 엔진 결함들 — 플레이어가 읽는 글과 미리보기가 다시 어긋나지 않게 묶어 둔다.
  describe("fallenStarQaMinorFixes", () => {
    isolateTimers();
    function innScene(gold: number): PlaySceneContext {
      store.replace(deserialize(serialize(createBlankProject())));
      const project = store.getCurrent();
      const host = document.createElement("div");
      document.body.append(host);
      const session = startSession(project, 1);
      session.gold = gold;
      return {
        session,
        map: project.maps[project.startMapId],
        tileX: 0,
        tileY: 0,
        game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
        syncRuntimeState() {},
        time: { delayedCall() { return { remove() {} }; } },
      } as unknown as PlaySceneContext;
    }
    afterEach(() => {
      document.body.replaceChildren();
      updatePlayerPreferences({ reduceMenuMotion: false });
    });
    describe("여관 요약(minor 15)", () => {
      it("돈이 모자라면 가진 돈과 모자란 돈을 적는다 — 「10 → 부족 G」가 아니다", async () => {
        const scene = innScene(10);
        const pending = playInn(scene, { kind: "inn", price: 30 });
        const purse = document.querySelector("[data-testid='inn-summary-gold']")?.textContent ?? "";
        expect(purse).toContain("10");
        expect(purse).toContain("20");
        expect(purse).toContain("부족");
        expect(purse).not.toContain("→");
        document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
        await pending;
      });

      it("돈이 넉넉하면 「가진 돈 → 남는 돈」 그대로다", async () => {
        const scene = innScene(1250);
        const pending = playInn(scene, { kind: "inn", price: 30 });
        const purse = document.querySelector("[data-testid='inn-summary-gold']")?.textContent ?? "";
        expect(purse).toContain("1,250 → 1,220");
        document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
        await pending;
      });

      it("이미 가득이면 「+0」을 적지 않는다", async () => {
        const scene = innScene(1250);
        const pending = playInn(scene, { kind: "inn", price: 30 });
        const hp = document.querySelector("[data-testid='inn-summary-hp']")?.textContent ?? "";
        expect(hp).not.toContain("+0");
        expect(hp).toContain("가득");
        document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
        await pending;
      });
    });
    describe("진형 도움말(minor 5)", () => {
      it("플레이어에게 하는 말이다 — 저작 용어(적 그룹 설정·기본 참전)가 없다", () => {
        const project = createBlankProject();
        project.database.actors.push({ ...structuredClone(project.database.actors[0]!), id: "qa_second", name: "둘째" });
        const session = startSession(project);
        session.partyActorIds = [session.partyActorIds[0]!, "qa_second"];
        const detail = formationDetail({ project, session, slots: [], waitModeEnabled: true, selectedCommand: "formation" as const });
        const texts = [detail.hint ?? "", ...detail.entries.map((entry) => entry.description ?? "")].join("\n");
        expect(texts).not.toContain("적 그룹");
        expect(texts).not.toContain("기본 참전");
        expect(texts).not.toMatch(/^결정:/mu);
        expect(texts).toContain("전투에 나섭니다");
      });
    });
    describe("기록 메뉴에 아직 없는 것(minor 2)", () => {
      it("유대 목록은 만난 동료만 — 파티에 없고 유대도 0 인 동료는 올리지 않는다", () => {
        const project = createBlankProject();
        const [first] = project.database.actors;
        project.database.actors.push({ ...structuredClone(first!), id: "qa_later", name: "나중 동료" });
        project.variables.push({ id: "var_bond_first", name: "유대 1" } as (typeof project.variables)[number], { id: "var_bond_later", name: "유대 2" } as (typeof project.variables)[number]);
        project.system.partyBonds = { members: [{ actorId: first!.id, variableId: "var_bond_first" }, { actorId: "qa_later", variableId: "var_bond_later" }] };
        const session = startSession(project);
        session.partyActorIds = [first!.id];
        expect(listPartyBondEntries(project, session).map((entry) => entry.actorId)).toEqual([first!.id]);
        // 합류하면 보인다.
        session.partyActorIds = [first!.id, "qa_later"];
        expect(listPartyBondEntries(project, session).map((entry) => entry.actorId)).toEqual([first!.id, "qa_later"]);
        // 유대를 쌓고 파티를 떠나도 남는다(「지금 파티에 없음」).
        session.variables.var_bond_later = 2;
        session.partyActorIds = [first!.id];
        const entries = listPartyBondEntries(project, session);
        expect(entries.map((entry) => entry.actorId)).toEqual([first!.id, "qa_later"]);
        expect(entries[1]).toMatchObject({ value: 2, inParty: false });
      });

      it("이야기 일지는 줄이 적힌 뒤에만 메뉴에 나온다", () => {
        const project = createBlankProject();
        project.meta.oprnStoryJournal = { version: 1, title: "이리스의 일지", writers: [{ id: "iris", name: "이리스" }] };
        const session = startSession(project);
        expect(listStatusMenuCommandIds(project, session)).not.toContain("journal");
        session.storyJournal = [{ id: "l1", writer: "iris", date: "1일", text: "별이 떨어졌다.", state: "normal" }];
        expect(listStatusMenuCommandIds(project, session)).toContain("journal");
      });
    });
    describe("임무 화면(minor 3)", () => {
      it("제목·상태 줄에 값 없는 꼬리표(「임무 요약」「완료한 단계 / 전체 단계」)를 달지 않는다", () => {
        const project = createBlankProject();
        project.quests = [{ kind: "graph", id: "q_graph", title: "첫 임무", summary: "숲으로 간다.", edges: [],
          nodes: [{ id: "n1", description: "숲 입구에 닿는다", completesWhen: { kind: "switch", switchId: "sw_never", value: true } }] }] as unknown as typeof project.quests;
        const session = startSession(project);
        const detail = createStatusMenuDetail({ project, session, selectedCommand: "quests", slots: [], waitModeEnabled: true });
        const summary = detail.entries.find((entry) => entry.testId === "status-menu-quest-q_graph");
        const state = detail.entries.find((entry) => entry.testId === "status-menu-quest-state-q_graph");
        expect(summary).toMatchObject({ label: "첫 임무", value: "숲으로 간다." });
        expect(summary?.description).toBeUndefined();
        expect(state?.description).toBeUndefined();
        expect(state?.value).toContain("(0/1)");
      });
    });
    describe("상점 회복 미리보기(쓰러진 동료)", () => {
      function fixture() {
        const project = createBlankProject();
        const item = project.database.items.find((record) => record.id === "item_potion");
        if (!item) throw new Error("missing item_potion fixture");
        Object.assign(item, { type: "medicine", scope: "ally", hpRecovery: { flat: 40, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 }, onlyEffectiveOnDeadActors: false });
        const session = startSession(project, 7);
        const actorId = session.partyActorIds[0]!;
        const vitals = session.actorVitals[actorId]!;
        return { project, session, item, actorId, vitals };
      }

      it("쓰러진 동료에게 보통 약은 듣지 않는다 — 「0 → 회복」을 보여 주지 않는다", () => {
        const f = fixture();
        f.vitals.hp = 0;
        const rows = recoveryPreview(f.project, f.session, itemToGoods(f.item));
        expect(rows?.[0]).toMatchObject({ actorId: f.actorId, current: 0, next: 0 });
        expect(rows?.[0]?.reason).toBeTruthy();
      });

      it("서 있는 다친 동료에게는 예전처럼 회복량을 보여 준다", () => {
        const f = fixture();
        f.vitals.hp = 1;
        const rows = recoveryPreview(f.project, f.session, itemToGoods(f.item));
        expect(rows?.[0]?.next).toBe(Math.min(f.vitals.maxHp, 41));
        expect(rows?.[0]?.reason).toBeUndefined();
      });

      it("되살리는 약은 쓰러진 동료에게만 듣는다", () => {
        const f = fixture();
        f.item.onlyEffectiveOnDeadActors = true;
        f.vitals.hp = 1;
        expect(recoveryPreview(f.project, f.session, itemToGoods(f.item))?.[0]).toMatchObject({ current: 1, next: 1 });
        f.vitals.hp = 0;
        expect(recoveryPreview(f.project, f.session, itemToGoods(f.item))?.[0]?.next).toBe(Math.min(f.vitals.maxHp, 40));
      });
    });
    describe("파티 상태 화면 — 파티원의 장(QA minor 4)", () => {
      function statusDetail(select?: (actorId: string) => void) {
        const project = createBlankProject();
        const session = startSession(project);
        const detail = createStatusMenuDetail({ project, session, selectedCommand: "status", slots: [], waitModeEnabled: true, ...(select ? { onSelectStatusActor: select } : {}) });
        return { project, session, detail };
      }

      it("파티원마다 능력치 · 장비 · 걸린 상태 · 다음 레벨까지가 한 장에 있다", () => {
        const { project, session, detail } = statusDetail(() => undefined);
        expect(detail.entries).toHaveLength(session.partyActorIds.length);
        const sheet = detail.entries[0]?.sheet;
        expect(sheet?.sections.map((section) => section.id)).toEqual(["vitals", "stats", "equipment"]);
        const rows = (id: string) => sheet?.sections.find((section) => section.id === id)?.rows ?? [];
        expect(rows("vitals").map((row) => row.id)).toEqual(["hp", "mp", "states", "next"]);
        expect(rows("vitals").find((row) => row.id === "hp")?.value).toMatch(/^\d+\/\d+$/);
        expect(rows("vitals").find((row) => row.id === "states")?.value).toBe("정상");
        expect(rows("vitals").find((row) => row.id === "next")?.value).toMatch(/^(\d+|최고 레벨)$/);
        expect(rows("stats").map((row) => row.label)).toEqual(["공격", "방어", "정신", "민첩"]);
        for (const row of rows("stats")) expect(row.value).toMatch(/^\d+$/);
        expect(rows("equipment").map((row) => row.id)).toEqual(equipmentSlots(project).map((slot) => slot.id));
        // 줄 안에는 한 줄 요약을 되풀이하지 않는다 — 장이 보인다.
        expect(detail.entries[0]?.description).toBeUndefined();
      });

      it("걸린 상태는 이름으로, 눈에 띄는 색으로 적는다", () => {
        const project = createBlankProject();
        const session = startSession(project);
        const actorId = session.partyActorIds[0]!;
        const state = project.database.states[0]!;
        session.actorStateIds = { ...session.actorStateIds, [actorId]: [state.id] };
        const detail = createStatusMenuDetail({ project, session, selectedCommand: "status", slots: [], waitModeEnabled: true, onSelectStatusActor: () => undefined });
        const states = detail.entries[0]?.sheet?.sections.find((section) => section.id === "vitals")?.rows.find((row) => row.id === "states");
        expect(states).toMatchObject({ value: state.name, tone: "down" });
      });

      it("줄을 고르면 그 파티원을 알려 준다 — Enter 가 「선택할 수 없습니다」로 끝나지 않는다", () => {
        const picked: string[] = [];
        const { session, detail } = statusDetail((actorId) => picked.push(actorId));
        detail.entries[0]?.onActivate?.();
        expect(picked).toEqual([session.partyActorIds[0]]);
      });

      it("고르는 콜백이 없는 읽기 전용 목록은 전처럼 줄 안에 HP·MP 요약을 둔다", () => {
        const { detail } = statusDetail();
        expect(detail.entries[0]?.onActivate).toBeUndefined();
        expect(detail.entries[0]?.description).toMatch(/HP \d+\/\d+ · MP \d+\/\d+ · 정상/);
      });

      it("장은 목록 옆 쇼케이스 자리에 그려진다", () => {
        const { project, detail } = statusDetail(() => undefined);
        const panel = renderStatusMenuDetailPanel(project, detail, { selectedActionIndex: 0, showcase: true });
        const sheet = panel.querySelector<HTMLElement>("[data-testid='status-menu-detail-showcase']");
        expect(sheet?.classList.contains("status-menu-member-sheet")).toBe(true);
        for (const id of ["status-menu-sheet-vitals", "status-menu-sheet-stats", "status-menu-sheet-equipment", "status-menu-sheet-vitals-next", "status-menu-sheet-stats-attack"]) {
          expect(panel.querySelector(`[data-testid='${id}']`), id).not.toBeNull();
        }
        expect(panel.querySelector("[data-testid='status-menu-sheet-stats']")?.classList.contains("two-up")).toBe(true);
      });
    });
  });
  // 갤러리 전체 화면: 보이는 캡션이 대화상자 이름이고, 좌우로 넘기면 그 문장을 알린다.
  describe("galleryViewerA11y", () => {
    isolateTimers();
    afterEach(() => {
      closeGalleryViewer();
      document.body.replaceChildren();
    });
    describe("gallery viewer accessibility", () => {
      it("names the dialog with the visible caption and announces the next picture", () => {
        store.replace(deserialize(serialize(createBlankProject())));
        const opener = document.createElement("button");
        opener.textContent = "그림 열기";
        document.body.append(opener);
        opener.focus();

        openGalleryViewer({
          project: store.getCurrent(),
          resourceIds: ["gallery-missing-a", "gallery-missing-b"],
          index: 0,
        });

        const dialog = document.querySelector<HTMLElement>("[data-testid='gallery-viewer']");
        const caption = document.querySelector<HTMLElement>("[data-testid='gallery-viewer-caption']");
        expect(dialog?.getAttribute("role")).toBe("dialog");
        expect(dialog?.getAttribute("aria-modal")).toBe("true");
        expect(dialog?.getAttribute("aria-labelledby")).toBe(caption?.id);
        expect(caption?.textContent).toBe("갤러리 1/2 · 그림");
        expect(dialog?.getAttribute("aria-describedby")).toBe("gallery-viewer-missing");
        expect(document.getElementById("gallery-viewer-missing")?.textContent).toBe("그림을 찾을 수 없습니다.");
        expect(document.activeElement).toBe(dialog);
        const announcement = document.querySelector("[data-testid='gallery-viewer-announcement']");
        expect(announcement?.getAttribute("role")).toBe("status");
        expect(announcement?.getAttribute("aria-live")).toBe("polite");
        expect(announcement?.textContent).toBe("");

        const closeButton = document.querySelector<HTMLButtonElement>("[data-testid='gallery-viewer-close']");
        closeButton?.focus();
        stepGalleryViewer(1);
        expect(document.activeElement).toBe(closeButton);
        expect(document.querySelector("[data-testid='gallery-viewer-announcement']")).toBe(announcement);
        expect(caption?.textContent).toBe("갤러리 2/2 · 그림");
        expect(document.querySelector("[data-testid='gallery-viewer-announcement']")?.textContent).toBe(
          "갤러리 2/2 · 그림. 그림을 찾을 수 없습니다.",
        );
        closeGalleryViewer();
        expect(document.querySelector("[data-testid='gallery-viewer']")).toBeNull();
        expect(document.activeElement).toBe(opener);
      });
    });
  });
  // 커뮤니티 호스팅 브릿지(__OPENRPG_BOOT__ returnUrl/hostFeatures) 파싱·검증과
  // 전체화면 토글 버튼의 마운트/미마운트 조건을 검증한다.
  describe("hostBridge", () => {
    isolateTimers();
    describe("isSafeReturnUrl — same-origin 상대 경로만 허용", () => {
      it("'/'로 시작하는 상대 경로를 허용한다", () => {
        expect(isSafeReturnUrl("/ko/games/my-game")).toBe(true);
        expect(isSafeReturnUrl("/")).toBe(true);
        expect(isSafeReturnUrl("/en/games/slug?tab=info#top")).toBe(true);
      });

      it("스킴 포함 절대 URL을 거부한다", () => {
        expect(isSafeReturnUrl("https://evil.example/phish")).toBe(false);
        expect(isSafeReturnUrl("http://evil.example")).toBe(false);
        expect(isSafeReturnUrl("javascript:alert(1)")).toBe(false);
      });

      it("프로토콜 상대('//')와 백슬래시 변종('/\\\\')을 거부한다", () => {
        expect(isSafeReturnUrl("//evil.example/games")).toBe(false);
        expect(isSafeReturnUrl("/\\evil.example")).toBe(false);
      });

      it("미설정/오타입/빈 문자열을 거부한다", () => {
        expect(isSafeReturnUrl(undefined)).toBe(false);
        expect(isSafeReturnUrl(null)).toBe(false);
        expect(isSafeReturnUrl(123)).toBe(false);
        expect(isSafeReturnUrl("")).toBe(false);
        expect(isSafeReturnUrl("games/relative-without-slash")).toBe(false);
      });
    });
    describe("parseHostFeatures — 인식된 기능만, 오타입은 조용히 무시", () => {
      it("정상 배열에서 exit/fullscreen 을 파싱한다", () => {
        expect(parseHostFeatures(["exit", "fullscreen"])).toEqual(["exit", "fullscreen"]);
      });

      it("배열이 아니면 빈 배열", () => {
        expect(parseHostFeatures("exit")).toEqual([]);
        expect(parseHostFeatures({ exit: true })).toEqual([]);
        expect(parseHostFeatures(undefined)).toEqual([]);
        expect(parseHostFeatures(null)).toEqual([]);
      });

      it("부분 유효: 알 수 없는 항목/오타입/중복을 걸러낸다", () => {
        expect(parseHostFeatures(["exit", "unknown", 42, null, "fullscreen", "exit"]))
          .toEqual(["exit", "fullscreen"]);
        expect(parseHostFeatures(["EXIT", "Fullscreen"])).toEqual([]);
      });
    });
    describe("parseHostBridge — 부트 객체 방어 파싱(부트 실패 금지)", () => {
      it("returnUrl + hostFeatures 를 함께 파싱한다", () => {
        expect(parseHostBridge({
          projectUrl: "https://cdn.example/p.json",
          returnUrl: "/ko/games/slug",
          hostFeatures: ["exit", "fullscreen"],
        })).toEqual({ returnUrl: "/ko/games/slug", hostFeatures: ["exit", "fullscreen"] });
      });

      it("잘못된 returnUrl 은 null 로 강등된다", () => {
        expect(parseHostBridge({ returnUrl: "https://evil.example" }).returnUrl).toBeNull();
        expect(parseHostBridge({ returnUrl: 42 }).returnUrl).toBeNull();
        expect(parseHostBridge({}).returnUrl).toBeNull();
      });

      it("비객체 입력(undefined/null/문자열)도 빈 브릿지로 흡수한다", () => {
        for (const raw of [undefined, null, "boot", 7]) {
          expect(parseHostBridge(raw)).toEqual({ returnUrl: null, hostFeatures: [] });
        }
      });
    });
    describe("hostExitReturnUrl — exit 기능이 켜졌을 때만 복귀 URL", () => {
      const bridge = (returnUrl: string | null, hostFeatures: readonly ("exit" | "fullscreen")[]): HostBridge =>
        ({ returnUrl, hostFeatures });

      it("exit + 유효 returnUrl → 복귀 URL", () => {
        expect(hostExitReturnUrl(bridge("/en/games/a", ["exit"]))).toBe("/en/games/a");
      });

      it("exit 미포함이면 returnUrl 이 있어도 null(기존 안내 폴백 유지)", () => {
        expect(hostExitReturnUrl(bridge("/en/games/a", []))).toBeNull();
        expect(hostExitReturnUrl(bridge("/en/games/a", ["fullscreen"]))).toBeNull();
      });

      it("exit 이 있어도 returnUrl 이 없으면 null", () => {
        expect(hostExitReturnUrl(bridge(null, ["exit"]))).toBeNull();
      });

      it("브릿지 자체가 없으면(에디터 테스트플레이) null", () => {
        expect(hostExitReturnUrl(undefined)).toBeNull();
      });
    });
    describe("mountHostFullscreenToggle — 버튼 마운트/미마운트 조건", () => {
      const fullscreenBridge: HostBridge = { returnUrl: "/ko/games/a", hostFeatures: ["fullscreen"] };
      let restoreExitFullscreen: (() => void) | null = null;

      const makeHost = (): { viewport: HTMLElement; root: HTMLElement } => {
        const root = document.createElement("div");
        const viewport = document.createElement("div");
        root.append(viewport);
        return { viewport, root };
      };

      const stubFullscreenApi = (root: HTMLElement): void => {
        Object.defineProperty(root, "requestFullscreen", {
          configurable: true,
          value: vi.fn(() => Promise.resolve()),
        });
        const doc = document as unknown as Record<string, unknown>;
        const hadOwn = Object.prototype.hasOwnProperty.call(doc, "exitFullscreen");
        const previous = doc["exitFullscreen"];
        doc["exitFullscreen"] = vi.fn(() => Promise.resolve());
        restoreExitFullscreen = () => {
          if (hadOwn) doc["exitFullscreen"] = previous;
          else delete doc["exitFullscreen"];
        };
      };

      afterEach(() => {
        restoreExitFullscreen?.();
        restoreExitFullscreen = null;
      });

      it("브릿지가 없으면(에디터 테스트플레이) 아무것도 렌더하지 않는다", () => {
        const { viewport, root } = makeHost();
        stubFullscreenApi(root);
        const cleanup = mountHostFullscreenToggle({ bridge: undefined, viewport, fullscreenRoot: root });
        expect(cleanup).toBeNull();
        expect(viewport.querySelector("[data-testid='play-fullscreen-toggle']")).toBeNull();
      });

      it("hostFeatures 에 fullscreen 이 없으면 마운트하지 않는다", () => {
        const { viewport, root } = makeHost();
        stubFullscreenApi(root);
        const exitOnly: HostBridge = { returnUrl: "/ko/games/a", hostFeatures: ["exit"] };
        expect(mountHostFullscreenToggle({ bridge: exitOnly, viewport, fullscreenRoot: root })).toBeNull();
        expect(viewport.querySelector("[data-testid='play-fullscreen-toggle']")).toBeNull();
      });

      it("Fullscreen API 부재(happy-dom 기본)에서는 안전하게 no-op", () => {
        const { viewport, root } = makeHost();
        Object.defineProperty(root, "requestFullscreen", { configurable: true, value: undefined });
        expect(mountHostFullscreenToggle({ bridge: fullscreenBridge, viewport, fullscreenRoot: root })).toBeNull();
        expect(viewport.querySelector("[data-testid='play-fullscreen-toggle']")).toBeNull();
      });

      it("fullscreen 기능 + API 존재 → 포인터 전용 버튼을 마운트하고 cleanup 으로 제거한다", () => {
        const { viewport, root } = makeHost();
        stubFullscreenApi(root);
        const cleanup = mountHostFullscreenToggle({ bridge: fullscreenBridge, viewport, fullscreenRoot: root });
        expect(cleanup).toBeTypeOf("function");
        const button = viewport.querySelector<HTMLButtonElement>("[data-testid='play-fullscreen-toggle']");
        expect(button).not.toBeNull();
        // 키보드 전용 게임 입력과 간섭 금지: Tab 순회 제외 + 포인터 소유권 표식.
        expect(button?.getAttribute("tabindex")).toBe("-1");
        expect(button?.dataset.playInputOwner).toBe("host-fullscreen");
        expect(button?.getAttribute("aria-pressed")).toBe("false");
        cleanup?.();
        expect(viewport.querySelector("[data-testid='play-fullscreen-toggle']")).toBeNull();
      });
    });
  });
  describe("lifePlacementRenderedBodyReplay", () => {
    isolateTimers();
    function spatialProject() {
      const project = createBlankProject();
      const item = project.database.items[0];
      if (!item) throw new Error("blank project requires a starter item");
      project.database.farmBuildingTypes = [{
        id: "shed",
        name: "Shed",
        levels: [{
          level: 1,
          footprint: { width: 2, height: 1 },
          capacity: 4,
          cost: { gold: 10, items: [{ itemId: item.id, count: 1 }] },
          graphicResourceId: "building-default",
        }],
      }];
      return { project, itemId: item.id };
    }
    function liveSession(project: Project, seed = 4401): PlaySession {
      const session = startSession(project, seed);
      session.currentMapId = project.startMapId;
      session.x = 5;
      session.y = 5;
      session.gold = 100;
      return session;
    }
    function activate(detail: StatusMenuDetail, testId: string): void {
      const entry = detail.entries.find((candidate) => candidate.testId === testId);
      expect(entry, `missing ledger action ${testId}`).toBeDefined();
      expect(entry?.disabled).not.toBe(true);
      entry?.onActivate?.();
    }
    function sceneFor(
      project: Project,
      session: PlaySession,
      extras?: Partial<LifePlacementSceneSource>,
    ): LifePlacementSceneSource {
      return {
        map: project.maps[project.startMapId]!,
        session,
        tileX: session.x,
        tileY: session.y,
        facing: "down",
        eventPositions: {},
        moving: false,
        autonomousNPCs: new Map(),
        ...extras,
      };
    }
    describe("life placement rendered-body replay (new, not historical RED)", () => {
      it("refuses construction through the ledger while an interpolating NPC body still covers the target and the destination body does not", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.x = 12;
        session.y = 2;
        session.inventory[itemId] = 2;
        const map = project.maps[project.startMapId]!;
        map.events = [
          event("npc_walker", 12, 5, [{
            ...page("walk", "same", { kind: "action" }),
            footprint: { width: 3, height: 3 },
            passRows: 1,
          }]),
        ];
        session.eventLocations = { npc_walker: { mapId: map.id, x: 12, y: 6 } };
        const scene = sceneFor(project, session, {
          map,
          tileX: 12,
          tileY: 2,
          eventPositions: { npc_walker: { x: 12, y: 5 } },
          autonomousNPCs: new Map([
            ["npc_walker", {
              activeMove: { fromX: 12, fromY: 5, toX: 12, toY: 6, elapsedMs: 200, durationMs: 400 },
              moveDurationMs: 400,
            }],
          ]),
        });
        const body = resolvePlayerBody(project, session);
        const target = adjacentSpatialPosition(
          { mapId: session.currentMapId, x: session.x, y: session.y, footprint: body.footprint, passRows: body.passRows },
          "down",
          { width: 2, height: 1 },
          "down",
        );
        expect(target.y).toBe(3);
        const readLive = createLifePlacementLiveReader(() => scene, () => project);
        const core = readLive();
        expect(core.npcs[0]).toMatchObject({ x: 12, y: 6 });
        const before = structuredClone(session);
        const mutations: Array<{ ok: boolean; message: string }> = [];
        activate(createLifeLedgerDetail({
          project,
          session,
          tab: "spaces",
          readLive,
          placementDirection: "down",
          getScene: () => scene,
          onMutation: (ok, message) => mutations.push({ ok, message }),
        }), "life-ledger-space-building-place-shed");
        expect(session).toEqual(before);
        expect(mutations).toEqual([{ ok: false, message: "처리할 수 없습니다: blocked" }]);
      });

      it("refuses visible below and pass-through overlap through the ledger without making them walking walls", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 3;
        const map = project.maps[project.startMapId]!;
        map.events = [
          event("below", 5, 6, [{
            ...page("floor", "below", { kind: "touch" }),
            footprint: { width: 2, height: 1 },
          }]),
          event("through", 8, 8, [{
            ...page("open", "same", { kind: "action" }),
            overlapForbidden: false,
            footprint: { width: 2, height: 1 },
          }]),
        ];
        const scene = sceneFor(project, session, {
          map,
          eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } },
        });
        const live = readLifePlacementLiveContext(project, scene);
        expect(live?.npcs).toEqual([]);
        const mutations: Array<{ ok: boolean; message: string }> = [];
        const before = structuredClone(session);
        activate(createLifeLedgerDetail({
          project,
          session,
          tab: "spaces",
          readLive: createLifePlacementLiveReader(() => scene, () => project),
          placementDirection: "down",
          getScene: () => scene,
          onMutation: (ok, message) => mutations.push({ ok, message }),
        }), "life-ledger-space-building-place-shed");
        expect(session).toEqual(before);
        session.x = 8;
        session.y = 7;
        const throughScene = sceneFor(project, session, {
          map,
          tileX: 8,
          tileY: 7,
          eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } },
        });
        const throughBefore = structuredClone(session);
        activate(createLifeLedgerDetail({
          project,
          session,
          tab: "spaces",
          readLive: createLifePlacementLiveReader(() => throughScene, () => project),
          placementDirection: "down",
          getScene: () => throughScene,
          onMutation: (ok, message) => mutations.push({ ok, message }),
        }), "life-ledger-space-building-place-shed");
        expect(session).toEqual(throughBefore);
        expect(mutations).toEqual([
          { ok: false, message: "처리할 수 없습니다: blocked" },
          { ok: false, message: "처리할 수 없습니다: blocked" },
        ]);
      });

      it("refuses an in-flight player through the ledger while the integer origin is still committed", () => {
        const { project, itemId } = spatialProject();
        project.system.playerFootprint = { width: 3, height: 3 };
        project.system.playerPassRows = 1;
        const session = liveSession(project);
        session.inventory[itemId] = 2;
        const scene = sceneFor(project, session, {
          moving: true,
          movingFrom: { x: 5, y: 5 },
          movingTo: { x: 6, y: 5 },
          moveProgress: 0.5,
          facing: "right",
        });
        const readLive = createLifePlacementLiveReader(() => scene, () => project);
        expect(readLive().player).toMatchObject({ x: 5, y: 5 });
        const before = structuredClone(session);
        const mutations: Array<{ ok: boolean; message: string }> = [];
        activate(createLifeLedgerDetail({
          project,
          session,
          tab: "spaces",
          readLive,
          placementDirection: "right",
          getScene: () => scene,
          onMutation: (ok, message) => mutations.push({ ok, message }),
        }), "life-ledger-space-building-place-shed");
        expect(session).toEqual(before);
        expect(mutations).toEqual([{ ok: false, message: "처리할 수 없습니다: blocked" }]);
      });
    });
  });
  describe("lifePlacementSceneUi", () => {
    isolateTimers();
    function spatialProject() {
      const project = createBlankProject();
      const item = project.database.items[0];
      if (!item) throw new Error("blank project requires a starter item");
      project.database.farmBuildingTypes = [{
        id: "shed",
        name: "Shed",
        levels: [
          {
            level: 1,
            footprint: { width: 2, height: 1 },
            capacity: 4,
            cost: { gold: 10, items: [{ itemId: item.id, count: 1 }] },
            graphicResourceId: "building-default",
          },
          {
            level: 2,
            footprint: { width: 3, height: 2 },
            capacity: 8,
            cost: { gold: 20 },
            graphicResourceId: "building-default",
          },
        ],
      }];
      project.database.homeDecorationTypes = [{
        id: "table",
        name: "Table",
        placementItemId: item.id,
        footprint: { width: 2, height: 1 },
        blocksMovement: true,
        allowedOrientations: ["down", "left", "right", "up"],
        graphicResourceId: "decor-default",
      }, {
        id: "rug",
        name: "Rug",
        placementItemId: item.id,
        footprint: { width: 2, height: 1 },
        blocksMovement: false,
        allowedOrientations: ["down", "left"],
        graphicResourceId: "decor-default",
      }];
      return { project, itemId: item.id };
    }
    function liveSession(project: Project, seed = 4401): PlaySession {
      const session = startSession(project, seed);
      session.currentMapId = project.startMapId;
      session.x = 5;
      session.y = 5;
      session.gold = 100;
      return session;
    }
    function activate(detail: StatusMenuDetail, testId: string): void {
      const entry = detail.entries.find((candidate) => candidate.testId === testId);
      expect(entry, `missing ledger action ${testId}`).toBeDefined();
      expect(entry?.disabled).not.toBe(true);
      entry?.onActivate?.();
    }
    function playerActor(project: Project, session: PlaySession, x = session.x, y = session.y): SpatialLiveActor {
      const body = resolvePlayerBody(project, session);
      return {
        mapId: session.currentMapId,
        x,
        y,
        footprint: body.footprint,
        passRows: body.passRows,
      };
    }
    function readerFor(
      project: Project,
      session: PlaySession,
      extras?: { npcs?: SpatialLiveActor[]; x?: number; y?: number },
    ): SpatialLiveContextReader {
      return () => ({
        player: playerActor(project, session, extras?.x ?? session.x, extras?.y ?? session.y),
        npcs: extras?.npcs ?? [],
      });
    }
    function spaces(project: Project, session: PlaySession, options?: {
      readLive?: SpatialLiveContextReader;
      placementDirection?: Dir;
      getPlacementDirection?: () => Dir | undefined;
      getScene?: () => LifePlacementSceneSource | undefined;
      onMutation?: (ok: boolean, message: string) => void;
    }) {
      return createLifeLedgerDetail({
        project,
        session,
        tab: "spaces",
        onMutation: options?.onMutation,
        readLive: options?.readLive,
        placementDirection: options?.placementDirection,
        getPlacementDirection: options?.getPlacementDirection,
        getScene: options?.getScene,
      });
    }
    function expectedAdjacent(
      project: Project,
      session: PlaySession,
      direction: Dir,
      footprint: SpatialFootprint,
      orientation: Dir,
    ) {
      return adjacentSpatialPosition(playerActor(project, session), direction, footprint, orientation);
    }
    function sceneFor(
      project: Project,
      session: PlaySession,
      extras?: Partial<LifePlacementSceneSource>,
    ): LifePlacementSceneSource {
      return {
        map: project.maps[project.startMapId]!,
        session,
        tileX: session.x,
        tileY: session.y,
        facing: "down",
        eventPositions: {},
        moving: false,
        autonomousNPCs: new Map(),
        ...extras,
      };
    }
    describe("life placement live UI", () => {
      it("refuses all six live mutations without a scene reader and leaves costs/state unchanged", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 4;
        session.farmBuildingPlacements = {
          shed_1: {
            instanceId: "shed_1", typeId: "shed", level: 1,
            mapId: project.startMapId, x: 1, y: 1, orientation: "down",
          },
        };
        session.homeDecorationPlacements = {
          table_1: {
            instanceId: "table_1", typeId: "table",
            mapId: project.startMapId, x: 8, y: 1, orientation: "down",
          },
        };
        const before = structuredClone(session);
        const mutations: Array<{ ok: boolean; message: string }> = [];
        const detail = spaces(project, session, {
          onMutation: (ok, message) => mutations.push({ ok, message }),
        });
        activate(detail, "life-ledger-space-building-place-shed");
        activate(detail, "life-ledger-space-building-move-shed_1");
        activate(detail, "life-ledger-space-building-upgrade-shed_1");
        activate(detail, "life-ledger-space-decoration-place-table");
        activate(detail, "life-ledger-space-decoration-move-table_1");
        activate(detail, "life-ledger-space-decoration-rotate-table_1");
        expect(session).toEqual(before);
        expect(mutations).toEqual(Array.from({ length: 6 }, () => ({
          ok: false,
          message: "처리할 수 없습니다: blocked",
        })));
      });

      it("displays and applies the adjacent full-body target, not the player foot tile", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 3;
        const body = resolvePlayerBody(project, session);
        const target = adjacentSpatialPosition(
          { mapId: session.currentMapId, x: session.x, y: session.y, footprint: body.footprint, passRows: body.passRows },
          "down",
          { width: 2, height: 1 },
          "down",
        );
        expect(target).toEqual({ mapId: project.startMapId, x: 5, y: 6, orientation: "down" });
        expect(target.y).not.toBe(session.y);
        const missing = createLifeLedgerDetail({ project, session, tab: "spaces" });
        const missingPlace = missing.entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed");
        expect(missingPlace?.value).not.toBe(`${project.startMapId} (5, 5)`);
        expect(missingPlace?.value).toBe("장면을 확인할 수 없습니다");
        const readLive = readerFor(project, session);
        const detail = () => spaces(project, session, {
          readLive,
          placementDirection: "down",
        });
        const placeBuilding = detail().entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed");
        expect(placeBuilding?.value).toBe(`${project.startMapId} (5, 6)`);
        expect(placeBuilding?.value).not.toBe(`${project.startMapId} (5, 5)`);
        activate(detail(), "life-ledger-space-building-place-shed");
        const buildingId = Object.keys(session.farmBuildingPlacements ?? {})[0];
        expect(session.farmBuildingPlacements?.[buildingId ?? ""]).toMatchObject({ x: 5, y: 6, mapId: project.startMapId });
        expect(session.farmBuildingPlacements?.[buildingId ?? ""]).not.toMatchObject({ x: 5, y: 5 });
      });

      it("still removes buildings and decorations and keeps other ledger tabs without a reader", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 0;
        session.farmBuildingPlacements = {
          shed_1: {
            instanceId: "shed_1", typeId: "shed", level: 1,
            mapId: project.startMapId, x: 1, y: 1, orientation: "down",
          },
        };
        session.homeDecorationPlacements = {
          table_1: {
            instanceId: "table_1", typeId: "table",
            mapId: project.startMapId, x: 8, y: 1, orientation: "down",
          },
        };
        const mutations: boolean[] = [];
        const detail = spaces(project, session, { onMutation: (ok) => mutations.push(ok) });
        activate(detail, "life-ledger-space-building-remove-shed_1");
        activate(detail, "life-ledger-space-decoration-remove-table_1");
        expect(session.farmBuildingPlacements).toEqual({});
        expect(session.homeDecorationPlacements).toEqual({});
        expect(session.inventory[itemId]).toBe(1);
        expect(mutations).toEqual([true, true]);
        const shipping = createLifeLedgerDetail({
          project,
          session,
          tab: "shipping",
          onMutation: (ok) => mutations.push(ok),
        });
        expect(shipping.entries.every((entry) => entry.testId?.startsWith("life-ledger-shipping-") || entry.testId === undefined || !entry.testId.includes("space"))).toBe(true);
      });

      it("places and moves on the adjacent full-body target, not the player foot tile", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 3;
        const readLive = readerFor(project, session);
        const buildingTarget = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
        const decorationTarget = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
        expect(buildingTarget).toEqual({ mapId: project.startMapId, x: 5, y: 6, orientation: "down" });
        expect(buildingTarget.y).not.toBe(session.y);
        const mutations: boolean[] = [];
        const detail = () => spaces(project, session, {
          readLive,
          placementDirection: "down",
          onMutation: (ok) => mutations.push(ok),
        });
        const placeBuilding = detail().entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed");
        expect(placeBuilding?.value).toBe(`${project.startMapId} (5, 6)`);
        expect(placeBuilding?.value).not.toBe(`${project.startMapId} (5, 5)`);
        activate(detail(), "life-ledger-space-building-place-shed");
        const buildingId = Object.keys(session.farmBuildingPlacements ?? {})[0];
        if (!buildingId) throw new Error("building was not placed");
        expect(session.farmBuildingPlacements?.[buildingId]).toMatchObject({ x: 5, y: 6, mapId: project.startMapId });
        expect(session.farmBuildingPlacements?.[buildingId]).not.toMatchObject({ x: 5, y: 5 });
        session.x = 2;
        session.y = 2;
        const moveTarget = expectedAdjacent(project, session, "right", { width: 2, height: 1 }, "down");
        activate(spaces(project, session, {
          readLive: readerFor(project, session),
          placementDirection: "right",
          onMutation: (ok) => mutations.push(ok),
        }), `life-ledger-space-building-move-${buildingId}`);
        expect(session.farmBuildingPlacements?.[buildingId]).toMatchObject({ x: moveTarget.x, y: moveTarget.y });
        session.x = 8;
        session.y = 8;
        activate(spaces(project, session, {
          readLive: readerFor(project, session),
          placementDirection: "down",
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-decoration-place-table");
        const decorationId = Object.keys(session.homeDecorationPlacements ?? {})[0];
        if (!decorationId) throw new Error("decoration was not placed");
        expect(session.homeDecorationPlacements?.[decorationId]).toMatchObject({
          x: expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down").x,
          y: expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down").y,
        });
        session.x = 10;
        session.y = 10;
        activate(spaces(project, session, {
          readLive: readerFor(project, session),
          placementDirection: "left",
          onMutation: (ok) => mutations.push(ok),
        }), `life-ledger-space-decoration-move-${decorationId}`);
        expect(session.homeDecorationPlacements?.[decorationId]).toMatchObject(
          expectedAdjacent(project, session, "left", { width: 2, height: 1 }, "down"),
        );
        expect(mutations.every((ok) => ok)).toBe(true);
        void decorationTarget;
      });

      it("targets all four facing directions with oriented footprints", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 8;
        const directions: Array<{ direction: Dir; x: number; y: number }> = [
          { direction: "up", x: 8, y: 8 },
          { direction: "down", x: 2, y: 2 },
          { direction: "left", x: 12, y: 4 },
          { direction: "right", x: 4, y: 12 },
        ];
        for (const { direction, x, y } of directions) {
          session.x = x;
          session.y = y;
          const target = expectedAdjacent(project, session, direction, { width: 2, height: 1 }, "down");
          const beforeGold = session.gold;
          const mutations: boolean[] = [];
          const beforeIds = new Set(Object.keys(session.farmBuildingPlacements ?? {}));
          activate(spaces(project, session, {
            readLive: readerFor(project, session),
            placementDirection: direction,
            onMutation: (ok) => mutations.push(ok),
          }), "life-ledger-space-building-place-shed");
          const placedId = Object.keys(session.farmBuildingPlacements ?? {}).find((id) => !beforeIds.has(id));
          expect(session.farmBuildingPlacements?.[placedId ?? ""]).toMatchObject({ x: target.x, y: target.y, orientation: "down" });
          expect(session.gold).toBe(beforeGold - 10);
          expect(mutations).toEqual([true]);
        }
        session.x = 12;
        session.y = 8;
        const left = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "left");
        expect(left.orientation).toBe("left");
        const mutations: boolean[] = [];
        const detail = spaces(project, session, {
          readLive: readerFor(project, session),
          placementDirection: "down",
          onMutation: (ok) => mutations.push(ok),
        });
        activate(detail, "life-ledger-space-decoration-place-table");
        const decorationId = Object.keys(session.homeDecorationPlacements ?? {})[0];
        if (!decorationId) throw new Error("decoration missing");
        expect(session.homeDecorationPlacements?.[decorationId]?.orientation).toBe("down");
        activate(spaces(project, session, {
          readLive: readerFor(project, session),
          placementDirection: "down",
          onMutation: (ok) => mutations.push(ok),
        }), `life-ledger-space-decoration-rotate-${decorationId}`);
        expect(session.homeDecorationPlacements?.[decorationId]?.orientation).toBe("left");
        expect(session.homeDecorationPlacements?.[decorationId]).toMatchObject({
          x: expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down").x,
          y: expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down").y,
        });
        expect(mutations).toEqual([true, true]);
      });

      it("protects all six callers against a live NPC body and rereads eventLocations after preview", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 4;
        session.gold = 100;
        const npcState = { x: 12, y: 8 };
        const readLive = () => ({
          player: playerActor(project, session),
          npcs: [{
            mapId: project.startMapId,
            x: npcState.x,
            y: npcState.y,
            footprint: { width: 3, height: 3 },
            passRows: 1,
          }],
        });
        const target = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
        expect(target.y).toBe(6);
        const preview = spaces(project, session, { readLive, placementDirection: "down" });
        expect(preview.entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed")?.value)
          .toBe(`${project.startMapId} (5, 6)`);
        npcState.x = 5;
        npcState.y = 6;
        session.eventLocations = { npc_1: { mapId: project.startMapId, x: 5, y: 6 } };
        const before = structuredClone(session);
        const mutations: Array<{ ok: boolean; message: string }> = [];
        const onMutation = (ok: boolean, message: string) => mutations.push({ ok, message });
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-place-shed");
        expect(session).toEqual(before);

        session.farmBuildingPlacements = {
          shed_1: {
            instanceId: "shed_1", typeId: "shed", level: 1,
            mapId: project.startMapId, x: 4, y: 4, orientation: "down",
          },
        };
        session.homeDecorationPlacements = {
          table_1: {
            instanceId: "table_1", typeId: "table",
            mapId: project.startMapId, x: 8, y: 1, orientation: "down",
          },
        };
        const beforeAll = structuredClone(session);
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-move-shed_1");
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-upgrade-shed_1");
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-decoration-place-table");
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-decoration-move-table_1");
        npcState.x = 8;
        npcState.y = 2;
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-decoration-rotate-table_1");
        expect(session.gold).toBe(beforeAll.gold);
        expect(session.inventory).toEqual(beforeAll.inventory);
        expect(session.farmBuildingPlacements).toEqual(beforeAll.farmBuildingPlacements);
        expect(session.homeDecorationPlacements?.table_1?.orientation).toBe("down");
        expect(mutations.every((entry) => entry.ok === false && entry.message.includes("blocked"))).toBe(true);
      });

      it("uses the full 3x3 body with passRows 1, not the passage row, for live overlap", () => {
        const { project, itemId } = spatialProject();
        project.system.playerFootprint = { width: 3, height: 3 };
        project.system.playerPassRows = 1;
        const session = liveSession(project);
        session.inventory[itemId] = 2;
        const npcState = { x: 5, y: 8 };
        const readLive = () => ({
          player: playerActor(project, session),
          npcs: [{
            mapId: project.startMapId,
            x: npcState.x,
            y: npcState.y,
            footprint: { width: 3, height: 3 },
            passRows: 1,
          }],
        });
        const target = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
        expect(target).toEqual({ mapId: project.startMapId, x: 4, y: 6, orientation: "down" });
        const mutations: Array<{ ok: boolean }> = [];
        const onMutation = (ok: boolean) => mutations.push({ ok });
        const blocked = structuredClone(session);
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-place-shed");
        expect(session).toEqual(blocked);
        expect(mutations).toEqual([{ ok: false }]);
        npcState.y = 12;
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-place-shed");
        expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 4, y: 6 });
        expect(mutations.at(-1)?.ok).toBe(true);
      });

      it("refuses rotation, upgrade, plots and last-exit without spending", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 4;
        session.farmBuildingPlacements = {
          shed_1: {
            instanceId: "shed_1", typeId: "shed", level: 1,
            mapId: project.startMapId, x: 4, y: 4, orientation: "down",
          },
        };
        session.homeDecorationPlacements = {
          table_1: {
            instanceId: "table_1", typeId: "table",
            mapId: project.startMapId, x: 4, y: 3, orientation: "down",
          },
        };
        const readLive = readerFor(project, session);
        const beforeUpgrade = structuredClone(session);
        const mutations: boolean[] = [];
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation: (ok) => mutations.push(ok) }), "life-ledger-space-building-upgrade-shed_1");
        expect(session).toEqual(beforeUpgrade);
        activate(spaces(project, session, { readLive, placementDirection: "down", onMutation: (ok) => mutations.push(ok) }), "life-ledger-space-decoration-rotate-table_1");
        expect(session.homeDecorationPlacements?.table_1?.orientation).toBe("down");
        expect(session.gold).toBe(100);

        const plotSession = liveSession(project, 4402);
        plotSession.inventory[itemId] = 2;
        const plotTarget = expectedAdjacent(project, plotSession, "down", { width: 2, height: 1 }, "down");
        plotSession.farmPlots = {
          [project.startMapId]: {
            [`${plotTarget.x},${plotTarget.y}`]: { tilled: true, watered: false },
          },
        };
        const beforePlot = structuredClone(plotSession);
        activate(spaces(project, plotSession, {
          readLive: readerFor(project, plotSession),
          placementDirection: "down",
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(plotSession).toEqual(beforePlot);

        const exitSession = liveSession(project, 4403);
        exitSession.x = 5;
        exitSession.y = 5;
        exitSession.gold = 100;
        exitSession.inventory[itemId] = 4;
        exitSession.farmBuildingPlacements = {
          a: { instanceId: "a", typeId: "shed", level: 1, mapId: project.startMapId, x: 3, y: 5, orientation: "down" },
          b: { instanceId: "b", typeId: "shed", level: 1, mapId: project.startMapId, x: 5, y: 4, orientation: "down" },
          c: { instanceId: "c", typeId: "shed", level: 1, mapId: project.startMapId, x: 5, y: 6, orientation: "down" },
        };
        const beforeExit = structuredClone(exitSession);
        activate(spaces(project, exitSession, {
          readLive: readerFor(project, exitSession),
          placementDirection: "right",
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(exitSession).toEqual(beforeExit);
        expect(mutations.every((ok) => ok === false)).toBe(true);
      });

      it("does not pass a mid-step fractional player anchor into the discrete body test", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 2;
        const logical = readerFor(project, session, { x: 5, y: 5 });
        const fractional = () => ({
          player: { ...playerActor(project, session), x: 5.4, y: 5.7 },
          npcs: [],
        });
        const mutations: boolean[] = [];
        activate(spaces(project, session, {
          readLive: fractional,
          placementDirection: "down",
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(session.farmBuildingPlacements ?? {}).toEqual({});
        expect(mutations).toEqual([false]);
        activate(spaces(project, session, {
          readLive: logical,
          placementDirection: "down",
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 5, y: 6 });
        expect(mutations).toEqual([false, true]);
      });

      it("refuses in-flight player actions while the integer origin is still committed", () => {
        const { project, itemId } = spatialProject();
        project.system.playerFootprint = { width: 3, height: 3 };
        project.system.playerPassRows = 1;
        const session = liveSession(project);
        session.inventory[itemId] = 2;
        const scene = sceneFor(project, session, {
          moving: true,
          movingFrom: { x: 5, y: 5 },
          movingTo: { x: 6, y: 5 },
          moveProgress: 0.5,
          facing: "right",
        });
        const readLive = createLifePlacementLiveReader(() => scene, () => project);
        const live = readLive();
        expect(live.player).toMatchObject({ x: 5, y: 5 });
        expect(Number.isSafeInteger(live.player.x)).toBe(true);
        const target = adjacentSpatialPosition(live.player, "right", { width: 2, height: 1 }, "down");
        expect(target).toEqual({ mapId: project.startMapId, x: 7, y: 3, orientation: "down" });
        const before = structuredClone(session);
        const mutations: boolean[] = [];
        activate(spaces(project, session, {
          readLive,
          placementDirection: "right",
          getScene: () => scene,
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(session).toEqual(before);
        expect(mutations).toEqual([false]);
        const landed = sceneFor(project, session, { moving: false, facing: "right" });
        activate(spaces(project, session, {
          readLive: createLifePlacementLiveReader(() => landed, () => project),
          placementDirection: "right",
          getScene: () => landed,
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 7, y: 3 });
        expect(mutations).toEqual([false, true]);
      });

      it("blocks a target that the interpolating NPC body still occupies after destination commit", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.x = 12;
        session.y = 2;
        session.inventory[itemId] = 2;
        const map = project.maps[project.startMapId]!;
        map.events = [
          event("npc_walker", 12, 5, [{
            ...page("walk", "same", { kind: "action" }),
            footprint: { width: 3, height: 3 },
            passRows: 1,
          }]),
        ];
        session.eventLocations = { npc_walker: { mapId: map.id, x: 12, y: 6 } };
        const movers = new Map([
          ["npc_walker", {
            activeMove: { fromX: 12, fromY: 5, toX: 12, toY: 6, elapsedMs: 200, durationMs: 400 },
            moveDurationMs: 400,
          }],
        ]);
        const scene = sceneFor(project, session, {
          map,
          tileX: 12,
          tileY: 2,
          eventPositions: { npc_walker: { x: 12, y: 5 } },
          autonomousNPCs: movers,
        });
        const destination = adjacentSpatialPosition(playerActor(project, session), "down", { width: 2, height: 1 }, "down");
        expect(destination.y).toBe(3);
        expect(placementBlockedByRenderedBodies(project, scene, destination, { width: 2, height: 1 })).toBe(true);
        const readLive = createLifePlacementLiveReader(() => scene, () => project);
        const core = readLive();
        expect(core.npcs[0]).toMatchObject({ x: 12, y: 6 });
        const before = structuredClone(session);
        const mutations: boolean[] = [];
        activate(spaces(project, session, {
          readLive,
          placementDirection: "down",
          getScene: () => scene,
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(session).toEqual(before);
        expect(mutations).toEqual([false]);
        const idle = sceneFor(project, session, {
          map,
          tileX: 12,
          tileY: 2,
          eventPositions: { npc_walker: { x: 12, y: 6 } },
        });
        activate(spaces(project, session, {
          readLive: createLifePlacementLiveReader(() => idle, () => project),
          placementDirection: "down",
          getScene: () => idle,
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: destination.x, y: destination.y });
        expect(mutations).toEqual([false, true]);
      });

      it("does not ban construction because an unrelated NPC is interpolating elsewhere", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 2;
        const map = project.maps[project.startMapId]!;
        map.events = [
          event("npc_far", 2, 2, [{
            ...page("walk", "same", { kind: "action" }),
            footprint: { width: 3, height: 3 },
            passRows: 1,
          }]),
        ];
        session.eventLocations = { npc_far: { mapId: map.id, x: 2, y: 3 } };
        const scene = sceneFor(project, session, {
          map,
          autonomousNPCs: new Map([["npc_far", {
            activeMove: { fromX: 2, fromY: 2, toX: 2, toY: 3, elapsedMs: 100, durationMs: 400 },
            moveDurationMs: 400,
          }]]),
        });
        const mutations: boolean[] = [];
        activate(spaces(project, session, {
          readLive: createLifePlacementLiveReader(() => scene, () => project),
          placementDirection: "down",
          getScene: () => scene,
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(mutations).toEqual([true]);
        expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 5, y: 6 });
      });

      it("protects visible below and pass-through bodies without turning them into walking walls", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 3;
        const map = project.maps[project.startMapId]!;
        map.events = [
          event("below", 5, 6, [{
            ...page("floor", "below", { kind: "touch" }),
            footprint: { width: 2, height: 1 },
          }]),
          event("through", 8, 8, [{
            ...page("open", "same", { kind: "action" }),
            overlapForbidden: false,
            footprint: { width: 2, height: 1 },
          }]),
        ];
        const scene = sceneFor(project, session, { map, eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } } });
        const live = readLifePlacementLiveContext(project, scene);
        expect(live?.npcs).toEqual([]);
        const down = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
        expect(placementBlockedByRenderedBodies(project, scene, down, { width: 2, height: 1 })).toBe(true);
        const mutations: boolean[] = [];
        const before = structuredClone(session);
        activate(spaces(project, session, {
          readLive: createLifePlacementLiveReader(() => scene, () => project),
          placementDirection: "down",
          getScene: () => scene,
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(session).toEqual(before);
        session.x = 8;
        session.y = 7;
        const throughScene = sceneFor(project, session, { map, tileX: 8, tileY: 7, eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } } });
        activate(spaces(project, session, {
          readLive: createLifePlacementLiveReader(() => throughScene, () => project),
          placementDirection: "down",
          getScene: () => throughScene,
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(session.farmBuildingPlacements ?? {}).toEqual({});
        expect(mutations).toEqual([false, false]);
        session.x = 2;
        session.y = 2;
        const clear = sceneFor(project, session, { map, tileX: 2, tileY: 2, eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } } });
        activate(spaces(project, session, {
          readLive: createLifePlacementLiveReader(() => clear, () => project),
          placementDirection: "down",
          getScene: () => clear,
          onMutation: (ok) => mutations.push(ok),
        }), "life-ledger-space-building-place-shed");
        expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 2, y: 3 });
        expect(mutations.at(-1)).toBe(true);
      });

      it("threads the live reader through status details and the status controller", () => {
        const { project, itemId } = spatialProject();
        const session = liveSession(project);
        session.inventory[itemId] = 2;
        store.replaceProject(project);
        const readLive = readerFor(project, session);
        const detail = createStatusMenuDetail({
          project,
          session,
          selectedCommand: "life-ledger",
          slots: [],
          waitModeEnabled: false,
          lifeLedgerTab: "spaces",
          readLive,
          placementDirection: "down",
        });
        const place = detail.entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed");
        expect(place?.value).toBe(`${project.startMapId} (5, 6)`);
        place?.onActivate?.();
        expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 5, y: 6 });

        const layout = document.createElement("div");
        document.body.append(layout);
        const playStage = document.createElement("div");
        layout.append(playStage);
        const scene = {
          session,
          map: project.maps[project.startMapId],
          tileX: session.x,
          tileY: session.y,
          facing: "down" as const,
          eventPositions: {},
          getSession: () => session,
          refreshRuntimeSurfaces: () => undefined,
          syncRuntimeState: () => undefined,
        };
        const controller = createPlayerStatusMenuController({
          layout,
          getActiveScene: () => scene as unknown as PlayScene,
          getPlayStage: () => playStage,
          closeMenu: () => undefined,
          closeMenuWithJuice: () => undefined,
          renderTitle: () => undefined,
          emitMenuJuice: (_event, target) => target ?? null,
          menuCloseJuiceMs: 0,
          loadSlot: () => undefined,
        });
        session.x = 3;
        session.y = 3;
        scene.tileX = 3;
        scene.tileY = 3;
        const menu = controller.renderMenu(undefined, "life-ledger");
        expect(menu).toBeTruthy();
        layout.remove();
      });
    });
    describe("life placement scene reader eligibility", () => {
      it("includes relocated and spawned actors and drops erased, off-map, and page-less ghosts", () => {
        const { project } = spatialProject();
        const map = project.maps[project.startMapId]!;
        map.events = [
          event("npc_here", 4, 4, [page("p1", "same", { kind: "action" })]),
          event("ghost", 6, 6, []),
          event("below", 7, 7, [page("floor", "below", { kind: "touch" })]),
          event("through", 3, 3, [{ ...page("open", "same", { kind: "action" }), overlapForbidden: false }]),
          event("erased", 8, 8, [page("p1", "same", { kind: "action" })]),
          event("away", 9, 9, [page("p1", "same", { kind: "action" })]),
        ];
        const session = liveSession(project);
        session.erasedEventIds = ["erased"];
        session.eventLocations = {
          away: { mapId: "other-map", x: 1, y: 1 },
          incoming: { mapId: map.id, x: 2, y: 3 },
        };
        session.spawnedEvents = {
          spawn_1: {
            templateMapId: map.id,
            templateEventId: "npc_here",
            mapId: map.id,
            x: 11,
            y: 4,
          },
        };
        const other = createBlankProject();
        const otherMap = other.maps[other.startMapId]!;
        otherMap.id = "other-map";
        otherMap.events = [event("incoming", 0, 0, [page("p1", "same", { kind: "action" })])];
        project.maps["other-map"] = otherMap;
        const live = readLifePlacementLiveContext(project, {
          map,
          session,
          tileX: 5,
          tileY: 5,
          facing: "down",
          eventPositions: { npc_here: { x: 4, y: 4 } },
        });
        expect(live?.player).toMatchObject({ mapId: map.id, x: 5, y: 5 });
        const cells = new Set(live?.npcs.map((actor) => `${actor.x},${actor.y}`));
        expect(cells.has("4,4")).toBe(true);
        expect(cells.has("2,3")).toBe(true);
        expect(cells.has("11,4")).toBe(true);
        expect(cells.has("6,6")).toBe(false);
        expect(cells.has("7,7")).toBe(false);
        expect(cells.has("3,3")).toBe(false);
        expect(cells.has("8,8")).toBe(false);
        expect(cells.has("9,9")).toBe(false);
      });
    });
  });
  // 숫자 입력은 대사 상자 안 폼인데 이름이 없었고, 자릿수는 숨긴 칸이라 눌러도 읽히지 않았다.
  describe("numberInputA11y", () => {
    isolateTimers();
    afterEach(() => {
      document.body.replaceChildren();
    });
    function open(options: { readonly prompt?: string; readonly showPad?: boolean; readonly digits?: number } = {}) {
      const overlay = document.createElement("div");
      document.body.append(overlay);
      const pending = showNumberInput(overlay, {
        digits: options.digits ?? 4,
        playerTileY: 0,
        mapHeight: 20,
        ...(options.prompt === undefined ? { prompt: "비밀번호" } : { prompt: options.prompt }),
        ...(options.showPad ? { showPad: true } : {}),
      }, {
        applyTextSettings() {},
        resetOverlay() {},
      });
      void pending.catch(() => undefined);
      return overlay;
    }
    function press(key: string, init: KeyboardEventInit = {}): void {
      document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
    }
    function close(overlay: HTMLElement): void {
      overlay.querySelector<HTMLButtonElement>("[data-testid='runtime-input-number-ok']")?.click();
    }
    describe("number input accessibility", () => {
      it("names the dialog, speaks each digit, and keeps Tab inside", () => {
        const overlay = open();
        const dialog = overlay.querySelector<HTMLElement>("[data-testid='runtime-input-number']");
        expect(dialog?.getAttribute("role")).toBe("dialog");
        expect(dialog?.getAttribute("aria-modal")).toBe("true");
        expect(dialog?.getAttribute("aria-labelledby")).toBe("runtime-number-input-title");
        expect(overlay.querySelector("#runtime-number-input-title")?.textContent).toBe("비밀번호");
        expect(overlay.querySelector("[data-testid='runtime-input-number-field']")?.getAttribute("aria-label")).toBe("비밀번호");

        const announcement = overlay.querySelector("[data-testid='runtime-input-number-announcement']");
        expect(announcement?.getAttribute("role")).toBe("status");
        expect(announcement?.getAttribute("aria-live")).toBe("polite");
        expect(announcement?.textContent).toBe("");

        press("1");
        press("2");
        expect(announcement?.textContent).toBe("1 2");
        press("Backspace");
        expect(announcement?.textContent).toBe("1");
        press("Backspace");
        expect(announcement?.textContent).toBe("비어 있음");
        press("Backspace");
        expect(announcement?.textContent).toBe("비어 있음");

        const field = overlay.querySelector<HTMLElement>("[data-testid='runtime-input-number-field']");
        const ok = overlay.querySelector<HTMLElement>("[data-testid='runtime-input-number-ok']");
        field?.focus();
        press("Tab", { shiftKey: true });
        expect(document.activeElement).toBe(ok);
        press("Tab");
        expect(document.activeElement).toBe(field);

        close(overlay);
        expect(overlay.querySelector("[data-testid='runtime-input-number']")).toBeNull();
      });

      it("names the pad's backspace key and announces a pad press", () => {
        const overlay = open({ showPad: true });
        const back = [...overlay.querySelectorAll<HTMLButtonElement>(".number-input-pad-key")].find((button) => button.textContent === "←");
        expect(back?.getAttribute("aria-label")).toBe("한 자리 지우기");
        expect(back?.textContent).toBe("←");

        overlay.querySelector<HTMLButtonElement>(".number-input-pad-key")?.click();
        const announcement = overlay.querySelector("[data-testid='runtime-input-number-announcement']");
        expect(announcement?.textContent).toBe("1");
        back?.click();
        expect(announcement?.textContent).toBe("비어 있음");

        const field = overlay.querySelector<HTMLElement>("[data-testid='runtime-input-number-field']");
        const firstPad = overlay.querySelector<HTMLElement>(".number-input-pad-key");
        field?.focus();
        press("Tab");
        expect(document.activeElement).toBe(firstPad);
        close(overlay);
      });

      it("falls back to the default title when the prompt is blank", () => {
        const overlay = open({ prompt: "  " });
        expect(overlay.querySelector("#runtime-number-input-title")?.textContent).toBe("숫자 입력");
        expect(overlay.querySelector("[data-testid='runtime-input-number-field']")?.getAttribute("aria-label")).toBe("숫자 입력");
        close(overlay);
      });
    });
  });
  describe("objectiveCardTouchControls", () => {
    isolateTimers();
    function host(touch: boolean): HTMLElement {
      const viewport = document.createElement("div");
      viewport.className = "play-viewport";
      if (touch) viewport.dataset.touchUi = "true";
      const stage = document.createElement("div");
      viewport.append(stage);
      document.body.append(viewport);
      return stage;
    }
    function firstCardControls(touch: boolean): string {
      const card = createObjectiveCard();
      const stage = host(touch);
      stage.append(card.element);
      syncObjectiveCard(card, stage, {}, null, true, 0);
      return card.element.querySelector(".objective-card-controls")?.textContent ?? "";
    }
    describe("objective card controls line (fs-vqa-fix-all, 390 touch)", () => {
      it("names keyboard keys on a keyboard screen", () => {
        expect(firstCardControls(false)).toContain("Esc");
      });

      it("names the on-screen buttons on a touch screen, not keyboard keys", () => {
        const text = firstCardControls(true);
        expect(text).not.toMatch(/Esc|Z |방향키/u);
        expect(text).toContain("A");
      });
    });
    // 2026-11-16 확인 빌드 r6 P10: 51자 목표가 구석의 목표 줄에서도, 처음 뜨는 띠에서도 «… 먼저 역 앞 전단지…» 로 끊겨 갈 곳을 말하는 뒷부분이 안 보였다.
    describe("objective strip shows the whole objective text", () => {
      const LONG = "상점가 사람들에게 잃어버린 고양이를 본 적 있는지 물어보자. 먼저 역 앞 전단지 아주머니에게.";

      it("carries the full text on the first strip and on a change, and stays up longer for a long line", () => {
        const card = createObjectiveCard();
        const stage = host(false);
        const session = {};
        syncObjectiveCard(card, stage, session, LONG, true, 0);
        expect(card.element.dataset.kind).toBe("intro");
        expect(card.element.querySelector(".objective-card-text")?.textContent).toBe(LONG);
        // 긴 글은 읽을 시간만큼 더 떠 있다 — 짧은 글의 첫 띠는 2.8초 그대로.
        expect(readingMs(LONG)).toBe((Array.from(LONG).length - 20) * 55);
        expect(card.hideAtMs).toBe(2800 + readingMs(LONG));
        expect(readingMs("촌장에게 말을 걸자")).toBe(0);
        expect(readingMs("가".repeat(400))).toBe(4000);
        syncObjectiveCard(card, stage, session, LONG, true, card.hideAtMs + 1);
        expect(card.element.hidden).toBe(true);
        const next = "편의점 점원에게 아침에 본 고양이를 물어보자. 편의점은 역 앞 상점가 서쪽 끝이다.";
        syncObjectiveCard(card, stage, session, next, true, 20_000);
        expect(card.element.dataset.kind).toBe("change");
        expect(card.element.querySelector(".objective-card-text")?.textContent).toBe(next);
        expect(card.hideAtMs).toBe(20_000 + 2200 + readingMs(next));
      });
    });
  });
});

describe("playSceneInterpreter", () => {
  isolateTimers();
  describe("p0TransitionControlFlow", () => {
    isolateTimers();
    function commandScene(sleepUntilMorning: () => Promise<boolean>) {
      const project = createBlankProject();
      project.system.timeSystem = { enabled: true };
      const session = startSession(project, 501);
      const overlays: string[] = [];
      const dialogue = {
        showText: vi.fn(async () => undefined),
        showChoices: vi.fn(async () => 0),
        showNumberInput: vi.fn(async () => 0),
        hide: vi.fn(),
        close: vi.fn(),
      };
      const registry = new Map<string, unknown>([["dialogue", dialogue]]);
      const scene = {
        session,
        running: false,
        inputEnabled: true,
        lastActionTargetKey: "",
        tileY: 0,
        map: { height: 1 },
        game: { registry: { get: (key: string) => registry.get(key) } },
        sleepUntilMorning,
        setInputEnabled: vi.fn(),
        refreshRuntimeSurfaces: vi.fn(),
        syncRuntimeState: vi.fn(),
        showRuntimeOverlay: (_id: string, text: string) => overlays.push(text),
        clearRuntimeOverlay: vi.fn(),
      } as unknown as PlaySceneContext;
      return { project, session, scene, overlays };
    }
    function deferred<T>() {
      let resolve!: (value: T) => void;
      let reject!: (cause: unknown) => void;
      const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    }
    function parallelScene(commands: Command[], sleepUntilMorning: () => Promise<boolean>) {
      const fixture = commandScene(sleepUntilMorning);
      fixture.project.commonEvents = [{
        id: "common_parallel_time",
        name: "Parallel time",
        trigger: "parallel",
        commands,
      }];
      fixture.scene.parallelProcesses = new Map();
      fixture.scene.activeRuntimeEvents = vi.fn(() => []);
      return fixture;
    }
    describe("P0 transition control flow", () => {
      it("does not resume the next authored command when sleep reports false", async () => {
        const previous = store.getCurrent();
        try {
          const { project, session, scene } = commandScene(async () => false);
          store.replaceProject(project);
          const commands: Command[] = [
            { kind: "sleepUntilMorning" },
            { kind: "setSwitch", switchId: "after_failed_sleep", value: true },
          ];

          await runCommands(scene, commands);

          expect(session.switches.after_failed_sleep).not.toBe(true);
        } finally {
          store.replaceProject(previous);
        }
      });

      it("observes false and rejected fire-and-forget scheduler sleeps", async () => {
        const falseCase = commandScene(async () => false);
        expect(applyNonBlockingStep(falseCase.scene, { kind: "sleepUntilMorning" })).toBe(true);
        await vi.waitFor(() => expect(falseCase.overlays.at(-1)).toContain("scheduled-sleep"));

        const rejectedCase = commandScene(async () => {
          throw new Error("scheduler rejection");
        });
        expect(applyNonBlockingStep(rejectedCase.scene, { kind: "sleepUntilMorning" })).toBe(true);
        await vi.waitFor(() => expect(rejectedCase.overlays.at(-1)).toContain("scheduler rejection"));
      });

      it("observes a rejected fire-and-forget scheduler day advance", async () => {
        const previous = store.getCurrent();
        try {
          const scheduled = commandScene(async () => {
            throw new Error("advance rejection");
          });
          store.replaceProject(scheduled.project);

          expect(applyNonBlockingStep(scheduled.scene, { kind: "advanceTime", days: 1 })).toBe(true);
          await vi.waitFor(() => {
            expect(scheduled.overlays.at(-1)).toContain("scheduled-advance");
            expect(scheduled.overlays.at(-1)).toContain("advance rejection");
          });
        } finally {
          store.replaceProject(previous);
        }
      });

      it("keeps a parallel sleep pending and resumes the interpreter only after success", async () => {
        // Break caught: consumeParallelSteps resumes setSwitch immediately after starting an unresolved sleep.
        const previous = store.getCurrent();
        const sleep = deferred<boolean>();
        try {
          const scheduled = parallelScene([
            { kind: "sleepUntilMorning" },
            { kind: "setSwitch", switchId: "after_parallel_sleep", value: true },
          ], () => sleep.promise);
          store.replaceProject(scheduled.project);

          updateParallelEvents(scheduled.scene, 16);
          updateParallelEvents(scheduled.scene, 16);
          expect(scheduled.session.switches.after_parallel_sleep).not.toBe(true);
          expect(scheduled.scene.parallelProcesses.size).toBe(1);

          sleep.resolve(true);
          await vi.waitFor(() => expect(scheduled.session.switches.after_parallel_sleep).toBe(true));
          expect(scheduled.scene.parallelProcesses.size).toBe(0);
        } finally {
          store.replaceProject(previous);
        }
      });

      it.each([
        ["false", (pending: ReturnType<typeof deferred<boolean>>) => pending.resolve(false)],
        ["reject", (pending: ReturnType<typeof deferred<boolean>>) => pending.reject(new Error("parallel sleep rejection"))],
      ] as const)("stops a failed parallel sleep (%s) without running later commands", async (_kind, finish) => {
        // Break caught: failed parallel sleeps only paint an overlay after their interpreter already completed.
        const previous = store.getCurrent();
        const sleep = deferred<boolean>();
        try {
          const scheduled = parallelScene([
            { kind: "sleepUntilMorning" },
            { kind: "setSwitch", switchId: "after_failed_parallel_sleep", value: true },
          ], () => sleep.promise);
          store.replaceProject(scheduled.project);

          updateParallelEvents(scheduled.scene, 16);
          finish(sleep);
          await vi.waitFor(() => expect(scheduled.overlays.at(-1)).toContain("scheduled-sleep"));
          updateParallelEvents(scheduled.scene, 16);

          expect(scheduled.session.switches.after_failed_parallel_sleep).not.toBe(true);
          expect(scheduled.scene.parallelProcesses.size).toBe(1);
          expect(scheduled.overlays.at(-1)).toContain("scheduled-sleep");
        } finally {
          store.replaceProject(previous);
        }
      });

      it("waits for a parallel advance before running its following command", async () => {
        // Break caught: advanceTime is treated as synchronous inside parallel processes even when it sleeps.
        const previous = store.getCurrent();
        const sleep = deferred<boolean>();
        try {
          const scheduled = parallelScene([
            { kind: "advanceTime", days: 1 },
            { kind: "setSwitch", switchId: "after_parallel_advance", value: true },
          ], () => sleep.promise);
          store.replaceProject(scheduled.project);

          updateParallelEvents(scheduled.scene, 16);
          expect(scheduled.session.switches.after_parallel_advance).not.toBe(true);
          sleep.resolve(true);
          await vi.waitFor(() => expect(scheduled.session.switches.after_parallel_advance).toBe(true));
        } finally {
          store.replaceProject(previous);
        }
      });

      it.each([
        ["false", async () => false],
        ["reject", async () => { throw new Error("parallel advance rejection"); }],
      ] as const)("stops a failed parallel advance (%s) without running later commands", async (_kind, sleepUntilMorning) => {
        // Break caught: advanceTime failure is observed but its parallel interpreter still resumes setSwitch.
        const previous = store.getCurrent();
        try {
          const scheduled = parallelScene([
            { kind: "advanceTime", days: 1 },
            { kind: "setSwitch", switchId: "after_failed_parallel_advance", value: true },
          ], sleepUntilMorning);
          store.replaceProject(scheduled.project);

          updateParallelEvents(scheduled.scene, 16);
          await vi.waitFor(() => expect(scheduled.overlays.at(-1)).toContain("scheduled-advance"));
          updateParallelEvents(scheduled.scene, 16);

          expect(scheduled.session.switches.after_failed_parallel_advance).not.toBe(true);
          expect(scheduled.scene.parallelProcesses.size).toBe(1);
        } finally {
          store.replaceProject(previous);
        }
      });
    });
  });
  // presentItem 실플레이어 경로: 선물하기와 같은 목록 창을 띄우고, 고른 아이템으로 인터프리터를 재개한다.
  describe("presentItemPlayerUi", () => {
    isolateTimers();
    function sceneFixture(inventory: Record<string, number>) {
      const blank = createBlankProject();
      const template = blank.database.items[0]!;
      blank.database.items.push({ ...template, id: "item_knife", name: "피 묻은 칼" }, { ...template, id: "item_letter", name: "찢긴 편지" });
      store.replace(deserialize(serialize(blank)));
      const project = store.getCurrent();
      const messages: string[] = [];
      const dialogue = { showText: async (message: { body: string }) => { messages.push(message.body); }, showChoices: async () => 0, showNumberInput: async () => 0, close() {}, hide() {} };
      const host = document.createElement("div");
      document.body.append(host);
      const scene = { session: startSession(project, 1), map: project.maps[project.startMapId], tileY: 0, running: false, inputEnabled: true, eventPositions: {}, eventSprites: new Map(), game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : key === "dialogueHost" ? host : undefined } }, setInputEnabled() {}, refreshRuntimeSurfaces() {}, syncRuntimeState() {}, showRuntimeOverlay() {}, clearRuntimeOverlay() {} } as unknown as PlaySceneContext;
      scene.session.inventory = { ...inventory };
      return { scene, messages, host };
    }
    const interrogate: Command[] = [{
      kind: "presentItem",
      prompt: "증거를 제시하라",
      itemIds: ["item_knife", "item_letter"],
      options: [{ itemId: "item_knife", branch: [{ kind: "text", body: "자백" }] }],
      otherwiseBranch: [{ kind: "text", body: "헛짚음" }],
      cancelBranch: [{ kind: "text", body: "안 냄" }],
    }];
    async function waitFor<T>(probe: () => T | null | undefined): Promise<T> {
      for (let i = 0; i < 50; i += 1) {
        const found = probe();
        if (found) return found;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error("timed out");
    }
    describe("presentItem 플레이어 UI", () => {
      beforeEach(() => { document.body.replaceChildren(); });

      it("소지한 후보만 목록에 띄우고 고른 아이템의 분기를 실행한다", async () => {
        const { scene, messages, host } = sceneFixture({ item_knife: 1, item_letter: 2, item_other: 1 });
        const run = runCommands(scene, interrogate);
        const button = await waitFor(() => host.querySelector<HTMLButtonElement>("[data-testid='present-item-item_knife']"));
        expect(host.querySelector("[data-testid='present-item-scene']")?.textContent).toContain("증거를 제시하라");
        expect([...host.querySelectorAll("[data-testid^='present-item-item_']")].map((el) => el.textContent)).toEqual(["피 묻은 칼1", "찢긴 편지2"]);
        button.click();
        await run;
        expect(messages).toEqual(["자백"]);
        expect(host.querySelector("[data-testid='present-item-scene']")).toBeNull();
      });

      it("그만두기 → cancelBranch", async () => {
        const { scene, messages, host } = sceneFixture({ item_knife: 1 });
        const run = runCommands(scene, interrogate);
        (await waitFor(() => host.querySelector<HTMLButtonElement>("[data-testid='present-item-cancel']"))).click();
        await run;
        expect(messages).toEqual(["안 냄"]);
      });

      it("보여줄 것이 없으면 prompt 만 보이고 cancelBranch", async () => {
        const { scene, messages, host } = sceneFixture({});
        await runCommands(scene, interrogate);
        expect(host.querySelector("[data-testid='present-item-scene']")).toBeNull();
        expect(messages).toEqual(["증거를 제시하라", "안 냄"]);
      });
    });
  });
  describe("runtimeEventMenus", () => {
    isolateTimers();
    describe("event menus block subsequent commands", () => {
      it.each([["m2-078-open-menu-screen", "openMenuScreen"], ["m2-093-open-load-menu", "openLoadMenu"]])("%s resumes only after closing its requested screen", async (id, callback) => {
        const project = createBlankProject(); store.replace(project);
        const session = startSession(project);
        const root = document.createElement("div"); document.body.append(root);
        const menu = document.createElement("div"); menu.dataset.testid = "main-menu";
        const show = vi.fn(() => openEventMenu(root, () => root.append(menu)));
        const save = vi.fn();
        const dialogue = { showText: vi.fn(), showChoices: vi.fn(), showNumberInput: vi.fn(), hide: vi.fn(), close: vi.fn() };
        const registry = new Map<string, unknown>([["dialogue", dialogue], [callback, show], ["openSaveMenu", save]]);
        const scene = {
          session, map: project.maps[project.startMapId], running: false, inputEnabled: true,
          game: { registry: { get: (key: string) => registry.get(key) } },
          setInputEnabled: vi.fn(), refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
          clearRuntimeOverlay: vi.fn(), showRuntimeOverlay: vi.fn(),
        } as unknown as PlaySceneContext;
        try {
          const pending = runCommands(scene, [
            { kind: "m2Command", commandId: id!, fields: {} },
            { kind: "setSwitch", switchId: "after", value: true },
          ]);
          expect(show).toHaveBeenCalledOnce();
          expect(save).not.toHaveBeenCalled();
          expect(session.switches.after).not.toBe(true);
          await Promise.resolve();
          expect(session.switches.after).not.toBe(true);
          menu.remove();
          await pending;
          expect(session.switches.after).toBe(true);
        } finally { root.remove(); }
      });

      it("resolves when the player is removed without leaking an observer", async () => {
        const root = document.createElement("div"); document.body.append(root);
        const pending = openEventMenu(root, () => { root.innerHTML = '<div data-testid="main-menu"></div>'; });
        root.remove();
        await pending;
      });

      it("loading abandons the old event without closing a new session's dialogue or unlocking it", async () => {
        const project = createBlankProject(); store.replace(project);
        const oldSession = startSession(project), newSession = startSession(project);
        const close = vi.fn(), input = vi.fn();
        const dialogue = { showText: vi.fn(), showChoices: vi.fn(), showNumberInput: vi.fn(), hide: vi.fn(), close };
        const scene = {
          session: oldSession, map: project.maps[project.startMapId], running: false, inputEnabled: true,
          game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : async () => {
            scene.session = newSession; scene.running = true;
          } } },
          setInputEnabled: input, refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
          clearRuntimeOverlay: vi.fn(), showRuntimeOverlay: vi.fn(),
        } as unknown as PlaySceneContext;
        await runCommands(scene, [
          { kind: "m2Command", commandId: "m2-093-open-load-menu", fields: {} },
          { kind: "setSwitch", switchId: "stale", value: true },
        ]);
        expect(oldSession.switches.stale).not.toBe(true);
        expect(newSession.switches.stale).not.toBe(true);
        expect(scene.running).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(input).not.toHaveBeenCalledWith(true);
      });
    });
  });
});
