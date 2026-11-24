import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAdvancedCommandBody } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, Project, Condition } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SAMPLE_MOVIE_RESOURCE, listMovieResources, resolveMovieResourceUrl } from "@/editor/panels/eventEditor/playMoviePreview";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import { shouldRerenderCommandForm } from "@/editor/panels/eventEditor/commandEditDialog";
import { commandSchemaFor } from "@/editor/eventCommands/schema/defineCommand";
import { isolateTimers } from "./mergedTeardown";

// EV-2 리치 이벤트 명령 편집 폼 테스트.
// - 레코드 픽커 카드(아이콘 + 이름 + 부제) 렌더
// - 연산 세그먼트 → 숨김 select 동기화 → replaceCommand 호출
// - 수량 스테퍼(− / +)
// - 전/후 프리뷰(시작 인벤토리/소지금/파티 기준) 라이브 계산
// - transfer 통행성 배지
describe("eventEditorRichForms", () => {
  isolateTimers();
  function contextWithReplaceSpy(
    replaceCommand: CommandEditContext["actions"]["replaceCommand"] = vi.fn()
  ): CommandEditContext {
    return {
      path: [2],
      actions: {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand,
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
      },
    };
  }
  function renderBody(context: CommandEditContext, cmd: Command): FakeElement {
    return renderWithFakeDom(() => renderAdvancedCommandBody(context, cmd) ?? document.createElement("div"));
  }
  describe("event editor rich forms", () => {
    let restoreDom: (() => void) | undefined;
    let project: Project;
    let itemId: string;
    let actorId: string;

    beforeEach(() => {
      restoreDom = installFakeDom({ animationFrames: "manual" });
      project = createBlankProject();
      const item = project.database.items[0];
      const actor = project.database.actors[0];
      if (!item || !actor) throw new Error("blank project is missing default item/actor records");
      item.name = "회복약";
      item.iconResourceId = "cc0-jetrel-potion-red";
      actor.name = "잭";
      itemId = item.id;
      actorId = actor.id;
      // 시작 상태(전/후 프리뷰 기준값).
      project.session.inventory = { [itemId]: 3 };
      project.session.gold = 100;
      project.session.partyActorIds = [actorId];
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders the Change Item form with an icon card, op segments, and a before/after preview", () => {
      const body = renderBody(contextWithReplaceSpy(), { kind: "changeItem", itemId, op: "+=", amount: 2 });

      // 기존 select 는 testid/값 그대로 유지(테스트·자동화 보호).
      const select = findByTestId(body, "change-item-select");
      expect(select?.tagName).toBe("SELECT");
      expect(select?.value).toBe(itemId);
      expect(findByTestId(body, "change-item-op-select")?.value).toBe("+=");
      expect(findByTestId(body, "change-item-amount-input")?.value).toBe("2");

      // 선택 레코드 카드: 아이콘 + 이름 + 시작 보유 부제.
      const card = findByTestId(body, "change-item-select-card");
      expect(card?.textContent).toContain("회복약");
      expect(card?.textContent).toContain("시작 보유 ×3");
      expect(card?.querySelector("img")?.attrs.src).toContain("potion-red");

      // 전/후 프리뷰: 시작 인벤토리 3 + 2 = 5.
      const preview = findByTestId(body, "change-item-preview");
      expect(preview?.dataset.before).toBe("3");
      expect(preview?.dataset.after).toBe("5");
      expect(preview?.textContent).toContain("×3");
      expect(preview?.textContent).toContain("×5");
      expect(preview?.textContent).toContain("시작 인벤토리 기준");
    });

    it("changes the Change Item operation through segment buttons and keeps the hidden select in sync", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeItem", itemId, op: "+=", amount: 2 });

      const setSegment = findByTestId(body, "change-item-op-select-segment-set");
      expect(setSegment?.tagName).toBe("BUTTON");
      setSegment?.click();

      expect(findByTestId(body, "change-item-op-select")?.value).toBe("=");
      expect(setSegment?.classList.contains("selected")).toBe(true);
      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeItem", itemId, op: "=", amount: 2 });
      // 대입 연산 프리뷰: 3 → 2.
      expect(findByTestId(body, "change-item-preview")?.dataset.after).toBe("2");
    });

    it("steps the Change Item amount with the +/- stepper buttons and refreshes the preview", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeItem", itemId, op: "+=", amount: 2 });

      findByTestId(body, "change-item-amount-plus")?.click();

      expect(findByTestId(body, "change-item-amount-input")?.value).toBe("3");
      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeItem", itemId, op: "+=", amount: 3 });
      expect(findByTestId(body, "change-item-preview")?.dataset.after).toBe("6");

      findByTestId(body, "change-item-amount-minus")?.click();
      expect(findByTestId(body, "change-item-amount-input")?.value).toBe("2");
    });

    it("explains storage chest scope without exposing runtime implementation jargon", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), {
        kind: "openChest",
        chestId: "farm_shared_storage",
      });

      expect(findByTestId(body, "open-chest-purpose-card")?.textContent).toContain("넣고 다시 꺼낼");
      expect(findByTestId(body, "open-chest-scope-select")?.value).toBe("shared");
      expect(findByTestId(body, "open-chest-id-input")?.value).toBe("farm_shared_storage");
      expect(body.textContent).not.toContain("session.chests");

      findByTestId(body, "open-chest-scope-select-segment-local")?.click();
      expect(replaceCommand).toHaveBeenLastCalledWith([2], { kind: "openChest" });
      expect(findByTestId(body, "open-chest-shared-settings")?.dataset.active).toBe("false");

      findByTestId(body, "open-chest-scope-select-segment-shared")?.click();
      const sharedId = findByTestId(body, "open-chest-id-input");
      if (!sharedId) throw new Error("missing open-chest-id-input");
      sharedId.value = "village_warehouse";
      sharedId.dispatchEvent(new Event("input"));
      expect(replaceCommand).toHaveBeenLastCalledWith([2], {
        kind: "openChest",
        chestId: "village_warehouse",
      });
    });

    it("previews storage as a two-way bag and chest interaction", () => {
      const preview = renderWithFakeDom(() => renderCommandPreview({
        kind: "openChest",
        chestId: "farm_shared_storage",
      })) as FakeElement;

      const stage = findByTestId(preview, "open-chest-preview");
      expect(stage?.textContent).toContain("가방");
      expect(stage?.textContent).toContain("보관 상자");
      expect(stage?.textContent).toContain("넣기");
      expect(stage?.textContent).toContain("꺼내기");
      expect(stage?.textContent).toContain("여러 상자 공유");
      expect(stage?.textContent).not.toContain("session.chests");
    });

    it("authors farm template, display name, and capacity on the storage chest form", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), {
        kind: "openChest",
        template: "farm",
      });

      expect(findByTestId(body, "open-chest-template")?.value).toBe("farm");
      const name = findByTestId(body, "open-chest-display-name");
      if (!name) throw new Error("missing open-chest-display-name");
      name.value = "헛간";
      name.dispatchEvent(new Event("input"));
      expect(replaceCommand).toHaveBeenLastCalledWith([2], {
        kind: "openChest",
        displayName: "헛간",
        template: "farm",
      });
    });

    it("previews Change Gold against the project's starting gold with a clamped result", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeGold", op: "+=", amount: 150 });

      const preview = findByTestId(body, "change-gold-preview");
      expect(preview?.dataset.before).toBe("100");
      expect(preview?.dataset.after).toBe("250");
      expect(preview?.textContent).toContain("지금 100G");
      expect(preview?.textContent).toContain("실행 후 250G");
      expect(preview?.textContent).toContain("시작 소지금 기준");

      // 감소 세그먼트: 100 - 150 → 0 으로 클램프(런타임 changeGold 와 동일 규칙).
      findByTestId(body, "change-gold-op-select-segment-dec")?.click();
      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeGold", op: "-=", amount: 150 });
      expect(preview?.dataset.after).toBe("0");
    });

    it("keeps the legacy select change path working for op selects (Playwright selectOption compatibility)", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeGold", op: "+=", amount: 10 });

      const opSelect = findByTestId(body, "change-gold-op-select");
      if (!opSelect) throw new Error("missing change-gold-op-select");
      opSelect.value = "=";
      opSelect.dispatchEvent(new Event("change"));

      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeGold", op: "=", amount: 10 });
      expect(findByTestId(body, "change-gold-op-select-segment-set")?.classList.contains("selected")).toBe(true);
    });

    it("previews Change Party membership against the starting party", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "changeParty", actorId, action: "remove" });

      expect(findByTestId(body, "change-party-actor-select")?.value).toBe(actorId);
      expect(findByTestId(body, "change-party-actor-select-card")?.textContent).toContain("잭");

      const preview = findByTestId(body, "change-party-preview");
      expect(preview?.dataset.beforeIn).toBe("true");
      expect(preview?.dataset.afterIn).toBe("false");
      expect(preview?.textContent).toContain("파티에 있음");
      expect(preview?.textContent).toContain("파티에 없음");
      expect(preview?.textContent).toContain("시작 파티 기준");

      findByTestId(body, "change-party-action-select-segment-add")?.click();
      expect(replaceCommand).toHaveBeenCalledWith([2], { kind: "changeParty", actorId, action: "add" });
      expect(preview?.dataset.afterIn).toBe("true");
    });

    it("shows enemy names in the Battle Processing troop card subtitle", () => {
      const troop = project.database.troops[0];
      const enemy = project.database.enemies[0];
      if (!troop || !enemy) throw new Error("blank project is missing default troop/enemy records");
      enemy.name = "슬라임";
      troop.enemyIds = [enemy.id];
      store.replace(project);

      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), {
        kind: "battleProcessing",
        troopId: troop.id,
        canEscape: true,
        canLose: false,
      });

      expect(findByTestId(body, "battle-processing-troop-select")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "battle-processing-troop-select-card")?.textContent).toContain("슬라임");
      const escape = findByTestId(body, "battle-processing-escape-select");
      const lose = findByTestId(body, "battle-processing-lose-select");
      expect(escape?.tagName).toBe("SELECT");
      expect(escape?.value).toBe("allow");
      expect(lose?.tagName).toBe("SELECT");
      expect(lose?.value).toBe("gameover");
      if (!escape) throw new Error("missing battle-processing-escape-select");
      escape.value = "deny";
      escape.dispatchEvent(new Event("change"));
      expect(replaceCommand).toHaveBeenCalledWith([2], {
        kind: "battleProcessing",
        troopId: troop.id,
        canEscape: false,
        canLose: false,
        battleFlow: undefined,
        troopSource: undefined,
        troopVariableId: undefined,
        branchOnResult: undefined,
        victoryBranch: undefined,
        defeatBranch: undefined,
        escapeBranch: undefined,
      });
    });

    it("renders equipment icons in the Change Equipment picker card", () => {
      const equipment = project.database.equipment[0];
      if (!equipment) throw new Error("blank project is missing default equipment records");
      equipment.name = "청동검";
      equipment.iconResourceId = "cc0-jetrel-bronze-sword";
      store.replace(project);

      const body = renderBody(contextWithReplaceSpy(), {
        kind: "changeEquipment",
        actorId,
        slot: "weapon",
        equipmentId: equipment.id,
      });

      expect(findByTestId(body, "change-equipment-actor-select")?.value).toBe(actorId);
      expect(findByTestId(body, "change-equipment-slot-select")?.tagName).toBe("SELECT");
      const selected = findByTestId(body, "change-equipment-selected");
      expect(selected?.textContent).toContain("청동검");
      expect(selected?.querySelector("img")?.attrs.src).toContain("bronze-sword");
    });

    it("renders Learn Skill with record picker cards while keeping the legacy select test ids", () => {
      const skill = project.database.skills[0];
      if (!skill) throw new Error("blank project is missing default skill records");
      skill.name = "파이어";
      store.replace(project);

      const body = renderBody(contextWithReplaceSpy(), { kind: "learnSkill", actorId, skillId: skill.id });

      expect(findByTestId(body, "learn-skill-actor-select")?.value).toBe(actorId);
      expect(findByTestId(body, "learn-skill-skill-select")?.value).toBe(skill.id);
      expect(findByTestId(body, "learn-skill-skill-select-card")?.textContent).toContain("파이어");
      expect(findByTestId(body, "event-command-learn-skill-form")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-action-select")).toBeTruthy();
    });

    it("flags out-of-bounds transfer destinations with a blocked passability badge", () => {
      const body = renderBody(contextWithReplaceSpy(), {
        kind: "transfer",
        mapId: project.startMapId,
        x: -1,
        y: -1,
      });

      expect(findByTestId(body, "transfer-command-summary")).not.toBeNull();
      const badge = findByTestId(body, "transfer-passability-badge");
      expect(badge?.dataset.passable).toBe("false");
      expect(badge?.textContent).toContain("통행 불가 타일!");
    });

    it("seeds an unknown transfer target to the active start map and shows passability", async () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderBody(contextWithReplaceSpy(replaceCommand), { kind: "transfer", mapId: "", x: 0, y: 0 });
      const badge = findByTestId(body, "transfer-passability-badge");

      expect(findByTestId(body, "transfer-command-summary")?.textContent).toContain(project.maps[project.startMapId]?.name);
      expect(badge?.dataset.passable).toBe("true");
      await Promise.resolve();
      expect(replaceCommand).toHaveBeenCalledWith([2], {
        kind: "transfer",
        mapId: project.startMapId,
        x: 0,
        y: 0,
      });
    });
  });
});

