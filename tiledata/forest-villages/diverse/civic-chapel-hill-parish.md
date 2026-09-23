# 공동 공간과 정원의 명시 배치 입력

```json
[
  {
    "id": "churchyard",
    "name": "교회 앞마당",
    "anchor": {
      "type": "landmark",
      "id": "chapel-hill-parish-church",
      "maxDistance": 6
    },
    "items": [
      {
        "id": "churchyard-1",
        "name": "벤치",
        "x": 29,
        "y": 16,
        "purpose": "예배 전후 앉아 기다리는 자리"
      },
      {
        "id": "churchyard-2",
        "name": "벤치",
        "x": 36,
        "y": 15,
        "purpose": "교회 앞 동쪽 쉼 자리"
      },
      {
        "id": "churchyard-3",
        "name": "돌등",
        "x": 32,
        "y": 14,
        "purpose": "교회 문 서쪽을 밝히는 등"
      },
      {
        "id": "churchyard-4",
        "name": "돌등",
        "x": 35,
        "y": 19,
        "purpose": "교회 문 동쪽을 밝히는 등",
        "near": "돌등"
      },
      {
        "id": "churchyard-5",
        "name": "꽃 화단",
        "x": 38,
        "y": 9,
        "purpose": "교회 벽 옆 제단용 꽃밭"
      }
    ]
  },
  {
    "id": "graveyard-gate",
    "name": "묘지 들머리",
    "anchor": {
      "type": "landmark",
      "id": "chapel-hill-parish-graveyard",
      "maxDistance": 6
    },
    "items": [
      {
        "id": "graveyard-gate-1",
        "name": "돌등",
        "x": 12,
        "y": 15,
        "purpose": "묘지 입구를 밝히는 등"
      },
      {
        "id": "graveyard-gate-2",
        "name": "마른 묘목",
        "x": 20,
        "y": 14,
        "purpose": "묘지 울타리 곁 마른 나무"
      }
    ]
  },
  {
    "id": "falls-pool",
    "name": "폭포 아래 소",
    "anchor": {
      "type": "road",
      "x": 53,
      "y": 31,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "falls-pool-1",
        "name": "벤치",
        "x": 52,
        "y": 33,
        "purpose": "폭포를 바라보며 쉬는 자리"
      },
      {
        "id": "falls-pool-2",
        "name": "낚시 바구니",
        "x": 54,
        "y": 35,
        "purpose": "폭포 아래 소에서 쓰는 낚시 바구니"
      }
    ]
  },
  {
    "id": "village-well",
    "name": "아랫마을 공동 우물",
    "anchor": {
      "type": "road",
      "x": 40,
      "y": 44,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "village-well-1",
        "name": "낮은 돌 우물",
        "x": 37,
        "y": 41,
        "purpose": "아랫마을 주민의 급수"
      },
      {
        "id": "village-well-2",
        "name": "항아리",
        "x": 35,
        "y": 41,
        "purpose": "길어 온 물을 담는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "village-well-3",
        "name": "게시판",
        "x": 43,
        "y": 41,
        "purpose": "교회 소식과 마을 공지를 붙이는 판"
      }
    ]
  },
  {
    "id": "entry-sign",
    "name": "남쪽 입구 길잡이",
    "anchor": {
      "type": "road",
      "x": 40,
      "y": 60,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-sign-1",
        "name": "나무 이정표",
        "x": 38,
        "y": 58,
        "purpose": "교회로 오르는 길 안내"
      }
    ]
  },
  {
    "id": "stair-sign",
    "name": "계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 40,
      "y": 28,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "stair-sign-1",
        "name": "나무 이정표",
        "x": 38,
        "y": 29,
        "purpose": "언덕 위 교회로 오르는 계단 안내"
      }
    ]
  }
]
```
