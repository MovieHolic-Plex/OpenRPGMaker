// 대사 관리·대본(이야기 순서) — 색인, 이야기 순서, 대본 글, 조수 도구 네 개(+요약), 거절 규칙.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { collectDialogueLines, dialogueTextHash, resolveDialogueSlot } from "@/editor/dialogue/dialogueIndex";
import { applyDialogueEdits, checkDialogueEdit, dialogueMeasureKey, estimateLineFit } from "@/editor/dialogue/dialogueEdits";
import { buildStory, resolveStoryRef } from "@/editor/dialogue/storyScript";
import { renderOutlineText, renderSceneText, selectScenes } from "@/editor/dialogue/storyScriptText";
import { DIALOGUE_PROPOSAL_LIMIT, readDialogueDesk, upsertDialogueProposals, writeDialogueWindow, type DialogueProposal } from "@/project/dialogueDesk";
import type { Command, EventPage, EventPageCondition, GameEvent, Project, Trigger } from "@/project/types";

function page(id: string, commands: Command[], options: { conditions?: EventPageCondition[]; trigger?: Trigger } = {}): EventPage {
  return {
    id,
    name: id,
    conditions: options.conditions ?? [],
    graphic: {},
    trigger: options.trigger ?? { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  } as EventPage;
}

function event(id: string, name: string, pages: EventPage[], x = 1): GameEvent {
  return { id, name, x, y: 1, trigger: { kind: "action" }, commands: [], pages } as GameEvent;
}

const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);
const on = (switchId: string): EventPageCondition => ({ kind: "switch", switchId, value: true } as EventPageCondition);

/**
 * 마을(시작 맵): 자동 시작 오프닝(sw_met) → 장로(sw_met 필요, 선택지, sw_quest) → 경비(sw_quest 필요, 동굴로 이동).
 * 동굴: 보스(sw_quest 필요, 엔딩). 곁가지: 마을 사람·광부(조건 없음). 오프닝은 일부러 맵 이벤트 목록 맨 뒤에 둔다.
 */
function fixture(): Project {
  const project = createBlankProject();
  const town = project.maps[project.startMapId]!;
  town.name = "마을";
  const cave = createBlankMap("동굴", 20, 15, town.tilesetId);
  cave.id = "map_cave";
  project.maps[cave.id] = cave;
  town.events.push(
    event("ev_villager", "마을 사람", [page("p1", [say("마을 사람", "오늘 날씨 좋네.")])], 2),
    event("ev_guard", "경비", [page("p1", [
      say("경비", "동굴은 위험하다. 조심해라."),
      { kind: "transfer", mapId: cave.id, x: 1, y: 1 } as Command,
    ], { conditions: [on("sw_quest")] })], 3),
    event("ev_elder", "장로", [page("p1", [
      say("장로", "북쪽 동굴에 괴물이 산다. 가 주겠느냐?"),
      { kind: "choices", options: [
        { text: "가겠습니다", branch: [say("리나", "맡겨 주세요.")] },
        { text: "싫어요", branch: [say("리나", "조금만 생각해 볼게요.")] },
      ] } as Command,
      { kind: "setSwitch", switchId: "sw_quest", value: true } as Command,
    ], { conditions: [on("sw_met")] })], 4),
    event("ev_intro", "오프닝", [page("p1", [
      say("", "작은 마을의 아침."),
      say("리나", "\\C[2]장로님\\C[0]이 부르셨다고?"),
      { kind: "setSwitch", switchId: "sw_met", value: true } as Command,
    ], { trigger: { kind: "auto" } })], 5),
  );
  cave.events.push(
    event("ev_miner", "광부", [page("p1", [say("광부", "곡괭이가 또 부러졌군.")])], 2),
    event("ev_boss", "괴물", [page("p1", [
      say("괴물", "드디어 왔구나."),
      { kind: "ending", title: "1막 끝", message: "괴물을 쓰러뜨렸다." } as Command,
    ], { conditions: [on("sw_quest")] })], 3),
  );
  return project;
}

function ctxOf(project: Project): ToolContext {
  return { project };
}

function lineBy(project: Project, text: string) {
  const line = collectDialogueLines(project).find((entry) => entry.text.includes(text));
  if (!line) throw new Error(`no line ${text}`);
  return line;
}

