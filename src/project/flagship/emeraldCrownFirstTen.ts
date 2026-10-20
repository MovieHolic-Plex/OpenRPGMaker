import type { Command, GameEvent, Project } from "@/project/types";
import { castTheAstraHorizon } from "./emeraldCrownCast";

/**
 * 아스트라 호라이즌 첫 10분(타이틀 → 내 방 → 엄마 → 연구소 → 스타터 → 라이벌 → 1번 도로 → 실바나 체육관) 다듬기.
 * 2026-10-20 실입력 첫 10분 녹화(first10.mjs)와 독립 검수에서 나온 것만 고친다:
 * - 엄마가 동료도 없는 첫 대면에 「구슬을 다 썼구나」 하며 구슬 세 개를 줬다(시작 때 구슬 0개라 조건이 참).
 * - 박사의 첫 말이 설정 설명 한 덩이였고, 스타터를 받은 뒤 바로 「배지 → 신전」 먼 목표부터 말했다.
 * - 라이벌 나루는 인사 한 줄 뒤 곧장 전투, 끝나고도 연구소에 계속 서서 재대결만 물었다. 동료는 지친 채 길로 나갔다.
 * - 회복 센터 직원이 카운터 앞(손님 자리)에 서 있었다.
 * - 1번 도로 트레이너 셋이 모두 풀에 반감(비행·벌레)이라 풀 스타터만 손해였고, 셋째는 벌레 기술로 풀을 두 배로 때렸다.
 */
const text = (body: string, speaker?: string): Command => (speaker ? { kind: "text", speaker, body } : { kind: "text", body });

function eventOf(project: Project, mapId: string, eventId: string): GameEvent | undefined {
  return project.maps[mapId]?.events.find((e) => e.id === eventId);
}

/** 명령 나무의 모든 하위 목록(분기·선택지·전투 결과). */
function walkLists(commands: Command[], visit: (list: Command[]) => void): void {
  visit(commands);
  for (const command of commands) {
    const node = command as unknown as Record<string, unknown>;
    for (const key of ["then", "else", "branch", "victoryBranch", "defeatBranch", "escapeBranch", "cancelBranch"]) {
      const child = node[key];
      if (Array.isArray(child)) walkLists(child as Command[], visit);
    }
    if (Array.isArray(node.options)) for (const option of node.options as { branch?: Command[] }[]) if (option.branch) walkLists(option.branch, visit);
  }
}

function replaceText(event: GameEvent | undefined, from: RegExp, to: Command[]): void {
  for (const page of event?.pages ?? []) {
    walkLists(page.commands, (list) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i]!;
        if (c.kind === "text" && from.test(c.body)) list.splice(i, 1, ...structuredClone(to));
      }
    });
  }
}

/** 내 방 — 오늘 무슨 날인지 한 줄, 조작은 짧은 안내 한 줄. */
function polishBedroom(project: Project): void {
  const intro = eventOf(project, "mx_map_home_house_2f", "mx_map_home_house_2f_opening");
  for (const page of intro?.pages ?? []) {
    page.commands = [
      // 한 쪽에 한 생각(적대 검수 m1: 문장 가운데서 쪽이 넘어갔다).
      text("드디어 오늘! 박사님께 첫 동료를 받는 날이다."),
      text("창밖에서는 여명의 날개 새들이 길을 잃은 듯 맴돌고 있다."),
      text("〔방향키〕 걷기 · 〔Z〕 말 걸기 · 〔X〕 메뉴"),
      { kind: "setSwitch", switchId: "mx_intro", value: true },
    ];
  }
}

/** 엄마 — 첫 대면엔 짧은 배웅과 길 안내, 동료를 데려오면 반기고 쉬게 해 준다. 구슬은 동료가 있고 다 썼을 때만. */
function polishMom(project: Project): void {
  const mom = eventOf(project, "mx_map_home_house", "mx_map_home_house_resident");
  const page = mom?.pages?.[0];
  if (!page) return;
  page.commands = [
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "mx_starter", value: true },
      then: [
        text("어머, 네 첫 동료구나! 이리 와, 둘 다 따뜻한 차 한 잔 마시고 가.", "엄마"),
        { kind: "recoverAll" },
        { kind: "playAudio", resourceId: "easyrpg-sound-chime2", channel: "se", loop: false },
        text("동료들의 기운이 돌아왔다."),
        {
          kind: "fork",
          condition: { kind: "item", itemId: "item_capture_orb", present: false },
          then: [
            { kind: "changeItem", itemId: "item_capture_orb", op: "+=", amount: 3 },
            text("구슬을 다 썼다고? 자, 세 개 챙겨 가렴. 너무 무리하진 말고!", "엄마"),
          ],
          else: [],
        },
      ],
      else: [
        text("일어났구나! 박사님이 아침부터 기다리셔.", "엄마"),
        text("연구소는 광장 건너 초록 지붕의 큰 건물이야. 나루는 벌써 뛰어나갔단다!", "엄마"),
      ],
    },
  ];
}

