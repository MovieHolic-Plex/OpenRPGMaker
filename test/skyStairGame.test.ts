// 《천공의 계단》 구성 계약 + 참조 무결성 + 밸런스 도달성.
//
// 이 파일이 지키는 것은 "숫자가 맞다"가 아니라 **저작한 것이 실제로 작동한다**다.
// 이 게임을 만들며 실제로 터진 결함들이 각각 아래 테스트 하나씩에 대응한다(2026-07-27):
//   · 액터를 4명으로 줄였더니 클래스·장비 권한에 남은 id 로 reference 오류 194건
//   · setWeather intensity 를 0~10 으로 줬다가 직렬화 왕복 실패
//   · TILE.TREE 하단만 놓아 화면에 줄기만 있는 나무 24그루
//   · 층간 이동문 6개가 벽 타일 위에 놓여 게임을 깰 수 없었음
//   · enemy_extra_* 재사용 시 25종이 전부 슬라임 스프라이트로 보임
import { readFileSync } from "node:fs";
import { PNG } from "pngjs"; // 선언은 test/pngjs.d.ts 에 좁게 두었다.
import { describe, expect, it } from "vitest";
import { builtinGeneratedResourceIds } from "@/assets/generatedAssetResourceResolver";
import { canMove, isPassable } from "@/project/collision";
import { totalExpForLevel } from "@/project/actorModel";
import {
  createSkyStairProject,
  SKY_BATTLE_BG,
  SKY_ENEMY_IDS,
  SKY_MAP,
  SKY_SWITCH,
} from "@/editor/content/skyStairGame";
import { projectLint } from "@/project/lint/projectLint";

const project = createSkyStairProject();
const maps = Object.values(project.maps);

/** 화자 이름이 붙은 대사를 하는 이벤트 = 사람 NPC. 전투·문·오브젝트는 이름 없이 말한다. */
function speakingNpcCount(mapId: string): number {
  const map = project.maps[mapId];
  if (!map) return 0;
  return map.events.filter((event) =>
    (event.pages ?? []).some((page) =>
      page.commands.some(
        (command) => command.kind === "text" && typeof (command as unknown as { speaker?: string }).speaker === "string"
      )
    )
  ).length;
}

