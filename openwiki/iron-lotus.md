# 강호의 철련 (iron-lotus)

폴른 스타(`chrono-bell`)의 동생 데모. 제1막만 있다. 기계 소녀가 무림에 떨어진다.

- 짓기: `createIronLotusFlagshipDemo` — `src/project/flagship/ironLotus.ts`
- 사양: `src/project/flagship/ironLotusStory.ts` (`buildJrpgChapter`)
- 오프닝: `src/project/flagship/ironLotusOpening.ts` (청죽림·사원·유하진 배경, 설린 칩)
- 그림: `scripts/content/iron-lotus-art.mjs` → `src/project/flagship/ironLotusArt.ts` (설린 걷기 칩·흉상·배경 셋. 생성 그림 없음)
- 맵 다시 깔기: `src/project/flagship/ironLotusMaps.ts`
- 자료집: `src/project/flagship/ironLotusLore.ts`
- 줄거리와 조작은 이 페이지와 빌더 주석이 정본이다.
- 플레이: `player.html?demo=iron-lotus` · 편집기 예제 메뉴 「강호의 철련」
- 굽기: `npm run bake:demos -- --only iron-lotus`
- 정본 저장: `node scripts/content/save-iron-lotus.mjs <project.json> --dir .oprn-projects/iron-lotus`
- QA: `scripts/qa/runtime/iron-lotus.scenario.mjs`, 체크포인트 `scripts/qa/runtime/checkpoints/iron-lotus.json`

맵은 번들 `sengoku_edo` 하나다. 유하진(여관 거리)과 여관·약방 실내, 청죽림과 청죽림 깊숙이, 운무산 사원과 본당·누각. 죽림은 구성기가 깐 무가 저택을 지우고 풀·흙길·대나무로 다시 깐다. `murim_wuxia` 는 사람이 고른 후보만 번들에 들어가므로 쓰지 않는다. 설린은 광대 모자가 없는 은발 기계 소녀 칩이고, 전투에서는 그 걷기 칩을 그대로 쓴다. 추락 고치는 폴른 스타 관(`fallenStarVessel`)과 같은 그림이며 죽림 길가에 둔다.

디버그 순간이동으로 마을에 돌아오면 귀환 자동 이벤트가 돈다. 다른 이벤트가 실행 중이면 끝난 다음 프레임에 다시 본다. 같은 맵 순간이동도 자동 실행을 돌린다.

새 프로젝트 「모험 JRPG」 예제 자리는 여전히 폴른 스타다. `iron-lotus` 는 예제 메뉴와 `?demo=` 로만 연다.
