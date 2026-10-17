// 체육관 클리어 → 「배지 획득」 연출 레시피(2026-10-16). 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import {
  BADGE_HALO_PICTURE_ID, BADGE_MEDAL_PICTURE_ID, badgeAwardCommands, badgeIconResourceId, findBadgeCeremony, installBadgeCeremonies, isBadgeCeremonyCommand,
} from "@/project/monsterBadgeCeremony";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { deserialize, serialize } from "@/project/io";
import type { Command, Project } from "@/project/types";

const kinds = (list: readonly Command[]): string[] => list.map((c) => c.kind);

function leaderLists(project: Project, switchId: string): Command[][] {
  const found: Command[][] = [];
  const walk = (list: Command[]): void => {
    if (list.some((c) => c.kind === "setSwitch" && c.switchId === switchId && c.value !== false)) found.push(list);
    for (const c of list) for (const nested of nestedCommandLists(c)) walk(nested as Command[]);
  };
  for (const map of Object.values(project.maps)) for (const event of map.events) { walk(event.commands); for (const page of event.pages ?? []) walk(page.commands); }
  return found;
}

describe("badgeAwardCommands — 연출 명령 배열", () => {
  const base = { badgeName: "새잎 배지", badgeIndex: 1, badgeTotal: 8, type: "grass", fanfareResourceId: "mx_audio_victory" } as const;

  it("섬광 → 징글 → 배지가 떠오름 → 빛 → 문장 → 그림 치우기 순서이고 새 런타임 명령을 쓰지 않는다", () => {
    const list = badgeAwardCommands(base);
    expect(list[0]).toMatchObject({ kind: "m2Command", commandId: "m2-047-flash-screen" });
    expect(list.find((c) => c.kind === "playAudio" && c.channel === "me")).toMatchObject({ resourceId: "mx_audio_victory" });
    const pictures = list.filter((c) => c.kind === "showPicture");
    expect(pictures.some((c) => c.kind === "showPicture" && c.pictureId === BADGE_HALO_PICTURE_ID && c.blendMode === "add")).toBe(true);
    const rise = pictures.filter((c) => c.kind === "showPicture" && c.pictureId === BADGE_MEDAL_PICTURE_ID);
    expect(rise.length).toBeGreaterThanOrEqual(2);
    expect(list.filter((c) => c.kind === "text").map((c) => (c.kind === "text" ? c.body : ""))).toEqual(["새잎 배지를 받았다!", "배지 케이스에 1/8번째 배지가 채워졌다."]);
    expect(kinds(list).slice(-2)).toEqual(["erasePicture", "erasePicture"]);
    for (const c of list) expect(["m2Command", "playAudio", "showPicture", "text", "erasePicture"]).toContain(c.kind);
  });

  it("받침 있는 이름은 「을」, 없는 이름은 「를」로 말한다", () => {
    const text = (name: string) => badgeAwardCommands({ badgeName: name }).filter((c) => c.kind === "text").map((c) => (c.kind === "text" ? c.body : ""))[0];
    expect(text("새잎 배지")).toBe("새잎 배지를 받았다!");
    expect(text("바위 훈장")).toBe("바위 훈장을 받았다!");
  });

  it("체육관 타입이 아이콘을 정하고, iconResourceId 가 타입보다 앞선다", () => {
    expect(badgeIconResourceId("water")).toBe("cc0-jetrel-gen-gem-sapphire");
    expect(badgeIconResourceId("nope")).toBe("cc0-jetrel-badge");
    const icon = (c: Command) => (c.kind === "showPicture" ? c.resourceId : undefined);
    expect(icon(badgeAwardCommands({ badgeName: "a", type: "fire" }).find((c) => c.kind === "showPicture")!)).toBe("cc0-jetrel-gen-gem-ruby");
    expect(icon(badgeAwardCommands({ badgeName: "a", type: "fire", iconResourceId: "cc0-jetrel-crystal" }).find((c) => c.kind === "showPicture")!)).toBe("cc0-jetrel-crystal");
  });

  it("그림은 화면 가운데 위쪽에 놓인다(해상도 따라)", () => {
    const medal = (screen: { width: number; height: number }) => badgeAwardCommands({ badgeName: "a", screen }).filter((c) => c.kind === "showPicture" && c.pictureId === BADGE_MEDAL_PICTURE_ID).at(-1) as Extract<Command, { kind: "showPicture" }>;
    const wide = medal({ width: 480, height: 320 });
    expect(wide.x! + 64).toBe(240); // 400% × 32px = 128px 폭
    const small = medal({ width: 320, height: 240 });
    expect(small.x! + 64).toBe(160);
  });

  it("연출 구간을 찾는다(앞쪽 섬광·징글 포함, 마지막 그림 치우기까지)", () => {
    const ceremony = badgeAwardCommands(base);
    const list: Command[] = [{ kind: "setSwitch", switchId: "s", value: true }, ...ceremony, { kind: "wait" } as unknown as Command];
    expect(findBadgeCeremony(list)).toEqual({ start: 1, end: ceremony.length });
    expect(findBadgeCeremony([{ kind: "setSwitch", switchId: "s", value: true }])).toBeUndefined();
    expect(ceremony.filter(isBadgeCeremonyCommand).length).toBeGreaterThan(0);
  });
});

