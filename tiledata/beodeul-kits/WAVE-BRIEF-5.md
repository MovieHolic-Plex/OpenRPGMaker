# 버들항 화풍 장르 웨이브 (웨이브 6) — 장르별 장소 묶음, 「팩 전용」 (2026-10-08)

읽는 순서: `WAVE-BRIEF-2.md`(합격선·필수 QA·파일 규칙) → `WAVE-BRIEF-4.md`(시그니처 땅 덩이 오토타일 규칙 1, 가장자리는 **불규칙·둥글게**, 직각 금지) → 이 문서.
전투 배경은 `WAVE-BRIEF-3.md` A 절을 따른다. 기준작: 합격한 웨이브 4·5 장소 폴더(`opera-stage`, `ghost-train`, `empire-city`, `eastern-castle`, `desert-castle`)의 `make_*.py`·`compare-ref.png`. 다른 장소 폴더는 **읽기만**.

## 달라지는 점
1. **공용 시트에 굽지 않는다.** 이 웨이브의 장소는 「장소 팩」(스토어 상품)으로만 나간다. 너는 굽지 말고(bake·팩 빌드 금지) 네 장소 폴더 `tiledata/beodeul-variants/<slug>/` 에만 만든다.
2. **팩 하나로 닫혀야 한다.** 이 장소를 받은 사람은 이 장소 팩 하나만 가진다(버들항 도시 풀밭·길·판석 칸 없음). 따라서 장소 안에 **맨 바탕 표본**(`ground-*` — 그 장소의 기본 땅 3종 이상: 평지·길·변화 바닥)과 **땅 덩이 오토타일**(연못·잔디·눈·그을음 등 시그니처 2~3종, 가장자리 불규칙)과 **길**(포석/흙길 이음이 되는 `ground-` 표본이나 오토타일)이 모두 들어 있어야 한다. 이웃 장소의 조각을 참조하지 않는다.
3. **한 장소 = 건물/랜드마크 키트 + 바닥 표본 + 땅 덩이 오토타일 + 소품 + 전투 배경 한 장.** 키트는 최소 45종. 조각 이름은 영문 소문자·하이픈(`ground-…`, `autotile-…`, 건물 `…`), 파일 `parts/*.png`, 각 조각은 `partmeta.json` 에 role·passable·설명(한글)을 쓴다 — 기존 장소의 `partmeta.json` 형식을 그대로 따른다.
4. **전투 배경:** `<네 폴더>/battle-bg.png` (640×360, WAVE-BRIEF-3 A 절 규약, 낮·맑음 하나). `check-overlay.png` 로 전투원 표식 검사를 남긴다.
5. **장르 일관성:** 같은 장르의 장소 셋은 같은 재질 언어를 쓴다. `tiledata/beodeul-kits/genres/<장르>.md` (없으면 첫 번째로 시작한 사람이 만든다, 5줄 이내: 주 재질·팔레트 키워드·금지) 를 먼저 읽고, 서로 다른 폴더의 같은 재질 조각은 규격을 맞춘다.
6. 사람·글자·상표·원작 고유 디자인 금지(일반 어휘로). 캐릭터가 필요하면 만들지 않는다.

## 산출물 (네 폴더)
`parts/*.png`, `partmeta.json`, `parts.md`, `grid.json`, `plan.md`(## 용도 한 문단 필수 — 스토어 설명에 쓴다), `make_<slug>.py`(재생성 가능), `render-1x.png`·`render-2x.png`(구역이 보이는 데모 맵: 바닥 표본 + 오토타일 덩이로 채운 완결 장면), `compare-ref.png`(버들항 기준 vs 이 장소, 최소 2회 고침), `check-autotile.png`, `battle-bg.png`, `check-overlay.png`.
데모 맵은 바닥을 **맨 바탕 표본 → 오토타일 덩이 → 건물·소품** 순으로 칠한다(조수가 따라 할 순서다).

## 커밋
`git add tiledata/beodeul-variants/<slug> tiledata/beodeul-kits/genres && git commit -m "feat(content): 버들항 <장소> — <장르> …" -- tiledata/beodeul-variants/<slug> tiledata/beodeul-kits/genres` 끝줄 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. 큰 스크립트를 한 번에 쓰지 말고 단계마다 저장·실행한다(스트림 정지 방지). bake·테스트·게이트·stash·push 금지. 보고는 짧게: 키트 수·오토타일 목록·커밋 해시·남은 약점.
