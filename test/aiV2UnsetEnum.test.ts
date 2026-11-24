import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { findSharedPortrait, dialogueFaceForEmotion } from "@/assets/sharedPortraitAssets";
import { bustOfChip, bustOfFace, settleSpeakerBustsIn } from "@/ai/v2/story/speakerBust";
import { pickPersonGraphic } from "@/ai/v2/place/people";
import { npcGraphicIntent, npcGraphicIsPlain, npcGraphicNamedBy, npcGraphicPersonQuery, queryNpcGraphics } from "@/assets/charsetQuery";
import { fillPartyLooks } from "@/ai/v2/story/shipLookDefaults";
import { charsetBattlerForCharacter } from "@/assets/charsetBattlers";
import { collectWebExportAssets } from "@/project/webExportAssets";
import type { Command, GameEvent, Project } from "@/project/types";
import { denominatorOnly, diffReport, direction, showRate, type GameMetrics } from "../scripts/qa/assistant-v2/specBank/metrics.mts";
import { readFileSync } from "node:fs";
import { realModelSign, replayEngine, SCRIPTED_MODEL, SCRIPTED_PROVIDER } from "../scripts/qa/assistant-v2/specBank/spec.mts";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { MIN_BLUEPRINT_PLACES, MIN_BLUEPRINT_STEPS, thinBlueprintReason } from "@/ai/v2/story/blueprint";
import { oneProjectGame } from "@/ai/v2/request/readers";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { continuationPrompt } from "@/ai/v2/loop/continuation";
import { syncGateItems } from "@/ai/v2/judge/gates";
import { indexProject } from "@/ai/v2/loop/refs";
import { carryOver, reviewKey, stampTargets } from "@/ai/v2/turn/carryOver";
import { handCarriedBlockers, loadVqaBook, noteVqaRound, saveVqaBook, vqaUnofferedBlockers, type VqaFinding } from "@/ai/v2/turn/vqaItems";
import { type VqaDefect, type VqaRound, parseVqaReply, vqaDefectLine, type VqaShot, vqaReviewerCandidates } from "@/ai/v2/judge/vqa";
import { getTool, runTool } from "@/editor/tools";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { englishToolCopy } from "@/ai/v2/tools/toolExposure";
import { preCheck } from "@/ai/v2/loop/argGuard";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { hidingSpots, requestedFeatureGaps } from "@/ai/v2/judge/requestedFeatures";
import { applyMapLighting, litShotNote } from "@/ai/v2/judge/vqaLighting";
import { familyOfProviderId } from "@/ai/assistantRoles";
import { shuffledOptions, trivialCode } from "@/ai/v2/story/puzzle";
import { weakPuzzleLocks } from "@/ai/v2/judge/puzzleChecks";
import { isolateTimers } from "./mergedTeardown";

