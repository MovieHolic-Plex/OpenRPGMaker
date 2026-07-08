import { describe, expect, it } from "vitest";
import type { Command, EventPage, Project } from "@/project/types";
import fixture from "./fixtures/projects/editor-authored-demo-v3.json";

function demoProject(): Project {
  return fixture as unknown as Project;
}

function commands(project: Project): readonly Command[] {
  return Object.values(project.maps)
    .flatMap((map) => map.events)
    .flatMap((event) => event.pages ?? [])
    .flatMap((page) => page.commands);
}

function visibleGraphicSignatures(project: Project): readonly string[] {
  return Object.values(project.maps)
    .flatMap((map) => map.events)
    .flatMap((event) => event.pages ?? [])
    .filter((page): page is EventPage => !page.graphic.transparent)
    .map((page) => `${page.graphic.sprite?.id}:${page.graphic.pattern}`);
}

describe("editor-authored harbor demo quality", () => {
  it("has varied EasyRPG NPC graphics instead of one repeated default character", () => {
    const signatures = visibleGraphicSignatures(demoProject());

    expect(new Set(signatures).size).toBeGreaterThanOrEqual(8);
    expect(signatures.every((signature) => signature.startsWith("tex_easyrpg_charset_"))).toBe(true);
  });

  it("presents a coherent lighthouse quest before the ending", () => {
    const project = demoProject();
    const allCommands = commands(project);
    const serializedCommands = JSON.stringify(allCommands);
    const firstEndingIndex = allCommands.findIndex((command) => command.kind === "ending");
    const firstQuestChoiceIndex = allCommands.findIndex((command) => command.kind === "choices" && command.prompt === "등대 복구를 시작할까요?");

    expect(project.meta.title).toBe("안개 항구와 등대의 밤");
    expect(project.maps[project.startMapId]?.name).toBe("안개 항구 마을");
    expect(firstQuestChoiceIndex).toBeGreaterThanOrEqual(0);
    expect(firstEndingIndex).toBeGreaterThan(firstQuestChoiceIndex);
    expect(serializedCommands).toContain("첫 조각은 소금 장수가 말한 안개 방파제 끝에");
    expect(serializedCommands).toContain("두 번째 조각은 돛 수선공이 걱정하는 폐등대 창고");
    expect(serializedCommands).toContain("렌즈 조각 두 개가 모이기 전에는 꼭대기 계단이 열리지 않습니다.");
    expect(allCommands.filter((command) => command.kind === "battleProcessing").length).toBeGreaterThanOrEqual(4);
  });

  it("makes village NPCs move and acknowledge each other", () => {
    const project = demoProject();
    const pages = Object.values(project.maps).flatMap((map) => map.events).flatMap((event) => event.pages ?? []);
    const movingNpcPages = pages.filter((page) => !page.graphic.transparent && page.movement.type !== "fixed");
    const dialogue = JSON.stringify(commands(project));

    expect(movingNpcPages.length).toBeGreaterThanOrEqual(8);
    expect(dialogue).toContain("소금 장수");
    expect(dialogue).toContain("돛 수선공");
    expect(dialogue).toContain("부두 아이");
    expect(dialogue).toContain("등대 수습");
    expect(dialogue).toContain("하루");
  });

  it("stores editable markdown village information with the project", () => {
    const project = demoProject();
    const documents = project.villageInfoDocuments ?? [];

    expect(documents.length).toBeGreaterThanOrEqual(Object.keys(project.maps).length);
    expect(documents.map((document) => document.title)).toContain("안개 항구 마을.md");
    expect(documents.every((document) => document.title.endsWith(".md"))).toBe(true);
    expect(JSON.stringify(documents)).toContain("새 NPC는 반드시 기존 NPC 중 한 명을 알고 있어야 한다.");
  });
});