describe("천공의 계단 — 구성", () => {
  it("맵이 7개다", () => {
    expect(maps).toHaveLength(7);
    expect(Object.keys(project.maps).sort()).toEqual(Object.values(SKY_MAP).slice().sort());
  });

  it("사람이 사는 6개 층에 NPC 가 30명이다", () => {
    const perMap = {
      [SKY_MAP.harbor]: 12,
      [SKY_MAP.wheat]: 6,
      [SKY_MAP.mistwood]: 4,
      [SKY_MAP.shrine]: 4,
      [SKY_MAP.mine]: 2,
      [SKY_MAP.snowgate]: 2,
    };
    let total = 0;
    for (const [mapId, expected] of Object.entries(perMap)) {
      expect(speakingNpcCount(mapId), `${project.maps[mapId]?.name} NPC 수`).toBe(expected);
      total += expected;
    }
    expect(total).toBe(30);
  });

  it("퀘스트가 5개이고 각각 시작·완료 스위치를 갖는다", () => {
    const started = [SKY_SWITCH.q1Started, SKY_SWITCH.q2Started, SKY_SWITCH.q3Started, SKY_SWITCH.q4Started, SKY_SWITCH.q5Started];
    const done = [SKY_SWITCH.q1Done, SKY_SWITCH.q2Done, SKY_SWITCH.q3Done, SKY_SWITCH.q4Done, SKY_SWITCH.q5Done];
    expect(started).toHaveLength(5);
    const known = new Set(project.switches.map((entry) => entry.id));
    for (const id of [...started, ...done]) expect(known.has(id), `스위치 ${id} 미등록`).toBe(true);
    // 모든 시작·완료 스위치는 실제로 어딘가에서 세팅돼야 한다 — 안 그러면 죽은 퀘스트다.
    const setSwitchIds = new Set(
      maps
        .flatMap((map) => map.events)
        .flatMap((event) => event.pages ?? [])
        .flatMap((page) => collectCommands(page?.commands ?? []))
        .filter((command) => command.kind === "setSwitch")
        .map((command) => (command as unknown as { switchId: string }).switchId)
    );
    for (const id of [...started, ...done]) expect(setSwitchIds.has(id), `스위치 ${id} 를 세팅하는 곳이 없다`).toBe(true);
  });

  it("아이템이 15종이다", () => {
    expect(project.database.items).toHaveLength(15);
  });

  it("몬스터가 25종이고 스프라이트가 전부 다르다", () => {
    expect(project.database.enemies).toHaveLength(25);
    expect(project.database.enemies.map((enemy) => enemy.id).sort()).toEqual([...SKY_ENEMY_IDS].sort());
    // 비주얼 중심 게임의 핵심 계약: 이름만 다르고 같아 보이는 적을 만들지 않는다.
    const sprites = project.database.enemies.map((enemy) => enemy.monsterResourceId);
    expect(new Set(sprites).size, `중복 스프라이트: ${JSON.stringify(sprites)}`).toBe(25);
  });

  it("모든 몬스터 스프라이트가 실제로 등록된 리소스다", () => {
    const known = new Set(builtinGeneratedResourceIds());
    const missing = project.database.enemies
      .map((enemy) => enemy.monsterResourceId)
      .filter((id): id is string => typeof id === "string" && !known.has(id));
    expect(missing, `등록되지 않은 몬스터 스프라이트: ${JSON.stringify(missing)}`).toEqual([]);
  });
});

describe("천공의 계단 — 다수 전투", () => {
  it("전투 그룹 11개 중 10개가 3명 이상이고, 단독은 최종 보스뿐이다", () => {
    const troops = project.database.troops;
    expect(troops).toHaveLength(11);
    const multi = troops.filter((troop) => troop.enemyIds.length >= 3);
    expect(multi.length, "다수 전투가 기본이어야 한다").toBe(10);
    const solo = troops.filter((troop) => troop.enemyIds.length === 1);
    expect(solo.map((troop) => troop.id)).toEqual(["troop_sky_demon_lord"]);
  });

  it("4인 그룹이 있고, 모든 그룹의 구성원이 정의된 적이다", () => {
    const ids = new Set(project.database.enemies.map((enemy) => enemy.id));
    const four = project.database.troops.filter((troop) => troop.enemyIds.length >= 4);
    expect(four.length, "4인 전투가 하나도 없다").toBeGreaterThanOrEqual(3);
    for (const troop of project.database.troops) {
      for (const enemyId of troop.enemyIds) {
        expect(ids.has(enemyId), `${troop.id} 가 없는 적 ${enemyId} 를 부른다`).toBe(true);
      }
    }
  });
});