describe("aiV2SpeakerBusts", () => {
  isolateTimers();
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

    // 2026-11-12 r1s-fun: «오르텐 할멈» 이 왕 칩으로 서서 대사창에 왕의 흉상이 떴다. 칩 → 흉상 짝은 맞았고 칩이 틀렸다 —
    // «할멈» 을 몰라 이름으로 돌려 골랐고, 돌리는 후보가 사람 칩 60칸 전체(왕·공주·메이드·기사 포함)였다.
    it("할멈은 노파 칩으로 서고 그 흉상이 뜬다 — 이름이 섞여도, 글이 말한 성별은 역할 표의 기본보다 먼저", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      for (const name of ["오르텐 할멈", "할멈", "할머니"]) {
        const pick = pickPersonGraphic(project, map, name, undefined)!;
        expect(`${pick.textureKey}#${pick.characterIndex} ${pick.label}`, name).toBe("tex_easyrpg_charset_people1#7 노파");
        expect(bustOfChip(pick.textureKey, pick.characterIndex), name).toBe("shared-people1-old-woman-expressions-bust-base");
      }
      expect(npcGraphicIntent("오르텐 할멈")).toEqual({ gender: "female", age: "elder" });
      expect(npcGraphicPersonQuery("오르텐 할멈")).toBe("할멈");
      expect(npcGraphicPersonQuery("신문팔이 핀")).toBeUndefined();
      // 글이 «여성» 이라고 했으면 남자 칩(촌장의 기본)은 흉상이 있어도 서지 않는다. 역할 표의 느슨한 낱말(«왕» ⊂ «여왕»)은 기울기일 뿐이다.
      expect(pickPersonGraphic(project, map, "여성 촌장", undefined)!.label).toBe("중년 여성 주민(흑인)");
      expect(pickPersonGraphic(project, map, "여왕", undefined)!.label).toBe("여왕");
    });

    it("역할을 못 알아들은 이름에는 그냥 주민만 선다 — 왕·공주·메이드·기사·아이 칩은 그 역할을 말했을 때만, 이름마다 고르게 갈린다", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      const plain = ["청년 남성", "젊은 여성", "중년 남성 주민(흑인)", "중년 여성 주민(흑인)", "대머리 남성 주민"];
      const names = ["기록가 여울", "마을 주민 다래", "선원", "나디아", "오르텐", "신문팔이 핀", "노동자 하크", "시민 엘리", "선장 바르가", "모라", "미르", "숲지기 연", "겨울 손님", "주술사", "족장 바라", "사냥꾼"];
      const labels = names.map((name) => pickPersonGraphic(project, map, name, undefined)!.label);
      for (const [i, label] of labels.entries()) expect(plain, names[i]).toContain(label);
      expect(new Set(labels).size).toBe(plain.length);
      // 말한 역할은 그대로 그 칩이다.
      expect(pickPersonGraphic(project, map, "왕", undefined)!.label).toBe("왕");
      expect(pickPersonGraphic(project, map, "공주", undefined)!.label).toBe("공주");
      expect(pickPersonGraphic(project, map, "수녀", undefined)!.label).toBe("수녀");
    });

    // 2026-11-12 명세 은행(흉상 먼저 고르기 전/후): 주민 둘을 세우고 나면 «상인 여자» 가 토끼 귀 여성, «농부» 가 귀족 남성, «마을 주민 남자» 가 승려로 섰다 —
    // 검색어 단의 순위는 성별만 맞은 칩까지 이어지고, 같은 맵에서 쓴 칩은 뒤로 밀린다. 말하지 않은 차림의 칩은 주민 칩을 한 번 더 쓰는 것보다 뒤다.
    it("한 맵에 같은 부류의 사람을 여럿 세워도 말하지 않은 차림(토끼 귀·귀족·승려·여왕)은 서지 않는다 — 주민 칩을 고르게 다시 쓴다", () => {
      const stand = (role: string, looks: string | undefined, times: number): string[] => {
        const project = createBlankProject() as Project;
        const map = project.maps[project.startMapId]!;
        const labels: string[] = [];
        for (let i = 0; i < times; i += 1) {
          const pick = pickPersonGraphic(project, map, role, looks)!;
          labels.push(pick.label);
          map.events = [...(map.events ?? []), { id: `ev_p${i}`, name: `p${i}`, x: i, y: 0, pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, commands: [],
            graphic: { sprite: { type: "bundled", id: pick.textureKey }, direction: "down", pattern: charsetFrameIndex({ characterIndex: pick.characterIndex, direction: "down", pattern: 1 }) } }] } as unknown as GameEvent];
        }
        return labels;
      };
      const count = (labels: string[], label: string) => labels.filter((l) => l === label).length;
      const women = stand("상인", "상인 여자", 6);
      for (const label of women) expect(["젊은 여성", "중년 여성 주민(흑인)", "노파"], women.join(" → ")).toContain(label);
      expect(count(women, "젊은 여성")).toBeLessThanOrEqual(3);
      const farmers = stand("농부", "농부", 6);
      for (const label of farmers) expect(["중년 남성 주민(흑인)", "대머리 남성 주민"], farmers.join(" → ")).toContain(label);
      expect(count(farmers, "중년 남성 주민(흑인)")).toBe(3);
      const men = stand("마을 사람", "마을 주민 남자", 6);
      expect(men.slice().sort()).toEqual(["대머리 남성 주민", "대머리 남성 주민", "중년 남성 주민(흑인)", "중년 남성 주민(흑인)", "청년 남성", "청년 남성"]);
      // 경비병은 여섯이 서도 경비병이다(난쟁이 병사·주민으로 바뀌지 않는다).
      expect(new Set(stand("경비병", undefined, 6))).toEqual(new Set(["청년 병사"]));
    });

    it("차림을 짚었는지는 칩 검색의 낱말 표로 읽는다 — 성별·나이 낱말은 차림이 아니다 · 할배는 청년 칩이 아니라 흉상이 있는 중년 주민", () => {
      const entry = (label: string) => queryNpcGraphics(label, 30).find((m) => m.entry.label === label && /^tex_easyrpg_charset_people/.test(m.entry.textureKey))!.entry;
      expect(npcGraphicNamedBy("상인 여자", entry("토끼 귀 여성"))).toBe(false);
      expect(npcGraphicNamedBy("토끼 귀 종업원", entry("토끼 귀 여성"))).toBe(true);
      expect(npcGraphicNamedBy("여왕", entry("왕"))).toBe(false);
      expect(npcGraphicNamedBy("늙은 왕 king", entry("왕"))).toBe(true);
      expect(npcGraphicNamedBy("사제", entry("승려"))).toBe(true);
      expect(npcGraphicNamedBy("아저씨 남성", entry("귀족 남성"))).toBe(false);
      expect(npcGraphicNamedBy("하녀장", entry("여자 메이드"))).toBe(true);
      for (const label of ["노파", "청년 남성", "젊은 여성", "대머리 남성 주민"]) expect(npcGraphicIsPlain(entry(label)), label).toBe(true);
      for (const label of ["왕", "여왕", "공주", "수녀", "승려", "토끼 귀 여성", "귀족 남성", "여자 메이드", "여관 주인", "청년 병사"]) expect(npcGraphicIsPlain(entry(label)), label).toBe(false);
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      for (const name of ["할배", "오르텐 할배"]) {
        const pick = pickPersonGraphic(project, map, name, undefined)!;
        expect(["중년 남성 주민(흑인)", "대머리 남성 주민"], name).toContain(pick.label);
        expect(bustOfChip(pick.textureKey, pick.characterIndex), name).toBeDefined();
      }
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
});

// 명세 은행 대조(scripts/qa/assistant-v2/specBank/metrics.mts) — 분모만 바뀐 줄을 나빠짐·좋아짐으로 치지 않는다.
// 2026-11-11 #4617 대조: 건물이 346 → 232 로 줄자 «눌러도 반응 없는 입구 110/379 → 108/263» 이 수는 줄었는데 나빠짐으로 찍혔다.
describe("aiV2SpecBankDiff", () => {
  isolateTimers();
  describe("spec bank diff — a rate that moved only because the denominator changed is not worse or better", () => {
    it("lower-is-better: fewer bad cases over a smaller total is not worse", () => {
      expect(direction("entrancesSilent", [110, 379], [108, 263])).toBe(0);
      expect(denominatorOnly("entrancesSilent", [110, 379], [108, 263])).toBe(true);
      expect(direction("gateWrongPrereq", [1, 232], [1, 218])).toBe(0);
    });
    it("lower-is-better: more bad cases at a worse rate is worse, fewer at a better rate is better", () => {
      expect(direction("foeStaysAfterWin", [0, 12], [3, 12])).toBe(-1);
      expect(direction("foeStaysAfterWin", [11, 12], [0, 12])).toBe(1);
      expect(direction("gateWrongPrereq", [3, 52], [0, 82])).toBe(1);
    });
    it("higher-is-better: fewer good cases with the same bad count is not worse; new bad cases are worse; fewer bad cases are better", () => {
      // 잠김 한 줄 244/250 → 123/129: 건물이 줄어 좋은 쪽도 줄었지만 나쁜 쪽은 6 그대로다.
      expect(direction("lockedOnEntrance", [244, 250], [123, 129])).toBe(0);
      expect(denominatorOnly("lockedOnEntrance", [244, 250], [123, 129])).toBe(true);
      expect(direction("exitsOnRoad", [40, 43], [40, 50])).toBe(-1);
      expect(direction("exitsOnRoad", [10, 43], [10, 30])).toBe(1);
      expect(direction("exitsOnRoad", [10, 43], [40, 43])).toBe(1);
      expect(direction("purposeEnterable", [14, 346], [20, 232])).toBe(1);
    });
    it("a side without a denominator is compared by counts", () => {
      expect(direction("exitsFullWidth", [0, 0], [2, 2])).toBe(1);
      expect(direction("exitsFullWidth", [0, 0], [0, 3])).toBe(-1);
      expect(direction("exitsFullWidth", [0, 0], [0, 0])).toBe(0);
    });
    it("a move inside 0.1 percentage point is the same; plain counts compare as before", () => {
      expect(direction("arrowWalkUnreached", [500, 1759], [523, 1844])).toBe(0);
      expect(direction("shipBlockers", 13, 20)).toBe(-1);
      expect(direction("shipBlockers", 20, 13)).toBe(1);
      expect(direction("maps", 100, 106)).toBe(0);
    });
    it("shows the count with its rate, and only where the cell is a share", () => {
      expect(showRate([108, 263])).toBe("108/263(41.1%)");
      expect(showRate([8, 10])).toBe("8/10(80%)");
      expect(showRate([59714, 106])).toBe("59714/106");
      expect(showRate([0, 0])).toBe("0/0");
      expect(showRate(13)).toBe("13");
    });
    it("the report names a game only when it really got worse and marks denominator-only lines", () => {
      const game = (id: string, values: GameMetrics["values"]): GameMetrics => ({ id, kind: "game", values, lines: {}, probeErrors: [] });
      const report = diffReport(
        [game("desert", { entrancesSilent: [1, 61], shipBlockers: 0 }), game("snow", { entrancesSilent: [109, 318], shipBlockers: 1 })],
        [game("desert", { entrancesSilent: [0, 16], shipBlockers: 5 }), game("snow", { entrancesSilent: [108, 247], shipBlockers: 1 })],
        "a", "b",
      );
      const silent = report.rows.find((row) => row.key === "entrancesSilent")!;
      expect(silent.dir).toBe(0);
      expect(silent.denominatorOnly).toBe(true);
      expect(silent.worseGames).toEqual([]);
      expect(report.rows.find((row) => row.key === "shipBlockers")!.worseGames).toEqual(["desert(0→5)"]);
      expect(report.text).toContain("(분모만 바뀜)");
    });
  });
});

