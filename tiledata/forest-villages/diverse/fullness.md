# 마을 채우기 (개정14) — 빈 띠 걷기와 생활 소품

마을이 비어 보이는 가장 큰 이유는 맵이 크고 집 사이가 넓은 것이다. 플레이어는 한 번에 17×13칸만 본다. 그 한 화면에 집 하나와 그 마당, 길, 숲 가장자리가 함께 들어와야 마을로 읽힌다. 개정14는 사용자가 승인한 시안 B(압축 + 소품)를 일곱 마을과 큰 항구 마을 「너울목」에 적용했다. 실행: `node scripts/content/fill-diverse-villages.mjs <개정13 catalog> <out> --add=<author-harbor-town.mjs 출력>`.

2026-09-24 사용자 전체 검수(「뜬금없는 소재가 뜬금없는 곳에 있는 건 싫다」「항구의 끝인가? 배는?」)를 반영한 규칙이 아래 0·4b·4c·4d·5에 있다.

## 순서
0. **잔디 마감(crest) 없음.** 평평한 잔디 위 504/559/505 사선 줄(2692~2694)은 덜 깔린 칸처럼 옅은 사다리꼴·사선으로 보였다. 모두 바닥240으로 되돌리고 plan.crest=null, grassJoins=[] 로 둔다.
1. **생활 마당.** 집마다 지정한 활동(prop-programs.json activities)이 3~5개 부품 묶음이 된다. 약초집=약초 화분·씨앗 자루·작업대·항아리, 빨래집=빨랫줄·헹굼 통·항아리, 목수=작업대·장작·통나무·상자·통, 창고=상자·통·오크통·과일 상자·술통, 텃밭=채소밭·허수아비·씨앗 자루·울타리, 기존 밭 돌보기=허수아비·씨앗 자루·상자, 어업=낚시 바구니·통·상자·항아리(부두 12칸 안), 폐가=마른 묘목·부서진 울타리·통나무. 자리가 없으면 fallbacks 순서로 줄인다(목적은 같다).
2. **현관 꽃.** 폐가가 아닌 집의 문 양옆에 꽃 화단(2×2) 또는 화분(1×2)을 하나씩. 아래 칸은 문 앞 줄에 서고, 두 칸짜리는 윗칸이 집 벽 밑단에 겹친다. 문 앞 칸(통로)과 길은 비운다. 검사 코드 `doorway-flank-misplaced`.
3. **우물가 광장.** 마을 한가운데 우물(낮은 돌 우물)에서 한 칸 띄워 벤치·꽃 화단·돌등·화분을 서로 한 칸씩 떨어뜨려 둔다(fullness-programs.json plaza). 폐촌은 돌등·마른 묘목·통나무. 각 소품은 공동 공간 문서의 그 우물 장소(civicPlaces)에 `…-plaza-N` 으로 들어가고 사용칸(civic-use)이 접근칸에 더해진다.
4. **빈 띠 걷기(압축).** 물체를 아는 이음매 깎기(lib/village-compact.mjs). 이음매는 행마다(세로) 또는 열마다(가로) 한 칸씩, 이웃 행과 최대 한 칸만 비껴 가며 잔디·숲 수관·길·넓은 물에서만 비스듬히 움직인다. 집·랜드마크·소품·마당·접근칸·계단·폭포·다리는 자르지 않고 통째로 옮긴다. 절벽 열은 옆 열과 똑같을 때만 세로로 걷고(높이는 그대로), 길은 양옆이 길일 때, 물은 양쪽 두 칸까지 물일 때만(폭4 강은 좁아지지 않는다) 걷는다. 이음매 하나를 걷을 때마다 길·물 오토타일과 수관·줄기 재맞춤을 해 본 뒤, 모든 문 앞·계단 끝·다리목·마당 입구·공동 소품 사용칸이 시작점에서 닿는지, 계단을 막으면 윗단에 못 가는지 확인하고 아니면 되돌린다. 계획의 모든 좌표(집·문·랜드마크·절벽 윤곽·계단·접근칸·길 칸·공동 장소)는 새 맵으로 옮겨 적는다.
   - 4b. **폭포 아래 소(lib/village-pools.mjs).** 정수 타원 웅덩이는 호수 오토타일로 십자 모양이 됐다. 중심을 물길에서 비껴 두고 반지름이 각도마다 흔들리는 비대칭 덩이로 다시 그린다. 폭포 바로 밑 칸과 다리 칸(그 좌우 한 칸)과 물길 행만 고정하고, 한 칸 폭 팔·돌기·한 칸 홈은 없앤다. 길·문 앞·물체 둘레는 물이 되지 않는다.
   - 4c. **주인 없는 소품 제거(lib/village-ownership.mjs).** 모든 생활·공동 소품은 2칸 안에 이유가 있어야 한다: 집 문·집, 밭, 부두, 랜드마크, 중심 소품(우물·모닥불·장터 노점·덩굴 아치·오벨리스크). 표지판·이정표·우편함은 길 한 칸 안, 게시판은 길 한 칸 안이나 장터 노점·우물 2칸 안, 벤치는 중심 소품 2칸 안·물가·랜드마크 옆(길가라는 이유만으로는 안 된다), 돌등은 길가·우물 옆·랜드마크 옆, 허수아비는 밭 한 칸 안, 낚시 바구니는 물가·부두. 같은 집·같은 장소의 묶음은 한 칸 띄워 놓이므로 2칸 안의 짝이 주인이 있으면 함께 주인이 있다. 이유가 없으면 지우고, 그것을 짝(near)이나 기준으로 삼던 소품도 연쇄로 지운다. 결과는 fullness.unownedRemoved.
   - 4d. **항구(lib/village-harbor.mjs).** 부두 판자는 끝이 있어야 한다: 바다 쪽 끝 양옆 물에 나룻배(8×4, LPC CC-BY-SA)를 한 칸 띄워 대고, 판자 가장자리 물 칸에 계류 말뚝을 4칸 간격으로, 부두 뿌리 땅에 밧줄·닻·오크통·상자·열린 통을 붙여 한 덩이로 모은다(EasyRPG 배 칩셋 CC0). 조각은 `tex_harbor_kit`(public/assets/harbor-kit)을 빈 칸 2657~2669·2695~2699·2703~2729 에 이식한다. `ensureHarborGrafts(tileset)` + `placeHarbor({map, dock, …})` 로 다른 숲마을 맵에서도 쓴다.