/** 연구소 — 박사는 짧게 왜 지금인지 말하고 고르게 한다. 고른 뒤엔 나루에게로, 나루와 싸운 뒤엔 1번 도로로. */
function polishLab(project: Project): void {
  const professor = eventOf(project, "mx_map_lab", "mx_map_lab_professor");
  replaceText(professor, /^어서 오렴\. 아스트라 군도의 몬스터들은/, [
    text("왔구나! 기다리고 있었단다. 오늘부터 너도 어엿한 트레이너야.", "천문박사"),
    text("등대를 되살리려면 먼 길을 함께 걸을 동료가 필요하지. 저 셋 중에서 첫 동료를 골라 보렴.", "천문박사"),
  ]);
  replaceText(professor, /^첫 동료와 만났구나!/, [
    text("좋은 짝이구나! 야생 몬스터는 체력을 깎은 다음 「가방」의 포획 구슬을 던지면 잘 잡힌단다.", "천문박사"),
  ]);
  replaceText(professor, /^실바나 체육관의 배지를 받으면 별모래 신전으로/, [
    text("저기 나루도 너를 기다리고 있었단다. 인사하고 가렴.", "천문박사"),
  ]);
  replaceText(professor, /^메뉴의 「도감」에서 만난 몬스터를/, [
    text("북쪽 1번 도로를 따라가면 실바나 마을이 나온단다. 거기 체육관 관장 유림을 만나 보렴.", "천문박사"),
    text("다음 목표는 언제든 메뉴의 「배지」에서 볼 수 있단다.", "천문박사"),
  ]);

  // 스타터 미리보기 그림(가운데)이 「자동」 위 대화창에 위쪽이 가렸다(2026-10-20 녹화 78초) — 박사 대사는 모두 아래 창.
  for (const page of professor?.pages ?? []) walkLists(page.commands, (list) => { for (const c of list) if (c.kind === "text") c.position = "bottom"; });

  const rival = eventOf(project, "mx_map_lab", "mx_map_lab_rival");
  const page = rival?.pages?.[0];
  if (!rival || !page) return;
  // 첫 대결(동료를 받은 뒤) 전투 명령을 그대로 가져와 앞뒤 대사만 새로 쓴다.
  let firstBattle: Extract<Command, { kind: "battleProcessing" }> | undefined;
  walkLists(page.commands, (list) => {
    for (const c of list) if (c.kind === "battleProcessing" && (c.victoryBranch ?? []).some((v) => v.kind === "setSwitch" && v.switchId === "mx_rival_lab")) firstBattle = c;
  });
  if (!firstBattle) return;
  const battle = structuredClone(firstBattle);
  const afterBattle: Command[] = [
    { kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { cue: "battle", operation: "reset", value: "", volume: 100 } },
    { kind: "setSwitch", switchId: "mx_rival_lab", value: true },
    text("천문박사가 다가와 두 동료를 쓰다듬었다."),
    { kind: "recoverAll" },
    { kind: "playAudio", resourceId: "easyrpg-sound-chime2", channel: "se", loop: false },
    text("둘 다 잘 싸웠다. 동료들은 기운을 되찾았단다.", "천문박사"),
    // 첫 길 선물 — 1번 도로는 연달아 싸우므로 새 플레이어가 전투 중 「가방」을 한 번은 쓸 수 있게(2026-10-20 녹화: 체력 4로 다음 야생에 졌다).
    { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 },
    text("이 회복약 두 개도 챙겨 가렴. 싸우다 위험하면 「가방」에서 쓰는 거란다.", "천문박사"),
    // 도감과 첫 포획 — 1번 도로 첫 야생에서 구슬 넷이 모두 「아깝다」로 끝나고 블랙아웃했다(2026-10-21 적대 검수 B3). 3세대 첫 포획처럼 반드시 잡히는 구슬 하나.
    { kind: "setSwitch", switchId: TRIAL.dexSwitch, value: true },
    text("그리고 이건 별빛 도감이란다. 만난 몬스터가 저절로 기록되지.", "천문박사"),
    { kind: "changeItem", itemId: TRIAL.orbId, op: "+=", amount: 1 },
    text("이 시험용 구슬도 받으렴. 처음 한 번은 꼭 잡히게 만든 구슬이란다. 1번 도로에서 써 보렴!", "천문박사"),
    { kind: "changeItem", itemId: "item_capture_orb", op: "+=", amount: 3 },
    text("이거, 내 몫 포획 구슬 세 개 나눠 줄게. 대신 도감은 내가 먼저 채운다!", "나루"),
    text("난 1번 도로로 먼저 간다! 실바나 마을 체육관에서 보자!", "나루"),
    { kind: "playAudio", resourceId: "mx_audio_town", channel: "bgm", loop: true },
    { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} },
  ];
  battle.victoryBranch = [text("으으, 졌다! …그래도 볼트온이랑 손발은 딱 맞았어.", "나루"), ...afterBattle];
  battle.defeatBranch = [text("내가 이겼다! 너도 처음치고는 꽤 하던데?", "나루"), ...afterBattle];
  page.commands = [
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "mx_starter", value: true },
      then: [
        text("왔다! 나도 방금 볼트온을 받았어. 박사님이 우리 둘에게 똑같이 맡기셨대.", "나루"),
        text("누구 동료가 더 센지 지금 확인해 보자. 봐주기 없기다!", "나루"),
        { kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { cue: "battle", operation: "set", resourceId: "mx_audio_trainerBattle", volume: 100 } },
        battle,
      ],
      else: [text("늦잠 잤지? 박사님이 기다리셔. 첫 동료부터 받아 와!", "나루")],
    },
  ];
  // 이긴 뒤 다시 들어오면 나루는 이미 1번 도로로 떠났다 — 빈 페이지가 이긴다(실바나 마을에서 다시 만난다).
  rival.pages = [
    page,
    { ...structuredClone(page), id: `${page.id}_gone`, name: "떠남", conditions: [{ kind: "switch", switchId: "mx_rival_lab", value: true }], graphic: { transparent: true }, commands: [] },
  ];
}