// 명세 은행 재생은 진짜 모델을 부르지 않는다 — 대본(streamFn)을 받는 제공자로만 넘기고, 진짜 사용량이 보이면 멈춘다(scripts/qa/assistant-v2/specBank/spec.mts).
// 2026-11-12: Haiku 판(제공자 local-cli:claude) 여섯을 재생했더니 로컬 CLI 고리가 대본을 무시하고 실제 게임 여섯 판을 돌렸다(CLI 호출 약 1,180번).
describe("aiV2SpecBankReplayGuard", () => {
  isolateTimers();
  describe("spec bank replay — the engine handed to the runtime always takes the script", () => {
    it("keeps the recorded provider only when it is known to take the scripted stream", () => {
      expect(replayEngine({ provider: "openai-compat:opencodex", model: "gpt-6.1-terra" })).toEqual({ provider: "openai-compat:opencodex", model: "gpt-6.1-terra", swapped: false });
      expect(replayEngine({ provider: "openai-compat:other", model: "" })).toEqual({ provider: "openai-compat:other", model: SCRIPTED_MODEL, swapped: false });
    });
    it("swaps a local CLI provider (and anything else) for the scripted default", () => {
      for (const provider of ["local-cli:claude", "local-cli:codex", "local-cli:gemini", "anthropic", "gemini"]) {
        expect(replayEngine({ provider, model: "claude-haiku-5-5" }), provider).toEqual({ provider: SCRIPTED_PROVIDER, model: SCRIPTED_MODEL, swapped: true });
      }
      expect(replayEngine({})).toEqual({ provider: SCRIPTED_PROVIDER, model: SCRIPTED_MODEL, swapped: false });
    });
    it("the replay does not hand the recorded provider to the runtime", () => {
      const source = readFileSync("scripts/qa/assistant-v2/specBank/replayGame.mts", "utf8");
      expect(source).toContain("provider: engine.provider, model: engine.model");
      expect(source).not.toMatch(/provider:\s*spec\.source\.provider/u);
    });
  });
  describe("spec bank replay — signs of a real model", () => {
    it("a scripted replay prints zero usage; anything else is a real model", () => {
      expect(realModelSign({ usageLine: "[pi-usage] input=0 cacheRead=0" })).toBeUndefined();
      expect(realModelSign({ usageLine: "[pi-usage] input=2 cacheRead=243351" })).toContain("input=2 cacheRead=243351");
      expect(realModelSign({ usageLine: "[pi-usage] input=24 cacheRead=0" })).toBeDefined();
      expect(realModelSign({ usageLine: "[r1-fun] 턴 1/3: 호출 120/120" })).toBeUndefined();
    });
    it("a turn that ends without the script having been asked, or with none of the recorded calls played, is a real model", () => {
      expect(realModelSign({ turn: { calls: 157, played: 157, scripted: 160 } })).toBeUndefined();
      expect(realModelSign({ turn: { calls: 157, played: 0, scripted: 0 } })).toContain("대본");
      expect(realModelSign({ turn: { calls: 157, played: 0, scripted: 3 } })).toContain("0/157");
      expect(realModelSign({ turn: { calls: 0, played: 0, scripted: 0 } })).toBeUndefined();
    });
  });
});

