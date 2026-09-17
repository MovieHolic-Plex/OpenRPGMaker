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
