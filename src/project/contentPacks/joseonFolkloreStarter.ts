import source from "../../../content-packs/joseon-folklore/starter/data.json";
import { createBlankProject } from "@/project/defaults/blankProject";
import { applyJoseonFolklorePack } from "./joseonFolklore";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { applyBattleMethod } from "@/project/battleMethod";
import type { Project } from "@/project/types";

type StarterData = Pick<Project, "maps" | "mapTree" | "mapConnections" | "startMapId" | "startPos" | "switches" | "variables" | "commonEvents" | "system" | "session"> & {
  baseDatabase: Project["database"];
  terms: Project["meta"]["terms"];
  bundledTilesetLayout: { count: number; tilesPerRow: number };
};

/** A fresh, editable six-map starting world. Never applies over an existing project. */
export function createJoseonFolkloreStarter(title: string): Project {
  const project = createBlankProject();
  const { baseDatabase, terms, bundledTilesetLayout, ...world } = structuredClone(source) as unknown as StarterData;
  Object.assign(project, world);
  // The starting world uses this atlas throughout. Other public tiles remain available
  // from the library without embedding their full reference catalogs in this example.
  project.tilesets = { joseon_baram: project.tilesets.joseon_baram! };
  const tileset = project.tilesets.joseon_baram!;
  if (tileset.count !== bundledTilesetLayout.count || tileset.tilesPerRow !== bundledTilesetLayout.tilesPerRow) {
    throw new Error("공용 조선 칩셋과 시작 프리셋 지도를 함께 갱신해 주세요.");
  }
  project.database = baseDatabase;
  applyJoseonFolklorePack(project);
  project.meta = { ...project.meta, title, terms: { ...project.meta.terms, ...terms, innTitle: "주막" } };
  project.system.genre = "adventure-jrpg";
  applyBattleMethod(project, "side");
  project.system.titleScreen = { ...project.system.titleScreen!, title };
  if (project.system.opening) project.system.opening = { ...project.system.opening, enabled: false };
  project.flags.starterExample = true;
  project.flags.joseonFolkloreStarter = true;
  project.worldCanon = {
    name: "조선 설화 판타지",
    premise: "기와집과 초가가 있는 버들마을에서 수련하고, 숲과 청석굴의 귀신·도깨비를 상대하는 조선 설화 모험.",
    tones: ["mythic", "hopeful"], era: "조선 시대에서 착안한 창작 세계",
    techCeiling: "한옥·장터·서당·약방, 칼·활·부적과 설화의 술법",
    laws: { power: { present: true, note: "전사·도적·주술사·도사. 기력을 써서 기술을 사용한다." }, gods: { present: true, note: "귀신·도깨비·산군과 민간 신앙의 술법이 존재한다." }, money: { present: true, note: "화폐 단위는 전. 약방과 장터에서 소비품·장비를 구한다." } },
    body: "마을에서 의뢰·수련·전직·장비 준비 → 사냥터와 동굴에서 전투·재료 수집 → 마을로 돌아와 회복·판매·성장한다. 소비품은 약재·탕약·부적, 장비는 각 직업의 무기와 의복을 쓴다. 전투는 기존 RM2003 턴제, 대화는 조선식 창과 한글 도트 글꼴을 쓴다. 다음 지역과 퀘스트도 이 세계관에 맞춰 저작한다.",
    status: "draft", visibility: "public",
  };
  const issues = collectProjectReferenceIssues(project);
  if (issues.length) throw new Error(`조선 설화 시작 프리셋의 참조를 확인해 주세요: ${issues.join("; ")}`);
  return project;
}
