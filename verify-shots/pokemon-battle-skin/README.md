# 포켓몬 전투 스킨 수정 — 증거 (2026-09-17)

## before/ · after/

두 진입 경로를 여섯 국면에서 찍었다.
- `A-cosmetic-*` — 자료집에서 **전투 스킨만** "포켓몬" 으로 바꾼 프로젝트(코스메틱 전용 경로)
- `B-genre-*` — 장르 프리셋 `monster-collect`(`battleUiStyle` + `battleModel=gen1` 둘 다)

`before/` 의 A 와 B 가 거의 같다는 것이 이번 진단의 출발점이다 — 규칙 엔진을 gen1 으로
켜도 화면이 안 바뀐다(커맨드 1개 차이). 어색함은 어느 규칙의 버그가 아니라 JRPG 엔진 위에
포켓몬 페인트를 칠한 **문법 불일치**였다.

주요 대조:
| 국면 | before | after |
|---|---|---|
| `01-command` | 아군 HUD 는 도트, 적 HUD·커맨드는 시스템 고딕 / 선택 표시가 비활성과 구분 안 됨 / 밴드 바닥 10px 어긋남 | 한 서체 / 흰 판 + 빨간 테두리 / 바닥 정렬 |
| `02-submenu` | 1열, 셋째 행이 글자 중간에 잘림 | 본가와 같은 2×2 격자 |
| `03-target` | 대상 선택 중 적 HUD 가 `opacity: 0.15` 로 소멸 | (after 에는 없음 — 적이 하나면 목록 자체를 건너뛴다) |
| `04-impact` | 주황색 데미지 숫자 「-67」 + 화면 흔들림 | 숫자 제거, 화면 폭력 억제 |
| `06-result` | 크림 패널 위에 남색 캡슐, 제목이 시스템 고딕 | 크림 행 + 픽셀 서체 |

`after/` 에 `B-genre-06-result.png` 가 없는 것은 gen1 피해량이 낮아 촬영 상한(24턴) 안에
전투가 끝나지 않았기 때문이다 — 결함이 아니다.

## control/

rm2000 · rm2003 대조군. 이번 변경이 다른 스킨을 건드리지 않았음을 화면과 커서 위치로 확인한다.
CSS 는 전부 `[data-battle-ui-style="pokemon"]` 스코프이고, 공유 코드 변경은
`battleDom.markMenuCursor` 하나뿐이다(두 스킨 모두 커서가 「공격」에 그대로 선다).

## cascade/

스타일시트 4→1 통합이 **동작 중립**임을 재는 계산 스타일 덤프.
`_battle-computed-style-dump.spec.ts` 가 `.battle-scene` 아래 모든 노드의 계산 스타일을
안정 경로 키로 뜬 것이다. `*.before.json`(구 14/16/18/20 분리) 대 `*.after.json`(통합).

    pokemon 0건 · genre 0건 · rm2000 0건 — 합계 0

**이 표면은 픽셀 비교가 통하지 않는다.** 배경 애니메이션·유휴 프레임·RNG 때문에 같은
코드로 두 번 찍어도 수만 픽셀이 다르다. 실측 잡음 바닥:

| | 잡음(같은 코드 2회) | 통합 전후 "차이" |
|---|---|---|
| result | 228,723 px | 229,364 px |
| rm2003 | **25,083 px** | 1,796 px |

잡음이 차이보다 큰 경우까지 있었다. 계산 스타일 덤프로 바꾼 뒤에야 픽셀로는 못 잡을
승자 뒤집힘 2건(서브메뉴 `min-height` 42px→0px, 헤더 행 18.25px→34px)이 잡혔고 둘 다 제거했다.

## 재현

    POKEMON_SHOTS_DIR=<dir> E2E_INCLUDE_DIAGNOSTICS=1 \
      npx playwright test test/e2e/_pokemon-skin-diagnosis.spec.ts
    CONTROL_SHOTS_DIR=<dir> E2E_INCLUDE_DIAGNOSTICS=1 \
      npx playwright test test/e2e/_skin-control-shots.spec.ts
    STYLE_DUMP_DIR=<dir>   E2E_INCLUDE_DIAGNOSTICS=1 \
      npx playwright test test/e2e/_battle-computed-style-dump.spec.ts