/** 회복 센터 — 직원은 카운터 안쪽(2행)에 서고, 손님은 카운터 앞(5행)에서 카운터 칸(4행)에 말을 건다. */
function nurseBehindCounter(project: Project): void {
  for (const mapId of ["mx_map_home_center", "mx_map_grove_center"]) {
    const map = project.maps[mapId];
    const nurse = map?.events.find((e) => e.id === `${mapId}_nurse`);
    if (!map || !nurse) continue;
    const behind = { x: 7, y: 2 }, desk = { x: 7, y: 4 };
    const sprite: GameEvent = {
      ...structuredClone(nurse),
      id: `${mapId}_nurse_sprite`,
      name: "센터 직원",
      x: behind.x,
      y: behind.y,
      pages: (nurse.pages ?? []).map((page) => ({ ...structuredClone(page), trigger: { kind: "action" as const }, commands: [] })),
    };
    // 말 거는 칸(카운터)은 보이지 않는 창구 — 회복 의식의 「뛰기」는 직원 그림이 한다.
    nurse.x = desk.x;
    nurse.y = desk.y;
    for (const page of nurse.pages ?? []) {
      page.graphic = { transparent: true };
      walkLists(page.commands, (list) => {
        for (const c of list) {
          if (c.kind === "moveEvent" && !c.eventId) c.eventId = sprite.id;
          // 방이 작아 카메라가 위에 붙으면 「자동」 대화창이 위로 가서 카운터 뒤 직원을 가렸다(2026-10-20 녹화). 직원 대사는 아래 창.
          if (c.kind === "text") c.position = "bottom";
        }
      });
    }
    map.events.push(sprite);
  }
}

/** 1번 도로 트레이너 — 첫 길에서는 어느 스타터든 기술 하나로 이길 수 있게, 상대는 몸통 기술만. 첫 트레이너는 땅 타입(풀·물에 약하고 불과는 보통). */
function fairRouteOne(project: Project): void {
  const enemies = project.database.enemies;
  const tackle = project.database.skills.find((s) => s.id === "mx_skill_normal_1")?.id;
  for (const enemy of enemies) {
    if (!/^mx_enemy_mx_map_meadow_trainer_\d+_\d+$/.test(enemy.id)) continue;
    if (tackle) enemy.actions = enemy.actions.filter((a) => !a.skillId || a.skillId === tackle);
  }
  const first = enemies.find((e) => e.id === "mx_enemy_mx_map_meadow_trainer_0_0");
  const groundPig = enemies.find((e) => e.id === "mx_enemy_rootpig");
  if (first && groundPig) {
    first.name = groundPig.name;
    first.speciesId = groundPig.speciesId;
    first.monsterResourceId = groundPig.monsterResourceId;
    first.graphicHue = groundPig.graphicHue;
    first.elementRates = structuredClone(groundPig.elementRates);
    first.stateRates = structuredClone(groundPig.stateRates);
  }
}

/**
 * 연구소 아래 서가 줄 — 같은 2×2 책장 여섯 개가 나란히 있었다(2026-10-20 검수: 반복 장식).
 * 같은 연구소 칩셋의 서버 랙·컴퓨터 책상·표본 진열장·윗선반으로 섞는다(새 그림 없음). 바닥 아래층은 체크 무늬로 되돌린다.
 */