describe("aiV2ThinBlueprint", () => {
  isolateTimers();
  const WHOLE = "닌자가 성에 잠입하는 게임";
  const step = (id: string, place: string, event: string) => ({ id, place, event, action: "살핀다", gives: `${id} 단서`, feeling: "긴장" });
  // 단계 종류를 섞는다(사람 둘·싸움·번호 자물쇠) — 전부 «살펴본다» 인 초안은 종류 검사(stepMixProblems)가 한 번 돌려보낸다.
  const KINDS = [{ kind: "talk", who: "문지기 겐" }, { kind: "find" }, { kind: "battle", who: "그림자 무사" }, { kind: "puzzle" }, { kind: "talk", who: "하녀 유키" }, { kind: "find" }] as const;
  const args = (places: string[], count: number, kinded = true) => ({
    genre: "잠입 액션",
    playerGoal: "비밀 문서를 훔쳐 탈출한다",
    steps: Array.from({ length: count }, (_, i) => ({ ...step(`s${i + 1}`, places[i % places.length]!, `이벤트${i + 1}`), ...(kinded ? KINDS[i % KINDS.length] : {}) })),
    ending: { name: "탈출", how: "문서를 들고 성을 나선다", feeling: "안도" },
  });
  const envFor = (project: Project, task = WHOLE) => ({
    ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
    emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
  }) as never;
  const write = (project: Project, session: V2Session, params: unknown, task = WHOLE) =>
    createV2Tools(envFor(project, task), session).find((t) => t.name === "write_blueprint")!.execute("a", params as never, undefined as never);
  const summaryOf = (res: unknown): string => JSON.stringify(res);
  describe("thinBlueprintReason", () => {
    it("flags one place or fewer than six steps and passes six steps over two places", () => {
      const thin = { ...createBlankProject().gameBlueprint, steps: args(["그림자 성"], 3).steps } as never;
      expect(thinBlueprintReason(thin)).toContain("그림자 성");
      const twoPlacesThreeSteps = { steps: args(["성 앞", "지하"], 3).steps } as never;
      expect(thinBlueprintReason(twoPlacesThreeSteps)).toBeTruthy();
      const ok = { steps: args(["성 앞", "지하", "천수각"], MIN_BLUEPRINT_STEPS).steps } as never;
      expect(thinBlueprintReason(ok)).toBeUndefined();
      expect(MIN_BLUEPRINT_PLACES).toBe(2);
    });
  });
  // 2026-11-16(오너 「벽을 기본값으로」): 얇은 초안·종류가 안 섞인 초안을 돌려보내지 않는다 — 건 뒤 알림으로 적는다(거절은 게임이 깨질 때만).
  describe("write_blueprint thin first draft", () => {
    it("hangs a one-place three-step first blueprint and says so as a notice, not a rejection", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const res = summaryOf(await write(project, session, args(["그림자 성"], 3)));
      expect(project.gameBlueprint?.steps.length).toBe(3);
      expect(res).toContain("Notice — saved as written, nothing is rejected");
      expect(res).toContain("3 step(s) over 1 place(s)");
      // 크기를 안 적은 첫 청사진은 첫 판 MVP 다(2026-11-23) — 알림은 MVP 크기(장소 2곳·단계 3)를 말한다.
      expect(project.gameBlueprint?.scale).toBe("mvp");
      expect(res).toContain("first playable version (mvp)");
    });
    it("gives no notice for a six-step three-place first blueprint", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const res = summaryOf(await write(project, session, args(["성 앞", "지하 통로", "천수각"], 6)));
      expect(project.gameBlueprint?.steps.length).toBe(6);
      expect(res).not.toContain("Notice — saved as written");
    });
    it("hangs a six-step draft whose steps are all examine and names the missing kinds in the notice", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const flat = args(["성 앞", "지하 통로", "천수각"], 6, false);
      const res = summaryOf(await write(project, session, flat));
      expect(project.gameBlueprint?.steps.length).toBe(6);
      expect(res).toContain("named");
      expect(res).toContain("no battle step");
      expect(res).toContain("3 find steps in a row");
    });
    it("a model-written scale:small and battles:false take the size and fight lines out of the notice", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const small = { ...args(["역 앞 상점가", "라멘집"], 4, false), scale: "small", battles: false };
      const res = summaryOf(await write(project, session, small, "짧은 이야기 게임을 만들어 줘. 전투는 없어도 돼."));
      // #4948: 새 게임의 첫 청사진은 모델이 scale:"small" 을 적어도 첫 판 MVP 로 둔다(엔딩 없음). MVP 기준(장소 2·단계 3 이상)을 넘으니
      // 크기 줄은 여전히 빠지고, battles:false 는 싸움 줄을 뺀다.
      expect(project.gameBlueprint?.scale).toBe("mvp");
      expect(project.gameBlueprint?.battles).toBe(false);
      expect(res).not.toContain("step(s) over");
      expect(res).not.toContain("no battle step");
    });
    it("gives no notice on a rewrite of an existing blueprint", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      await write(project, session, args(["성 앞", "지하 통로", "천수각"], 6));
      const res = summaryOf(await write(project, session, args(["성 앞"], 3)));
      expect(project.gameBlueprint?.steps.length).toBe(3);
      expect(res).not.toContain("Notice — saved as written");
    });
    it("gives no notice when only the request sentence says escape room", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const res = summaryOf(await write(project, session, args(["작은 방"], 3), "밀실 탈출 게임 만들어 줘"));
      expect(project.gameBlueprint?.steps.length).toBe(3);
      expect(res).not.toContain("Notice — saved as written");
    });
    it("does not reject a locked-room escape game", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      await write(project, session, args(["작은 방"], 3), "방탈출 게임 만들어 줘");
      expect(project.gameBlueprint?.steps.length).toBe(3);
      expect(oneProjectGame(project, "방탈출 게임 만들어 줘")).toBe(true);
    });
  });
});

describe("aiV2TodoBriefResult", () => {
  isolateTimers();
  // 2026-11-12 Haiku 게임 하나(r1v-fun) 실측: todo 91번, 결과마다 목록 전체(평균 6.7천 자) — 대화에 쌓여 그 판 입력의 8.7%.
  // 항목 하나를 고친 결과는 그 줄과 열린 줄만 싣는다(전체는 todo view). 문서 openwiki/assistant-v2.md 「할 일 결과는 짧게」.

  function listOf(n: number): TodoStore {
    const store = new TodoStore();
    store.init([{ phase: "짓기", items: Array.from({ length: n }, (_, i) => ({ content: `할 일 ${i + 1} — 무언가를 짓는다` })) }]);
    return store;
  }
  describe("viewFocusEn — 항목 하나를 고친 뒤의 짧은 목록", () => {
    it("짧은 목록은 전체를 준다", () => {
      const store = listOf(TodoStore.SHORT_LIST);
      expect(store.viewFocusEn(store.items[0]!.id)).toBe(store.view(40, true));
    });

    it("긴 목록은 세는 줄 + 그 항목 + 열린 항목 8개 + 나머지 수만", () => {
      const store = listOf(30);
      for (const item of store.items.slice(0, 12)) store.done(item, undefined);
      const focus = store.items[11]!;
      const text = store.viewFocusEn(focus.id);
      const lines = text.split("\n");
      expect(lines[0]).toBe(store.view(40, true).split("\n")[0]);
      expect(lines[1]).toContain(` ${focus.id} `);
      expect(lines.slice(2, 10).map((l) => l.trim().split(" ")[1])).toEqual(store.items.slice(12, 20).map((i) => i.id));
      expect(lines.at(-1)).toContain("todo view shows the whole list");
      expect(lines.at(-1)).toContain("10 open");
      expect(text).not.toContain(` ${store.items[0]!.id} `);
      expect(text.length).toBeLessThan(store.view(40, true).length / 2);
    });

    it("전체 목록의 40줄 상한 뒤에 있는 열린 항목도 보인다", () => {
      const store = listOf(46);
      for (const item of store.items.slice(0, 44)) store.done(item, undefined);
      const text = store.viewFocusEn(store.items[43]!.id);
      expect(text).toContain(` ${store.items[45]!.id} `);
      expect(store.view(40, true)).not.toContain(` ${store.items[45]!.id} `);
    });

    it("항목을 못 찾았으면(id 없음) 전체를 준다", () => {
      const store = listOf(30);
      expect(store.viewFocusEn(undefined)).toBe(store.view(40, true));
    });
  });
});

