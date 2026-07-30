// 주민 대사가 상황에 반응하는지, 그리고 그 과정에서 기능이 사라지지 않는지 지키는 가드.
//
// 실측 배경(2026-07-26): 장로만 6페이지 퀘스트 체인을 갖고 나머지 주민은 1페이지 고정 대사였다.
// 종을 되살려도(sw_0006) 마을 사람 누구도 몰랐다. 조건 시스템은 이미 다 지원하는데 쓰지 않았을 뿐이다.
//
// 가장 위험한 회귀: 페이지가 교체되면 그 페이지의 **명령 전체**가 바뀐다. 상인의 shop /
// 노아의 recoverAll 을 빠뜨리면 조건이 맞는 순간 상점과 회복이 조용히 사라진다.
import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { layerDewVillageDialogue } from "@/project/defaults/dewVillageDialogue";
import { resolveEventPage } from "@/project/io/pageResolution";
import type { GameEvent, Project } from "@/project/types";

const project = createSampleAdventureProject();
const map = project.maps[project.startMapId]!;
const npc = (id: string): GameEvent => {
  const found = map.events.find((entry) => entry.id === id);
  if (!found) throw new Error(`이벤트 없음: ${id}`);
  return found;
};

type Session = Parameters<typeof resolveEventPage>[1];
const EMPTY = {
  switches: {},
  variables: {},
  selfSwitches: {},
  gold: 0,
  inventory: {},
  partyActorIds: [],
  timers: {},
} as unknown as Session;

function session(patch: Record<string, unknown>): Session {
  return { ...(EMPTY as unknown as Record<string, unknown>), ...patch } as unknown as Session;
}

function lineFor(id: string, state: Session): string {
  const page = resolveEventPage(npc(id), state);
  const text = page?.commands.find((command) => command.kind === "text") as { body?: string } | undefined;
  return text?.body ?? "";
}

function functionalKinds(id: string, state: Session): string[] {
  const page = resolveEventPage(npc(id), state);
  return (page?.commands ?? []).filter((command) => command.kind !== "text").map((command) => command.kind);
}

describe("주민 대사 층", () => {
  it("호감 조건이 작동하려면 characterId 가 있어야 한다 — 없으면 영원히 거짓이다", () => {
    for (const id of ["ev_merchant", "ev_noah", "ev_kid"]) {
      expect(npc(id).characterId, `${id} characterId`).toBeTruthy();
    }
  });

  it("대화로 호감이 자란다 — 자라지 않으면 호감 층이 열리지 않는다", () => {
    for (const id of ["ev_merchant", "ev_noah", "ev_kid"]) {
      expect(npc(id).talkFriendship, `${id} talkFriendship`).toBeTruthy();
    }
  });

  it("현재 활동에 따라 다른 말을 한다", () => {
    const idle = lineFor("ev_merchant", session({}));
    const preparing = lineFor("ev_merchant", session({ npcActivities: { ev_merchant: "prepare" } }));
    const selling = lineFor("ev_merchant", session({ npcActivities: { ev_merchant: "market" } }));
    expect(new Set([idle, preparing, selling]).size).toBe(3);
  });

  it("퀘스트 진행을 마을이 안다 — 수락 후와 종 복원 후 대사가 다르다", () => {
    for (const id of ["ev_merchant", "ev_noah", "ev_kid"]) {
      const before = lineFor(id, session({}));
      const accepted = lineFor(id, session({ switches: { sw_0001: true } }));
      const restored = lineFor(id, session({ switches: { sw_0006: true } }));
      expect(new Set([before, accepted, restored]).size, `${id} 상태별 대사`).toBe(3);
    }
  });

  it("호감이 높으면 태도가 바뀐다", () => {
    const plain = lineFor("ev_kid", session({}));
    const friendly = lineFor("ev_kid", session({ friendship: { char_lu: 40 } }));
    expect(friendly).not.toBe(plain);
  });

  it("어떤 층이 뽑혀도 상점이 사라지지 않는다", () => {
    const states: Session[] = [
      session({}),
      session({ npcActivities: { ev_merchant: "prepare" } }),
      session({ npcActivities: { ev_merchant: "market" } }),
      session({ switches: { sw_0001: true } }),
      session({ switches: { sw_0006: true } }),
      session({ friendship: { char_merchant: 40 } }),
    ];
    for (const state of states) {
      expect(functionalKinds("ev_merchant", state)).toContain("shop");
    }
  });

  it("어떤 층이 뽑혀도 회복이 사라지지 않는다", () => {
    const states: Session[] = [
      session({}),
      session({ npcActivities: { ev_noah: "well" } }),
      session({ npcActivities: { ev_noah: "field" } }),
      session({ switches: { sw_0001: true } }),
      session({ switches: { sw_0002: true } }),
      session({ switches: { sw_0006: true } }),
      session({ friendship: { char_noah: 40 } }),
    ];
    for (const state of states) {
      expect(functionalKinds("ev_noah", state)).toContain("recoverAll");
    }
  });

  it("장로 퀘스트 체인은 건드리지 않는다 — 페이지 순서에 의존한다", () => {
    const elder = npc("ev_mir_elder");
    expect(elder.pages?.length).toBe(6);
    // 종 복원 페이지가 여전히 마지막에서 이겨야 한다.
    expect(lineFor("ev_mir_elder", session({ switches: { sw_0006: true } }))).toContain("종이 다시 울리네");
    // 미수락 상태에서는 의뢰 페이지가 나와야 한다.
    expect(lineFor("ev_mir_elder", session({}))).toContain("종이 약해져");
  });

  it("두 번 적용해도 페이지가 중복되지 않는다(멱등)", () => {
    const before = npc("ev_merchant").pages?.length ?? 0;
    layerDewVillageDialogue(project);
    expect(npc("ev_merchant").pages?.length).toBe(before);
  });

  it("건너뛴 주민이 없다", () => {
    const fresh: Project = createSampleAdventureProject();
    for (const event of fresh.maps[fresh.startMapId]!.events) {
      if (event.pages && event.pages.length > 1 && event.id !== "ev_mir_elder") {
        event.pages = [event.pages[0]!];
      }
    }
    expect(layerDewVillageDialogue(fresh).skipped).toEqual([]);
  });
});
