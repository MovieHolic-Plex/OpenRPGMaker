# extra.json 형식 (맵 → 에디터 변환기 공용 계약)
맵 빌더(demo20.py / demo_gungnae.py)는 map.json 옆에 `extra.json` 을 낸다:
{
 "width": W, "height": H,
 "placed": [{"name": "<catalog 조각 이름>", "x": 타일x, "y": 타일y, "w": 칸수, "h": 칸수}],   // 물체 레이어에 놓은 모든 조각(바닥 그림자 항목 제외 가능, 놓은 순서대로)
 "groundKind": [[ "grass|road|yard|paving|slab|water|paddy|field|wall|bridge|other" ... ] ...],   // 칸마다 바닥 종류(행 우선, H×W)
 "doors": [{"x": 타일x, "y": 타일y, "piece": "<조각 이름>"}],   // 걸어 들어가는 문 앞 칸(건물 문 바로 앞 땅 칸 좌표)
 "people": [{"x":..,"y":..,"char":0~7,"dir":"down|left|right|up","frame":0~2}]
}