// 턴 사이 기억(2026-11-11 B4): 막힌 항목은 막힌 채로 이어 받고, 대상이 바뀌었거나 요청이 짚은 것만 다시 연다. 화면 검수 장부도 이어 받는다.
describe("aiV2TurnMemory", () => {
  isolateTimers();
  const project = (() => { const p = createBlankProject() as Project; p.maps[p.startMapId]!.name = "황금궁 정원"; return p; })();
  const mapId = project.startMapId;
  /** 턴 1 끝: 조수 항목 셋·검토자 항목·관문 항목 둘이 막힌 채 저장된다. */
  function turnOne(): unknown {
    const store = new TodoStore();
    store.init([{ phase: "짓기", items: [
      { content: "대장간을 짓는다", id: "smith", check: { kind: "place", name: "대장간" } },
      { content: "정원을 꾸민다", id: "garden" },
      { content: "촌장을 세운다", id: "chief", check: { kind: "person", name: "촌장" } },
    ] }]);
    const smith = store.get("smith")!, garden = store.get("garden")!, chief = store.get("chief")!;
    store.start(smith); store.noteTried(smith, "make_place");
    store.recordFailure(smith, "make_place:x", "make_place 거절: 자리가 없다", "make_place rejected: no room");
    store.noteTried(smith, "edit_place");
    store.block(smith, "3번 실패 — 자리가 없다", "auto");
    garden.refs = { mapIds: [mapId] }; store.block(garden, "꾸밀 물건을 못 찾음");
    store.block(chief, "세울 칸을 못 찾음");
    const [adv] = store.append("검토자", [{ content: "보고의 주장이 실제 변경과 반대다", key: reviewKey("adv", "보고의 주장이 실제 변경과 반대다|엔딩을 연결") }], "critic");
    store.block(adv!, "표현을 잘못 썼다");
    store.append("함수 검사", [{ content: "[scene repeat] 같은 대사 반복", key: "game:scene-repeat" }, { content: "[출하 차단 maps-min] 맵이 적다", key: "game:maps-min" }], "gate");
    store.block(store.byKey("game:scene-repeat")!, "고칠 대사를 못 정함");
    store.block(store.byKey("game:maps-min")!, "맵을 더 지을 수 없음");
    stampTargets(store, indexProject(project));
    return JSON.parse(JSON.stringify(store.serialize("판타지 RPG 게임 하나 만들어 줘.")));
  }
  function turnTwo(task: string, p: Project = project): TodoStore {
    const store = new TodoStore();
    store.restore(turnOne(), carryOver(task, p, indexProject(p)));
    return store;
  }
  describe("carrying the todo list into the next turn", () => {
    it("keeps blocked items blocked, with attempts, last failure, verbs tried and the reason", () => {
      const store = turnTwo("계속 해 줘");
      expect(["smith", "garden", "chief"].map((id) => store.get(id)!.status)).toEqual(["blocked", "blocked", "blocked"]);
      expect(store.get("smith")!.attempts).toBe(1);
      expect(store.get("smith")!.blockedReason).toContain("3번 실패");
      expect(store.meta.get("smith")!.lastFail).toContain("자리가 없다");
      expect(store.meta.get("smith")!.tried).toEqual(["make_place", "edit_place"]);
      expect(store.openCount()).toBe(0);
      expect(store.initialized).toBe(true);
    });

    it.each([
      ["nothing changed, nothing named", "계속 해 줘", false, []],
      ["the request names a check subject", "이어서 촌장 다시 세워 줘", false, ["chief"]],
      ["the request names an item id", "이어서 smith 다시 해 줘", false, ["smith"]],
      ["the request names the bound map", "계속. 황금궁 정원 좀 더 꾸며 줘", false, ["garden"]],
      ["the bound map changed since the block", "계속 해 줘", true, ["garden"]],
    ] as const)("reopens only what changed or was named — %s", (_name, task, changeMap, reopened) => {
      const p = structuredClone(project);
      if (changeMap) p.maps[mapId]!.width += 1;
      const store = turnTwo(task, p);
      expect(["smith", "garden", "chief"].filter((id) => store.get(id)!.status !== "blocked")).toEqual([...reopened]);
      for (const id of reopened) expect(store.get(id)!.attempts).toBe(0);
    });

    it("a reopened item shows what was tried in the earlier turn", () => {
      const store = turnTwo("이어서 smith 다시 해 줘");
      expect(continuationPrompt(store)).toContain("already tried in an earlier turn: make_place, edit_place");
    });

    it("drops reviews of the previous turn's report instead of carrying them", () => {
      const store = turnTwo("계속 해 줘");
      const adv = store.items.find((i) => i.source === "critic")!;
      expect(adv.status).toBe("dropped");
      expect(store.holds(adv)).toBe(false);
    });

    it("a new plan does not erase carried blocked items", () => {
      const store = turnTwo("계속 해 줘");
      store.init([{ phase: "새 계획", items: [{ content: "엔딩을 잇는다" }] }]);
      expect(store.get("smith")!.status).toBe("blocked");
      expect(store.items.some((i) => i.content === "엔딩을 잇는다")).toBe(true);
    });

    it("the finish gate neither re-adds a carried blocked problem nor keeps one it no longer reports", () => {
      const store = turnTwo("계속 해 줘");
      const before = store.items.length;
      const sync = syncGateItems(store, [{ key: "game:maps-min", text: "[출하 차단 maps-min] 맵이 적다", source: "gate" }], new Set());
      expect(sync.opened).toEqual([]);
      expect(store.items).toHaveLength(before);
      expect(store.byKey("game:maps-min")!.status).toBe("blocked");
      const gone = store.byKey("game:scene-repeat")!;
      expect(gone.status).toBe("dropped");
      expect(gone.blockedReason).toContain("기존 결함");
    });

    it("review item keys come from the note itself, so a later review cannot overwrite another note", () => {
      expect(reviewKey("adv", "a|b")).toBe(reviewKey("adv", "a|b"));
      expect(reviewKey("adv", "a|b")).not.toBe(reviewKey("adv", "a|c"));
      const store = new TodoStore();
      const [first] = store.append("검토자", [{ content: "시키지 않은 삭제", key: reviewKey("adv", "시키지 않은 삭제|") }], "critic");
      store.append("검토자 다시", [{ content: "요청 중 안 된 부분", key: reviewKey("adv", "요청 중 안 된 부분|") }], "critic");
      expect(first!.content).toBe("시키지 않은 삭제");
      expect(store.items).toHaveLength(2);
    });
  });
  describe("carrying the screen-review ledger into the next turn", () => {
    const on = (what: string, severity: VqaDefect["severity"] = "polish"): VqaDefect => ({ where: "맵 «황금궁 정원» (20×15칸) · 어딘가", what, severity, target: { kind: "map", ref: mapId } });
    const round = (n: number, defects: VqaDefect[]): VqaRound => ({ round: n, shots: [{ where: "", kind: "map", ref: mapId }], defects, ms: 0, reviewer: "test" });
    const dragon = on("붉은 용 스프라이트가 윗벽 장식 띠에 겹쳐 반쯤 벽 속에 박힌 것처럼 보인다.", "blocker");
    const dragonAgain = on("붉은 용 스프라이트의 머리가 윗벽 장식 띠에 맞닿아 벽에 박힌 것처럼 보인다.", "blocker");
    const sparse = on("정원 대부분이 빈 잔디 바닥이라 휑하다.");
    const boat = on("배가 물 위가 아니라 눈밭과 나무 사이에 놓여 있어 배치가 어색하다.");
    const chest = on("보물상자가 방의 오른쪽 벽 경계에 걸쳐 있어 벽에 묻힌 것처럼 보이고 다가가기 어렵다.", "blocker");

    /** 턴 1: 용·빈 정원은 건네져 막혔고, 상자는 판이 남지 않은 판에 처음 보였다. */
    function saved(): unknown {
      const store = new TodoStore();
      const book: VqaFinding[] = [];
      store.init([{ phase: "짓기", items: [{ content: "마을" }] }]);
      store.done(store.items[0]!, undefined);
      noteVqaRound(book, store, round(1, [dragon, sparse, boat]), project);
      store.markOffered();
      for (const item of store.items.filter((i) => i.source === "vqa")) store.block(item, "옮길 칸을 못 찾음");
      noteVqaRound(book, store, round(5, [dragon, sparse, boat, chest]), project);
      expect(vqaUnofferedBlockers(book, store)).toHaveLength(1);
      store.memory.vqa = saveVqaBook(book, store, project, "fp-turn1");
      return JSON.parse(JSON.stringify(store.serialize("게임 만들어 줘")));
    }
    const continued = () => { const store = new TodoStore(); const state = saved(); store.loadMemory(state); store.restore(state, carryOver("계속 해 줘", project, indexProject(project))); return store; };

    it("stays small", () => {
      expect(JSON.stringify((saved() as { memory: unknown }).memory).length).toBeLessThan(2500);
    });

    it("round 1 of the next turn does not turn already-handed complaints into new items", () => {
      const store = continued();
      const { book, reviewedFp } = loadVqaBook(store.memory.vqa, store);
      expect(reviewedFp).toBe("fp-turn1");
      expect(book.filter((f) => f.itemId)).toHaveLength(2);
      const before = store.items.length;
      const out = noteVqaRound(book, store, round(1, [dragonAgain, sparse, boat, chest]), project);
      expect(out.offered).toEqual([chest]);
      expect(store.items).toHaveLength(before + 1);
      expect(store.items.filter((i) => i.source === "vqa" && i.status === "blocked")).toHaveLength(2);
    });

    it("hands over a blocker the previous turn could not, without photographing again", () => {
      const store = continued();
      const { book } = loadVqaBook(store.memory.vqa, store);
      const first = handCarriedBlockers(book, store, project);
      expect(first.offered).toEqual([chest]);
      expect(handCarriedBlockers(book, store, project).opened).toEqual([]);
      expect(vqaUnofferedBlockers(book, store)).toEqual([]);
    });

    it("a turn that did not carry the list re-hands a blocker with no item, but never polish handed once", () => {
      const store = new TodoStore();
      store.loadMemory(saved());
      const { book } = loadVqaBook(store.memory.vqa, store);
      expect(book.every((f) => !f.itemId)).toBe(true);
      const out = noteVqaRound(book, store, round(1, [dragon, sparse]), project);
      expect(out.opened).toHaveLength(1);
      expect(out.opened[0]!.content).toContain("붉은 용");
      expect(store.items.some((i) => i.severity === "polish")).toBe(false);
    });

    it("ignores a malformed saved ledger", () => {
      expect(loadVqaBook({ findings: "x" }, new TodoStore()).book).toEqual([]);
      expect(loadVqaBook(undefined, new TodoStore()).book).toEqual([]);
      expect(loadVqaBook({ findings: [{ key: 1 }, null] }, new TodoStore()).book).toEqual([]);
    });
  });
});