describe("dialogue index", () => {
  it("collects text, choice and ending lines with stable ids, hashes and speakers", () => {
    const project = fixture();
    const lines = collectDialogueLines(project, { includeDescriptions: false });
    const elder = lineBy(project, "북쪽 동굴");
    expect(elder.speaker).toBe("장로");
    expect(elder.hash).toBe(dialogueTextHash(elder.text));
    expect(lines.filter((line) => line.kind === "choiceOption").map((line) => line.text)).toEqual(["가겠습니다", "싫어요"]);
    expect(lines.some((line) => line.kind === "ending" && line.text === "1막 끝")).toBe(true);
    const slot = resolveDialogueSlot(project, elder.id);
    expect(slot).not.toBeNull();
  });
});

describe("story order", () => {
  it("orders main scenes by switch gates and transfers, not by map/event order, and ends at the ending", () => {
    const project = fixture();
    const story = buildStory(project, { fresh: true });
    expect(story.chapters).toHaveLength(1);
    const chapter = story.chapters[0]!;
    const main = chapter.mainIds.map((id) => story.scenes.get(id)!);
    expect(main.map((scene) => scene.eventId)).toEqual(["ev_intro", "ev_elder", "ev_guard", "ev_boss"]);
    expect(main.map((scene) => scene.ref)).toEqual(["S1", "S2", "S3", "S4"]);
    expect(main.at(-1)!.endsChapter).toBe(true);
    const side = chapter.sideIds.map((id) => story.scenes.get(id)!);
    expect(side.map((scene) => scene.eventId).sort()).toEqual(["ev_miner", "ev_villager"]);
    expect(side.every((scene) => scene.lane === "side" && scene.ref.startsWith("B"))).toBe(true);
    // 동굴 곁가지(광부)는 동굴로 들어가는 장면 뒤에 닻을 둔다.
    const miner = side.find((scene) => scene.eventId === "ev_miner")!;
    expect(story.scenes.get(miner.anchorId!)?.eventId).toBe("ev_guard");
  });

  it("resolves S2.1 style refs to the line in that scene", () => {
    const project = fixture();
    const story = buildStory(project, { fresh: true });
    const target = resolveStoryRef(story, "S2.1");
    expect(target?.line?.text).toContain("북쪽 동굴");
  });
});

