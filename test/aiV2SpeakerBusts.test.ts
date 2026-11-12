import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { findSharedPortrait, dialogueFaceForEmotion } from "@/assets/sharedPortraitAssets";
import { bustOfChip, bustOfFace, settleSpeakerBustsIn } from "@/ai/v2/story/speakerBust";
import { pickPersonGraphic } from "@/ai/v2/place/people";
import { fillPartyLooks } from "@/ai/v2/story/shipLookDefaults";
import { charsetBattlerForCharacter } from "@/assets/charsetBattlers";
import { collectWebExportAssets } from "@/project/webExportAssets";
import type { Command, GameEvent, Project } from "@/project/types";

// 2026-11-12 오너(r1w-fun): «초상화나 이런 건 미리 만들어둔 거 써도 좋았겠다». 공용 흉상(76세트 × 16표정)이 있는데 v2 가 지은 대사에는 이름표만 떴다.
// 이제 화자의 흉상이 기본이다 — 칩에서 결정적으로 나온다(칩 → 검토된 짝 얼굴 → 표정 세트 → 흉상). 문서 openwiki/assistant-v2.md 「대사에는 화자의 공용 흉상」.

const OLD_MAN = "shared-people1-old-man-expressions-bust-base";
const chip = (sheet: string, index: number) => ({ sprite: { type: "bundled", id: `tex_easyrpg_charset_${sheet}` }, direction: "down", pattern: charsetFrameIndex({ characterIndex: index, direction: "down", pattern: 1 }) });
const text = (speaker: string | undefined, body: string): Command => ({ kind: "text", ...(speaker ? { speaker } : {}), body }) as Command;

function withEvent(pages: unknown[], name = "촌장", id = "ev_chain_t_1"): { project: Project; event: () => GameEvent } {
  const project = createBlankProject() as Project;
  const map = project.maps[project.startMapId]!;
  (map.events as unknown[]).push({ id, name, x: 3, y: 3, pages });
  return { project, event: () => project.maps[map.id]!.events.find((e) => e.id === id)! };
}
const kinds = (commands: readonly Command[]) => commands.map((c) => (c.kind === "changeFace" ? `face:${c.resourceId}` : c.kind === "text" ? `text:${c.speaker ?? ""}${c.emotion ? `:${c.emotion}` : ""}` : c.kind));

describe("칩 → 공용 흉상", () => {
  it("짝 얼굴이 검토된 칩은 그 표정 세트의 흉상, 없는 칩은 없다", () => {
    expect(bustOfChip("tex_easyrpg_charset_people1", 6)).toBe(OLD_MAN);
    expect(bustOfChip("easyrpg-charset-people1", 6)).toBe(OLD_MAN);
    expect(findSharedPortrait(OLD_MAN)?.mode).toBe("bust");
    expect(bustOfFace("easyrpg-faceset-people1-06")).toBe(OLD_MAN);
    // 터번 노인(짝 얼굴 없음) · 청년 병사(얼굴 낱장뿐, 흉상 없음) · 몬스터 칩.
    expect(bustOfChip("tex_easyrpg_charset_people4", 6)).toBeUndefined();
    expect(bustOfChip("tex_easyrpg_charset_people5", 0)).toBeUndefined();
    expect(bustOfChip("generated-enemy-boar-tusk", 0)).toBeUndefined();
  });

  it("줄의 표정이 같은 세트의 표정 그림을 고르며, 내보내기에 실린다", () => {
    expect(dialogueFaceForEmotion(OLD_MAN, "angry", undefined)).toBe("shared-people1-old-man-expressions-bust-angry");
    const { project } = withEvent([{ graphic: chip("people1", 6), trigger: { kind: "action" }, commands: [text("촌장", "어서 오게.")] }]);
    settleSpeakerBustsIn(project);
    // 내보내기: 쓴 흉상과 대사 표정이 고르는 같은 세트의 표정 그림이 같이 실린다.
    const paths = collectWebExportAssets(project).map((asset) => asset.zipPath);
    expect(paths.some((path) => path.endsWith("people1-old-man/bust-base.png"))).toBe(true);
    expect(paths.some((path) => path.endsWith("people1-old-man/bust-angry.png"))).toBe(true);
  });
});