// 값이 하나뿐인 선택 enum 은 칸을 다 채우는 모델이 비울 수 없다 — v2 는 "none" 을 더해 보여 주고, 인자 검사가 도구에 가기 전에 걷는다.
// 2026-11-11 작은 일 둘째 묶음 item-new-built: upsert_item 의 escapeTo 가 하나뿐인 값 "entrance" 로 채워져 회복 차가 탈출 로프로 저장됐다.
describe("aiV2UnsetEnum", () => {
  isolateTimers();
  type Node = { enum?: unknown[]; properties?: Record<string, Node>; items?: Node; required?: string[] };
  const at = (node: Node, path: string[]): Node | undefined => path.reduce<Node | undefined>((n, k) => n?.properties?.[k], node);
  describe("값 하나짜리 선택 enum", () => {
    const ctx = { project: buildFixture("starter") };
    const shown = (name: string) => englishToolCopy(createPiToolset(ctx, { toolNames: [name] }).find((t) => t.name === name)!, true).parameters as Node;

    it("모델이 보는 스키마에는 none 이 앞에 있다 — 도구의 진짜 스키마는 그대로", () => {
      expect(at(shown("upsert_item"), ["item", "escapeTo"])?.enum).toEqual(["none", "entrance"]);
      expect(at(getTool("upsert_item")!.parameters as Node, ["item", "escapeTo"])?.enum).toEqual(["entrance"]);
      expect(at(shown("place_npc"), ["guide"])?.enum).toEqual(["none", "action-controls"]);
      // 값이 여럿인 enum 과 필수 칸은 건드리지 않는다.
      expect(at(shown("upsert_item"), ["item", "scope"])?.enum).toEqual(at(getTool("upsert_item")!.parameters as Node, ["item", "scope"])?.enum);
    });

    it("none 으로 온 칸은 도구에 가기 전에 걷히고, 차는 탈출 로프가 되지 않는다", () => {
      const sent = { item: { id: "item_tea", name: "눈꽃 차", scope: "ally", price: 30, type: "medicine", escapeTo: "none", hpRecovery: { flat: 50, percentMax: 0 } } };
      const pre = preCheck("upsert_item", shown("upsert_item"), sent, ctx.project);
      expect(pre.kind).toBe("ok");
      const args = (pre as { args: { item: Record<string, unknown> } }).args;
      expect("escapeTo" in args.item).toBe(false);
      // 진짜 값이 none 인 칸(scope)은 그대로 둔다.
      const keep = preCheck("upsert_item", shown("upsert_item"), { item: { id: "item_rope", name: "밧줄", scope: "none" } }, ctx.project);
      expect((keep as { args: { item: Record<string, unknown> } }).args.item.scope).toBe("none");
      const run = { project: ctx.project };
      expect(runTool(run, "upsert_item", args).ok).toBe(true);
      const saved = run.project.database.items.find((i) => i.id === "item_tea") as { escapeTo?: string; type?: string } | undefined;
      expect(saved?.escapeTo).toBeUndefined();
      expect(saved?.type).toBe("medicine");
    });
  });
});

