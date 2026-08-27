# before→after 좌→우 와이프 증거 (2026-08-27)

실제 에디터 표면(dev 서버 :9824, `?freshProject=1`)에서 대본화된 AI 턴 1회
(`set_build_spec` → `fill_region` 연못)를 돌려 캡처했다.

- `wipe-settled.png` — 제안 카드의 비교 뷰. 미니맵 한 장 + 캡션 `지금 → 적용 후`.
  칸별 `지금`/`적용 후` 라벨과 2단 그리드(`.ai-proposal-thumbs`)는 없다.
- `wipe-settled-full.png` — 같은 시점의 에디터 전체 화면.

계측값 (getComputedStyle / getBoundingClientRect):

- `.ai-proposal-thumb.is-after` → `position: absolute`, `animation-name: ai-proposal-wipe-sweep`,
  `animation-duration: 0.42s`
- before/after 사각형 완전 일치: `{x:494, y:355.59, w:454, h:200}` (겹침이 어긋나지 않는다)
- `.ai-proposal-thumb-label` 0개, `.ai-proposal-thumbs` 0개
- 진행 중 `clip-path` 샘플(와이프를 3s 로 늘려 200ms 간격 관측):
  `inset(0 80.55% 0 0)` → `48.34%` → `38.34%` → `32.78%` → `0%`
  = 오른쪽 인셋이 단조 감소, 즉 선단이 **좌에서 우로** 한 번 지나간다.
- 캔버스 고스트 상태칩 최종 문구: `초안 완성 · 검토 대기`
