// 전투는 전부 도트 측면이다(2026-10-02) — 정면 전투 스킨 다섯(rm2000·dragonquest·mother·mv·vxace)과
// 몬스터 그림 생성을 지웠고, 같은 날 창 색만 다르던 측면 스킨 여섯(rm2003·octopath·chrono·bravely·ff·goldensun)도 지웠다. 이 파일은 그 전환의 경계 계약만 한곳에 못 박는다:
//   - 저장된 옛 스킨 id 는 기본 도트 측면(retro2003)으로 풀리고 저장에서 지워진다.
//   - 스킨 공용 정면 적 그림(bskin-enemy-*)은 지웠고, 옛 id 는 도트 슬라임 초상으로 풀린다.
//   - 조수·자료집 AI 는 몬스터 그림을 새로 만들 수 없고 도트 몬스터(140종) 중에서 고른다.
// 몬스터 그림 자체의 폐기·140종 도트 계약은 openwiki/native-enemy-retirement.md 쪽 시험이 맡는다.
import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { PIXEL_ENEMY_PORTRAIT_URLS } from "@/assets/pixelEnemyPortraits";
import { DEFAULT_BATTLE_SKIN_ID, isRetiredBattleSkinId, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import { parseGeneratedRecord } from "@/editor/aiDatabaseGeneration";
import { runTool } from "@/editor/tools";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults/blankProject";

const RETIRED_SKINS = ["classic", "rm2000", "dragonquest", "mother", "mv", "vxace", "rm2003", "octopath", "chrono", "bravely", "ff", "goldensun"] as const;

describe("지운 전투 스킨 id", () => {
  it.each(RETIRED_SKINS)("%s 는 기본 도트 측면(retro2003)으로 풀린다", (id) => {
    expect(resolveSkinId(id)).toBe("retro2003");
    expect(isRetiredBattleSkinId(id)).toBe(true);
    expect(listBattleSkinIds() as string[]).not.toContain(id);
  });

  it("미설정·모르는 값도 retro2003 이고, 남은 스킨은 그대로다", () => {
    expect(DEFAULT_BATTLE_SKIN_ID).toBe("retro2003");
    expect(resolveSkinId(undefined)).toBe("retro2003");
    expect(resolveSkinId("bogus")).toBe("retro2003");
    for (const id of ["retro2003", "pokemon"]) {
      expect(resolveSkinId(id)).toBe(id);
      expect(isRetiredBattleSkinId(id)).toBe(false);
    }
  });

  it.each(["rm2000", "vxace", "octopath"])("normalizeSystemRecords 는 저장된 %s 를 지운다(기본 retro2003 으로 열린다)", (id) => {
    const project = createBlankProject();
    (project.system as { battleUiStyle?: string }).battleUiStyle = id;
    expect("battleUiStyle" in normalizeSystemRecords(project.system)).toBe(false);
  });

  it("normalizeSystemRecords 는 명시한 포켓몬 스킨을 보존한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "pokemon";
    expect(normalizeSystemRecords(project.system).battleUiStyle).toBe("pokemon");
  });
});

describe("스킨 공용 정면 적 그림", () => {
  it.each(["rm2003", "rm2000", "dragonquest", "mother", "octopath", "chrono", "bravely", "ff", "goldensun"])("bskin-enemy-%s 는 도트 슬라임 초상으로 풀린다", (id) => {
    expect(resolveAssetResourceUrl(`bskin-enemy-${id}`)).toBe(PIXEL_ENEMY_PORTRAIT_URLS["generated-enemy-slime-01"]);
  });
});

describe("자료집 AI 적 생성", () => {
  it("목록 안 id 는 그대로, 목록 밖 id 는 이름 조각으로, 그래도 없으면 슬라임으로", () => {
    expect(parseGeneratedRecord("enemy", '{"name":"서슬 늑대","monsterResourceId":"generated-enemy-wolf-grey"}').monsterResourceId)
      .toBe("generated-enemy-wolf-grey");
    expect(parseGeneratedRecord("enemy", '{"name":"동굴 박쥐","monsterResourceId":"bat"}').monsterResourceId)
      .toMatch(/^generated-enemy-bat/);
    expect(parseGeneratedRecord("enemy", '{"name":"이름없는 것","monsterResourceId":"quux"}').monsterResourceId)
      .toBe("generated-enemy-slime-01");
  });
});

describe("몬스터 그림 생성 금지", () => {
  it("generate_image_asset 는 kind monster 를 거절한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "generate_image_asset", { kind: "monster", prompt: "눈 덮인 산에서 포효하는 얼음 늑대", tags: ["늑대"] });
    expect(result.ok).toBe(false);
    expect(runTool(ctx, "generate_image_asset", { kind: "backdrop", prompt: "불타는 화산 동굴" }).ok).toBe(true);
  });
});
