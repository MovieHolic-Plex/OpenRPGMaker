// tiledata/beodeul-variants/_revive/bake.py 가 쓴다(손으로 고치지 말 것). 버들항 웨이브 장소 — 원본 그림 칸으로 되살린 장소 맵.
// 스냅숏 src/project/regionReferences/beodeul-wave-places.json(여러 맵 한 파일).
export const BEODEUL_WAVE_PLACE_REFERENCES = [
  {
    "id": "bd-wave-ash-plain",
    "name": "재의 들판",
    "kind": "completed-place",
    "placeKind": "natural",
    "revision": 1,
    "x": 0,
    "y": 0,
    "width": 72,
    "height": 21,
    "tilesetId": "beodeul_wave_places",
    "preview": "/assets/region-references/bd-wave-ash-plain.png",
    "tilesetPreview": "/assets/beodeul-wave-places/beodeul-wave-places-chipset.png",
    "sourceProjectId": "oprn-bundled-beodeul-wave-places",
    "sourceMapId": "bd-wave-ash-plain",
    "snapshotProjectId": "oprn-place-bd-wave-ash-plain-v1",
    "rules": [
      "버들항 장르 웨이브(2026-10-08) 손 도트 장소의 원본 그림을 16px 칸으로 자른 맵. 칩셋 `beodeul_wave_places`(계열 oprn-atlas-wave), 칸 72×21.",
      "화산 지대 필드의 남쪽 재 평원만 자른 들판(용암 강 남쪽, 용암 강·신전·분화구 없음). 그을린 고목 숲·짐승 뼈·주상절리·흑요석·유황 분기공 벌판, 잿빛 오솔길이 남쪽 입구에서 북쪽 끝(출구)까지 이어진다.",
      "입구 칸 (35,20). 걷는 칸 1387, 입구에서 4방향 통행으로 닿는 칸 1387.",
      "아래층 = 원본 칸, 위층 = 키 큰 물체 화소(걷는 칸은 ★). 겹쳐 그리면 원본 그림과 화소 0 차이."
    ],
    "limitations": "북쪽 끝 줄은 잘린 가장자리라 출구 이벤트를 놓을 자리다. 동쪽 가운데 작은 용암 웅덩이(3×2)는 원본 그대로 남았다(막힘). 이벤트·적·BGM 은 없다. 새 맵을 이 칩셋 낱칸으로 짓는 재료가 아니다."
  },
  {
    "id": "bd-wave-volcano-field",
    "name": "화산 지대 필드",
    "kind": "completed-place",
    "placeKind": "natural",
    "revision": 1,
    "x": 0,
    "y": 0,
    "width": 72,
    "height": 52,
    "tilesetId": "beodeul_wave_places",
    "preview": "/assets/region-references/bd-wave-volcano-field.png",
    "tilesetPreview": "/assets/beodeul-wave-places/beodeul-wave-places-chipset.png",
    "sourceProjectId": "oprn-bundled-beodeul-wave-places",
    "sourceMapId": "bd-wave-volcano-field",
    "snapshotProjectId": "oprn-place-bd-wave-volcano-field-v1",
    "rules": [
      "버들항 장르 웨이브(2026-10-08) 손 도트 장소의 원본 그림을 16px 칸으로 자른 맵. 칩셋 `beodeul_wave_places`(계열 oprn-atlas-wave), 칸 72×52.",
      "화산 지대 필드 전체: 남쪽 입구 → 재 평원 → 현무암 다리로 용암 강 건넘 → 절벽 돌계단 → 화산 신전 입구, 곁길 징검돌 → 화산 동굴 입구.",
      "입구 칸 (35,51). 걷는 칸 2940, 입구에서 4방향 통행으로 닿는 칸 2940.",
      "아래층 = 원본 칸, 위층 = 키 큰 물체 화소(걷는 칸은 ★). 겹쳐 그리면 원본 그림과 화소 0 차이."
    ],
    "limitations": "신전 문·동굴 입구는 그림뿐 — 이동 이벤트를 따로 놓는다. 이벤트·적·BGM 은 없다. 새 맵을 이 칩셋 낱칸으로 짓는 재료가 아니다."
  },
  {
    "id": "bd-wave-ruined-village",
    "name": "폐허 마을 (새벽샘 터)",
    "kind": "completed-place",
    "placeKind": "settlement",
    "revision": 1,
    "x": 0,
    "y": 0,
    "width": 64,
    "height": 48,
    "tilesetId": "beodeul_wave_places",
    "preview": "/assets/region-references/bd-wave-ruined-village.png",
    "tilesetPreview": "/assets/beodeul-wave-places/beodeul-wave-places-chipset.png",
    "sourceProjectId": "oprn-bundled-beodeul-wave-places",
    "sourceMapId": "bd-wave-ruined-village",
    "snapshotProjectId": "oprn-place-bd-wave-ruined-village-v1",
    "rules": [
      "버들항 장르 웨이브(2026-10-08) 손 도트 장소의 원본 그림을 16px 칸으로 자른 맵. 칩셋 `beodeul_wave_places`(계열 oprn-atlas-wave), 칸 64×48.",
      "불타고 버려진 마을: 무너진 예배당과 종탑, 판석 광장(마른 우물·찢긴 천막 가판·넘어진 수레), 반쯤 무너진 집 여섯, 묘지와 지하 묘소 입구, 말라 죽은 밭과 허수아비, 남쪽 문기둥.",
      "입구 칸 (31,47). 걷는 칸 2636, 입구에서 4방향 통행으로 닿는 칸 2627.",
      "아래층 = 원본 칸, 위층 = 키 큰 물체 화소(걷는 칸은 ★). 겹쳐 그리면 원본 그림과 화소 0 차이."
    ],
    "limitations": "집·예배당 문은 그림뿐(실내 맵 없음). 주민·까마귀 이벤트는 없다. 이벤트·적·BGM 은 없다. 새 맵을 이 칩셋 낱칸으로 짓는 재료가 아니다."
  },
  {
    "id": "bd-wave-ice-age-field",
    "name": "빙하기 설원 (얼음 호수)",
    "kind": "completed-place",
    "placeKind": "natural",
    "revision": 1,
    "x": 0,
    "y": 0,
    "width": 72,
    "height": 52,
    "tilesetId": "beodeul_wave_places",
    "preview": "/assets/region-references/bd-wave-ice-age-field.png",
    "tilesetPreview": "/assets/beodeul-wave-places/beodeul-wave-places-chipset.png",
    "sourceProjectId": "oprn-bundled-beodeul-wave-places",
    "sourceMapId": "bd-wave-ice-age-field",
    "snapshotProjectId": "oprn-place-bd-wave-ice-age-field-v1",
    "rules": [
      "버들항 장르 웨이브(2026-10-08) 손 도트 장소의 원본 그림을 16px 칸으로 자른 맵. 칩셋 `beodeul_wave_places`(계열 oprn-atlas-wave), 칸 72×52.",
      "빙하기 설원: 북쪽 빙벽과 얼음 굴 입구·언 폭포·얼음 속 짐승 그림자, 가운데 언 호수와 물길(얼음 다리로 건넘), 서쪽 눈 전나무 숲·설동, 남쪽 모피 천막 야영지(모닥불·움막·엄니 문), 동쪽 거대 짐승 뼈 벌판.",
      "입구 칸 (35,51). 걷는 칸 2073, 입구에서 4방향 통행으로 닿는 칸 2000.",
      "아래층 = 원본 칸, 위층 = 키 큰 물체 화소(걷는 칸은 ★). 겹쳐 그리면 원본 그림과 화소 0 차이."
    ],
    "limitations": "얼음 굴 입구·설동은 그림뿐. 물체 통행은 원본 그림을 물체/땅으로 나눠 밑동 칸을 막은 것이라 스크립트 판보다 거칠다. 이벤트·적·BGM 은 없다. 새 맵을 이 칩셋 낱칸으로 짓는 재료가 아니다."
  },
  {
    "id": "bd-wave-mountain-fortress",
    "name": "산악 요새 (관문 요새)",
    "kind": "completed-place",
    "placeKind": "facility",
    "revision": 1,
    "x": 0,
    "y": 0,
    "width": 72,
    "height": 56,
    "tilesetId": "beodeul_wave_places",
    "preview": "/assets/region-references/bd-wave-mountain-fortress.png",
    "tilesetPreview": "/assets/beodeul-wave-places/beodeul-wave-places-chipset.png",
    "sourceProjectId": "oprn-bundled-beodeul-wave-places",
    "sourceMapId": "bd-wave-mountain-fortress",
    "snapshotProjectId": "oprn-place-bd-wave-mountain-fortress-v1",
    "rules": [
      "버들항 장르 웨이브(2026-10-08) 손 도트 장소의 원본 그림을 16px 칸으로 자른 맵. 칩셋 `beodeul_wave_places`(계열 oprn-atlas-wave), 칸 72×56.",
      "산악 요새 정문 앞: 남쪽 산길 입구 → 지그재그 오르막(돌계단 둘) → 골짜기 위 도개교 → 성벽 성문 통로 → 앞뜰(대장간·창고 마당) → 거대 석문. 서·동 갈래 출구.",
      "입구 칸 (14,55). 걷는 칸 1617, 입구에서 4방향 통행으로 닿는 칸 1464.",
      "아래층 = 원본 칸, 위층 = 키 큰 물체 화소(걷는 칸은 ★). 겹쳐 그리면 원본 그림과 화소 0 차이."
    ],
    "limitations": "석문·대장간은 그림뿐 — 요새 안 맵 이동 이벤트를 따로 놓는다. 이벤트·적·BGM 은 없다. 새 맵을 이 칩셋 낱칸으로 짓는 재료가 아니다."
  }
];
