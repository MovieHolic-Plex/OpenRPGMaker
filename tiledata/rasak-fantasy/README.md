# Rasak's Fantasy Tileset — 비공식 지원 (그림 없음)

- 팩: Rasak's Fantasy Tileset — https://rasak.itch.io/rasaks-fantasy (작가 Rasak)
- 라이선스 요지: 사용·수정 가능(크레딧 필수), **원본·수정본 그림의 재배포 금지**, 링크는 허용.
- 그래서 이 폴더와 `scripts/content/rasak/` 에는 **설정과 스크립트만** 있다. 팩 PNG 나 그로부터
  만든 아틀라스·렌더·맵 캡처는 저장소에 절대 넣지 않는다. 작업물은 `~/third-party-assets/rasak/` 에 둔다.
- 게임에 쓸 때 크레딧: `Tileset: Rasak's Fantasy Tileset by Rasak (https://rasak.itch.io/rasaks-fantasy)`

## 파일

| 파일 | 내용 |
|---|---|
| `bundles.json` | 팩 정보, 시트별 sha256(팩 버전 확인용), MZ 슬롯(A1~E + 추가 시트) 묶음 3개: `rasak_field` · `rasak_swamp` · `rasak_cave` |
| `substitutions.json` | 제작자 프리뷰(2022 스크린샷) 이후 다시 그려진 그림 자리에 현재 시트의 같은 물체를 통째로 놓는 수동 대체 |

## 파이프라인 (사용자가 직접 받은 팩 기준)

```sh
# 0. 팩을 받아 풀기 (RAR5 — 7z 는 못 푼다, unrar 또는 node-unrar-js)
#    ~/third-party-assets/rasak/extracted/Fantasy/Tileset/...
# 1. 묶음마다 OPRN 아틀라스(96칸 폭) 굽기: MZ 자동타일 전 모양·A1 애니 프레임·그림자 15종
python3 scripts/content/rasak/bake_atlas.py --source ~/third-party-assets/rasak/extracted/Fantasy/Tileset \
  --bundle rasak_field --out ~/third-party-assets/rasak/baked
# 2. 제작자 프리뷰를 칸 단위로 역재구성 (MZ 스택 그대로)
python3 scripts/content/rasak/reconstruct_preview.py --baked ~/third-party-assets/rasak/baked/rasak_field \
  --preview ~/third-party-assets/rasak/previews/p01.png --id rasak_preview_p01 --name "Rasak 재현 · 일본 정원" \
  --out ~/third-party-assets/rasak/maps --substitutions tiledata/rasak-fantasy/substitutions.json
# 3. OPRN 은 칸당 lower 1장 + upper 1장만 그린다(타일 스택은 은퇴, mapOverlayTiles.ts).
#    여러 겹인 칸을 합성 타일로 접는다. 애니 물 위 합성은 프레임마다 합성해 strip 으로 등록.
python3 scripts/content/rasak/fold_layers.py --baked ~/third-party-assets/rasak/baked/rasak_field \
  --maps ~/third-party-assets/rasak/maps
# 4. 두 층 렌더로 독립 검증
python3 scripts/content/rasak/verify_folded.py --baked ~/third-party-assets/rasak/baked/rasak_field \
  --map ~/third-party-assets/rasak/maps/rasak_preview_p01.folded.map.json \
  --preview ~/third-party-assets/rasak/previews/p01.png --phase 0,0
# 5. 로컬 전용 연구 프로젝트(SQLite)로 저장 → oprn-serve 로 열기
node scripts/content/rasak/publish-study-project.mjs --baked ~/third-party-assets/rasak/baked \
  --maps ~/third-party-assets/rasak/maps --project-dir ~/third-party-assets/rasak/study-project
node scripts/oprn-serve.mjs --project-dir ~/third-party-assets/rasak/study-project --port 9837
# 3'. (합성 대신) 스택을 1·2층·그림자·3·4층에 그대로 싣기 — 칸에 다 안 들어가는 스택만 그 무리를 합성으로 되돌린다.
#     *.layers.map.json + atlas.layers.png 를 만들고, publish 에 --layers 를 주면 그것을 싣는다.
python3 scripts/content/rasak/stack_to_layers.py --baked ~/third-party-assets/rasak/baked/rasak_field \
  --maps ~/third-party-assets/rasak/maps
node scripts/content/rasak/publish-study-project.mjs --layers --baked ~/third-party-assets/rasak/baked \
  --maps ~/third-party-assets/rasak/maps --project-dir ~/third-party-assets/rasak/study-project-layers
```

## 프리뷰 재현 결과 (2026-09-24, 두 층 렌더 기준)

| 프리뷰 | 묶음 | 완전 일치 | ±32 이내 | 남은 차이 |
|---|---|---|---|---|
| p01 일본 정원 | field | 91.1% | 92.8% | 2022 이후 다시 그려진 꽃·캐릭터(이벤트) |
| p02 절벽과 폭포 | field | 84.4% | 89.2% | 옛 꽃·고사리·거미줄, 캐릭터. 폭포는 첫 프레임 |
| p28 늪 | swamp | 98.5% | 99.9% | — |
| p27a 얼음 동굴 | cave | 98.3% | 99.1% | — |
| p27b 용암 동굴 | cave | 80.8% | 99.4% | 천장 밝기 1~2 차(옛 A4_Cave) |

## 통행 휴리스틱 (타일별 플래그를 쓰기 전 임시)

A1(물)·A3·A4(벽) 막힘, A2·A5·그림자 통과, B~E·추가 시트는 칸의 불투명 비율이 50% 넘으면 막힘,
합성 칸은 구성 중 하나라도 막히면 막힘. 우선순위는 B~E·추가 시트·upper 합성이 upper.

## 남은 일

- 사용자가 팩 시트를 올리면 파일명/sha256 으로 알아보고 위 묶음 구성·타일 설명을 조수에게 주는 프리셋.
  `applyCustomChipsetMinimalHarness` 가 upper 를 잘못 옮기므로 프리셋 타일셋은 거기서 빼야 한다
  (Rasak Modern 선례와 같은 함정).
- 통행·우선순위를 휴리스틱 대신 타일별로 확정.
