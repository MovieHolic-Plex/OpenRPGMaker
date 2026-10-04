# geo — 실제 지리 자료 (style `real`)

`kit/lib/kit_realgeo.py` 가 읽는 작은 묶음. 원본에서 다시 만들려면 `python3 kit/tools/pack_geo.py <원본 폴더>`.

| 파일 | 내용 | 출처 · 라이선스 |
|---|---|---|
| `land.json.gz` | 육지 다각형(1:5천만, 0.02° 단순화, 0.01° 반올림) | Natural Earth `ne_50m_land` — 퍼블릭 도메인 |
| `lakes.json.gz` | 호수 다각형 | Natural Earth `ne_50m_lakes` — 퍼블릭 도메인 |
| `rivers.json.gz` | 강 중심선(이름·등급) | Natural Earth `ne_50m_rivers_lake_centerlines` — 퍼블릭 도메인 |
| `regions.json.gz` | 이름난 지역 — 산맥·사막·고원·분지·툰드라·습지·평야(한국어 이름 포함) | Natural Earth `ne_10m_geography_regions_polys` — 퍼블릭 도메인 |
| `elev.npy.gz` | 높이 0.25° 격자(uint8, 30m 단위, 바다 0, 위도 오름차순 720 × 경도 1440) | NOAA NGDC ETOPO1 Ice Surface(ERDDAP `etopo180` 표본) — 자유 재배포, 보증 없음. Amante & Eakins 2009, NOAA Tech. Memo NESDIS NGDC-24 |

Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.

- 원본 GeoJSON: https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
- 높이: https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.nc?altitude[(-89.875):15:(89.875)][(-179.875):15:(179.875)]

자료 해상도 때문에 칸보다 좁은 해협·운하(지브롤터·수에즈·바브엘만데브·메시나·파나마)는 땅으로 막힌다 —
`kit_realgeo.CUTS` 가 범위 안에 있으면 칸 하나 폭 물길로 판다.