function varyLabShelves(project: Project): void {
  const lab = project.maps.mx_map_lab;
  if (!lab || lab.lowerTiles[7 * lab.width + 1] !== 830) return;
  const floor = (x: number, y: number) => ((x + y) % 2 === 0 ? 288 : 289);
  const put = (x0: number, y0: number, upper: number[][]) => {
    upper.forEach((row, dy) => row.forEach((tile, dx) => {
      const i = (y0 + dy) * lab.width + x0 + dx;
      lab.lowerTiles[i] = floor(x0 + dx, y0 + dy);
      lab.upperTiles[i] = tile;
    }));
  };
  put(3, 7, [[816, 816], [817, 817]]); // 서버 랙 둘
  put(5, 7, [[818, 819], [820, 821]]); // 컴퓨터 책상
  put(8, 7, [[822, 823], [824, 825]]); // 표본 진열장
  put(12, 7, [[826, 827], [828, 829]]); // 윗선반
}

/** 회복 의식 — 구슬 반짝임 한 바퀴·빛 한 번이면 충분하다. 생성기 기본은 빛을 세 번 돌려 글 없이 7초쯤 멈춰 있었다(2026-10-20 첫 10분 녹화). */
function quickerHealing(project: Project): void {
  for (const mapId of ["mx_map_home_center", "mx_map_grove_center"]) {
    const nurse = project.maps[mapId]?.events.find((e) => e.id === `${mapId}_nurse`);
    for (const page of nurse?.pages ?? []) {
      walkLists(page.commands, (list) => {
        const recover = list.findIndex((c) => c.kind === "recoverAll");
        if (recover < 0) return;
        const flashes = list.map((c, i) => (c.kind === "m2Command" && c.commandId === "m2-047-flash-screen" ? i : -1)).filter((i) => i >= 0 && i < recover);
        if (flashes.length > 1) list.splice(flashes[0]! + 2, recover - (flashes[0]! + 2)); // 첫 빛과 그 뒤 wait 하나만 남긴다
        for (const c of list) if (c.kind === "wait" && c.ms > 300) c.ms = 300;
      });
    }
  }
}

/** 체육관 수련생 — 필드에서 이름을 밝힌 사람이 전투 문장에서는 「수련생」·「견습 조련사」로 불렸다. */
function nameGymTrainers(project: Project): void {
  const names: Record<string, string> = { mx_troop_mx_map_grove_gym_grunt_0: "덩굴지기 하람", mx_troop_mx_map_grove_gym_grunt_1: "정원사 소이", mx_troop_mx_map_grove_gym_grunt_2: "수련생 도윤" };
  for (const troop of project.database.troops) if (names[troop.id]) troop.name = names[troop.id]!;
  // 정원사 소이의 전투 그림이 분홍 원피스 어린 소녀였다(2026-10-21 적대 검수) — 초록 작업복 그림(bug_catcher)으로.
  const soi = project.database.troops.find((t) => t.id === "mx_troop_mx_map_grove_gym_grunt_1");
  if (soi?.trainerSprite) soi.trainerSprite = { ...soi.trainerSprite, front: "bug_catcher" };
  // 이긴 체육관 수련생에게 다시 말을 걸면 「견습 조련사」 이름으로 「다시 만나 반가워」 + 재대결 선택지가 나왔고, Enter 한 번에 같은 승부를 또 했다
  // (2026-10-21 적대 검수 — 정원사 소이와 두 번 싸우고 다음 수련생에게 쓰러짐). 3세대처럼 진 수련생은 자기 이름으로 한마디만 한다.
  const after: Record<string, [string, string]> = {
    mx_map_grove_gym_grunt_0: ["덩굴지기 하람", "덩굴 문은 네가 열었으니 이 길도 네 거야. 관장님께 힘내!"],
    mx_map_grove_gym_grunt_1: ["정원사 소이", "승부 솜씨 좋더라. 관장님은 쉽게 물러서지 않으셔."],
    mx_map_grove_gym_grunt_2: ["수련생 도윤", "풀의 끈기를 넘었구나. 관장님 앞에서도 그렇게만 해!"],
  };
  for (const event of project.maps.mx_map_grove_gym?.events ?? []) {
    const line = after[event.id];
    const rematch = event.pages?.find((page) => page.id.endsWith("_rematch"));
    if (line && rematch) { rematch.name = "이긴 뒤"; rematch.commands = [text(line[1], line[0])]; }
  }
}

/**
 * 1번 도로 첫 야생 — 길은 풀숲 옆으로만 나 있어 풀을 밟지 않고 실바나 마을까지 갈 수 있었고, 첫 10분 녹화에서 야생을 한 번도 못 만났다.
 * 도로에 들어서 몇 걸음 가면 풀숲에서 피오르(노말·비행)가 한 번 뛰어나온다 — 잡으면 풀 체육관에 강한 동료가 된다.
 */