describe("천공의 계단 — 비주얼 정체성", () => {
  it("7개 층이 각자 BGM·전투 배경·조명을 갖는다", () => {
    for (const map of maps) {
      expect(map.bgm?.mode, `${map.name} BGM 미지정`).toBe("custom");
      expect(map.bgm?.resourceId, `${map.name} BGM 리소스 없음`).toBeTruthy();
      expect(map.battleBackground, `${map.name} 전투 배경 미지정`).toBeTruthy();
      expect(map.defaultLighting, `${map.name} 조명 미지정`).toBeTruthy();
    }
  });

  it("전투 배경이 층마다 다르다 — 층이 바뀌면 전투 화면도 바뀐다", () => {
    const backgrounds = maps.map((map) => map.battleBackground);
    expect(new Set(backgrounds).size, `중복 전투 배경: ${JSON.stringify(backgrounds)}`).toBe(7);
    expect(new Set(Object.values(SKY_BATTLE_BG)).size).toBe(7);
  });

  it("조명이 층마다 실제로 다르다 — 폐광이 가장 어둡고 제단이 가장 밝다", () => {
    // 주의: ambient 는 "밝기"가 아니라 **화면을 덮는 오버레이의 불투명도**다
    // (lighting.ts drawLightingMask: globalAlpha = ambient 로 color 를 칠하고 광원이 구멍을 뚫는다).
    // 즉 ambient 가 클수록 어둡다. 처음에 이걸 거꾸로 알고 제단에 ambient 1 + #ffffff 를 줬다가
    // **불투명한 흰 판**이 돼서 제단이 완전한 백색 화면으로 나왔다(2026-07-27 스크린샷으로 발견).
    const overlay = new Map(maps.map((map) => [map.id, map.defaultLighting?.ambient ?? 0]));
    const mine = overlay.get(SKY_MAP.mine) ?? 0;
    const altar = overlay.get(SKY_MAP.altar) ?? 1;
    const mistwood = overlay.get(SKY_MAP.mistwood) ?? 0;
    expect(mine, "폐광이 가장 어두워야 한다(덮개가 가장 두꺼움)").toBeGreaterThan(0.6);
    expect(mine, `폐광 덮개가 ${mine} — 다른 층보다 두꺼워야 한다`).toBe(Math.max(...overlay.values()));
    expect(altar, "제단은 덮개가 없어야 가장 밝다").toBe(0);
    expect(mistwood, "안개 숲이 항구보다 어두워야 한다").toBeGreaterThan(overlay.get(SKY_MAP.harbor) ?? 0);
    // 어떤 층도 화면을 통째로 덮어서는 안 된다 — ambient 1 은 단색 판이다.
    for (const [mapId, value] of overlay) {
      expect(value, `${project.maps[mapId]?.name} 의 덮개가 불투명하다(${value}) — 화면이 단색이 된다`).toBeLessThan(0.9);
    }
    // 조명값이 최소 5가지는 달라야 "층마다 다르다"가 참이다.
    expect(new Set([...overlay.values()]).size).toBeGreaterThanOrEqual(5);
    // 폐광에는 등불이 실제로 있어야 어둠이 연출이 된다(아니면 그냥 안 보이는 맵이다).
    expect(project.maps[SKY_MAP.mine]?.defaultLighting?.sources.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("날씨가 안개 숲과 설산에서 실제로 켜진다", () => {
    const weathers = maps
      .flatMap((map) => map.events)
      .flatMap((event) => event.pages ?? [])
      .flatMap((page) => collectCommands(page?.commands ?? []))
      .filter((command) => command.kind === "setWeather")
      .map((command) => (command as unknown as { weather: string }).weather);
    expect(weathers).toContain("fog");
    expect(weathers).toContain("snow");
  });

  it("파티가 4명이고 전투 스프라이트가 전부 다르다", () => {
    expect(project.database.actors).toHaveLength(4);
    expect(project.system.startActorIds).toHaveLength(4);
    const battlers = project.database.actors.map((actor) => actor.battleCharacterResourceId);
    expect(new Set(battlers).size, `중복 전투 스프라이트: ${JSON.stringify(battlers)}`).toBe(4);
    // 아군 스프라이트를 그리는 스킨이어야 4인 파티가 화면에 보인다 — 기본 도트 측면 전투.
    expect(project.system.battleUiStyle).toBe("retro2003");
  });
});

describe("천공의 계단 — 도달성", () => {
  /** 진입 지점에서 canMove 로 실제로 걸어 도달할 수 있는 칸 집합. */
  function reachable(mapId: string, from: { x: number; y: number }): Set<number> {
    const map = project.maps[mapId];
    if (!map) return new Set();
    const key = (x: number, y: number): number => y * map.width + x;
    const seen = new Set<number>([key(from.x, from.y)]);
    const queue: [number, number][] = [[from.x, from.y]];
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        if (seen.has(key(nx, ny))) continue;
        if (!canMove(project, map, x, y, nx, ny)) continue;
        seen.add(key(nx, ny));
        queue.push([nx, ny]);
      }
    }
    return seen;
  }

  /** 각 층의 진입 지점 — 아래 층에서 올라올 때 실제로 떨어지는 칸. */
  const ENTRY: Readonly<Record<string, { x: number; y: number }>> = {
    [SKY_MAP.harbor]: { x: 15, y: 19 },
    [SKY_MAP.wheat]: { x: 15, y: 25 },
    [SKY_MAP.mistwood]: { x: 15, y: 29 },
    [SKY_MAP.shrine]: { x: 15, y: 21 },
    [SKY_MAP.mine]: { x: 3, y: 16 },
    [SKY_MAP.snowgate]: { x: 15, y: 19 },
    [SKY_MAP.altar]: { x: 12, y: 17 },
  };

  it("모든 이벤트가 걸어서 닿을 수 있는 자리에 있다", () => {
    // 완주 시나리오는 이벤트를 id 로 직접 호출하므로 **도달 불가한 이벤트를 잡지 못한다.**
    // 실제로 폐광 곁방이 본 갱도와 끊겨 미믹(25,10)이 영원히 못 가는 자리에 있었다(2026-07-27).
    for (const [mapId, entry] of Object.entries(ENTRY)) {
      const map = project.maps[mapId]!;
      const seen = reachable(mapId, entry);
      const key = (x: number, y: number): number => y * map.width + x;
      const unreachable = map.events.filter((event) => {
        // 이벤트 칸 자체가 막혀 있어도, 옆에서 말을 걸 수 있으면 도달로 친다(RM2003 관례).
        const around = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]] as const;
        return !around.some(([dx, dy]) => seen.has(key(event.x + dx, event.y + dy)));
      });
      expect(
        unreachable.map((event) => `${event.id}(${event.x},${event.y})`),
        `${map.name}: 걸어서 닿을 수 없는 이벤트`
      ).toEqual([]);
    }
  });

  it("갈 수 없는 넓은 고립 지대가 없다", () => {
    // 1~2칸짜리 고립 칸은 **의도된 시각 효과**다 — 집 킷의 지붕 모서리가 상위 레이어의
    // 투명 캡이라 그 아래 잔디 한 칸이 지붕에 둘러싸인다. 플레이어가 갈 일도, 갈 이유도 없다.
    // 반면 3칸 이상 묶인 고립 지대는 "팠는데 안 이어 붙인 방"이고, 실제로 폐광 곁방 39칸이
    // 그렇게 통째로 끊겨 미믹이 도달 불가였다(2026-07-27). 그래서 문턱을 3으로 둔다.
    const MIN_ISLAND = 3;
    for (const [mapId, entry] of Object.entries(ENTRY)) {
      const map = project.maps[mapId]!;
      const seen = reachable(mapId, entry);
      const key = (x: number, y: number): number => y * map.width + x;
      const stranded = new Set<number>();
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          // 반드시 `isPassable`(두 레이어 합성)로 봐야 한다. 하위 타일만 보면
          // **상위 레이어 소품이 만든 벽**을 놓친다 — 상자·통은 upper 에 놓이고
          // tilePassability 는 upper 가 있으면 그 플래그로 덮어쓴다(collision.ts:35).
          // 처음에 하위만 봤다가 소품 아래 잔디를 "갈 수 있는데 못 가는 칸"으로 오탐했다.
          if (isPassable(project, map, x, y) && !seen.has(key(x, y))) stranded.add(key(x, y));
        }
      }
      // 고립 칸을 연결 성분으로 묶는다 — 개수가 아니라 "덩어리 크기"가 문제다.
      const visited = new Set<number>();
      const bigIslands: string[] = [];
      for (const cell of stranded) {
        if (visited.has(cell)) continue;
        const group: number[] = [];
        const stack = [cell];
        visited.add(cell);
        while (stack.length > 0) {
          const current = stack.pop()!;
          group.push(current);
          const cx = current % map.width;
          const cy = Math.floor(current / map.width);
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
            const next = key(cx + dx, cy + dy);
            if (stranded.has(next) && !visited.has(next)) {
              visited.add(next);
              stack.push(next);
            }
          }
        }
        if (group.length >= MIN_ISLAND) {
          const first = group[0]!;
          bigIslands.push(`${first % map.width},${Math.floor(first / map.width)} (${group.length}칸)`);
        }
      }
      expect(bigIslands, `${map.name}: 이어 붙이지 않은 고립 지대`).toEqual([]);
    }
  });
});