describe("build_monster_game 의 관장 승리 분기", () => {
  const { project } = createMonsterExpedition({ gymCount: 2 });
  const badges = project.system.monsterCampaign!.badges;

  it("모든 배지의 승리 분기에 연출이 스위치 켜기 바로 뒤에 들어 있다", () => {
    expect(badges.length).toBe(2);
    for (const badge of badges) {
      const lists = leaderLists(project, badge.switchId);
      expect(lists.length, badge.id).toBeGreaterThan(0);
      for (const list of lists) {
        const at = list.findIndex((c) => c.kind === "setSwitch" && c.switchId === badge.switchId && c.value !== false);
        expect(list.slice(at + 1).some((c) => c.kind === "showPicture" && c.pictureId === BADGE_MEDAL_PICTURE_ID), badge.id).toBe(true);
      }
    }
  });

  it("캠페인 배지는 번들에 있는 아이콘을 가지고 저장·재로드해도 남는다", () => {
    const ids = collectResourceIds(project);
    for (const badge of badges) {
      expect(badge.iconResourceId).toBeTruthy();
      expect(ids.has(badge.iconResourceId!), badge.iconResourceId).toBe(true);
    }
    const reloaded = deserialize(serialize(project));
    expect(reloaded.system.monsterCampaign!.badges.map((b) => b.iconResourceId)).toEqual(badges.map((b) => b.iconResourceId));
  });

  it("배지 스위치 규칙: 배지 N 의 스위치는 mx_badge_N", () => {
    badges.forEach((badge, index) => expect(badge.switchId).toBe(`mx_badge_${index + 1}`));
  });
});

describe("installBadgeCeremonies / configure_monster_campaign {badgeCeremony}", () => {
  const fresh = (): Project => deserialize(serialize(createMonsterExpedition({ gymCount: 1 }).project));
  const ceremonyCount = (project: Project, switchId: string): number => leaderLists(project, switchId).reduce((n, list) => n + list.filter((c) => c.kind === "showPicture" && c.pictureId === BADGE_MEDAL_PICTURE_ID).length, 0);

  it("걷었다 다시 심으면 원래 모양이고(멱등), 두 번 심어도 겹치지 않는다", () => {
    const project = fresh();
    const switchId = project.system.monsterCampaign!.badges[0]!.switchId;
    const before = ceremonyCount(project, switchId);
    expect(before).toBeGreaterThan(0);
    expect(installBadgeCeremonies(project, { remove: true }).removed).toEqual(["badge_1"]);
    expect(ceremonyCount(project, switchId)).toBe(0);
    expect(installBadgeCeremonies(project).installed).toEqual(["badge_1"]);
    installBadgeCeremonies(project);
    expect(ceremonyCount(project, switchId)).toBe(before);
  });

  it("스위치를 켜는 이벤트가 없는 배지는 missing, 없는 badgeId 는 거부", () => {
    const project = fresh();
    project.system.monsterCampaign!.badges.push({ id: "badge_x", name: "빈 배지", switchId: "mx_badge_x", cityMapId: project.system.monsterCampaign!.badges[0]!.cityMapId });
    expect(installBadgeCeremonies(project).missing).toEqual(["badge_x"]);
    expect(() => installBadgeCeremonies(project, { badgeId: "nope" })).toThrow(/없는 배지 id/);
  });

  it("도구가 같은 일을 하고 요약에 결과를 적는다", () => {
    const project = fresh();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: true };
    const removed = runTool(ctx, "configure_monster_campaign", { badgeCeremony: { remove: true } }, { dryRun: false });
    expect(removed.ok, removed.summary).toBe(true);
    expect(removed.summary).toContain("걷음");
    const planted = runTool(ctx, "configure_monster_campaign", { badgeCeremony: { badgeId: "badge_1", line: "별빛이 손에 들어왔다!" } }, { dryRun: false });
    expect(planted.ok, planted.summary).toBe(true);
    const texts = leaderLists(ctx.project, "mx_badge_1").flatMap((l) => l.filter((c) => c.kind === "text").map((c) => (c.kind === "text" ? c.body : "")));
    expect(texts).toContain("별빛이 손에 들어왔다!");
  });

  it("definition.badges 의 없는 아이콘은 참조 검사에서 막힌다", () => {
    const project = fresh();
    project.system.monsterCampaign!.badges[0]!.iconResourceId = "no-such-icon";
    expect(() => deserialize(serialize(project))).toThrow();
  });
});