function firstWildOnRouteOne(project: Project): void {
  const meadow = project.maps.mx_map_meadow;
  if (!meadow || meadow.events.some((e) => e.id.startsWith("mx_map_meadow_first_wild_"))) return;
  const troopId = "mx_troop_mx_map_meadow_wild_0";
  if (!project.database.troops.some((t) => t.id === troopId)) return;
  if (!project.switches.some((sw) => sw.id === "mx_first_wild")) project.switches.push({ id: "mx_first_wild", name: "mx_first_wild" });
  const commands: Command[] = [
    { kind: "setSwitch", switchId: "mx_first_wild", value: true },
    text("풀숲이 바스락거리더니 무언가 튀어나왔다!"),
    text("〔힌트〕 「가방」에서 박사님이 준 「시험용 구슬」을 던져 보자. 처음 한 번은 꼭 잡힌다!"),
    {
      kind: "battleProcessing", troopId, canEscape: true, canLose: true, branchOnResult: true,
      victoryBranch: [],
      escapeBranch: [],
      defeatBranch: [
        text("눈앞이 캄캄해졌다…"),
        text("…정신을 차려 보니 회복 센터였다. 동료들도 기운을 되찾았다."),
        { kind: "recoverAll" },
        { kind: "transfer", mapId: "mx_map_home_center", x: 7, y: 7, direction: "up", fade: "black" },
      ],
    } as Command,
  ];
  // 도로 입구에서 세 줄 위 가로줄 전체(지나갈 수 있는 칸마다) — 길 옆 풀밭으로 돌아가도 한 번은 만난다.
  const y = 24;
  for (const x of [6, 7, 8, 9, 10, 11, 12, 13, 16, 17]) {
    if (meadow.events.some((e) => e.x === x && e.y === y)) continue;
    meadow.events.push({
      id: `mx_map_meadow_first_wild_${x}`,
      name: "첫 야생",
      x,
      y,
      trigger: { kind: "playerTouch" },
      commands: [],
      pages: [{
        id: `mx_map_meadow_first_wild_${x}_p1`,
        name: "첫 야생",
        conditions: [{ kind: "switch", switchId: "mx_first_wild", value: false }, { kind: "switch", switchId: "mx_starter", value: true }],
        graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "below",
        trigger: { kind: "playerTouch" },
        commands: structuredClone(commands),
      }],
    });
  }
}

/**
 * 첫 체육관(풀·벌레)을 어느 스타터로든 기술만으로 넘을 수 있게 — 2026-10-20 첫 10분 녹화에서 토리프(풀)는 몸통 기술 하나로 버티다 관장에게 졌다.
 * 풀·물 스타터는 원래 16레벨에 배우던 보조 타입 기술을 6레벨(1번 도로 첫 승리 즈음)로 당긴다. 불 스타터는 이미 유리하다.
 */
function starterCoverage(project: Project): void {
  const early: Record<string, string> = { mx_species_spriglet: "mx_skill_psychic_1", mx_species_rivulet: "mx_skill_ice_1" };
  for (const species of project.database.monsterSpecies ?? []) {
    const skillId = early[species.id];
    const entry = species.skillsByLevel?.find((s) => s.skillId === skillId);
    if (entry && entry.level > 6) entry.level = 6;
    species.skillsByLevel?.sort((a, b) => a.level - b.level);
  }
  // 그래도 풀·벌레 체육관에서 불은 3턴 무패, 물은 수련생에게 전멸, 풀은 관장에게 10턴 끝에 졌다(2026-10-21 적대 검수 r3).
  // 처음부터(Lv5) 풀은 깃바람(비행 — 풀·벌레에 두 배), 물은 서리발(얼음 — 풀에 두 배)을 갖고 시작한다. 불은 숯불톡이 같은 몫이다.
  const fromStart: Record<string, string> = { mx_species_spriglet: "mx_skill_flying_1", mx_species_rivulet: "mx_skill_ice_1" };
  for (const species of project.database.monsterSpecies ?? []) {
    const skillId = fromStart[species.id];
    if (!skillId || !project.database.skills.some((s) => s.id === skillId)) continue;
    const list = (species.skillsByLevel ??= []);
    const entry = list.find((s) => s.skillId === skillId);
    if (entry) entry.level = Math.min(entry.level, 5); else list.push({ level: 5, skillId });
    list.sort((a, b) => a.level - b.level);
  }
}

/**
 * 체육관 퍼즐 — 원래는 「손을 얹는다」·「덤불을 정리한다」 두 번 예를 누르면 끝이었다(2026-10-20 검수: 퍼즐이 얕다).
 * 입구 받침을 셋으로 늘리고 안내원의 힌트(새싹은 해를 따라 깬다 → 동쪽부터)대로 차례로 물을 줘야 덩굴 문이 열린다.
 * 맞으면 받침이 꽃 화분(같은 체육관 칩셋 1258)으로 피고, 틀리면 셋 다 다시 새싹(1253)으로 움츠러든다. 새 그림 없음.
 */
