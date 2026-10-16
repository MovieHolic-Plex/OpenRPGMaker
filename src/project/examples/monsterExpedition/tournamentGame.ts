import { createExpeditionSeed } from "./seed";
import { configureScarloxyPokemonDemoProject } from "@/project/defaults/scarloxyPokemonDemoGame";
import { configureExpeditionRoster } from "./roster";
import { configureExpeditionAudio } from "./audio";
import { authorTournamentWorld, type TournamentOptions } from "./tournament";
import { deserialize, serialize } from "@/project/io";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { configureMonsterPresentation } from "@/project/monsterPresentation";
import { configureEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { configureEmeraldMonsterOpening, configureEmeraldMonsterTitle } from "@/project/emeraldMonsterOpening";
import { configureEmeraldMonsterCast } from "@/project/emeraldMonsterCast";
import { remapCharsetsToPreset } from "@/project/genreLockCharsets";
import { monsterTitleThemeFromStart } from "@/project/emeraldMonsterTitleArt";

/**
 * 포획 없는 대회형 몬스터 게임(트레이너 대전 토너먼트). 캠페인(createMonsterExpedition)과 같은 룰·로스터·그림·칩셋을 쓰되
 * 맵·이벤트·이야기는 대회용으로 따로 짠다 — 캠페인을 깎아 만들면 8관·밤막회사 문장이 남는다.
 * 선언: system.monsterCollection=false(포획 안 함) + 파티 전투(monsterBattleParty).
 */
export function createMonsterTournament(options: TournamentOptions & { readonly title?: string } = {}) {
  const project = createExpeditionSeed();
  const hero = project.database.actors.find(a => a.id === DEFAULT_ACTOR_ID)!;
  configureScarloxyPokemonDemoProject(project);
  configureMonsterPresentation(project);
  // 체육관·배지가 없는 게임(대회형·탐험형)에는 「배지」 메뉴 칸이 없다 — 빈 배지 화면이 열리던 것을 뺀다. 목표는 「원정 수첩」(trainer-card)에서 본다.
  const menu = project.meta.oprnFieldMenu;
  if (menu) project.meta.oprnFieldMenu = { ...menu, entries: menu.entries.filter(e => e.command !== "campaign-progress") };
  // 주인공은 몬스터 테이밍 팩 트레이너(Scarloxy People1 0번) — 예전에는 기본 Actor1 로 되돌렸다(2026-10-16 장르 잠금 charset).
  hero.characterIndex = 0;
  hero.name = "여행자";
  const expedition = options.format === "expedition";
  const title = options.title?.trim() || (expedition ? `${options.names?.region ?? "별빛 사냥터"} 도감 탐험` : `${options.names?.region ?? "별빛 대회"} 몬스터 토너먼트`);
  project.meta.title = title;
  project.meta.author = "OPRN Studio";
  configureExpeditionRoster(project);
  configureExpeditionAudio(project);
  const ether = project.database.items.find(i => i.id === "item_ether")!;
  ether.ppRecovery = { flat: 10, percentMax: 0 };
  ether.mpRecovery = { flat: 0, percentMax: 0 };
  ether.name = "기술 에테르";
  ether.description = "몬스터가 배운 기술의 PP를 각각 10 회복한다.";
  project.system.menuUiStyle = "pixel";
  project.system.fieldHud = { theme: "collector", font: "pixel", menuStyle: "project", vitals: false, clock: false, tools: false, objective: false, hideEmpty: true };
  project.system.actionCombat = { ...project.system.actionCombat, enabled: false, hud: { hearts: false, stamina: false, enemyHpBars: "never" } };
  project.system.dialogueStyle = "handheld";
  project.system.dialogueSpeed = 2;
  project.session.monsterInstances = {};
  project.session.monsterParty = [];
  project.session.monsterBox = [];
  const manifest = authorTournamentWorld(project, options);
  const usedTilesets = new Set(Object.values(project.maps).map(map => map.tilesetId));
  project.tilesets = Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => usedTilesets.has(id)));
  project.database.monsterSpecies = project.database.monsterSpecies?.filter(s => s.id.startsWith("mx_species_"));
  project.database.enemies = project.database.enemies.filter(e => e.id.startsWith("mx_enemy_"));
  project.database.troops = project.database.troops.filter(t => t.id.startsWith("mx_troop_"));
  project.system.initialTroopId = project.database.troops[0]!.id;
  // 포획은 선언적으로 끈다 — 파티 전투(monsterBattleParty)는 그대로. 게임 검사는 이 선언을 보고 포획 요구를 건너뛴다.
  project.system.monsterCollection = expedition;
  project.system.monsterBattleParty = true;
  project.system.battleParty = "monsters";
  configureEmeraldMonsterStyle(project);
  configureEmeraldMonsterCast(project, { startTheme: options.startTheme });
  const region = options.names?.region ?? (expedition ? "별빛 사냥터" : "별빛 대회");
  configureEmeraldMonsterOpening(project, { professorName: options.names?.registrar ?? (expedition ? "도감 박사 라온" : "접수 담당 라온"), titleTheme: monsterTitleThemeFromStart(options.startTheme), pages: expedition ? [
    { id: "hunt_intro_welcome", text: `${region}에 어서 와!\n이 땅의 도감은 아직 텅 비어 있단다.` },
    { id: "hunt_intro_rules", text: "체육관은 없어.\n사냥터를 따라 걸으며 만나고, 잡고, 기록하렴." },
    { id: "hunt_intro_start", text: "먼저 연구소에서 첫 동료를 만나 보렴.\n길 끝에는 사냥터의 주인이 기다리고 있단다." },
  ] : [
    { id: "tour_intro_welcome", text: `${region}에 어서 와!\n몬스터와 함께 서는 토너먼트 무대란다.` },
    { id: "tour_intro_rules", text: "규칙은 간단해.\n데려온 동료들로만 승부하고, 포획은 없어." },
    { id: "tour_intro_start", text: "먼저 접수처에서 첫 동료를 만나고,\n연습장에서 몸을 풀어 보렴." },
  ] });
  configureEmeraldMonsterTitle(project, monsterTitleThemeFromStart(options.startTheme));
  if (project.system.titleScreen) { project.system.titleScreen.title = title; project.system.titleScreen.logoSubtitle = expedition ? "체육관 없는 도감 탐험" : "포획 없는 토너먼트"; }
  remapCharsetsToPreset(project, "monster-collect");
  const serialized = serialize(project);
  return { project: deserialize(serialized), serialized, manifest };
}

/** 체육관 없는 사냥터 탐험 — 포획이 있는 수집 게임. 사냥터 N곳 → 라이벌 → 마지막 사냥터 보스. 도감은 define_monster_families 로 더 채운다. */
export function createMonsterHuntingGrounds(options: Omit<TournamentOptions, "format"> & { readonly title?: string } = {}) {
  return createMonsterTournament({ ...options, format: "expedition" });
}
