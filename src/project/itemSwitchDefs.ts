import type { Project } from "./types";

/**
 * 기본 카탈로그 스위치 아이템이 올리는 스위치의 표시 이름.
 * 스위치 정의는 상태(문이 열렸다/등대가 켜졌다)를 이름짓는 것이 자연스러워
 * 아이템 이름과 다른 정식 명칭이 있을 때만 여기 둔다.
 */
const ITEM_SWITCH_NAMES: Readonly<Record<string, string>> = {
  sw_gen2_sun_relay: "태양 기동석 작동",
  sw_gen2_moon_relay: "달 기동석 작동",
  sw_gen2_bridge_relay: "교량 기동석 작동",
  sw_gen2_seal_relay: "봉인 기동석 작동",
  sw_catalog_gate_open: "성문 개방",
  sw_catalog_lighthouse_lit: "등대 점화",
  sw_catalog_mine_lift: "광산 승강기 작동",
  sw_catalog_fountain_flow: "분수 작동",
  sw_catalog_archive_unlock: "서고 봉인 해제",
  sw_catalog_beacon_lit: "봉화 점화",
  sw_catalog_aqueduct_route: "수로 전환",
};

/**
 * 아이템의 switchId 는 언제나 선언된 스위치 정의를 갖는다 — 선언이 없으면 저작자가
 * 스위치 탭에서 후속 이벤트를 연결할 방법이 없다. 스위치를 켜는 실행 자체는
 * 세션 키 쓰기라 정의가 없어도 동작하지만, 그러면 정의 목록이 불완전해진다.
 * 로드 복구(repairProjectReferences)와 세션 정규화(ensureSwitchVariableSlots)
 * 양쪽에서 호출해 어떤 경로로 들어와도 정의가 채워진다.
 */
export function ensureItemSwitchDefs(project: Project): boolean {
  const ids = new Set(project.switches.map((entry) => entry.id));
  let changed = false;
  for (const item of project.database.items) {
    const switchId = item.switchId;
    if (!switchId || ids.has(switchId)) continue;
    project.switches.push({ id: switchId, name: ITEM_SWITCH_NAMES[switchId] ?? item.name });
    project.session.switches[switchId] ??= false;
    ids.add(switchId);
    changed = true;
  }
  return changed;
}