function gymBloomPuzzle(project: Project): void {
  const gym = project.maps.mx_map_grove_gym;
  const pivot = gym?.events.find((e) => e.id === "mx_map_grove_gym_device_pivot");
  const guide = gym?.events.find((e) => e.id === "mx_map_grove_gym_gym_guide");
  if (!gym || !pivot || !guide || gym.events.some((e) => e.id === "mx_map_grove_gym_device_bloom_east")) return;
  let gateOpen: Command[] | undefined;
  walkLists(pivot.pages?.[0]?.commands ?? [], (list) => {
    if (!gateOpen && list.some((c) => c.kind === "changeTile") && list.some((c) => c.kind === "setSwitch" && c.switchId === "mx_gym_1_puzzle_pivot")) gateOpen = structuredClone(list.filter((c) => c.kind !== "text"));
  });
  if (!gateOpen) return;
  const seq = "mx_gym_1_bloom_seq";
  if (!project.variables.some((v) => v.id === seq)) project.variables.push({ id: seq, name: "실바나 체육관 꽃 받침 순서" });
  const stands = [{ id: "mx_map_grove_gym_device_bloom_east", x: 11, y: 17 }, { id: "mx_map_grove_gym_device_pivot", x: 8, y: 17 }, { id: "mx_map_grove_gym_device_bloom_west", x: 5, y: 17 }];
  const tile = (x: number, y: number, t: number): Command => ({ kind: "changeTile", mapId: gym.id, layer: "upper", x, y, tile: t });
  const reset: Command[] = [...stands.map((st) => tile(st.x, st.y, 1253)), { kind: "setVariable", variableId: seq, op: "=", value: 0 }];
  const STAND = "새싹 돌 받침";
  stands.forEach((st, i) => {
    gym.upperTiles[st.y * gym.width + st.x] = 1253;
    const commands: Command[] = [{
      kind: "fork",
      condition: { kind: "switch", switchId: "mx_gym_1_puzzle_pivot", value: true },
      then: [text("새싹이 활짝 피어 덩굴 문이 열려 있다.")],
      else: [{
        kind: "fork",
        condition: { kind: "variable", variableId: seq, op: ">", value: i },
        then: [text("이 받침의 새싹은 벌써 꽃을 피웠다.")],
        else: [
          text("새싹이 잠든 돌 받침이다. 물을 줄까?", STAND),
          {
            kind: "choices",
            options: [
              {
                text: "물을 준다",
                branch: [{
                  kind: "fork",
                  condition: { kind: "variable", variableId: seq, op: "==", value: i },
                  then: [
                    tile(st.x, st.y, 1258),
                    { kind: "setVariable", variableId: seq, op: "+=", value: 1 },
                    { kind: "playAudio", resourceId: "easyrpg-sound-chime2", channel: "se", loop: false },
                    ...(i < stands.length - 1
                      ? [text("새싹이 기지개를 켜더니 꽃을 피웠다!")]
                      : [...structuredClone(gateOpen!), text("마지막 새싹이 피자 덩굴 나무 문이 스르르 열렸다!")]),
                  ],
                  else: [...structuredClone(reset), text("새싹들이 놀라 다시 움츠러들었다… 깨우는 순서가 틀린 것 같다.")],
                }],
              },
              { text: "그만둔다", branch: [] },
            ],
            cancelBehavior: "branch",
            cancelBranch: [],
          },
        ],
      }],
    }];
    const existing = gym.events.find((e) => e.id === st.id);
    const page = { ...structuredClone(pivot.pages![0]!), id: `${st.id}_page`, name: st.id.replace("mx_map_grove_gym_", ""), commands };
    if (existing) { existing.pages = [page]; existing.x = st.x; existing.y = st.y; }
    else gym.events.push({ ...structuredClone(pivot), id: st.id, name: "새싹 받침", x: st.x, y: st.y, pages: [page] });
  });
  // 동→가운데→서 순서로 이벤트를 놓는다(안내원 힌트를 따른 플레이어 순서 그대로 — QA 봇도 이 순서로 말을 건다).
  const order = stands.map((st) => st.id);
  const standEvents = order.map((id) => gym.events.find((e) => e.id === id)).filter((e): e is GameEvent => Boolean(e));
  const at = gym.events.findIndex((e) => order.includes(e.id));
  gym.events = gym.events.filter((e) => !order.includes(e.id));
  gym.events.splice(Math.min(at, gym.events.length), 0, ...standEvents);
  for (const page of guide.pages ?? []) {
    page.commands = [
      text("관장님 정원의 새싹은 해를 따라 깨어나요.", "체육관 안내원"),
      text("해가 뜨는 쪽부터 차례로 물을 주면 덩굴 문이 열리고, 안쪽 가시 덤불은 정원 가위로 정리할 수 있대요.", "체육관 안내원"),
      // 관장(Lv8·9) 앞에서 센터까지 되돌아가지 않아도 되게 — 수련생 셋을 이긴 뒤 체력이 바닥난 채 관장에게 들어가 졌다(2026-10-21 스타터 3종 봇).
      text("관장님께 도전하기 전에 동료들을 쉬게 해 줄까요?", "체육관 안내원"),
      {
        kind: "choices",
        options: [
          { text: "부탁해요", branch: [{ kind: "recoverAll" }, { kind: "playAudio", resourceId: "easyrpg-sound-chime2", channel: "se", loop: false }, text("동료들이 기운을 되찾았다!")] },
          { text: "괜찮아요", branch: [] },
        ],
        cancelBehavior: "branch",
        cancelBranch: [],
      },
    ];
  }
}

