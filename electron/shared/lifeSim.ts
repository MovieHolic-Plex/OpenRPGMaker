/**
 * 생활(농사·낚시·동물·농장 건물·제작 경영) 편집·제작 표면을 여는 단 하나의 스위치.
 *
 * 2026-11-24 (qa1124 항목 12): 생활 시스템은 다음 버전에서 연다. false 이면 자료집 「생활」 그룹은 안내 한 장만 보이고
 * (탭 레일·탭 검색·딥링크 모두 편집 화면에 닿지 않는다), 새 프로젝트의 「농장 생활」 갈래(키워드 추천·컨셉 카드)는 숨고,
 * 조수는 생활 도구·생활 컬렉션 쓰기를 쓰지 않는다. 코드와 데이터는 지우지 않았다 — 이 프로젝트가 이미 가진 생활 데이터
 * (database.crops 등)는 저장·재로드에서 그대로이고 게임 런타임도 그대로 동작한다. 되살릴 때 이 값만 true 로 바꾼다.
 *
 * 선례: electron/shared/teamCollab.ts 의 TEAM_COLLAB_ENABLED. 시험이 켠 상태를 보려면
 * `vi.mock("../electron/shared/lifeSim", () => ({ LIFE_SIM_ENABLED: true, … }))` 로 대체한다.
 *
 * 여기에 묶이지 않는 것(계속 열려 있음): 제작법·도구 강화(아이템 → 제작법·강화, upsert_craft_recipe·upsert_item_upgrade),
 * 판매 가격 도구(set_sell_prices), 공포 장르의 목숨 꽃(set_life_flower), 폴른 스타 공방.
 */
export const LIFE_SIM_ENABLED: boolean = false;

export const LIFE_SIM_CLOSED_TITLE = '생활(농사·낚시·동물)은 다음 버전에서 열려요';
export const LIFE_SIM_CLOSED_BODY = '이 프로젝트의 생활 데이터는 지워지지 않고 게임에서는 그대로 동작합니다';
/** 안내 카드·조수 거절 문구가 같이 쓰는 한 문장. */
export const LIFE_SIM_CLOSED_NOTICE = `${LIFE_SIM_CLOSED_TITLE}. ${LIFE_SIM_CLOSED_BODY}`;