describe("aiV2VisibleHiding", () => {
  isolateTimers();
  const task = "학교 공포 게임 만들어 줘. 사물함에 숨을 수 있게.";
  const withHiding = (graphic: Record<string, unknown>): Project => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.events = [{ id: "hide", x: 2, y: 2, pages: [{ id: "p", graphic, interaction: { kind: "hiding" }, movement: { type: "fixed" }, commands: [] }] } as never];
    return project;
  };
  describe("hiding spots must be visible (J81)", () => {
    it("a transparent hiding event on bare floor does not count as a hiding spot", () => {
      const project = withHiding({ transparent: true });
      expect(hidingSpots(project)[0]!.visible).toBe(false);
      expect(requestedFeatureGaps(project, task).map((b) => b.evidence.split(":")[0])).toEqual(["hiding"]);
    });
    it("a drawn hiding event counts", () => {
      const project = withHiding({ appearanceId: "locker" });
      expect(requestedFeatureGaps(project, task)).toEqual([]);
    });
  });
});

describe("aiV2VqaFixTurn", () => {
  isolateTimers();
  const shots: VqaShot[] = [
    { where: "타이틀 화면 배경", kind: "title", ref: "res_title", image: "data:," },
    { where: "맵 «저택 1층» (시작 맵)", kind: "map", ref: "map_hall", image: "data:," },
  ];
  describe("VQA fix turns (J68)", () => {
    it("keeps the shot target on each defect so the fix list names the mapId", () => {
      const { defects } = parseVqaReply('{"defects":[{"image":2,"where":"왼쪽 위","what":"벽 안에 사람이 서 있다","severity":"blocker"}]}', shots);
      expect(defects[0]?.target).toEqual({ kind: "map", ref: "map_hall" });
      expect(vqaDefectLine(defects[0]!, 0)).toContain("mapId: map_hall");
    });

  });
});

describe("aiV2VqaLighting", () => {
  isolateTimers();
  const setup = (ambient: number) => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.defaultLighting = { ambient, sources: [{ id: "torch", at: { x: 1, y: 1 }, radius: 1 }] };
    const tile = 4, w = map.width * tile, h = map.height * tile;
    const rgba = new Uint8Array(w * h * 4).fill(200);
    return { project, map, rgba, w, h, tile };
  };
  describe("VQA map shots carry game lighting (J79 rerun)", () => {
    it("darkens the map by ambient and leaves the light centre bright", () => {
      const { project, map, rgba, w, h, tile } = setup(0.88);
      const lit = applyMapLighting(rgba, w, h, map, project);
      expect(lit.applied).toBe(true);
      const at = (x: number, y: number) => rgba[(y * w + x) * 4]!;
      expect(at(w - 1, h - 1)).toBe(Math.round(200 * 0.12));
      expect(at(Math.floor(1.5 * tile), Math.floor(1.5 * tile))).toBeGreaterThan(150);
      expect(litShotNote(lit)).toContain("어둠 0.88");
    });
    it("does nothing without darkness", () => {
      const { project, map, rgba, w, h } = setup(0);
      expect(applyMapLighting(rgba, w, h, map, project).applied).toBe(false);
      expect(rgba[0]).toBe(200);
    });
  });
});