describe("천공의 계단 — 무결성과 밸런스", () => {
  it("projectLint 오류가 0건이다", () => {
    const errors = projectLint(project).filter((issue) => issue.severity === "error");
    expect(errors.map((issue) => `[${issue.code}] ${issue.message}`)).toEqual([]);
  });

  it("고정 전투로 얻는 경험치만으로 레벨이 여러 번 오른다", () => {
    // 고정(퀘스트) 전투에서 확실히 얻는 경험치만 센다 — 랜덤 인카운트는 계산에 넣지 않는다.
    const enemyById = new Map(project.database.enemies.map((enemy) => [enemy.id, enemy]));
    const fixedTroopIds = [
      "troop_sky_scarecrow",
      "troop_sky_carnivore",
      "troop_sky_seal_water",
      "troop_sky_seal_stone",
      "troop_sky_seal_storm",
      "troop_sky_mine_crew",
      "troop_sky_wardens",
      "troop_sky_demon_lord",
    ];
    let total = 0;
    for (const troopId of fixedTroopIds) {
      const troop = project.database.troops.find((entry) => entry.id === troopId);
      expect(troop, `그룹 ${troopId} 없음`).toBeTruthy();
      for (const enemyId of troop!.enemyIds) total += enemyById.get(enemyId)?.rewards.exp ?? 0;
    }
    const curve = project.database.actors[0]!.expCurve;
    // 레벨 2 가 실제로 도달 가능해야 한다 — 기본 곡선은 L2 에 678 을 요구해서 불가능했다.
    expect(total, `고정 전투 총 경험치 ${total}`).toBeGreaterThan(totalExpForLevel(curve, 2));
    // 순례를 마칠 때 최소 8레벨은 되어야 층마다 성장이 체감된다.
    expect(total, `L8 요구 ${totalExpForLevel(curve, 8)} vs 획득 ${total}`).toBeGreaterThanOrEqual(
      totalExpForLevel(curve, 8)
    );
  });

  it("능력치 곡선이 평평하지 않다 — 레벨업이 눈에 보인다", () => {
    for (const actor of project.database.actors) {
      const hp = actor.parameterCurves.maxHp;
      const attack = actor.parameterCurves.attack;
      expect(hp[9]! - hp[0]!, `${actor.name} HP 성장`).toBeGreaterThan(100);
      expect(attack[9]! - attack[0]!, `${actor.name} 공격 성장`).toBeGreaterThan(20);
    }
  });

  it("시작 파티·소지품·전투 BGM 이 실제로 채워져 있다", () => {
    expect(project.session.partyActorIds).toHaveLength(4);
    expect(Object.keys(project.session.inventory).length).toBeGreaterThan(0);
    expect(project.system.battleBgmResourceId).toBe("cc0-bgm-battle");
    expect(project.system.defaultBgmResourceId).toBeTruthy();
    expect(project.startMapId).toBe(SKY_MAP.harbor);
  });
});

