// 조수 v2 «HUD·타이틀을 이 이야기에 맞게 골랐나» 검사 — 템플릿 지문이 그대로 남은 게임을 짚는다.
//
// 왜(2026-11-09 fs-use-tools, 오너 「조수가 HUD 랑 타이틀 적합하게 고르게해」): 보상 레인 기준선 26판에서 모델이 set_field_hud 를 부른 판은 8, set_title_screen 은 2판뿐이다.
// 나머지는 템플릿이 깐 값이 그대로 남는다 — HUD 는 genreDefaults.applyStorySetupDefaults 의 값(26판 중 14판이 글자 그대로 같다),
// 타이틀은 글자가 아니라 모양(blueprintAssembly 가 넣는 「장르 · 장소」 부제 + 글자 질감·메뉴 스타일 미선택)이 템플릿이다.
// 기존 editorDefaultsLeft 의 'hud' 는 fieldHud 가 undefined 일 때만 울려서 이 14판을 못 잡는다. 도구를 한 번 부르면 풀리므로 헛도는 반복이 없다.
// 순수 함수(프로젝트만 읽는다) — gameContentProblems 가 게임을 만드는 요청에서만 부른다.
import type { Project } from "@/project/types";
import { STORY_SETUP_HUD } from "./genreDefaults";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** 필드 HUD 가 이야기 기본 템플릿(체력 끔·시계 켬 minimal)과 같은가 — objective 칸은 다른 도구가 켜므로 비교에서 뺀다. */
export function hudIsStoryTemplate(project: Project): boolean {
  const hud = project.system.fieldHud as unknown;
  if (!isObj(hud)) return false;
  const { objective: _o, ...rest } = STORY_SETUP_HUD as Obj;
  const keys = new Set([...Object.keys(rest), ...Object.keys(hud).filter((k) => k !== "objective" && hud[k] !== undefined)]);
  return [...keys].every((k) => k === "widgets" ? !Array.isArray(hud[k]) || (hud[k] as unknown[]).length === 0 : JSON.stringify(hud[k]) === JSON.stringify(rest[k]));
}

export function hudTitleChoiceProblems(project: Project): string[] {
  const problems: string[] = [];
  if (hudIsStoryTemplate(project)) {
    problems.push("[게임 검사 HUD 선택] 필드 HUD 가 이야기 기본 템플릿(minimal·체력 끔·시계 켬) 그대로다 — 이 게임의 분위기로 골랐다고 볼 수 없다. set_field_hud{theme} 로 이 이야기에 맞는 테마(공포 horror·고전 전투 classic·하트 모험 hearts·수집 collector·추격 chase …)를 고르거나, 체력이 줄지 않는 게임이면 {off:true} 로 끈다. 시계가 필요 없으면 clock:false.");
  }
  const title = (project.system.titleScreen ?? {}) as Obj;
  if (title.logoStyle === undefined && title.menuStyle === undefined) {
    problems.push("[게임 검사 타이틀 모양] 타이틀 화면의 글자 질감(logoStyle)과 메뉴 스타일(menuStyle)이 둘 다 비어 있다 — 어느 게임이나 같은 글꼴·같은 창 모양이다. set_title_screen{logoStyle:'gold'|'metal'|'stone'|'glow'|'plain', menuStyle:'window'|'plain', logoSubtitle} 로 이 이야기에 맞는 모양을 고른다(예: 마왕·성 = stone/metal, 밤·공포 = glow, 일상 = plain).");
  }
  return problems;
}
