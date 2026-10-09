# 장소 팩 「완성 배치도」 저작 지침 (2026-10-08)

**왜:** 스토어에서 팩만 받은 다른 사람의 조수는 부품 60~90종 앞에서 매번 즉흥으로 짜서 느리고(호출 100~200번) 어색하다. 팩에 **완성 배치도 키트 하나**(`bd-layout-<slug>-<name>`)를 넣으면 조수가 (0,0)에 한 번 찍고 필요한 곳만 고친다. 이 배치도의 품질이 곧 그 팩을 받은 사람이 처음 보는 결과다.

## 만드는 법
1. 팩을 만든다(이미 있으면 생략): `python3 scripts/content/beodeul-picks/build_place_packs.py <slug>` → `build/place-packs/<slug>/`.
2. 배치 정의 `tiledata/beodeul-variants/<slug>/layouts/main.json` (이미 있는 `desert-castle/layouts/main.json` 이 견본). 형식은 `scripts/qa/pack-layout-replay.mts` 머리말: size, name, title, description, steps[ fill / rect / line / blob(오토타일 붓 덩이) / stamp(키트 이름 끝) ].
3. 재생·그림: `bun scripts/qa/pack-layout-replay.mts <slug> tiledata/beodeul-variants/<slug>/layouts/main.json /tmp/<slug>-layout.png --scale 2 --kit-out /tmp/<slug>-lo --verify` — **그림을 반드시 직접 열어** 본다(Read). 최소 3번 고친다. `--verify` 가 「동일」이어야 한다.
4. 키트 이름·붓 이름은 `build/place-packs/<slug>/tileset.json` 의 structureKits id 끝, autotileGroups id 끝(`..._autotile_<붓>`) 이다. 직접 확인한다. 존재하지 않으면 도구가 멈춘다.

## 품질 (합격선)
- 크기: 야외 64×48, 던전·실내 48×36(필요하면 더 크게). 한 화면(20×15) 어디를 잘라도 빈 바닥 ≤40%, 의미 없는 반복·일렬 금지.
- 순서: ① 맨 바탕 채우기(`fill` ground-*) ② 구역별 바닥 변화(`rect`/`line`) ③ 오토타일 덩이(`blob` — 연못·풀·눈·용암·그을음 등, 가장자리가 둥글어야 하고, 그렇지 않으면 반경·seed 를 바꾼다) ④ 길(입구 → 앵커 → 문 앞을 잇고 바닥과 **대비**되는 재질) ⑤ 큰 건물·랜드마크부터 ⑥ 소품은 목적 있는 덩이(시장 옆 좌판, 분수 둘레…).
- 던전·실내: 천장 밑에 벽 앞면 2~3줄, ㅁ자 고립 방 금지, 방과 방은 통로로 잇는다. 어느 문·계단도 길로 닿아야 한다.
- 이웃 건물은 1칸 띄우거나 벽을 맞댄다. 문 칸 아래 칸은 길. 같은 키트 일렬 금지.
- 도달성: 만든 뒤 `bun scripts/qa/pack-layout-replay.mts … --project /tmp/<slug>.json` 로 프로젝트를 저장하고 `runHeadlessTool` 의 `check_reachability` 와 같은 검사를 쓸 수 있으면 돌린다(어려우면 생략하고 눈으로 확인).
- 이 팩에 없는 부품은 쓰지 않는다. 팩이 약하면(바닥 대비 약함·부품 부족) 배치도에서 억지로 가리지 말고 보고서에 「팩 약점」으로 적는다(다른 에이전트가 고친다).

## 파일·커밋
`tiledata/beodeul-variants/<slug>/layouts/main.json` 만 쓴다(+필요하면 `second.json`). 팩 빌드 산출물(build/)은 커밋하지 않는다. 그림 `layouts/preview.png`(scale 1, 커밋). 커밋: `git add tiledata/beodeul-variants/<slug>/layouts && git commit -m "feat(content): <장소> 완성 배치도" -- tiledata/beodeul-variants/<slug>/layouts` 끝줄 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. 다른 폴더·공용 스크립트 수정 금지. bake·gates·테스트·stash·push 금지. 장소마다 단계 커밋(스트림 정지 방지). 보고는 짧게: 장소별 한 줄 + 팩 약점.