describe("aiV2VqaReviewerOrder", () => {
  isolateTimers();
  // 2026-11-12 측정(Haiku 5.5 high 실행, GPT 할당량 없음 · Gemini CLI 는 그림을 못 봄): 다른 계열 검수자가 모두 답하지 못하자 Haiku 가 제 화면을 검수했다.
  // 같은 계열의 검수용 모델(Sonnet)은 후보에 없었다. 지은 모델이 제 화면을 보는 것은 맨 마지막이어야 한다.
  const order = (main: { provider: string; model: string }, keyed: string[] = [main.provider]) =>
    vqaReviewerCandidates({ main, keyed: new Set(keyed), familyOf: (id) => familyOfProviderId(id, [main.model]) }).map((p) => `${p.provider}/${p.model}${p.sameAsMain ? " (같은 계열)" : ""}`);
  // 2026-11-16 실모델 확인 r7a(Opus 5.5 medium 실행, N6): 다른 계열이 답하지 못한 뒤의 Claude 검수자가 Sonnet 으로 박혀 있어 화면 검수 7번이 Sonnet 으로 갔다.
  // 오너 결정 2026-11-23 「조수는 sonnet 5.5 high 만」 — Claude 검수자는 Sonnet 5.5 · high 이다. Sonnet 으로 지으면 지은 모델과 검수 모델이 같다(«같은 계열 검수», 약한 증거).
  const picks = (main: { provider: string; model: string }) =>
    vqaReviewerCandidates({ main, keyed: new Set([main.provider]), familyOf: (id) => familyOfProviderId(id, [main.model]) });
  describe("화면 검수자 차례 — 자기 자신은 맨 마지막", () => {
    it("Haiku 가 지으면: 다른 계열(Codex · Gemini) → 같은 계열의 Sonnet 5.5 → Haiku 자신", () => {
      expect(order({ provider: "local-cli:claude", model: "claude-haiku-5-5" })).toEqual([
        "local-cli:codex/gpt-6.2-sol", "local-cli:gemini/gemini-4-argon",
        "local-cli:claude/claude-sonnet-5-5 (같은 계열)", "local-cli:claude/claude-haiku-5-5 (같은 계열)",
      ]);
    });

    it("Sonnet 5.5 가 지으면(Claude 기본): 다른 계열 → Sonnet 5.5 · high 한 번 — Opus 로 가지 않고, 같은 모델을 두 번 넣지 않는다", () => {
      expect(order({ provider: "local-cli:claude", model: "claude-sonnet-5-5" })).toEqual([
        "local-cli:codex/gpt-6.2-sol", "local-cli:gemini/gemini-4-argon", "local-cli:claude/claude-sonnet-5-5 (같은 계열)",
      ]);
      const claude = picks({ provider: "local-cli:claude", model: "claude-sonnet-5-5" }).filter((p) => p.provider === "local-cli:claude");
      expect(claude).toEqual([{ provider: "local-cli:claude", model: "claude-sonnet-5-5", effort: "high", sameAsMain: true }]);
    });

    it("Opus 가 지으면(사람이 고름): 같은 계열의 Sonnet 5.5 가 먼저, Opus 자신은 맨 끝", () => {
      const got = order({ provider: "local-cli:claude", model: "claude-opus-5-5" });
      expect(got.filter((p) => p.startsWith("local-cli:claude/"))).toEqual(["local-cli:claude/claude-sonnet-5-5 (같은 계열)", "local-cli:claude/claude-opus-5-5 (같은 계열)"]);
    });

    it("GPT 가 지으면(Terra): 다른 계열(Claude Sonnet 5.5 · Gemini)이 먼저, 같은 계열의 검수용 모델이 자기 자신 앞", () => {
      const got = order({ provider: "openai-codex", model: "gpt-6.2-sol" });
      expect(got.slice(0, 2)).toEqual(["local-cli:claude/claude-sonnet-5-5", "local-cli:gemini/gemini-4-argon"]);
      expect(got.slice(-2)).toEqual(["local-cli:codex/gpt-6.2-sol (같은 계열)", "openai-codex/gpt-6.2-sol (같은 계열)"]);
      expect(picks({ provider: "openai-codex", model: "gpt-6.2-sol" })[0]).toMatchObject({ model: "claude-sonnet-5-5", effort: "high", sameAsMain: false });
    });

    it("다른 계열 후보에는 «같은 계열» 표시가 붙지 않고, 같은 계열 후보에는 늘 붙는다", () => {
      const picks = vqaReviewerCandidates({ main: { provider: "local-cli:claude", model: "claude-haiku-5-5" }, keyed: new Set(["local-cli:claude"]), familyOf: (id) => familyOfProviderId(id) });
      for (const p of picks) expect(p.sameAsMain).toBe(familyOfProviderId(p.provider) === "claude");
    });
  });
});

describe("aiV2WeakPuzzles", () => {
  isolateTimers();
  // 판정 J63: 정답이 첫 보기, 1024·1234·0000 같은 번호.
  function lockProject(commands: unknown[]): Project {
    return { maps: { m: { id: "m", name: "서재", width: 5, height: 5, events: [{ id: "ev_safe", name: "금고", x: 1, y: 1, pages: [{ conditions: [], trigger: { kind: "action" }, commands }] }] } } } as unknown as Project;
  }
  describe("weak puzzle locks (J63)", () => {
    it("treats repeated, sequential and common codes as trivial", () => {
      for (const c of ["1024", "1234", "0000", "4321", "1111"]) expect(trivialCode(c)).toBe(true);
      for (const c of ["3817", "0917", "12"]) expect(trivialCode(c)).toBe(false);
    });
    it("never puts the answer first and keeps it among the five shown options", () => {
      for (const seed of ["a", "b", "chain:0", "chain:1", "x:9"]) {
        const out = shuffledOptions(["정답", "가", "나", "다", "라", "마", "바"], "정답", seed);
        expect(out.length).toBe(5);
        expect(out.indexOf("정답")).toBeGreaterThan(0);
      }
    });
    it("flags a trivial number code and a correct-first choice, passes a fair lock", () => {
      const num = (value: number) => lockProject([{ kind: "inputNumber", variableId: "v", digits: 4 }, { kind: "fork", condition: { kind: "variable", variableId: "v", op: "==", value }, then: [{ kind: "setSwitch", switchId: "s", value: true }], else: [] }]);
      expect(weakPuzzleLocks(num(1024))).toHaveLength(1);
      expect(weakPuzzleLocks(num(3817))).toEqual([]);
      const choice = (answerAt: number) => lockProject([{ kind: "choices", options: ["봄", "여름", "가을"].map((text, i) => ({ text, branch: i === answerAt ? [{ kind: "setSwitch", switchId: "s", value: true }] : [{ kind: "showText", text: "아니다" }] })) }]);
      expect(weakPuzzleLocks(choice(0))).toHaveLength(1);
      expect(weakPuzzleLocks(choice(2))).toEqual([]);
    });
  });
});
