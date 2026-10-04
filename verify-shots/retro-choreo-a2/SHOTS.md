# 연출 레코드 A2 — 편집기·조수 미리보기 증거

**저장 상태: 메모리 세션이다.** 전부 `?freshProject=1` 로 띄운 dev 서버(9807) 화면이고, 화면 상단에
「이 세션은 저장되지 않습니다. 보존하려면 프로젝트를 내보내세요.」 배너가 보인다. 정본 프로젝트 저장이
아니다(순수 편집기 코드 변경이라 저장 의무 없음). 재생성: `node scripts/capture-retro-choreo-a2.mjs`.
직접 본 것만 적는다. `results.json` 은 스크립트가 잰 수치다.

| 파일 | 직접 본 것 |
|---|---|
| a-tab-list-default-badge.png | 자료집 > 전투 규칙 > 「도트 연출」 탭. 헤더 「기본 1130」, 목록의 모든 행에 「기본」 배지(십자베기·돌진 찌르기·올려베기 …), 행마다 작은 썸네일. 오른쪽 십자베기 상세: 「기본 연출은 고칠 수 없습니다」 안내, 무대 미리보기(파랑 X 베기), 「쓰는 곳: 십자베기」. |
| b0-default-readonly.png | 기본 연출 「십자베기」 읽기 전용. 「복제해서 고치기」 버튼, 용사 3 대 몬스터 3 무대, 「쓰는 곳」 패널. |
| b1-cloned-before.png | 복제 직후 「십자베기 사본」(chor_hero_cross_slash), 층 1개(hero_cross). 편집 가능. |
| b2-lightning-search.png | 2번째 층의 시트 갤러리에서 「번개」 검색: 「20개」, 1/1쪽, 카드마다 프레임이 도는 썸네일(airship_storm, mage_chain_bolt …). |
| b3-layer-added-before-edit.png | airship_storm 층 추가 직후. 층 2: 시작 0ms · 배율 1 · 반복 1. 숫자칸이 보인다(CSS 고침 후). 시간축 막대 두 줄. |
| b4-layer-edited-after.png | 층 2를 시작 400ms · 배율 2로 고친 뒤. 시간축에서 층 2 막대가 400ms 뒤로 밀리고 전체 길이 1.2초로 바뀐 것이 보인다. 막대 글씨는 흰 글씨+그림자로 읽힌다. |
| c-stage-0..3.png | 무대 미리보기만 자른 그림 4장(시각을 달리해 촬영). c-stage-2 는 카운터 「1.3 / 1.3초」에서 멈춘 상태로, 박쥐·눈알·기계·용사 3인 스프라이트와 층 칩 hero_cross·airship_storm 이 보이지만 이 순간에는 이펙트가 화면에 없다. 프레임별 이펙트 위치 비교는 c-stage-playing 을 보라. |
| c-stage-playing.png | 재생 중 무대: 용사·몬스터 스프라이트, 「0.1 / 1.3초」, 층 칩 hero_cross·airship_storm(64px × 10칸). |
| d0-skill-tab-picker.png | 스킬 탭 「도트 연출」 갤러리를 아래로 스크롤한 모습. 5열 카드(회전베기·함성·낙하참·도발·철벽 …), 카드마다 썸네일과 이름·모션 종류(파고들어 베기·제자리 시전·필살기 등). 오른쪽 「쓰는 곳」은 비어 있음. 필터 칸은 이 컷에 안 잡혔고 d2 에서 보인다. |
| d1-skill-picker-selected.png | 갤러리에서 「십자베기 사본」(내 연출) 카드를 고른 상태. 카드 아래 이름·시퀀스 요약·「이 연출을 이 스킬에 쓰기」 버튼, 그 아래 무대. 미리보기 머리줄의 글씨는 이제 간격이 벌어져 읽힌다. |
| d2-skill-picker-picked.png | 버튼을 누른 뒤. 상태 줄 「빌려 온 연출: 십자베기 사본 (chor_hero_cross_slash)」, 「연출 지우기」 활성. 위 무대에는 hero_cross·airship_storm 칩. 오른쪽 「쓰는 곳」은 스킬 자체가 아직 아무 데서도 안 쓰인다고 표시. |
| e-preview-choreography-0.png | 조수 도구 `preview_choreography` 가 만든 700x224 그림. 1행 hero_cross(파랑 X 베기 프레임들), 2행 airship_storm(구름·번개·마법진). |

results.json 수치: 「번개」 시트 카드 20, 복제 id `chor_hero_cross_slash`, 층 편집 후 `startMs 400 / scale 2`,
스킬 고르기 후 `retroChoreographyId = chor_hero_cross_slash`, 도구 요약 「연출 「십자베기 사본」(프로젝트, dash-strike) 층 2개」.
기본 배지 수 150 은 목록이 가상화되어 화면에 올라온 행 수일 뿐이다(총 1130).

콘솔의 `net::ERR_CONNECTION_REFUSED` 는 외부 리소스 요청으로 이 작업과 무관하다.