describe("screenplay text", () => {
  it("renders heading, conditions, speaker lines with tags, stage directions and choices", () => {
    const project = fixture();
    const story = buildStory(project, { fresh: true });
    const elder = story.scenes.get(story.chapters[0]!.mainIds[1]!)!;
    const text = renderSceneText(project, story, elder);
    const line = lineBy(project, "북쪽 동굴");
    expect(text).toMatch(/^### /u);
    expect(text).toContain("조건: S1 뒤"); // 이름 없는 스위치는 그 스위치를 켜는 장면으로 보인다
    expect(text).toContain(`장로: 북쪽 동굴에 괴물이 산다. 가 주겠느냐? ⟨S2.1·${line.hash.slice(0, 6)}⟩`);
    expect(text).toContain("[선택지]");
    expect(text).toMatch(/> 가겠습니다 ⟨S2\.\d+·/u);
    expect(text).toContain("리나: 맡겨 주세요.");
    const guard = renderSceneText(project, story, story.scenes.get(story.chapters[0]!.mainIds[2]!)!);
    expect(guard).toContain("[장소 이동 → 동굴]");
    const intro = renderSceneText(project, story, story.scenes.get(story.chapters[0]!.mainIds[0]!)!);
    expect(intro).toContain("(내레이션): 작은 마을의 아침.");
  });

  it("outline lists main scenes with side counts; includeSide lists side scenes", () => {
    const project = fixture();
    const outline = renderOutlineText(project);
    expect(outline).toMatch(/- S1 마을 — /u);
    expect(outline).not.toContain("## 곁가지");
    expect(renderOutlineText(project, undefined, { includeSide: true })).toContain("## 곁가지");
  });

  it("speaker selection includes side scenes (NPCs often only appear there)", () => {
    const project = fixture();
    const story = buildStory(project, { fresh: true });
    const scenes = selectScenes(story, { speaker: "광부" });
    expect(scenes.map((scene) => scene.eventId)).toEqual(["ev_miner"]);
  });

  it("from/to accept a side scene ref and slice by position", () => {
    const project = fixture();
    const story = buildStory(project, { fresh: true });
    const all = selectScenes(story, { includeSide: true });
    const sideAt = all.findIndex((scene) => scene.lane === "side");
    expect(sideAt).toBeGreaterThan(0);
    const from = selectScenes(story, { includeSide: true, from: all[sideAt]!.ref });
    expect(from.map((scene) => scene.ref)).toEqual(all.slice(sideAt).map((scene) => scene.ref));
  });

  it("marks lines that overflow the measured window", () => {
    const project = fixture();
    writeDialogueWindow(project, {
      key: dialogueMeasureKey(project),
      variants: [{ face: false, speaker: true, bodyWidthPx: 60, fontSizePx: 12, maxLines: 1, fontLabel: "테스트" }],
    });
    const story = buildStory(project, { fresh: true });
    const text = renderSceneText(project, story, story.scenes.get(story.chapters[0]!.mainIds[1]!)!);
    expect(text).toMatch(/«창 넘침 \d+\/1줄»/u);
  });
});

describe("assistant story tools", () => {
  it("get_story_outline returns the outline, chapters and cast", () => {
    const result = runTool(ctxOf(fixture()), "get_story_outline", {});
    expect(result.ok).toBe(true);
    const data = result.data as { outline: string; chapters: { main: number; side: number }[]; cast: { speaker: string }[] };
    expect(data.chapters[0]).toMatchObject({ main: 4, side: 2 });
    expect(data.outline).toContain("S4");
    expect(data.cast.map((entry) => entry.speaker)).toContain("리나");
  });

  it("read_story_script speaker filter finds a side-only NPC", () => {
    const result = runTool(ctxOf(fixture()), "read_story_script", { speaker: "광부" });
    expect(result.ok).toBe(true);
    expect((result.data as { script: string }).script).toContain("광부: 곡괭이가 또 부러졌군.");
  });

  it("read_story_script paginates with nextFrom, and nextFrom on a side scene continues", () => {
    const project = fixture();
    const story = buildStory(project, { fresh: true });
    const all = selectScenes(story, { includeSide: true });
    const side = all.find((scene, index) => index > 0 && scene.lane === "side")!;
    // 곁가지 바로 앞까지만 들어가게 자른다.
    const before = all.slice(0, all.indexOf(side)).map((scene) => renderSceneText(project, story, scene));
    const budget = Math.max(2000, before.reduce((sum, text) => sum + text.length + 2, 0));
    const first = runTool(ctxOf(project), "read_story_script", { includeSide: true, maxChars: budget });
    expect(first.ok).toBe(true);
    const nextFrom = (first.data as { nextFrom?: string }).nextFrom;
    if (nextFrom) {
      const second = runTool(ctxOf(project), "read_story_script", { includeSide: true, from: nextFrom });
      expect(second.ok).toBe(true);
      expect((second.data as { script: string }).script).toContain(`### `);
    }
    // nextFrom 이 곁가지 번호여도 그 자리부터 읽는다.
    const fromSide = runTool(ctxOf(project), "read_story_script", { includeSide: true, from: side.ref });
    expect(fromSide.ok).toBe(true);
    expect((fromSide.data as { script: string }).script.startsWith(`### `)).toBe(true);
    expect((fromSide.data as { script: string }).script).toContain(side.lines[0]!.text);
  });

  it("rewrite_dialogue takes a script ref + 6-char hash and leaves a proposal (game text unchanged)", () => {
    const project = fixture();
    const line = lineBy(project, "북쪽 동굴");
    const ctx = ctxOf(project);
    const result = runTool(ctx, "rewrite_dialogue", {
      edits: [{ ref: "S2.1", hash: line.hash.slice(0, 6), text: "북쪽 동굴에 괴물이 있다. 가 줄 테냐?", reason: "짧게" }],
    });
    expect(result.ok).toBe(true);
    const proposals = readDialogueDesk(ctx.project).proposals;
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ lineId: line.id, after: "북쪽 동굴에 괴물이 있다. 가 줄 테냐?" });
    expect(lineBy(ctx.project, "북쪽 동굴").text).toBe(line.text);
  });

  it("read_story_script names the valid range instead of returning nothing for an unknown scene ref", () => {
    const result = runTool(ctxOf(fixture()), "read_story_script", { includeSide: true, from: "B1", to: "B99" });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain("B99 없음");
    expect(JSON.stringify(result)).toContain("곁가지는 B1~B2");
  });

  it("never evicts older proposals when the proposal list is full; the overflow is reported as rejected", () => {
    const project = fixture();
    const filler: DialogueProposal[] = Array.from({ length: DIALOGUE_PROPOSAL_LIMIT - 1 }, (_, index) => ({
      id: `p${index}`, lineId: `ev/x/y/z/${index}#body`, baseHash: "h", before: "a", after: "b", source: "ai", createdAt: "",
    }));
    expect(upsertDialogueProposals(project, filler)).toBe(DIALOGUE_PROPOSAL_LIMIT - 1);
    const elder = lineBy(project, "북쪽 동굴");
    const villager = lineBy(project, "날씨 좋네");
    const ctx = ctxOf(project);
    const result = runTool(ctx, "rewrite_dialogue", { edits: [
      { id: elder.id, hash: elder.hash, text: "북쪽 동굴 괴물, 맡아 줄 테냐?" },
      { id: villager.id, hash: villager.hash, text: "날씨 참 좋다." },
    ] });
    expect(result.ok).toBe(true);
    const proposals = readDialogueDesk(ctx.project).proposals;
    expect(proposals).toHaveLength(DIALOGUE_PROPOSAL_LIMIT);
    expect(proposals[0]!.id).toBe("p0");
    const data = result.data as { accepted: { id: string }[]; rejected: { id: string; reason: string }[] };
    expect(data.accepted).toHaveLength(1);
    expect(data.rejected).toEqual([expect.objectContaining({ reason: "full" })]);
  });

  it("rewrite_dialogue rejects an unknown ref", () => {
    const result = runTool(ctxOf(fixture()), "rewrite_dialogue", { edits: [{ ref: "S9.9", hash: "abcdef", text: "x" }] });
    expect(result.ok).toBe(false);
  });

  it("set_scene_summaries stores a summary that the outline then shows", () => {
    const project = fixture();
    const ctx = ctxOf(project);
    const result = runTool(ctx, "set_scene_summaries", { items: [{ scene: "S2", summary: "장로가 동굴 괴물 퇴치를 부탁한다." }] });
    expect(result.ok).toBe(true);
    const outline = runTool(ctx, "get_story_outline", {});
    expect((outline.data as { outline: string }).outline).toContain("장로가 동굴 괴물 퇴치를 부탁한다.");
  });
});

