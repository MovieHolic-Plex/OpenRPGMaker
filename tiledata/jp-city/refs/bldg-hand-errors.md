# 일본 도시 — 손 도트 건물 정상/오류(엔진 변조 실험)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **10041칸**, 16px 칸, 시트 768×3360px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

| 오류 코드 | 변조 | 검출 칸(맵 좌표 x,y) | 그림 |
|---|---|---|---|
| `door-access-blocked` | 상점 3채 줄에서 두 번째 가게 접근칸 위로 `jp-prop-vend-pair` 를 찍음 | (11,10) | `jp-img-err-bldg-access` |
| `wall-overwritten` | 다음 x = x + w − **2**(두 칸 겹침) | 15칸, 처음 (7,2), (7,3), (7,4), (7,5), (7,6), (7,7), (7,8), (7,9) | `jp-img-err-bldg-overlap` |

검사 범위: 구조(칸 번호가 키트대로 남았는가)와 통행(접근칸에서 걸어 갈 수 있는 칸 수)만 잰다. 미적 품질·실내 이동 이벤트·건물 사이 간격의 자연스러움은 이 검사로 판정하지 않는다.
정상 쪽은 같은 줄을 x + w − 1 로 세운 것(오류 0).