// 투명 배경 타일을 하위 레이어에 심으면 **화면에 검은 구멍이 난다.**
//
// 하위 레이어는 지면이라 그 아래에 아무것도 없고, 플레이 캔버스 배경은 `#000`
// (createPlayGame.ts `backgroundColor`)이다. 실제로 이 결함이 출하됐다 — 안개 숲의
// 나무·덤불 165칸을 setLower 로 심어 잔디를 지웠고, 화면의 6.5%가 순수 검정이었다.
// 평균 휘도는 129 로 멀쩡했기 때문에 E2E 의 휘도·고유색 검사를 모두 통과했다.
//
// 이 테스트는 규칙을 **아트에서 직접 유도한다** — 목록을 손으로 적으면 새 타일을 놓친다.
// 칩셋 PNG 를 디코딩해 투명 픽셀이 있는 타일을 찾고, 그런 타일이 어떤 맵의 하위 레이어에도
// 없어야 한다고 단정한다. 수관 260/262/263 은 통행 가능·priority=upper 이므로
// 상위 레이어에 올리는 것이 정답이고, 그러면 구멍도 없고 통행 판정도 맞는다.
describe("투명 배경 타일은 하위 레이어에 오면 안 된다", () => {
  const SHEETS: Record<string, string> = {
    easyrpg_chipset_combined_town: "public/assets/easyrpg-chipset-combined-town-transparent.png",
    easyrpg_chipset_dungeon: "public/assets/easyrpg-chipset-dungeon-transparent.png",
  };

  /** 칩셋에서 투명 픽셀이 한 칸이라도 있는 타일 id 집합. */
  function transparentTiles(sheetPath: string): Set<number> {
    const png = PNG.sync.read(readFileSync(sheetPath));
    const columns = Math.floor(png.width / 16);
    const found = new Set<number>();
    for (let row = 0; row * 16 < png.height; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        for (let y = 0; y < 16 && !found.has(row * columns + col); y += 1) {
          for (let x = 0; x < 16; x += 1) {
            const i = (((row * 16 + y) * png.width) + (col * 16 + x)) << 2;
            if ((png.data[i + 3] ?? 255) < 128) { found.add(row * columns + col); break; }
          }
        }
      }
    }
    return found;
  }

  it("7개 층의 하위 레이어에 투명 배경 타일이 하나도 없다", () => {
    const cache = new Map<string, Set<number>>();
    const offenders: string[] = [];
    for (const map of Object.values(project.maps)) {
      const sheet = SHEETS[map.tilesetId];
      if (!sheet) throw new Error(`${map.name}: 칩셋 ${map.tilesetId} 의 시트 경로를 이 테스트에 등록하라`);
      if (!cache.has(sheet)) cache.set(sheet, transparentTiles(sheet));
      const holey = cache.get(sheet)!;
      const counts = new Map<number, number>();
      for (const tile of map.lowerTiles) {
        if (tile < 0 || !holey.has(tile)) continue;
        counts.set(tile, (counts.get(tile) ?? 0) + 1);
      }
      for (const [tile, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
        offenders.push(`${map.name}: 타일 ${tile} × ${n}칸`);
      }
    }
    expect(
      offenders,
      "하위 레이어에 투명 배경 타일이 있다 — 그 칸은 화면에서 순수 검정으로 보인다. "
      + "상위 레이어(upperTiles)로 옮기고 하위에는 지면(잔디 240 / 키큰 풀 303 등, 투명 0/256)을 남겨라."
    ).toEqual([]);
  });
});

/** fork/loop 안에 든 커맨드까지 재귀로 모은다 — 얕게 보면 조건 분기 안의 명령을 놓친다. */
function collectCommands(commands: readonly unknown[]): { kind: string }[] {
  const out: { kind: string }[] = [];
  for (const raw of commands) {
    const command = raw as { kind: string; then?: unknown[]; else?: unknown[]; commands?: unknown[] };
    out.push(command);
    if (Array.isArray(command.then)) out.push(...collectCommands(command.then));
    if (Array.isArray(command.else)) out.push(...collectCommands(command.else));
    if (Array.isArray(command.commands)) out.push(...collectCommands(command.commands));
  }
  return out;
}