describe("playMovieEditorBody", () => {
  isolateTimers();
  const WEBM_DATA_URL = "data:video/webm;base64,GkXfo0AgQoaBAULygQRC";
  const MP4_DATA_URL = "data:video/mp4;base64,AAAAIGZ0eXBpc29t";
  function ctx(replaceCommand = vi.fn()): CommandEditContext {
    return {
      path: [0],
      actions: {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand,
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
      },
    };
  }
  /**
   * 동영상 업로드는 ResourceKind 에 전용 종류가 없다(`movie` 를 넣으면 RESOURCE_SLICING 의
   * `satisfies Record<ResourceKind, …>` 가 깨진다 — 다른 레인 소유 파일).
   * 그래서 편집기는 업로드 kind 가 아니라 **미디어 타입**으로 동영상을 알아본다.
   */
  function withMovies(project: Project): Project {
    project.assets.uploaded["movie-opening"] = {
      id: "movie-opening",
      name: "오프닝 영상",
      kind: "picture",
      dataUrl: WEBM_DATA_URL,
      meta: {},
    };
    project.assets.uploaded["movie-ending"] = {
      id: "movie-ending",
      name: "엔딩 영상",
      kind: "picture",
      dataUrl: MP4_DATA_URL,
      meta: {},
    };
    project.assets.uploaded["picture-note"] = {
      id: "picture-note",
      name: "쪽지 그림",
      kind: "picture",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      meta: {},
    };
    return project;
  }
  function movieBody(cmd: Extract<Command, { kind: "playMovie" }>, replaceCommand = vi.fn()): FakeElement {
    return renderWithFakeDom(() => renderAdvancedCommandBody(ctx(replaceCommand), cmd)!);
  }
  function lastCommand(replaceCommand: ReturnType<typeof vi.fn>): Extract<Command, { kind: "playMovie" }> {
    return replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "playMovie" }>;
  }
  describe("playMovie 편집기 본문", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(withMovies(createBlankProject()));
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("동영상 리소스 목록은 미디어 타입이 동영상인 업로드만 담는다", () => {
      const entries = listMovieResources(store.getCurrent());

      expect(entries.map((entry) => entry.id)).toEqual(["movie-ending", "movie-opening"]);
      expect(entries.map((entry) => entry.name)).toEqual(["엔딩 영상", "오프닝 영상"]);
    });

    it("리소스 URL 은 업로드 동영상만 통과시키고 그림 데이터는 거른다", () => {
      const project = store.getCurrent();

      expect(resolveMovieResourceUrl("movie-opening", project)).toBe(WEBM_DATA_URL);
      expect(resolveMovieResourceUrl("picture-note", project)).toBeNull();
      expect(resolveMovieResourceUrl("", project)).toBeNull();
    });

    it("번들 오디오와 같은 ID의 업로드는 동영상 선택에서 제외한다", () => {
      const project = store.getCurrent();
      const id = "cc0-se-osx-wooded-box-open";
      project.assets.uploaded[id] = { id, name: "충돌 영상", kind: "movie", dataUrl: WEBM_DATA_URL, meta: {} };
      expect(listMovieResources(project).map(entry => entry.id)).toEqual(["movie-ending", "movie-opening"]);
      expect(resolveMovieResourceUrl(id, project)).toBeNull();
    });

    it("본문이 동영상 픽커와 항목을 그린다", () => {
      const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" });

      expect(findByTestId(body, "play-movie-command-body")).not.toBeNull();
      const select = findByTestId(body, "play-movie-resource-select");
      expect(select).not.toBeNull();
      expect(select?.children.map((option) => option.value)).toEqual(["", "movie-ending", "movie-opening"]);
      expect(select?.value).toBe("movie-opening");
      expect(findByTestId(body, "play-movie-resource-select-card")?.textContent).toContain("오프닝 영상");
    });

    it("미리보기 표시면이 선택한 동영상을 실제 <video> 로 걸어 둔다", () => {
      const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" });

      const stage = findByTestId(body, "play-movie-preview-stage");
      expect(stage).not.toBeNull();
      const video = findByTestId(body, "play-movie-preview-video");
      expect(video?.tagName).toBe("VIDEO");
      expect(video?.getAttribute("src")).toBe(WEBM_DATA_URL);
      expect(video?.getAttribute("preload")).toBe("metadata");
      expect(video?.getAttribute("controls")).not.toBeNull();
      expect(video?.getAttribute("muted")).not.toBeNull();
      expect(findByTestId(body, "play-movie-sample-note")).toBeNull();
    });

    it("리소스가 없으면 번들 샘플 클립을 재생면에 걸고 그 사실을 밝힌다", () => {
      const body = movieBody({ kind: "playMovie", resourceId: "" });

      expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(SAMPLE_MOVIE_RESOURCE.url);
      expect(findByTestId(body, "play-movie-sample-note")?.textContent).toContain("샘플");
    });

    it("명령에 지정된 번들 동영상은 대기 설정을 바꿔도 유지한다", () => {
      const replaceCommand = vi.fn();
      const body = movieBody({ kind: "playMovie", resourceId: SAMPLE_MOVIE_RESOURCE.id }, replaceCommand);
      const wait = findByTestId(body, "play-movie-wait-select") as FakeElement;
      wait.value = "false";
      wait.dispatchEvent(new Event("change"));

      expect(lastCommand(replaceCommand)).toMatchObject({ resourceId: SAMPLE_MOVIE_RESOURCE.id, wait: false });
      expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(SAMPLE_MOVIE_RESOURCE.url);
      expect(findByTestId(body, "play-movie-sample-note")).toBeNull();
    });

    it("픽커 선택이 명령의 resourceId 를 갱신한다", () => {
      const replaceCommand = vi.fn();
      const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" }, replaceCommand);

      const select = findByTestId(body, "play-movie-resource-select") as FakeElement;
      select.value = "movie-ending";
      select.dispatchEvent(new Event("change"));

      // 본문은 대기·스킵을 늘 명시해 쓴다 — 생략은 런타임에서 true 다(commandCatalog playMovie `wait !== false`).
      expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-ending", wait: true, skippable: true });
      expect(findByTestId(body, "play-movie-preview-video")?.getAttribute("src")).toBe(MP4_DATA_URL);
    });

    it("완료 대기·스킵 허용 토글이 명령 모양에 그대로 반영된다", () => {
      const replaceCommand = vi.fn();
      // 생략한 대기·스킵은 런타임 기본값 true 로 보인다(commandCatalog playMovie `wait !== false`) — 끄는 쪽부터 누른다.
      const body = movieBody({ kind: "playMovie", resourceId: "movie-opening" }, replaceCommand);

      (findByTestId(body, "play-movie-wait-select-segment-false") as FakeElement).dispatchEvent(new Event("click"));
      expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: false, skippable: true });

      (findByTestId(body, "play-movie-skippable-select-segment-false") as FakeElement).dispatchEvent(new Event("click"));
      expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: false, skippable: false });

      (findByTestId(body, "play-movie-wait-select-segment-true") as FakeElement).dispatchEvent(new Event("click"));
      expect(lastCommand(replaceCommand)).toEqual({ kind: "playMovie", resourceId: "movie-opening", wait: true, skippable: false });
    });

    it("번들 샘플 클립 파일이 dev 서버 경로 그대로 레포에 있다", () => {
      const filePath = fileURLToPath(new URL(`../public${SAMPLE_MOVIE_RESOURCE.url}`, import.meta.url));

      expect(existsSync(filePath), `${filePath} 가 없다 — node scripts/gen-sample-movie.mjs 로 생성`).toBe(true);
    });
  });
});