5. **바닥 변화.** 곧은 숲 가장자리 앞에 나무 2~5그루 덩이. 원래 맵에 혼자 있던 덤불(2칸 안에 다른 식물이 없는 둥근·작은 덤불)은 흩뿌린 점으로 보이므로 걷어 낸다. 그다음 빈칸 게이트(한 변 5칸 정사각형 없음, 17×13 화면 빈 잔디 40% 이하 — 여유를 두고 39%까지)를 통과할 때까지 **덩이 장면**을 하나씩 놓는다(fillNaturalGaps): 나무 덩이·나무 두 그루·나무와 덤불·덤불숲·꽃 핀 덤불숲·작은 덤불숲·바위와 덤불·**풀숲**, 좁은 자리에만 꽃 핀 둥근 덤불. 낱개 꽃·낱개 덤불은 놓지 않는다(점 뿌리기 금지). 꽃은 장면에 붙은 한 줄로만 핀다.
   - **풀숲 = 키큰 풀 E/F/G(PR #1421).** 10~20칸 덩이를 기르고 2×2 블록 안 칸만 남긴 뒤 `lib/tall-grass.mjs arrangeTallGrass` 로 맵 전체 키큰 풀을 다시 깐다: 2×2 미만 조각 삭제, 곧은 볼록 모서리 해시로 깎기, 덩이마다 한 종류 — 수관 1칸 안이면 E(짙음 243~335), 집·길 3칸 안이면 G(짧음 1128~1190), 나머지 F(밝음 1124~1186). 칸은 그 종류 variantMap 으로 고른다(무작위 칸 금지). 덩이끼리는 한 칸 띄운다. 결과 칸 수는 fullness.tallGrass {E,F,G}.
   - 어떤 바닥 조각도 걸어갈 수 있던 땅을 고립시키지 않는다(고립 칸 수가 늘면 되돌림).

## 지키는 것
- 절벽 높이, 계단 폭·높이, 강 폭, 집·랜드마크 그림은 그대로다. 윗단은 여전히 계단으로만 오른다.
- 모든 소품은 완전한 부품이고 소유자·목적·기준 대상이 있다(생활 마당·공동 공간 문서의 검사 그대로).
- 수관은 줄기를 밑변과 같은 폭으로 다시 맞춘 뒤 속을 깊이별 잎으로 채운다(숲·가구 문서).
- 걷을 수 있는 띠가 없으면 목표 크기 전에 멈춘다. 성·세 줄 절벽처럼 가로지르는 구조가 많은 마을은 덜 줄어든다.
- 큰 배(EasyRPG 배 칩셋의 갑판 맵)는 위에서 걸어 다니는 갑판 그림이라 숲마을 바깥 풍경의 배로 쓰지 않는다. 항구는 나룻배를 댄다.

## 마을별 결과
```json
[
  {
    "id": "pine-hamlets",
    "before": {
      "width": 80,
      "height": 64
    },
    "after": {
      "width": 61,
      "height": 53
    },
    "removed": {
      "columns": 19,
      "rows": 11,
      "rejected": 1
    },
    "yards": 7,
    "yardProps": 28,
    "doorFlanks": 8,
    "plaza": [
      "벤치",
      "화분"
    ],
    "treeClumps": 0,
    "tallGrass": {
      "E": 31,
      "F": 0,
      "G": 184
    },
    "pools": [],
    "unownedRemoved": 7,
    "loneBushesRemoved": 5,
    "harbor": 0,
    "scenes": 17,
    "emptiness": {
      "beforeGapFill": {
        "maxSq": 6,
        "screen": 0.593
      },
      "after": {
        "maxSq": 4,
        "screen": 0.389
      }
    }
  },
  {
    "id": "terrace-cliff-village",
    "before": {
      "width": 88,
      "height": 72
    },
    "after": {
      "width": 62,
      "height": 60
    },
    "removed": {
      "columns": 26,
      "rows": 12,
      "rejected": 0
    },
    "yards": 7,
    "yardProps": 28,
    "doorFlanks": 9,
    "plaza": [
      "벤치",
      "돌등",
      "화분"
    ],
    "treeClumps": 0,
    "tallGrass": {
      "E": 17,
      "F": 10,
      "G": 164
    },
    "pools": [],
    "unownedRemoved": 6,
    "loneBushesRemoved": 1,
    "harbor": 0,
    "scenes": 18,
    "emptiness": {
      "beforeGapFill": {
        "maxSq": 7,
        "screen": 0.638
      },
      "after": {
        "maxSq": 4,
        "screen": 0.38
      }
    }
  },
  {
    "id": "twin-falls-river-village",
    "before": {
      "width": 88,
      "height": 72
    },
    "after": {
      "width": 62,
      "height": 65
    },
    "removed": {
      "columns": 26,
      "rows": 7,
      "rejected": 2
    },
    "yards": 6,
    "yardProps": 24,
    "doorFlanks": 11,
    "plaza": [
      "돌등"
    ],
    "treeClumps": 0,
    "tallGrass": {
      "E": 0,
      "F": 0,
      "G": 152
    },
    "pools": [
      {
        "pool": [
          34,
          24,
          5.5,
          3.2
        ],
        "added": 10,
        "dried": 3
      },
      {
        "pool": [
          32,
          47,
          6,
          3.4
        ],
        "added": 11,
        "dried": 7
      }
    ],
    "unownedRemoved": 5,
    "loneBushesRemoved": 5,
    "harbor": 0,
    "scenes": 12,
    "emptiness": {
      "beforeGapFill": {
        "maxSq": 6,
        "screen": 0.561
      },
      "after": {
        "maxSq": 4,
        "screen": 0.385
      }
    }
  },
  {
    "id": "reed-bay-village",
    "before": {
      "width": 88,
      "height": 64
    },
    "after": {
      "width": 71,
      "height": 52
    },
    "removed": {
      "columns": 17,
      "rows": 12,
      "rejected": 3
    },
    "yards": 6,
    "yardProps": 19,
    "doorFlanks": 8,
    "plaza": [
      "벤치",
      "돌등"
    ],
    "treeClumps": 0,
    "tallGrass": {
      "E": 46,
      "F": 10,
      "G": 172
    },
    "pools": [],
    "unownedRemoved": 17,
    "loneBushesRemoved": 5,
    "harbor": 14,
    "scenes": 26,
    "emptiness": {
      "beforeGapFill": {
        "maxSq": 9,
        "screen": 0.67
      },
      "after": {
        "maxSq": 4,
        "screen": 0.385
      }
    }
  },
  {
    "id": "chapel-hill-parish",
    "before": {
      "width": 80,
      "height": 64
    },
    "after": {
      "width": 57,
      "height": 54
    },
    "removed": {
      "columns": 23,
      "rows": 10,
      "rejected": 0
    },
    "yards": 6,
    "yardProps": 24,
    "doorFlanks": 9,
    "plaza": [
      "벤치",
      "꽃 화단"
    ],
    "treeClumps": 0,
    "tallGrass": {
      "E": 0,
      "F": 17,
      "G": 126
    },
    "pools": [
      {
        "pool": [
          43,
          25,
          5,
          3
        ],
        "added": 4,
        "dried": 4
      }
    ],
    "unownedRemoved": 4,
    "loneBushesRemoved": 1,
    "harbor": 0,
    "scenes": 11,
    "emptiness": {
      "beforeGapFill": {
        "maxSq": 5,
        "screen": 0.584
      },
      "after": {
        "maxSq": 4,
        "screen": 0.38
      }
    }
  },
  {
    "id": "ford-castle-town",
    "before": {
      "width": 100,
      "height": 92
    },
    "after": {
      "width": 80,
      "height": 87
    },
    "removed": {
      "columns": 20,
      "rows": 5,
      "rejected": 2
    },
    "yards": 8,
    "yardProps": 30,
    "doorFlanks": 13,
    "plaza": [
      "벤치",
      "꽃 화단",
      "벤치"
    ],
    "treeClumps": 1,
    "tallGrass": {
      "E": 50,
      "F": 22,
      "G": 324
    },
    "pools": [
      {
        "pool": [
          69,
          51,
          5,
          3
        ],
        "added": 4,
        "dried": 2
      },
      {
        "pool": [
          68,
          74,
          5.5,
          3.2
        ],
        "added": 6,
        "dried": 9
      }
    ],
    "unownedRemoved": 3,
    "loneBushesRemoved": 5,
    "harbor": 0,
    "scenes": 34,
    "emptiness": {
      "beforeGapFill": {
        "maxSq": 8,
        "screen": 0.683
      },
      "after": {
        "maxSq": 4,
        "screen": 0.385
      }
    }
  },
  {
    "id": "mistpond-hollow",
    "before": {
      "width": 80,
      "height": 64
    },
    "after": {
      "width": 66,
      "height": 56
    },
    "removed": {
      "columns": 14,
      "rows": 8,
      "rejected": 3
    },
    "yards": 6,
    "yardProps": 18,
    "doorFlanks": 1,
    "plaza": [
      "돌등",
      "마른 묘목"
    ],
    "treeClumps": 0,
    "tallGrass": {
      "E": 12,
      "F": 10,
      "G": 179
    },
    "pools": [
      {
        "pool": [
          10,
          22,
          4.5,
          2.8
        ],
        "added": 1,
        "dried": 4
      }
    ],
    "unownedRemoved": 3,
    "loneBushesRemoved": 4,
    "harbor": 0,
    "scenes": 20,
    "emptiness": {
      "beforeGapFill": {
        "maxSq": 7,
        "screen": 0.588
      },
      "after": {
        "maxSq": 4,
        "screen": 0.38
      }
    }
  },
  {
    "id": "nuleolmok-harbor-town",
    "before": {
      "width": 80,
      "height": 64
    },
    "after": {
      "width": 76,
      "height": 60
    },
    "removed": {
      "columns": 4,
      "rows": 4,
      "rejected": 0
    },
    "yards": 9,
    "yardProps": 28,
    "doorFlanks": 9,
    "plaza": [
      "벤치",
      "꽃 화단",
      "돌등"
    ],
    "treeClumps": 0,
    "tallGrass": {
      "E": 15,
      "F": 17,
      "G": 310
    },
    "pools": [
      {
        "pool": [
          37,
          27,
          4.5,
          2.5
        ],
        "added": 5,
        "dried": 6
      }
    ],
    "unownedRemoved": 0,
    "loneBushesRemoved": 0,
    "harbor": 9,
    "scenes": 29,
    "emptiness": {
      "beforeGapFill": {
        "maxSq": 10,
        "screen": 0.647
      },
      "after": {
        "maxSq": 4,
        "screen": 0.38
      }
    }
  }
]
```

## 입력
```json
{
  "note": "개정14 · 마을 채우기(B = 압축 + 소품). 사용자가 승인한 시안 claude-viz/village-fullness.html 의 B 를 실제 맵에 적용한다. targets 는 빈 띠를 걷어 낼 목표 크기(폭, 높이)로, 걷을 수 있는 띠가 없으면 그 전에 멈춘다. plaza 는 우물(center)을 둘러쌀 공동 소품, ground 는 숲 가 풀숲 덩이(삐죽한 7~16칸)·세 개 묶음 들꽃(서로 6칸 이상 떨어짐)·나무 덩이 수. 남는 빈 땅은 빈칸 게이트(한 변 5칸 정사각형 없음, 17×13 화면 빈 땅 40% 이하)를 통과할 때까지 삐죽한 풀숲 덩이로 채운다.",
  "villages": {
    "pine-hamlets": {
      "target": [
        56,
        50
      ],
      "plaza": {
        "zone": "well",
        "center": "낮은 돌 우물",
        "items": [
          "벤치",
          "꽃 화단",
          "벤치",
          "화분"
        ]
      },
      "grass": 8,
      "wild": 7,
      "trees": 4
    },
    "terrace-cliff-village": {
      "target": [
        62,
        56
      ],
      "plaza": {
        "zone": "well",
        "center": "낮은 돌 우물",
        "items": [
          "벤치",
          "돌등",
          "화분"
        ]
      },
      "grass": 8,
      "wild": 7,
      "trees": 4
    },
    "twin-falls-river-village": {
      "target": [
        62,
        56
      ],
      "plaza": {
        "zone": "well",
        "center": "낮은 돌 우물",
        "items": [
          "벤치",
          "꽃 화단",
          "돌등",
          "벤치"
        ]
      },
      "grass": 8,
      "wild": 7,
      "trees": 4
    },
    "reed-bay-village": {
      "target": [
        62,
        50
      ],
      "plaza": {
        "zone": "well",
        "center": "낮은 돌 우물",
        "items": [
          "벤치",
          "꽃 화단",
          "돌등"
        ]
      },
      "grass": 8,
      "wild": 6,
      "trees": 3
    },
    "chapel-hill-parish": {
      "target": [
        56,
        50
      ],
      "plaza": {
        "zone": "village-well",
        "center": "낮은 돌 우물",
        "items": [
          "벤치",
          "꽃 화단",
          "돌등",
          "벤치",
          "화분"
        ]
      },
      "grass": 8,
      "wild": 6,
      "trees": 4
    },
    "ford-castle-town": {
      "target": [
        70,
        72
      ],
      "plaza": {
        "zone": "mid-market",
        "center": "낮은 돌 우물",
        "items": [
          "벤치",
          "꽃 화단",
          "돌등",
          "벤치"
        ]
      },
      "grass": 14,
      "wild": 12,
      "trees": 5
    },
    "mistpond-hollow": {
      "target": [
        56,
        50
      ],
      "plaza": {
        "zone": "dead-well",
        "center": "낮은 돌 우물",
        "items": [
          "돌등",
          "마른 묘목",
          "통나무 더미"
        ]
      },
      "grass": 10,
      "wild": 5,
      "trees": 3
    },
    "nuleolmok-harbor-town": {
      "target": [
        76,
        60
      ],
      "plaza": {
        "zone": "well",
        "center": "낮은 돌 우물",
        "items": [
          "벤치",
          "꽃 화단",
          "돌등"
        ]
      },
      "grass": 10,
      "wild": 10,
      "trees": 4
    }
  }
}
```
