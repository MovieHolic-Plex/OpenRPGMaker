# 배 실내 — 선실과 화물칸

easyrpg_chipset_ship(30열·16px). 공용 장소 「푸른물결호 · 가로 갑판」과 같은 시트다. 이 시트는 EasyRPG 실내 칩셋과 **천장 배치가 같다**: 공허 430, 테두리 371·399~401·429·431·459~461이 같은 번호에 나무 테두리로 그려져 있다. 그래서 벽을 손으로 쌓지 않고 집 실내 껍데기를 그대로 쓴 뒤 벽면과 바닥만 바꾼다.

## 조립
1. interiorRoomPipeline plan→floor→walls로 껍데기(칸막이 방은 rooms + innerDoors).
2. 벽면 다시 가리키기: 윗줄 74·75·76 → 둥근 창 벽 104·105·106, 아랫줄 104·105·106 → 선체 판벽 134·135·136. 바닥 72 → 목재 갑판 279.
3. 남쪽 문은 천장으로 되메우고, 갑판에서 내려오는 사다리 22|23(두 칸 폭)을 벽면 두 줄에 놓는다(아래층, 통행).
4. 배 시트의 소품은 위층: 침대 416/446(세로), 책장 384·책 선반 414, 해도 그림 388/389, 엇갈린 검 295, 그림 358/359, 둥근 탁자 387·걸상 417, 오크통 385, 항아리 386, 밧줄 263, 닻 259, 대포 324/325, 랜턴 119, 물약 선반 148, 환기 격자창 202, 급수 펌프 72/73/102/103(아래층).
5. 시트에 없는 상자·자루·궤짝은 Tibo 조립을 이 시트 480번 뒤로 이식해 찍는다. 통행·우선순위는 Tibo 원본 칸을 따른다.
6. transparentColor "#ff678b" 필수 — 번들 그림의 일부 소품 칸에 분홍 색키가 남아 있다(갑판 저장본과 같다).

## 이식표
```json
[
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 837,
    "targetTile": 480
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1253,
    "targetTile": 481
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1249,
    "targetTile": 482
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1279,
    "targetTile": 483
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1356,
    "targetTile": 484
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1386,
    "targetTile": 485
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1353,
    "targetTile": 486
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1821,
    "targetTile": 487
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1822,
    "targetTile": 488
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1823,
    "targetTile": 489
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1851,
    "targetTile": 490
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1852,
    "targetTile": 491
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1853,
    "targetTile": 492
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 767,
    "targetTile": 493
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 768,
    "targetTile": 494
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1352,
    "targetTile": 495
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1382,
    "targetTile": 496
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1057,
    "targetTile": 497
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1058,
    "targetTile": 498
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1087,
    "targetTile": 499
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1088,
    "targetTile": 500
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1247,
    "targetTile": 501
  }
]
```


## 검사
```bash
node scripts/content/author-rpg-interiors.mjs   # 저작 + 통행 검사(막힌 목표·갇힌 바닥이 있으면 멈춤)
```

```json
[
  {
    "id": "interior-ship-cabin",
    "entry": [
      17,
      5
    ],
    "targets": [
      [
        6,
        6
      ],
      [
        9,
        8
      ],
      [
        12,
        7
      ],
      [
        16,
        8
      ]
    ],
    "reachable": 62,
    "walkable": 61,
    "blocked": []
  },
  {
    "id": "interior-ship-hold",
    "entry": [
      10,
      5
    ],
    "targets": [
      [
        11,
        9
      ],
      [
        3,
        7
      ],
      [
        18,
        8
      ]
    ],
    "reachable": 70,
    "walkable": 67,
    "blocked": []
  }
]
```

## 이 분류의 방
- 배 · 선실 (interior-ship-cabin, 21×13): 배의 갑판 아래 선실. 갑판에서 사다리로 내려오면 오른쪽 선원 침실(침상·짐통), 칸막이 문을 지나 왼쪽이 선장실(침대·책장·해도 그림·탁자).
- 배 · 화물칸 (interior-ship-hold, 22×14): 배 밑바닥 화물칸. 갑판에서 사다리로 내려오면 양옆으로 짐이 쌓여 있다 — 왼쪽 물·술 오크통과 예비 대포, 가운데 급수 펌프, 오른쪽 식량 자루·상자·소포.