describe("대사에 화자 흉상", () => {
  it("얼굴 명령이 없는 페이지: 그 사람이 말하는 줄 앞에만 걸고 내레이션 앞에서는 지운다 — 갈래 안도, 싸우기 직전 말은 화난 얼굴", () => {
    const { project, event } = withEvent([
      { graphic: chip("people1", 6), trigger: { kind: "action" }, commands: [
        text(undefined, "(다시 묻는다.)"), text("촌장", "숫자를 받았느냐."), text("촌장", "서둘러라."), text(undefined, "(촌장이 고개를 돌린다.)"),
        { kind: "choices", options: [{ text: "예", branch: [text("촌장", "좋다.")] }, { text: "아니오", branch: [text(undefined, "(대답하지 않았다.)")] }], cancelBehavior: "disallow" },
      ] },
      { graphic: chip("people1", 6), trigger: { kind: "action" }, commands: [text("촌장", "덤벼라!"), { kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: false }, text("촌장", "졌다.")] },
    ]);
    expect(settleSpeakerBustsIn(project)).toEqual(["대사 3곳에 화자 흉상(이벤트 1개)"]);
    const [talk, fight] = event().pages!;
    expect(kinds(talk!.commands!.slice(0, 6))).toEqual(["text:", `face:${OLD_MAN}`, "text:촌장", "text:촌장", "face:", "text:"]);
    const choices = talk!.commands!.at(-1) as Extract<Command, { kind: "choices" }>;
    expect(kinds(choices.options[0]!.branch)).toEqual([`face:${OLD_MAN}`, "text:촌장"]);
    expect(kinds(choices.options[1]!.branch)).toEqual(["text:"]);
    expect(kinds(fight!.commands!)).toEqual([`face:${OLD_MAN}`, "text:촌장:angry", "battleProcessing", "text:촌장"]);
    // 되풀이 안전.
    const once = JSON.stringify(event());
    expect(settleSpeakerBustsIn(project)).toEqual([]);
    expect(JSON.stringify(event())).toBe(once);
  });

  it("이미 얼굴 명령이 있는 페이지(place_npc): 낱장 얼굴만 같은 인물의 흉상으로 — 자리·비운 얼굴·직접 정한 모양은 그대로", () => {
    const face = (resourceId: string, extra: Record<string, unknown> = {}) => ({ kind: "changeFace", resourceId, position: "left", flipHorizontally: false, ...extra }) as Command;
    const { project, event } = withEvent([{ graphic: chip("people1", 6), trigger: { kind: "action" }, commands: [
      face("easyrpg-faceset-people1-06"), text("촌장", "어서 오게."), face(""), text(undefined, "(바람이 분다.)"), face("easyrpg-faceset-people1-06", { presentation: "face" }), text("촌장", "…"),
    ] }]);
    settleSpeakerBustsIn(project);
    expect(kinds(event().pages![0]!.commands!)).toEqual([`face:${OLD_MAN}`, "text:촌장", "face:", "text:", "face:easyrpg-faceset-people1-06", "text:촌장"]);
  });

  it("흉상이 없는 칩·몬스터 그림·모르는 화자는 건드리지 않는다 · 주인공 이름 줄에는 주인공 흉상", () => {
    const { project, event } = withEvent([{ graphic: chip("people4", 6), trigger: { kind: "action" }, commands: [text("촌장", "어서 오게.")] }]);
    expect(settleSpeakerBustsIn(project)).toEqual([]);
    expect(kinds(event().pages![0]!.commands!)).toEqual(["text:촌장"]);
    const hero = project.database.actors.find((a) => a.id === project.system.startActorIds![0])!;
    const heroBust = bustOfChip(hero.characterResourceId, hero.characterIndex ?? 0)!;
    expect(heroBust).toBeDefined();
    const map = project.maps[project.startMapId]!;
    (map.events as unknown[]).push({ id: "ev_sign", name: "표지판", x: 5, y: 5, pages: [{ graphic: { transparent: true }, trigger: { kind: "action" }, commands: [text(hero.name, "여기가 마을이구나."), text("지나가던 목소리", "…")] }] });
    settleSpeakerBustsIn(project, [{ mapId: map.id, eventId: "ev_sign" }]);
    expect(kinds(project.maps[map.id]!.events.find((e) => e.id === "ev_sign")!.pages![0]!.commands!)).toEqual([`face:${heroBust}`, `text:${hero.name}`, "face:", "text:지나가던 목소리"]);
  });
});

describe("사람·주인공 칩 고르기 — 흉상이 있는 칩 먼저", () => {
  it("촌장은 흉상이 있는 노인 칩으로 선다(얼굴 없는 터번 노인이 아니라) — 역할 칩뿐인 여관 주인은 그대로", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const chief = pickPersonGraphic(project, map, "촌장", undefined)!;
    expect(bustOfChip(chief.textureKey, chief.characterIndex)).toBe(OLD_MAN);
    const innkeeper = pickPersonGraphic(project, map, "여관 주인", undefined)!;
    expect(innkeeper.label).toBe("여관 주인");
    // 역할 낱말이 없는 이름은 이름으로 돌려 고르되 흉상이 있는 칩에서.
    for (const name of ["주술사", "족장 바라", "동굴 지기 아루", "사냥꾼"]) { const pick = pickPersonGraphic(project, map, name, undefined)!; expect(bustOfChip(pick.textureKey, pick.characterIndex), name).toBeDefined(); }
  });

  it("주인공: 흉상과 전투 그림이 둘 다 그 칩의 것인 칩 · 전투 그림도 그 칩으로 · 맵에 선 사람의 칩은 피한다", () => {
    const project = createBlankProject() as Project;
    project.gameBlueprint = { title: "불씨", genre: "판타지 모험", playerGoal: "불씨를 되찾자", ending: { name: "끝", how: "끝", feeling: "f" }, steps: [] } as never;
    const map = project.maps[project.startMapId]!;
    (map.events as unknown[]).push({ id: "ev_npc", name: "주술사", x: 4, y: 4, pages: [{ graphic: chip("people1", 2), trigger: { kind: "action" }, commands: [] }] });
    fillPartyLooks(project, "판타지 모험");
    const hero = project.database.actors.find((a) => a.id === project.system.startActorIds![0])!;
    expect(`${hero.characterResourceId}#${hero.characterIndex}`).not.toBe("easyrpg-charset-people1#2");
    expect(bustOfChip(hero.characterResourceId, hero.characterIndex ?? 0)).toBeDefined();
    expect(hero.battleCharacterResourceId).toBe(charsetBattlerForCharacter(hero.characterResourceId, hero.characterIndex ?? 0));
    expect(hero.battleCharacterResourceId).toBeDefined();
  });
});
