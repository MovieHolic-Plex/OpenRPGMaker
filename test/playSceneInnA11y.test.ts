// @vitest-environment happy-dom
// 여관 창: 제목으로 이름 붙인 대화상자, 질문·부족·휴식은 상태 영역,
// 상태 회복 미리보기(「독 → 정상」)는 CSS 가 아니라 글자로 있다.
import { afterEach, describe, expect, it } from "vitest";
import { playInn } from "@/player/playSceneCommerce";
import { updatePlayerPreferences } from "@/player/playerPreferences";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID, DEFAULT_STATE_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

function sceneFixture(gold: number): { scene: PlaySceneContext; waits: Array<() => void> } {
  store.replace(deserialize(serialize(createBlankProject())));
  const project = store.getCurrent();
  const host = document.createElement("div");
  document.body.append(host);
  const session = startSession(project, 1);
  session.gold = gold;
  session.actorStateIds = { [DEFAULT_ACTOR_ID]: [DEFAULT_STATE_ID] };
  const waits: Array<() => void> = [];
  const scene = {
    session,
    map: project.maps[project.startMapId],
    tileX: 0,
    tileY: 0,
    game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
    syncRuntimeState() {},
    time: {
      delayedCall(ms: number, cb: () => void) {
        void ms;
        waits.push(cb);
        return { remove() {} };
      },
    },
  } as unknown as PlaySceneContext;
  return { scene, waits };
}

afterEach(() => {
  document.body.replaceChildren();
  updatePlayerPreferences({ reduceMenuMotion: false });
});

describe("inn dialog accessibility", () => {
  it("names the inn, announces the question, and puts the cure preview in the text", async () => {
    const { scene } = sceneFixture(0);
    const pending = playInn(scene, { kind: "inn", price: 40 });
    const dialog = document.querySelector<HTMLElement>("[data-testid='inn-scene']");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-label")).toBe("여관");

    const status = document.querySelector<HTMLElement>("[data-testid='commerce-status']");
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.textContent).toContain("40");
    expect(status?.textContent).toContain("묵으시겠습니까");

    const state = document.querySelector(`[data-testid='inn-party-row-${DEFAULT_ACTOR_ID}'] .runtime-inn-party-state`);
    expect(state?.textContent).toBe("독 → 정상");
    expect(document.querySelector(".runtime-inn-track")?.getAttribute("aria-hidden")).toBe("true");

    document.querySelector<HTMLButtonElement>("[data-testid='inn-stay']")?.click();
    expect(status?.textContent).toBe("소지금이 부족합니다.");
    expect(dialog?.getAttribute("aria-label")).toBe("여관");

    document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
    await pending;
    expect(document.querySelector("[data-testid='inn-scene']")).toBeNull();
  });

  it("names the rest blackout and skips the fade when menu motion is reduced", async () => {
    updatePlayerPreferences({ reduceMenuMotion: true });
    const { scene, waits } = sceneFixture(80);
    const pending = playInn(scene, { kind: "inn", price: 10, restDurationMs: 400, wakeDurationMs: 400 });
    document.querySelector<HTMLButtonElement>("[data-testid='inn-stay']")?.click();

    const fade = document.querySelector<HTMLElement>("[data-testid='inn-resting']");
    expect(fade?.getAttribute("role")).toBe("status");
    expect(fade?.getAttribute("aria-label")).toBe("휴식 중");
    expect(fade?.style.animation).toBe("none");
    expect(fade?.style.opacity).toBe("0.96");
    expect(document.querySelector("[data-testid='inn-scene']")?.getAttribute("aria-label")).toBe("여관");

    expect(waits).toHaveLength(1);
    waits.shift()?.();
    await Promise.resolve();
    const wake = document.querySelector<HTMLElement>("[data-testid='inn-wake']");
    expect(wake?.getAttribute("role")).toBe("status");
    expect(wake?.textContent).toContain("좋은 아침입니다");
    expect(document.querySelector("[data-testid='inn-scene']")?.getAttribute("aria-label")).toBe("여관");

    expect(waits).toHaveLength(1);
    waits.shift()?.();
    await pending;
    expect(document.querySelector("[data-testid='inn-scene']")).toBeNull();
  });

  it("uses the database gold, HP, and MP terms on the inn purse and gauges", async () => {
    const { scene } = sceneFixture(1250);
    store.getCurrent().meta.terms = { gold: "냥", hp: "체력", mp: "마력" };
    const actorId = scene.session.partyActorIds[0] ?? DEFAULT_ACTOR_ID;
    const vitals = scene.session.actorVitals[actorId];
    if (!vitals) throw new Error("missing party vitals");
    vitals.hp = Math.max(1, Math.floor(vitals.maxHp * 0.4));
    vitals.mp = Math.floor(vitals.maxMp * 0.25);

    const pending = playInn(scene, { kind: "inn", price: 30 });
    const dialog = document.querySelector<HTMLElement>("[data-testid='inn-scene']");
    expect(dialog?.textContent).toContain("30 냥");
    const purse = document.querySelector("[data-testid='inn-summary-gold']")?.textContent ?? "";
    expect(purse).toContain("냥");
    expect(purse).not.toContain("G");
    expect(document.querySelector("[data-testid='inn-party-hp-0']")?.textContent).toContain("체력");
    expect(document.querySelector("[data-testid='inn-party-mp-0']")?.textContent).toContain("마력");
    expect(document.querySelector("[data-testid='inn-summary-hp']")?.textContent).toContain("체력");
    expect(document.querySelector("[data-testid='inn-summary-mp']")?.textContent).toContain("마력");

    document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
    await pending;
  });
});
