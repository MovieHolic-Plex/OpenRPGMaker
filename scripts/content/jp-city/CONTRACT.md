# jp_city 굽기 블록 계약 (`scripts/content/jp-city/`)

번들 타일셋 `jp_city`(id `jp_city`, 텍스처 `tex_jp_city`, 계열 `oprn-jp`, 16px 칸, 48열, 팔레트 **modern3**)는 **블록**들을 합쳐 만든다.
각 블록은 `blocks/<이름>.py` 하나이고, 단일 `bake_jp.py`(M1 담당) 가 정해진 순서로 불러 시트·정의 JSON 으로 합친다.
블록은 자기 그림을 **코드로 그린다**(손 도트, modern3 팔레트만, AI 이미지 금지). 다른 블록의 파일을 고치지 않는다.

## 블록 모듈 인터페이스
```python
BLOCK = "autotiles_ground"          # 파일 이름과 같게. 번호 핀 키의 접두어
def build() -> dict:                # 부작용 없음, 같은 입력이면 같은 결과(시드 고정)
    return {
      "cells":  { "<local>": {"img": PIL.Image(RGBA 16x16), "pc": "floor|solidfloor|flat|solid|star|blank",
                              "label": "한국어 이름", "desc": "쓰임새·놓는 곳", "tags": [...]}, ... },
      "autotiles": [ {"id": "jp-...", "name": "...", "neighborhood": 8, "layer": "lower|upper",
                      "member": ["<local>",...],            # 멤버 칸
                      "connect": ["<local>"|"other:<autotile id>", ...],   # 이어진 이웃으로 셀 칸(다른 오토타일 id 도 가능)
                      "variantMap": {"0": "<local>", ..., "255": "<local>"},   # 8방은 256키 전부, 4방은 16키
                      "interior": [["<local>",...],["<local>",...]] | None,    # 속칸 깊이 변형(선택)
                      "edgeConnects": True|False} ],
      "groups":  [ {"id": "jp:...", "name": "...", "role": "terrain|road|edge|detail|prop|wall|path|water|green", "defaultLayer": "lower|upper",
                    "cells": ["<local>",...], "desc": "...", "rules": "..."} ],   # tileGroups (fill_region 어휘 연결용: 오토타일 멤버와 칸이 겹치게)
      "kits":    [ {"id": "jp-...", "name": "...", "grid": [[local|None,...],...],      # 위층(upperTiles)
                    "base": [[local|None,...],...] | None,                               # 아래층(tiles), 없으면 -1
                    "parts": [{"kind":"entrance|sign|anchor|window","x":0,"y":0,"w":1,"h":1,"label":"..."}],
                    "ai": {"snap":"floor|wall","tags":[...],"description":"...","placementRules":"...","repeatability":"fixed|repeat","growthAxis":"x|y|xy|None","anchor":{"dx":0,"dy":0},"access":[{"x":0,"y":0}]}} ],
      "notes": "블록 설명, 알려진 한계"
    }
```
- `local` 키는 블록 안에서 **불변**(그림을 다듬어도 키는 유지). 번호 핀 키 = `"<BLOCK>/<local>"` (자리 키 핀 — 그림을 고쳐도 번호가 안 바뀐다, `scripts/content/hand-interior/pin_ids.py` 참고). 새 칸은 시트 끝에 덧붙고 기존 번호는 절대 안 움직인다.
- 칸 `pc`(통행·층): `floor`(불투명 lower·통행), `solidfloor`(불투명 lower·막힘), `flat`(투명 lower 오버레이·통행·붓 홈 upper), `solid`(upper·막힘), `star`(upper·통행 ★), `blank`.
- 오토타일: 8방 비트 N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128 (`src/project/defaults/autotileEngine.ts`). 정규화 `canon(m) = (m&15) | (두 변이 모두 켜진 대각 비트)`, 47종을 `sorted(canon 집합)` 오름차순으로 칸 0..46, 몸통 변형 2칸(b1,b2) = 49칸. variantMap 은 `{str(m): tiles[canon(m)] for m in 0..255}` (선례 `scripts/content/build-atlas-biome-chipsets.py:161-170`, `build-joseon-tileset.py:204-214,464-490`). 4방 그룹은 16키.
- 블록은 `build()` 반환에 `"connect_extra": {<오토타일 id>: [<이 블록 로컬>, ...]}` 를 더할 수 있다. 굽기가 그 오토타일의 `connectTileIds` 에 덧붙인다(다른 블록의 오토타일 칸을 화소 그대로 복사해 키트에 쓰는 블록이, 복사 칸을 같은 땅으로 읽히게 할 때). 번호·그림은 안 바뀐다.
- 같은 오토타일의 `member` 칸끼리만 서로 이웃으로 센다(`connect` 로 늘릴 수 있음). 바깥 이웃(다른 지형)의 질감은 **가장자리 칸 그림 안에 같이 구워** 둔다(오토타일 하나는 바깥 지형 하나 가정; 문서에 적는다).
- 선형 오토타일(울타리·담·선로·차선 표시)은 `layer: upper` 또는 투명 오버레이이고 4방+대각이 필요 없으면 4방(16키)으로 둔다.
- 팔레트: `tiledata/atlas-pick/palette/modern3.pal` 의 색만. 마커색 `#e040c0` 금지. 반투명 금지(알파 0 또는 255). 윤곽은 램프의 어두운 단(`sumi`/재질 어두운 단). 빛은 왼쪽 위, 그림자 오른쪽 아래. 3/4 시점(윗면 + 남쪽 정면).
- 재질 질감은 **기존 시트의 칸 내부를 빌려** 이음새 없게 한다(지침: 새로 만든 알갱이로 16px 칸을 채우면 이음새·반복이 드러난다) — 기준 칸은 `tiledata/jp-city/sources/jp_shopstreet16.png`(M0 가 만든다; 없으면 `~/gv3-work/chipset/jp_shopstreet16.png`)의 street 칸(`catalog.json` 의 `street` 이름 → 번호): `road_n/c/s`, `sw`, `sw_tactile`, `lawn`, `gravel`, `sando`, `pave_a/b`, `water`, `quay`, `plant_strip`, `rail` 등.
- 검증 함수를 블록에 포함: `selftest()` — (a) 모든 칸 16×16 RGBA, 색 ⊂ modern3, 알파 0/255, (b) 오토타일이면 256키 전부·canon 47종·키 `local` 존재, (c) 이음새: 몸통 칸이 3×3 반복으로 이음새 없음, (d) 무작위 마스크 맵(예: 32×32, 시드 고정)을 칸으로 렌더해 PNG 로 저장(눈 확인용).

## 산출물 위치
- 블록 코드 `scripts/content/jp-city/blocks/<이름>.py`, 눈 확인용 렌더 `tiledata/jp-city/blocks/<이름>/*.png`.
- 오토타일 qa 맵 렌더는 `tiledata/jp-city/blocks/<이름>/mask-map.png`(원본 해상도) 와 ×4 확대.
