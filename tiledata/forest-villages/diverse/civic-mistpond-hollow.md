# 공동 공간과 정원의 명시 배치 입력

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
        "x": 37,
        "y": 41,
        "purpose": "못 울타리 입구 서쪽 돌기둥"
      },
      {
        "id": "pond-gate-2",
        "name": "흰 돌기둥",
        "x": 43,
        "y": 41,
        "purpose": "못 울타리 입구 동쪽 돌기둥",
        "near": "흰 돌기둥"
      },
      {
        "id": "pond-gate-3",
        "name": "돌등",
        "x": 35,
        "y": 42,
        "purpose": "꺼진 채 남은 입구 등"
      }
    ]
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
        "x": 49,
        "y": 36,
        "purpose": "못지기가 석상을 바라보며 앉는 자리"
      },
      {
        "id": "pond-offering-2",
        "name": "꽃 화단",
        "x": 48,
        "y": 33,
        "purpose": "석상에 바칠 꽃을 기르는 화단"
      }
    ]
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
        "id": "grave-edge-1",
        "name": "마른 묘목",
        "x": 65,
        "y": 31,
        "purpose": "묘지 울타리 곁 말라 죽은 나무"
      },
      {
        "id": "grave-edge-2",
        "name": "해골",
        "x": 73,
        "y": 36,
        "purpose": "묘지 밖에 굴러 나온 해골"
      },
      {
        "id": "grave-edge-3",
        "name": "돌 오벨리스크",
        "x": 64,
        "y": 36,
        "purpose": "마을이 비기 전 세운 위령비"
      }
    ]
  },
  {
    "id": "dead-well",
    "name": "말라 버린 우물",
    "anchor": {
      "type": "road",
      "x": 40,
      "y": 44,
      "maxDistance": 8
    },
    "items": [
      {
        "id": "dead-well-1",
        "name": "낮은 돌 우물",
        "x": 36,
        "y": 46,
        "purpose": "물이 끊긴 옛 공동 우물"
      },
      {
        "id": "dead-well-2",
        "name": "부서진 울타리",
        "x": 34,
        "y": 46,
        "purpose": "무너진 우물가 울타리",
        "near": "낮은 돌 우물"
      },
      {
        "id": "dead-well-3",
        "name": "통나무 더미",
        "x": 38,
        "y": 49,
        "purpose": "썩어 가는 옛 땔감",
        "near": "낮은 돌 우물"
      }
    ]
  },
  {
    "id": "falls-lookout",
    "name": "폭포 아래 옛 빨래터",
    "anchor": {
      "type": "road",
      "x": 22,
      "y": 36,
      "maxDistance": 10
    },
    "items": [
      {
        "id": "falls-lookout-1",
        "name": "항아리",
        "x": 19,
        "y": 31,
        "purpose": "빨래터에 버려진 물항아리"
      },
      {
        "id": "falls-lookout-2",
        "name": "마른 묘목",
        "x": 20,
        "y": 40,
        "purpose": "물가에 선 마른 나무"
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
        "purpose": "글씨가 바랜 마을 이정표"
      }
    ]
  }
]
```
