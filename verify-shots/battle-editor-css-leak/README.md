# 전투 미리보기 에디터 CSS 누수 — 증거

`:where(body:has(.editor-layout)) .battle-enemy:disabled { opacity: 0.55 }`
(`src/styles/runtime/from-editor-core-part-2.css`) 때문에 **에디터 안 전투 테스트에서만**
적 배틀러가 55% 로 비쳤다. 출하 플레이어는 `.editor-layout` 이 없어 영향이 없었다.

| 파일 | 내용 |
|---|---|
| `01-before-editor-55pct.png` | 수정 전, 에디터 안. 몸통 너머로 배경이 비친다 |
| `02-before-over-red-backdrop.png` | 수정 전, 배경만 빨강으로 교체 → 슬라임이 **갈색**으로 합성. 알파 블렌딩의 결정적 증거 |
| `03-before-over-blue-backdrop.png` | 같은 조건, 파랑 |
| `04-after-editor-opaque.png` | 수정 후, 에디터 안. computed opacity 0.55 → 1 |
| `05-after-rm2000-scene.png` | 수정 후 rm2000 대조 — 슬라임이 또렷하고 커맨드 패널 이상 없음 |
| `06-after-rm2003-scene.png` | 수정 후 rm2003 대조 |
| `07-before-rm2000-slime-zoom.png` | 수정 전 rm2000 확대 — 몸통 너머로 나무 능선이 보인다(포켓몬만의 문제가 아님) |

스프라이트 알파는 원인이 아니다: `monster-slime-01.png` 부분투명 픽셀 0.0%,
유휴 스트립 0.2%(가장자리 안티앨리어싱).

재현: `test/e2e/_slime-opacity-probe.spec.ts`(배경 교체 판정),
`test/e2e/_slime-opacity-cause.spec.ts`(`.editor-layout` 제거 후 재측정).
회귀 가드: `test/battleEditorCssLeak.test.ts`.

## cascade/

아홉 규칙을 지운 변화를 **결정적으로** 잰 계산 스타일 덤프
(`test/e2e/_battle-computed-style-dump.spec.ts`). `*.before.json` 은 규칙이 있던 상태,
`*.after.json` 은 지운 뒤. 픽셀 비교로는 이 판정을 못 한다 — 이 표면은 배경 애니메이션과
RNG 때문에 같은 코드로 두 번 찍어도 수만 픽셀이 다르다.

변화는 세 갈래뿐이고 전부 **복원**이다:

| 프로젝트 | 바뀐 속성 |
|---|---|
| pokemon | `color` ×18 · `border-top-color` ×12 · `::before/color` ×8 · `::before/border-top-color` ×8 |
| genre | `color` ×18 · `border-top-color` ×12 · `::before/color` ×8 · `::before/border-top-color` ×8 |
| rm2000 | `border-top-color` ×18 · `color` ×18 · `::before/color` ×6 · `::before/border-top-color` ×6 |

- `color` — 적 서브트리가 에디터 `--text-muted`(#626e89) → **각 스킨 팔레트**로 복귀
  (pokemon #282828, rm2000 #f8fbff). `border-top-color` 는 `currentColor` 라 함께 따라온다.
- `.battle-command-panel` 의 `flex-wrap`·`justify-content` (rm2000 에서만 관측) —
  `18-pokemon-layout-redesign.css:58` 이 이미 우회를 들고 싸우던 규칙이다.
- `.battle-submenu-header` 의 `font-weight` — 유지할 값이라
  `11-compact-hud-row.css` 가 직접 소유하도록 옮겼다(이 덤프에는 이동 후 상태가 찍혔다).

`opacity` 는 이 덤프의 수집 목록에 없다 — 애니메이션이 만지는 속성이라 제외했다.
헤드라인 수정(0.55 → 1)은 `_slime-opacity-cause.spec.ts` 가 따로 잰다.
