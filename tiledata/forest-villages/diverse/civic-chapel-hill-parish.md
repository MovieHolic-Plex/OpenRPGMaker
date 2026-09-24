# 공동 공간과 정원의 배치(완성 맵 좌표)

개정14에서 우물가에 광장 소품(id …-plaza-N)을 더했다. civic-programs.json 은 압축 전 저작 입력이다.

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
        "id": "churchyard-2",
        "name": "벤치",
        "x": 22,
        "y": 12,
        "purpose": "교회 앞 동쪽 쉼 자리"
      },
      {
        "id": "churchyard-3",
        "name": "돌등",
        "x": 18,
        "y": 11,
        "purpose": "교회 문 서쪽을 밝히는 등"
      },
      {
        "id": "churchyard-4",
        "name": "돌등",
        "x": 21,
        "y": 15,
        "purpose": "교회 문 동쪽을 밝히는 등",
        "near": "돌등"
      },
      {
        "id": "churchyard-5",
        "name": "꽃 화단",
        "x": 24,
        "y": 6,
        "purpose": "교회 벽 옆 제단용 꽃밭"
      }
    ],
    "site": {
      "x": 16,
      "y": 2,
      "w": 7,
      "h": 9,
      "layer": "lower"
    }
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
        "id": "graveyard-gate-2",
        "name": "마른 묘목",
        "x": 10,
        "y": 11,
        "purpose": "묘지 울타리 곁 마른 나무"
      }
    ],
    "site": {
      "x": 2,
      "y": 4,
      "w": 9,
      "h": 7,
      "layer": "lower"
    }
  },
  {
    "id": "falls-pool",
    "name": "폭포 아래 소",
    "anchor": {
      "type": "road",
      "x": 37,
      "y": 26,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "falls-pool-2",
        "name": "낚시 바구니",
        "x": 38,
        "y": 30,
        "purpose": "폭포 아래 소에서 쓰는 낚시 바구니"
      }
    ],
    "site": {
      "x": 37,
      "y": 26,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "village-well",
    "name": "아랫마을 공동 우물",
    "anchor": {
      "type": "road",
      "x": 25,
      "y": 39,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "village-well-1",
        "name": "낮은 돌 우물",
        "x": 23,
        "y": 36,
        "purpose": "아랫마을 주민의 급수"
      },
      {
        "id": "village-well-2",
        "name": "항아리",
        "x": 21,
        "y": 36,
        "purpose": "길어 온 물을 담는 용기",
        "near": "낮은 돌 우물"
      },
      {
        "id": "village-well-plaza-1",
        "name": "벤치",
        "x": 22,
        "y": 34,
        "purpose": "우물가에 앉아 쉬는 자리",
        "near": "낮은 돌 우물"
      },
      {
        "id": "village-well-plaza-2",
        "name": "꽃 화단",
        "x": 23,
        "y": 32,
        "purpose": "마을 한가운데를 꾸미는 화단",
        "near": "낮은 돌 우물"
      }
    ],
    "site": {
      "x": 25,
      "y": 39,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "entry-sign",
    "name": "남쪽 입구 길잡이",
    "anchor": {
      "type": "road",
      "x": 25,
      "y": 50,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-sign-1",
        "name": "나무 이정표",
        "x": 23,
        "y": 48,
        "purpose": "교회로 오르는 길 안내"
      }
    ],
    "site": {
      "x": 25,
      "y": 50,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "stair-sign",
    "name": "계단 아래 길잡이",
    "anchor": {
      "type": "road",
      "x": 25,
      "y": 23,
      "maxDistance": 10
    },
    "items": [],
    "site": {
      "x": 25,
      "y": 23,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  }
]
```