describe("edit rejections", () => {
  it("rejects a stale hash", () => {
    const project = fixture();
    const line = lineBy(project, "북쪽 동굴");
    const verdict = checkDialogueEdit(project, { id: line.id, hash: "000000000000", text: "다른 글" });
    expect(verdict).toMatchObject({ ok: false, reason: "stale-hash" });
  });

  it("rejects dropped or added control codes", () => {
    const project = fixture();
    const line = lineBy(project, "부르셨다고");
    expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: "장로님이 부르셨다고?" })).toMatchObject({ ok: false, reason: "control-codes" });
    expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: "\\C[2]장로님\\C[0]이 \\C[3]부르셨다고?" })).toMatchObject({ ok: false, reason: "control-codes" });
    expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: "\\C[2]장로님\\C[0], 부르셨어요?" })).toMatchObject({ ok: true });
  });

  it("rejects text that overflows the window more than the original unless allowOverflow", () => {
    const project = fixture();
    writeDialogueWindow(project, {
      key: dialogueMeasureKey(project),
      variants: [{ face: false, speaker: true, bodyWidthPx: 200, fontSizePx: 12, maxLines: 2, fontLabel: "테스트" }],
    });
    const line = lineBy(project, "북쪽 동굴");
    expect(estimateLineFit(project, line, line.text)?.overflow).toBe(false);
    const long = "북쪽 동굴에 괴물이 산다. ".repeat(8);
    expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: long })).toMatchObject({ ok: false, reason: "overflow" });
    expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: long }, { allowOverflow: true }).ok).toBe(true);
  });

  it("apply writes the text into the event command and changes the hash", () => {
    const project = fixture();
    const line = lineBy(project, "북쪽 동굴");
    const [verdict] = applyDialogueEdits(project, [{ id: line.id, hash: line.hash, text: "동굴 괴물 좀 잡아 다오." }]);
    expect(verdict!.ok).toBe(true);
    const after = collectDialogueLines(project).find((entry) => entry.id === line.id)!;
    expect(after.text).toBe("동굴 괴물 좀 잡아 다오.");
    expect(after.hash).not.toBe(line.hash);
    expect(checkDialogueEdit(project, { id: line.id, hash: line.hash, text: "또 고침" })).toMatchObject({ ok: false, reason: "stale-hash" });
  });
});
