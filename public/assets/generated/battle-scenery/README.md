# 측면 전투용 겹 배경 (도트)

2026-09-28부터 다섯 지형(plains, forest, cave, snow, desert)의 네 장은 **PIL 로 직접 찍은 도트**다.
논리 320×180 에서 그리고 nearest 2배로 640×360 을 쓴다. 지형당 24색 이하, 알파 0/255.

```sh
python3 scripts/asset-gen/pixel-scenery/plains.py   # forest.py · cave.py · snow.py · desert.py
```

- 생성기: `scripts/asset-gen/pixel-scenery/<biome>.py`, 공용 함수 `lib_plains.py`(초원·숲)·`lib_cave.py`(동굴·설원·사막).
- 각 생성기는 sky/far/mid/ground/preview 를 쓰고 규격(640×360, 이진 알파, sky 불투명·좌우 이음새, ground y≥160 불투명, 색 수)을 검사해 출력한다.
- `source.png`·`prompts.json`·`scripts/asset-gen/gen-battle-scenery.mjs` 는 **옛 AI 원화 경로의 기록**이다.
  그 스크립트를 돌리면 도트 배경을 AI 원화 축소본으로 덮어쓴다 — 돌리지 않는다. `manifest.json` 도 옛 경로의 해시다.

## 소비 계약

- URL: `/assets/generated/battle-scenery/<biome>/<layer>.png` (`src/assets/battleSceneryCatalog.ts`).
- 뒤→앞: sky → far → mid → ground. 모두 640×360.
- sky 는 불투명이고 640px 가로 반복으로 흐른다 — 좌우 끝이 이어진다.
- mid 는 ±2px 흔들린다. ground 는 y=160 부터 불투명. 바닥 가운데는 인물이 서는 자리라 조용하게 둔다.
- preview.png·source.png 는 런타임에서 불러오지 않는다.

## 장소 그림 (한 장짜리, 2026-11-11~)

다섯 지형 밖의 폴더(`tomb/` …)는 `preview.png` 한 장만 있는 **장소 그림**이다. 겹(sky/far/mid/ground)이 없다.

- battle-backdrop 하네스가 그 장소의 맵 캡처를 참고 그림으로 생성형 이미지(god-tibo-imagen) → 320×180 맵 팔레트 도트화 → Claude Opus 검수(숨긴 디코이, 3.5 통과) 최고점을
  `npm run harness -- battle-backdrop build <판> --bundle <키>` 로 실은 것이다. 생성형 그림은 전투 배경에 한해 허용된다(2026-10-29).
- 규격은 위 미리보기와 같다: 640×360 = 320×180 격자 2배, 불투명, 32색 이하(팔레트 PNG).
- id `battle-scenery-<키>`, 목록 `src/assets/battleSceneryStills.json`(하네스가 쓴다 — 손으로 고치거나 그림을 바꿔 넣지 않는다. 화소 해시가 원장의 검수 기록에 묶여 있고 `test/battleSceneryStills.test.ts` 가 본다).
- 런타임은 종류로 풀지 않고 이 한 장을 그대로 깐다. 문서 `openwiki/harnesses/battle-backdrop.md` 「장소 그림」.
