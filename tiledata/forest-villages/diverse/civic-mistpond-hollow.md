# 공동 공간과 정원의 배치(완성 맵 좌표)

개정14에서 우물가에 광장 소품(id …-plaza-N)을 더했다. civic-programs.json 은 압축 전 저작 입력이다.

```json
[
  {
    "id": "pond-gate",
    "name": "못 울타리 들머리",
    "anchor": {
      "type": "landmark",
      "id": "mistpond-hollow-shrine-pond",
      "maxDistance": 4
    },
    "items": [
      {
        "id": "pond-gate-1",
        "name": "흰 돌기둥",
        "x": 28,
        "y": 36,
        "purpose": "못 울타리 입구 서쪽 돌기둥"
      },
      {
        "id": "pond-gate-2",
        "name": "흰 돌기둥",
        "x": 34,
        "y": 36,
        "purpose": "못 울타리 입구 동쪽 돌기둥",
        "near": "흰 돌기둥"
      },
      {
        "id": "pond-gate-3",
        "name": "돌등",
        "x": 26,
        "y": 37,
        "purpose": "꺼진 채 남은 입구 등"
      }
    ],
    "site": {
      "x": 24,
      "y": 24,
      "w": 15,
      "h": 12,
      "layer": "lower"
    }
  },
  {
    "id": "pond-offering",
    "name": "못가 제물 자리",
    "anchor": {
      "type": "landmark",
      "id": "mistpond-hollow-shrine-pond",
      "maxDistance": 6
    },
    "items": [
      {
        "id": "pond-offering-1",
        "name": "벤치",
        "x": 40,
        "y": 31,
        "purpose": "못지기가 석상을 바라보며 앉는 자리"
      },
      {
        "id": "pond-offering-2",
        "name": "꽃 화단",
        "x": 39,
        "y": 28,
        "purpose": "석상에 바칠 꽃을 기르는 화단"
      }
    ],
    "site": {
      "x": 24,
      "y": 24,
      "w": 15,
      "h": 12,
      "layer": "lower"
    }
  },
  {
    "id": "grave-edge",
    "name": "잊힌 묘지 가장자리",
    "anchor": {
      "type": "landmark",
      "id": "mistpond-hollow-graveyard-small",
      "maxDistance": 5
    },
    "items": [
      {
        "id": "grave-edge-2",
        "name": "해골",
        "x": 60,
        "y": 31,
        "purpose": "묘지 밖에 굴러 나온 해골"
      },
      {
        "id": "grave-edge-3",
        "name": "돌 오벨리스크",
        "x": 52,
        "y": 31,
        "purpose": "마을이 비기 전 세운 위령비"
      }
    ],
    "site": {
      "x": 53,
      "y": 28,
      "w": 7,
      "h": 6,
      "layer": "lower"
    }
  },
  {
    "id": "dead-well",
    "name": "말라 버린 우물",
    "anchor": {
      "type": "road",
      "x": 31,
      "y": 39,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "dead-well-1",
        "name": "낮은 돌 우물",
        "x": 27,
        "y": 41,
        "purpose": "물이 끊긴 옛 공동 우물"
      },
      {
        "id": "dead-well-2",
        "name": "부서진 울타리",
        "x": 25,
        "y": 41,
        "purpose": "무너진 우물가 울타리",
        "near": "낮은 돌 우물"
      },
      {
        "id": "dead-well-plaza-1",
        "name": "돌등",
        "x": 30,
        "y": 41,
        "purpose": "밤에 우물가를 밝히는 돌등",
        "near": "낮은 돌 우물"
      }
    ],
    "site": {
      "x": 31,
      "y": 39,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  },
  {
    "id": "falls-lookout",
    "name": "폭포 아래 옛 빨래터",
    "anchor": {
      "type": "road",
      "x": 17,
      "y": 32,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "falls-lookout-1",
        "name": "항아리",
        "x": 14,
        "y": 27,
        "purpose": "빨래터에 버려진 물항아리"
      }
    ],
    "site": {
      "x": 17,
      "y": 32,
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
      "x": 31,
      "y": 52,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "entry-sign-1",
        "name": "나무 이정표",
        "x": 29,
        "y": 50,
        "purpose": "글씨가 바랜 마을 이정표"
      }
    ],
    "site": {
      "x": 31,
      "y": 52,
      "w": 1,
      "h": 1,
      "layer": "lower"
    }
  }
]
```
