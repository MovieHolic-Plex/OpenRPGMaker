# 현대 도시 — 층 표기 대조: 엔진 판정 전후

tilesetId `modern_city` · 그림 `public/assets/modern-city/modern-city-chipset.png`(텍스처 `tex_modern_city`, **9998칸**, 16px 칸, 시트 768×3344px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-modern` — 버들항(`oprn-atlas`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

AI-REFERENCE-CONTRACT 8항: 투명 여부·홈 레이어·통행·그림 순서는 **별개의 정보**다. 칸 9997칸을 엔진 함수로 대조했다(`tiledata/modern-city/refs/layer-audit.mts`, 결과 `layer-audit.json`): 어긋남 **0건**.
대조한 엔진 함수: 홈 레이어 `src/editor/tileLayerPolicy.ts`, 통행 `src/project/collision.ts` 의 `passabilityOf`, 그림 순서 `src/player/characterDepth.ts` 의 `mapUpperTileDepth`.

## 그룹별 측정(칸 수)
| 그룹 | 칸 수 | 통행 | 칸 우선순위 priority | 홈 레이어(편집기 붓) | 그림 순서 |
|---|---|---|---|---|---|
| `mc:road` | 3 | 걸음 | lower | lower | 캐릭터 아래 |
| `mc:sidewalk` | 1 | 걸음 | lower | lower | 캐릭터 아래 |
| `mc:green` | 4 | 걸음 | lower | lower | 캐릭터 아래 |
| `mc:water` | 1 | 막힘 | lower | lower | 캐릭터와 y 정렬 |
| `mc:hedge` | 1 | 막힘 | lower | lower | 캐릭터와 y 정렬 |
| `mc:marking-center` | 12 | 걸음 | lower | upper | 캐릭터 아래 |
| `mc:marking-stop` | 12 | 걸음 | lower | upper | 캐릭터 아래 |
| `mc:marking-arrow` | 4 | 걸음 | lower | upper | 캐릭터 아래 |
| `mc:marking-manhole` | 4 | 걸음 | lower | upper | 캐릭터 아래 |
| `mc:shadow` | 20 | 걸음 | lower | upper | 캐릭터 아래 |

건물·소품·차량 칸 묶음(요약): solid|prio=upper|home=upper|depth=ysort, star|prio=upper|home=upper|depth=above.

## 전/후
| 항목 | 전: 번들 tileMeta·그룹 문구 | 후: 엔진 측정과 이 문서의 표기 |
|---|---|---|
| 도로 표시·그림자 칸의 층 | 그룹 이름 「…(오버레이, 2층)」, tileMeta 설명 「붓은 위층에 깔고 … 캐릭터 밑에 그린다(2층)」 — 읽는 사람이 홈 레이어(위층=3층)와 2층을 한 가지로 오해할 수 있다 | 투명 칸이고 통행 가능이다. 편집기 붓 홈 레이어는 `upper`(위층 슬롯)지만 **그림 순서는 캐릭터 아래**(통행 가능한 칸은 y 정렬 대신 아래). 예제 맵은 이 칸들을 **2층 `lowerOverlayTiles`** 에 둔다(같은 그림·같은 통행, 캐릭터 아래). 1층에 단독으로 두면 아래 땅이 없어 검게 보인다 → 오류 코드 `overlay-in-base-layer` |
| 건물·소품 칸 | 「위층에 찍는다」 | 맞다. 3층(홈 `upper`). 막힘 칸은 캐릭터와 y 정렬, ★ 칸은 항상 캐릭터 위. 1층에 있으면 `building-in-lower-layer` |
| 땅 칸 | 아래층 | 맞다. 1층. 3·4층에 있으면 `ground-in-object-layer` |
| 물·생울타리 땅 | 아래층 | 1층이지만 **막힘**(통행 막힘 + y 정렬) — 땅이라고 걸을 수 있는 것은 아니다 |
| 투명 여부 vs 층 | (구분 안 됨) | 투명하다고 위층에 두는 것이 아니다: 투명한 소품도 발밑 줄은 막고 윗줄만 ★. 투명 오버레이(표시·그림자)만 2층 |

tileMeta·그룹의 문구 자체는 이 문서의 작성자가 고치지 않았다(번들 정의 JSON 은 별도 담당). 위 전/후 표가 **문서에서 쓰는 정정 표기**이며 엔진 측정으로 뒷받침된다.
