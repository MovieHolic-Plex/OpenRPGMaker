/** @vitest-environment happy-dom */
// 호감도 조건의 UI 게이트 — 런타임이 하드 게이트(resolveSocialKey → null)로 항상 거짓을 내는 조합을
// 저작 화면이 조용히 만들게 두지 않는다. 근거: docs/specs/2026-07-14-character-id-relationship-gate.md §1-7,8
import { beforeEach, describe, expect, it } from "vitest";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { openEventRailGroupFor } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition, GameEvent, Project } from "@/project/types";

const HINT = "event-condition-friendship-requires-character-id";

function pageWith(conditions: readonly EventPageCondition[]): EventPage {
  return {
    id: "p1",
    name: "호감도 게이트",
    conditions: [...conditions],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "안녕" }],
  };
}

function renderRow(page: EventPage, event?: { characterId?: string }): HTMLElement {
  const host = document.createElement("div");
  host.append(...renderPageConditions("map-start", "ev_gate", page, event));
  return host;
}

function seedEvent(page: EventPage, characterId?: string): { project: Project; mapId: string; event: GameEvent } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const event: GameEvent = {
    id: "ev_gate",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
    ...(characterId ? { characterId } : {}),
  };
  project.maps[mapId]!.events = [event];
  return { project, mapId, event };
}

function issueCodes(page: EventPage, characterId?: string): readonly string[] {
  const { project, mapId, event } = seedEvent(page, characterId);
  return validateEventDraftBody(project, mapId, event).issues.map((issue) => issue.code);
}

describe("호감도 조건 게이트", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("NPC 관계가 없으면 조건 행이 항상 거짓임을 말한다", () => {
    const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]));
    expect(host.querySelector(`[data-testid="${HINT}"]`)).not.toBeNull();
    // 행 자체는 사라지지 않는다 — RM 계약상 핵심 조건 행은 항상 자리를 지킨다.
    expect(host.querySelector('[data-testid="event-page-friendship-condition-value"]')).not.toBeNull();
  });

  it("NPC 관계가 연결되면 경고가 사라진다", () => {
    const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), { characterId: "char_a" });
    expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
  });

  it("NPC 키를 직접 적은 경로는 미연결에서도 유효하다", () => {
    const host = renderRow(pageWith([{ kind: "friendshipAtLeast", npcKey: "village_herbalist", value: 80 }]));
    expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
  });

  it("검증기가 미연결 호감도 조건을 경고로 잡는다", () => {
    expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }])))
      .toContain("condition.friendship.no-character-id");
  });

  it("검증기는 연결됐거나 NPC 키가 있으면 경고하지 않는다", () => {
    expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), "char_a"))
      .not.toContain("condition.friendship.no-character-id");
    expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", npcKey: "char_b", value: 80 }])))
      .not.toContain("condition.friendship.no-character-id");
  });

  it("중첩·명령 안 조건도 같은 게이트를 받는다", () => {
    const nested = pageWith([{ kind: "all", conditions: [{ kind: "friendshipAtLeast", value: 10 }] }]);
    expect(issueCodes(nested)).toContain("condition.friendship.no-character-id");

    const forked = pageWith([]);
    const page: EventPage = {
      ...forked,
      commands: [{
        kind: "fork",
        condition: { kind: "friendshipAtLeast", value: 10 },
        then: [],
        else: [],
      }],
    };
    expect(issueCodes(page)).toContain("condition.friendship.no-character-id");
  });
});

describe("검증 이슈 앵커와 설정 레일 그룹", () => {
  it("닫힌 그룹 안의 앵커를 가리키면 그 그룹이 열린다", () => {
    const rail = document.createElement("div");
    rail.className = "event-editor-settings-accordion";
    rail.dataset.railKey = "rail-test";
    const groups = ["look-talk", "when"].map((slug, index) => {
      const group = document.createElement("div");
      group.className = `event-editor-settings-accordion-group${index === 0 ? " is-open" : ""}`;
      group.dataset.railGroup = slug;
      const header = document.createElement("button");
      header.className = "event-editor-settings-accordion-header";
      header.setAttribute("aria-expanded", index === 0 ? "true" : "false");
      group.append(header);
      rail.append(group);
      return group;
    });
    const anchor = document.createElement("input");
    groups[1]!.append(anchor);
    document.body.append(rail);

    openEventRailGroupFor(anchor);

    expect(groups[1]!.classList.contains("is-open")).toBe(true);
    expect(groups[0]!.classList.contains("is-open")).toBe(false);
    expect(groups[1]!.querySelector(".event-editor-settings-accordion-header")?.getAttribute("aria-expanded")).toBe("true");
    rail.remove();
  });
});