/**
 * 챔피언 나루 — 마지막 승부 전에 둘 다 최고 상태로. 정직 여정(2026-10-21)에서 신전 보스를 이긴 Lv11·Lv8 파티가 나루의 셋을 쓰러뜨리고
 * 회복약이 바닥나 에이스에게 졌다. 라이벌다운 한 장면으로 동료를 쉬게 하고 회복약 둘을 쥐여 준다(처음 한 번만).
 */
function fairChampion(project: Project): void {
  const champion = eventOf(project, "mx_map_league_0", "mx_map_league_0_league_challenge");
  const page = champion?.pages?.[0];
  const top = page?.commands.find((c): c is Extract<Command, { kind: "fork" }> => c.kind === "fork" && c.condition.kind === "switch" && c.condition.switchId === "mx_league_1");
  const first = top?.else;
  if (!first) return;
  const at = first.findIndex((c) => c.kind === "battleProcessing");
  if (at < 0 || first.some((c) => c.kind === "setSwitch" && c.switchId === "mx_league_gift")) return;
  if (!project.switches.some((sw) => sw.id === "mx_league_gift")) project.switches.push({ id: "mx_league_gift", name: "mx_league_gift" });
  // 전투 음악을 바꾸는 줄(m2Command)이 전투 바로 앞에 있으면 그 앞에 넣는다 — 쉬는 장면은 아직 전당 음악으로.
  let before = at;
  while (before > 0 && first[before - 1]!.kind === "m2Command") before--;
  first.splice(before, 0,
    text("잠깐! 지친 동료로 이기면 하나도 기쁘지 않아. 우리 둘 다 최고 상태로 붙자.", "챔피언 · 나루"),
    { kind: "recoverAll" },
    { kind: "playAudio", resourceId: "easyrpg-sound-chime2", channel: "se", loop: false },
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "mx_league_gift", value: false },
      then: [
        { kind: "setSwitch", switchId: "mx_league_gift", value: true },
        { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 },
        text("나루가 동료들을 쉬게 해 주고 회복약 두 개를 건넸다."),
      ],
      else: [text("나루가 동료들을 쉬게 해 주었다.")],
    },
  );
}

/** 도감 받음 스위치(메뉴의 도감은 이것이 켜진 뒤에만 보인다)와 반드시 잡히는 시험용 구슬. */
export const TRIAL = { dexSwitch: "mx_pokedex_received", orbId: "mx_item_trial_orb" } as const;

/**
 * 3세대(GBA) 손맛 — 2026-10-21 적대 검수(4.0/10) 몫:
 * - 시험용 구슬(마스터 등급, 1개)을 가방 맨 앞에. 도감 받음 스위치 등록.
 * - 급소: gen1 속도 기반(빠른 몬스터 약 18%) → 기술마다 고정 6.25%(급소 잘 나는 기술 12.5%) — 엔진은 그대로, 기술 값으로.
 * - 1번 도로: 풀 스타터가 처음 상대 넷에게 모두 반감이었다 → 연구원 몬스터를 바위(로키온)로. 승리 뒤 회복약을 누가 줬는지 밝힌다.
 * - 모든 필드 대사는 아래 상자 하나(위·아래로 오가던 상자, 흉상 잔상의 원인).
 */
