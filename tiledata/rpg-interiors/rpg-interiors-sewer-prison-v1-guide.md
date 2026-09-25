# 지하 하수 감옥 — 던전 시트 조립

타일셋은 oprn_dungeon_stone = 번들 던전 시트(easyrpg_chipset_dungeon, 30열·16px) 번호 그대로 + 480~488 이식(보물상자 480·광차 481/482 Tibo, 돌계단 483~485·흉벽 486~488 EasyRPG 마을). 공용 「RPG 던전」 분류의 지하 수로·납골당과 같은 조립이다(scripts/content/rpg-dungeons/kit.mjs, theme "stone").

## 벽 조립 (손으로 쌓지 않는다)
- 바깥은 공허 430과 abyss-gray 오토타일 테두리. 열린 칸 중 위가 공허인 첫 두 줄이 벽면: 윗줄 21|22|23, 아랫줄 51|52|53(왼끝·가운데·오른끝). 바닥은 회녹색 돌 187.
- 감방 칸막이는 공허 기둥(1칸 폭, 벽면까지 세로로)이다. 기둥 밑 첫 두 줄은 저절로 벽면 토막이 된다.
- 감방 앞 창살은 바닥 한 줄 위층: 왼끝 234, 가운데 235, 오른끝 236, 감방 문 205(창살 문, 닫힘). 감방 안은 일부러 못 들어가는 곳(sealed) — 통행 검사에서 뺀다. 감방 바닥은 흙 오토타일(dirt).
- 물길: 물 3(4칸 폭)을 맵 남쪽 끝까지 이어 흘러 나가게 한다(물길 끝을 막힌 네모 수조로 만들지 않는다). 가로지르는 판자 다리는 물 위에 141(위층)을 얹어 물이 한 덩어리로 남게 한다. 북쪽 끝 수문 창살 234|235|235|236은 물길 바로 위 바닥 줄.
- 위층에서 내려오는 돌계단 483|484|485는 벽면 두 줄에 새긴다(아래층, "^" 조각). 입구는 그 바로 아래 바닥.
- 조각: 화로 263/293, 석주 446/476, 침상 384/414, 해골과 뼈 299, 물통 419, 나무통 417, 항아리 418, 긴 탁자 385~387, 의자 327(왼쪽 보기)/328(오른쪽 보기), 둥근 탁자 326, 걸상 356, 책장 329/359, 이끼 394, 자갈 382·잔돌 383/412·돌무더기 259/260, 벽 균열 267·268/269, 붉은 카펫 오토타일(간수실 탁자 밑).

## 배치 규칙
- 감방마다 침상·해골·물통 중 둘 정도 — 누가 갇혀 있는지 보이게. 복도는 감방 앞 한 줄(창살 앞)을 비워 간수가 오간다.
- 간수실은 감방 옆에: 탁자와 양쪽 의자, 침대, 압수품 상자, 나무통.
- 둑길 3칸 중 물가 쪽은 비우고, 벽 쪽에 석주·화로·나무통 무리. 잔해는 흩뿌리지 말고 모서리·벽 곁에 몰아 둔다.
- 빈칸 검사(/tmp/oprn-qa/emptiness.py --kind dungeon --plain 421,187,108,301,67,110,141): 맨바닥 정사각형 한 변 ≤4, 17×13 한 화면 ≤40%.

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
    "sourceTile": 1231,
    "targetTile": 481
  },
  {
    "sourceChipset": "tex_tibo_interior_expanded",
    "sourceTile": 1232,
    "targetTile": 482
  },
  {
    "sourceChipset": "tex_easyrpg_chipset_combined_town",
    "sourceTile": 111,
    "targetTile": 483
  },
  {
    "sourceChipset": "tex_easyrpg_chipset_combined_town",
    "sourceTile": 112,
    "targetTile": 484
  },
  {
    "sourceChipset": "tex_easyrpg_chipset_combined_town",
    "sourceTile": 113,
    "targetTile": 485
  },
  {
    "sourceChipset": "tex_easyrpg_chipset_combined_town",
    "sourceTile": 108,
    "targetTile": 486
  },
  {
    "sourceChipset": "tex_easyrpg_chipset_combined_town",
    "sourceTile": 109,
    "targetTile": 487
  },
  {
    "sourceChipset": "tex_easyrpg_chipset_combined_town",
    "sourceTile": 110,
    "targetTile": 488
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
    "id": "interior-sewer-prison",
    "entry": [
      14,
      4
    ],
    "targets": [
      [
        2,
        9
      ],
      [
        6,
        9
      ],
      [
        10,
        9
      ],
      [
        26,
        9
      ],
      [
        32,
        9
      ],
      [
        28,
        13
      ],
      [
        14,
        20
      ],
      [
        21,
        12
      ]
    ],
    "reachable": 243,
    "walkable": 245,
    "blocked": []
  }
]
```

## 이 분류의 방
- 지하 하수 감옥 (interior-sewer-prison, 36×24): 성 아래 하수도에 딸린 감옥. 위층에서 돌계단으로 내려오면 창살 친 수문 앞, 가운데 하수 물길을 따라 양쪽 둑길이 남쪽으로 흘러 나간다. 서쪽 샛길로 가면 감방 셋, 동쪽 샛길로 가면 감방 둘과 간수가 먹고 자는 간수실. 죄수는 창살 뒤에 갇혀 있다(감방 안은 일부러 못 들어간다).
