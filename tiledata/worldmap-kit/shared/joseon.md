# 실제 지형 · 조선 팔도 전도

실제 지형의 RPG 지도 사례. 마을·오프닝·엔딩은 이 지역 사본에 포함하지 않는다.

## 실제 저장된 지형 설정

```json
{
  "theme": "joseon",
  "ops": [
    {
      "style": "real",
      "region": "korea",
      "op": "continents",
      "count": 0
    }
  ],
  "terrainId": "joseon-korea+edit",
  "palette": "joseon",
  "base": "generate",
  "fitSalt": 0
}
```

- read_region_reference에서 자료를 찾고 import_region_reference로 새 맵에 가져온다.
- worldmapSource의 실제 지리 범위·home·ops와 characterScale을 보존한다.
- 선택 아이콘은 list_worldmap_icons에서 고른 뒤 참고문서 전 페이지와 그림을 읽고 stamp_worldmap_icon으로 전체 배치한다.
- 지형 편집 후 inspect_worldmap_icon과 check_reachability로 배열·입구 접근을 확인한다.

이동 이벤트는 새 목적지 맵과 연결해야 한다. includeEvents 기본값은 false다.
