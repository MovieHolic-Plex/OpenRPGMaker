import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { editorDefaultsLeft, endingClosureProblems, offPremiseArt, openingWithoutPlace, shipBlockers, titleSpoilers, wantsWholeGame } from "@/ai/v2/shipChecks";
import { getTool } from "@/editor/tools";
import type { Project } from "@/project/types";

describe("ship checks: editor defaults (2026-10-25 user rule)", () => {
  it("a blank project lists the factory title, opening, HUD, window look and party defaults", () => {
    const ids = editorDefaultsLeft(createBlankProject() as Project).map((b) => b.id);
    for (const id of ["title-name", "title-image", "opening", "hud", "window-look", "party-names", "party-faces", "hero-look"]) expect(ids).toContain(id);
  });

  it("authored replacements clear the defaults", () => {
    const p = createBlankProject() as Project;
    p.meta.title = "검은 장미 저택";
    p.system.titleScreen = { ...p.system.titleScreen!, title: "검은 장미 저택", backgroundResourceId: "bg-mansion-night" };
    p.system.opening = { ...p.system.opening!, enabled: false };
    getTool("set_field_hud")!.run(p as never, { theme: "horror" } as never);
    p.meta.oprnVnLook = { preset: "night-glass" } as never;
    const hero = p.database.actors.find((a) => a.id === "actor_hero")!;
    hero.name = "하나"; hero.faceResourceId = "face-hana"; hero.characterResourceId = "tex_people1"; hero.characterIndex = 1;
    const ids = editorDefaultsLeft(p).map((b) => b.id);
    for (const id of ["title-name", "title-image", "opening", "hud", "window-look", "party-names", "party-faces", "hero-look"]) expect(ids).not.toContain(id);
  });

  it("flags placeholder endings and one-line endings", () => {
    const p = createBlankProject() as Project;
    p.endings = [{ id: "e1", name: "첫 구간 끝", conditions: [], priority: 1, epilogue: [{ kind: "say", text: "끝." }] }];
    expect(editorDefaultsLeft(p).map((b) => b.id)).toContain("placeholder-text");
    const closure = endingClosureProblems(p);
    expect(closure).toHaveLength(1);
    expect(closure[0]!.message).toContain("맺음 대사");
    p.endings = [{ id: "e2", name: "새벽의 탈출", conditions: [], priority: 1, presentation: { backgroundResourceId: "bg-dawn", finalTitle: "끝" }, epilogue: [
      { kind: "say", text: "하나는 언니 유나의 손을 꼭 잡고 무너지는 저택의 정문을 나섰다." },
      { kind: "say", speaker: "유나", text: "이제 집에 가자. 다시는 이 숲에 들어오지 말자." },
      { kind: "say", text: "새벽빛 아래 검은 장미가 하나둘 시들어 갔고, 두 사람은 뒤를 돌아보지 않았다." },
    ] }];
    expect(endingClosureProblems(p)).toHaveLength(0);
  });

  it("only whole-game requests are ship-checked; title spoilers always", () => {
    expect(wantsWholeGame("검은 장미 저택 공포 게임 만들어 줘")).toBe(true);
    expect(wantsWholeGame("촌장을 광장으로 옮겨 줘")).toBe(false);
    const p = createBlankProject() as Project;
    expect(shipBlockers(p, "촌장을 광장으로 옮겨 줘")).toHaveLength(0);
    p.system.titleScreen = { ...p.system.titleScreen!, title: "10시 24분의 저택" };
    const map = p.maps[p.startMapId!]!;
    map.events.push({ id: "ev_safe", name: "금고", x: 1, y: 1, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "fork", condition: { kind: "variable", variableId: "v1", op: "==", value: 1024 }, then: [], else: [] }] }] } as never);
    expect(titleSpoilers(p)[0]?.id).toBe("title-spoiler");
  });
});

describe("ship checks: the opening and endings show this game's place (J24, J65, J10, J17)", () => {
  it("flags an opening made only of sky layers and clears once a map shot is added", () => {
    const p = createBlankProject() as Project;
    p.system.opening = { enabled: true, skippable: true, scenes: [
      { id: "s1", kind: "image", resourceId: "oprn-pano-night", narration: "비 오는 밤", durationMs: 4000, motion: "none" },
      { id: "s2", kind: "image", resourceId: "oprn-pano-sky-day-clouds-near", narration: "구름", durationMs: 4000, motion: "none" },
    ] };
    expect(openingWithoutPlace(p).map((b) => b.id)).toEqual(["opening-no-place"]);
    p.system.opening.scenes.push({ id: "s3", kind: "animatic", narration: "저택", durationMs: 4000, composition: { width: 384, height: 216, layers: [{ id: "bg", kind: "image", role: "background", resourceId: `map-view:${p.startMapId}`, x: 0, y: 0, width: 384, height: 216 }] } } as never);
    expect(openingWithoutPlace(p)).toEqual([]);
  });

  it("flags endings that fall back to the snowy factory title art in a story with no snow", () => {
    const p = createBlankProject() as Project;
    p.endings = [{ id: "e1", name: "나란히 내리는 역", conditions: [], priority: 1, epilogue: [] }];
    expect(offPremiseArt(p, "서울 지하철 연애 게임 만들어 줘").map((b) => b.id)).toContain("ending-off-premise");
    p.endings[0]!.presentation = { backgroundResourceId: "oprn-pack-still-modern-01" };
    expect(offPremiseArt(p, "서울 지하철 연애 게임 만들어 줘").map((b) => b.id)).not.toContain("ending-off-premise");
    p.endings[0]!.presentation = { backgroundResourceId: "oprn-still-snow-village" };
    expect(offPremiseArt(p, "서울 지하철 연애 게임 만들어 줘").map((b) => b.id)).toContain("ending-off-premise");
    expect(offPremiseArt(p, "눈 내리는 겨울 마을 연애 게임 만들어 줘").map((b) => b.id)).not.toContain("ending-off-premise");
  });
});