function gbaFeel(project: Project): void {
  const db = project.database;
  if (!project.switches.some((sw) => sw.id === TRIAL.dexSwitch)) project.switches.push({ id: TRIAL.dexSwitch, name: "도감 받음" });
  const master = db.items.find((i) => i.id === "item_gen_master_orb");
  if (master && !db.items.some((i) => i.id === TRIAL.orbId)) {
    db.items.unshift({ ...structuredClone(master), id: TRIAL.orbId, name: "시험용 구슬", price: 0, description: "천문박사가 만든 시험용 구슬. 처음 한 번은 꼭 잡힌다." });
  }
  for (const skill of db.skills) {
    if (!skill.id.startsWith("mx_skill_") || skill.criticalRate !== undefined) continue;
    skill.criticalRate = skill.gen1CriticalRate === "high" ? 12.5 : 6.25;
  }
  const researcher = db.enemies.find((e) => e.id === "mx_enemy_mx_map_meadow_trainer_1_0");
  const rock = db.enemies.find((e) => e.id === "mx_enemy_pebblekid");
  if (researcher && rock) {
    researcher.name = rock.name;
    researcher.speciesId = rock.speciesId;
    researcher.monsterResourceId = rock.monsterResourceId;
    researcher.graphicHue = rock.graphicHue;
    researcher.elementRates = structuredClone(rock.elementRates);
    researcher.stateRates = structuredClone(rock.stateRates);
  }
  const meadow = project.maps.mx_map_meadow;
  const giver: Record<string, string> = { mx_map_meadow_trainer_0: "산책하는 소년", mx_map_meadow_trainer_1: "연구원", mx_map_meadow_trainer_2: "길을 걷는 조련사" };
  for (const event of meadow?.events ?? []) {
    for (const page of event.pages ?? []) walkLists(page.commands, (list) => {
      for (const c of list) {
        if (c.kind !== "text") continue;
        if (c.body === "타입 상성만큼 기술 횟수도 중요하지.") c.body = "바위 타입은 풀과 물에 약해. 상성만 알아도 승부가 쉬워지지!";
        if (c.body === "여행에 쓰라고 회복약 하나를 건네받았다." && giver[event.id]) c.body = `${giver[event.id]}에게서 회복약 하나를 받았다.`;
      }
    });
  }
  // 스타터 미리보기 설명이 「토리프⏎풀 타입」 같은 덜 다듬은 줄이었다(적대 검수 m5) — 문장으로. 목록의 타입 표시는 starterChoice.ts 가 한다.
  const typeName: Record<string, string> = { grass: "풀", fire: "불꽃", water: "물" };
  const starterType = new Map((db.monsterSpecies ?? []).filter((sp) => ["mx_species_spriglet", "mx_species_coalbit", "mx_species_rivulet"].includes(sp.id)).map((sp) => [sp.name, typeName[sp.types?.[0] ?? ""] ?? ""]));
  const topic = (word: string) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return `${word}${code >= 0 && code <= 11171 && code % 28 ? "은" : "는"}`; };
  const lab = project.maps.mx_map_lab?.events.find((e) => e.id === "mx_map_lab_professor");
  for (const page of lab?.pages ?? []) walkLists(page.commands, (list) => {
    for (const c of list) {
      if (c.kind === "text") { const m = /^(\S+)\n(\S+) 타입$/u.exec(c.body); if (m && starterType.has(m[1]!)) c.body = `${topic(m[1]!)} ${m[2]} 타입이란다.`; }
    }
  });
  // 나루 대사 상자에 직함을 붙인다(적대 검수 R2-6: 「나루」 이름만).
  const titled = (commands: Command[]) => walkLists(commands, (list) => { for (const c of list) if (c.kind === "text" && c.speaker === "나루") c.speaker = "라이벌 나루"; });
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const page of event.pages ?? []) titled(page.commands);
  // 간호사 인사: 두 줄짜리 한 쪽이 찍는 중간에 「…건강하게」에서 잘린 것처럼 보였다(r3·r4) — 인사와 물음을 두 쪽으로.
  const greet = "회복 센터에 어서 오세요!\n동료들을 건강하게 해 드릴까요?";
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const page of event.pages ?? []) walkLists(page.commands, (list) => {
    for (let i = 0; i < list.length; i++) {
      const c = list[i]!;
      if (c.kind !== "text" || c.body !== greet) continue;
      list.splice(i, 1, { ...c, body: "회복 센터에 어서 오세요!" }, { ...c, body: "동료들을 건강하게 해 드릴까요?" });
      i++;
    }
  });
  const bottom = (commands: Command[]) => walkLists(commands, (list) => { for (const c of list) if (c.kind === "text" && !c.position) c.position = "bottom"; });
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const page of event.pages ?? []) bottom(page.commands);
  for (const common of project.commonEvents ?? []) bottom(common.commands);
}

export function polishFirstTenMinutes(project: Project): void {
  polishBedroom(project);
  polishMom(project);
  polishLab(project);
  nurseBehindCounter(project);
  fairRouteOne(project);
  varyLabShelves(project);
  quickerHealing(project);
  nameGymTrainers(project);
  firstWildOnRouteOne(project);
  starterCoverage(project);
  gymBloomPuzzle(project);
  fairChampion(project);
  gbaFeel(project);
  castTheAstraHorizon(project);
}

