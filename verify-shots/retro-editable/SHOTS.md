# retro-editable 증거 (1600x1000, 메모리 세션 ?freshProject=1, 포트 9807)

"다시 열기" = 자료집 모달 닫았다 다시 열기 + 스토어 읽기. 정본 SQLite 저장이 아니다.
스크립트: `scripts/capture-retro-editable.mjs`, 값: `results.json`.

- a-skill-soul-eater-before / -after / -states — skill_dark_knight_soul_eater. before: 흡수 50 · HP 대가 0 · 타격별 배율 "1". after: HP 대가 15 · 흡수 40 · 타격별 배율 "1, 0.5, 0.5". states: 효과 카드(암 속성) · 「상태 변화」 카드 + 「+상태 추가」.
- b-skill-range-combo-before / -after / -reopened — 같은 스킬. 범위=직선(가로 띠), 범위 반경 160, 연계 배우 1·2·3 = 주인공·수호자·마도사, 안내문 "연계기: 3명". after 와 reopened 모두 세 칸이 채워져 있고 스토어에도 comboActorIds 3개 (첫 캡처에서 한 칸만 고르면 비어 버리던 버그를 a4e218352 로 고친 뒤 재촬영).
- c-state-stop — state_stop: 「스톱 — ATB 게이지 정지·행동 불가」 켜짐(행동 불가도 켜짐).
- c-state-berserk — state_berserk: 공격 배율 1.5, 「버서크 — 명령 없이 무작위 상대를 통상 공격」 켜짐.
- c-state-protect — state_protect: 물리 피해 방어 배율 1.5.
- c-state-wet-before / -after / -reopened — state_wet: after·reopened 에서 마법 피해 방어 배율 0.75, 속성 FIRE=E·무효, THUNDER=A·약함 (속성 열 15개 전부 표시, 나머지 「(없음)」).
- d-old-project-classes-before-ensure / -after-ensure / -after-ensure-darkknight — 로스터를 뺀 옛 프로젝트. before: 검색 결과 0건. after: 「발키리 #134」, 「암흑기사 #135」 가 목록에 나타남. 주의: 오른쪽 상세는 검색 전 선택돼 있던 「전사」 그대로다(목록만 필터됨). 상세 내용은 이 장면의 증거가 아니다.
- e-skill-retro-stage-idle / -playing — 스킬 탭 「도트 전투 미리보기」: 재생 중(0.9 / 1.1초, 정지 버튼)이며 「생명력 흡수」 애니메이션 · dark_knight_soul 대상 64px×10칸이 표시됨. 편집한 배율이 그림에 어떻게 반영되는지는 이 캡처로 판정하지 못함.