describe("roguelikeRunEditor", () => {
  isolateTimers();
  function change(element: FakeElement | null, value: string): void {
    if (!element) throw new Error(`missing control for value ${value}`);
    element.value = value;
    element.dispatchEvent(new Event("change"));
  }
  function stagedContext(initial: Command): { context: CommandEditContext; current: () => Command } {
    let command = initial;
    const context: CommandEditContext = {
      path: [0],
      getCurrentCommand: () => command,
      actions: {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand: vi.fn((_path, next) => { command = next; }),
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
      },
    };
    return { context, current: () => command };
  }
  describe("roguelike run event authoring", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => { restoreDom = installFakeDom(); });
    afterEach(() => { restoreDom?.(); });

    it("authors a run floor condition without raw JSON", () => {
      let current: Condition = { kind: "run", query: "floor", op: ">=", value: 3 };
      const body = renderWithFakeDom(() => conditionForm(current, (next) => { current = next; }));

      expect(findByTestId(body, "event-condition-run-query")?.value).toBe("floor");
      change(findByTestId(body, "event-condition-run-floor-op"), ">");
      change(findByTestId(body, "event-condition-run-floor-value"), "7");

      expect(current).toEqual({ kind: "run", query: "floor", op: ">", value: 7 });
    });

    it("keeps consecutive run flag edits on the latest staged command", () => {
      const initial: Command = { kind: "runControl", action: "setFlag", flag: "door", value: false };
      const staged = stagedContext(initial);
      const body = renderWithFakeDom(() => renderAdvancedCommandBody(staged.context, initial)!);

      change(findByTestId(body, "event-command-run-flag"), "bossDoor");
      change(findByTestId(body, "event-command-run-flag-value"), "true");

      expect(staged.current()).toEqual({ kind: "runControl", action: "setFlag", flag: "bossDoor", value: true });
    });

    it("rerenders the command editor when the run action changes shape", () => {
      expect(shouldRerenderCommandForm(
        { kind: "runControl", action: "start" },
        { kind: "runControl", action: "advance", amount: 1 },
      )).toBe(true);
    });

    it("registers runControl in the native command schema catalog", () => {
      expect(commandSchemaFor("runControl")?.family).toBe("system");
    });
  });
});
