# 기존 레이어 설명 정정

아래 99개 항목은 이 공용 커스텀 타일셋의 실제 priority와 일치하도록 group.defaultLayer / tileMeta.defaultLayer 설명을 정정했다. 게임 priority 자체를 일괄 변경하지 않았다. 예전 문서의 “줄기 시작은 잎과 같은 행”도 폐기하고 정확한 두 레이어 배열로 대체했다. 이식된 동굴893의 backing=652는 명시적 새 합성 정의다.

```json
{
  "layerAnnotations": [
    {
      "scope": "group",
      "id": "harness-combined-town-fence",
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-windows",
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-bush-props",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-flower-props",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-branch-props",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-bench-horizontal",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-bench-vertical",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-table-horizontal",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-table-vertical",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-table-chairs",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-free-chairs",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-house-yard-props",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-cemetery-props",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-wall-ladder",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-fruit-box",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-wood-box",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-market-rail-upper",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-stone-step-slab",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-magic-circle",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-barrel-prop",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-plaza-statue",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-plaza-pillar",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-village-well",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "harness-combined-town-small-props",
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "group",
      "id": "forest-trees:round-bush",
      "before": "mixed",
      "after": "lower"
    },
    {
      "scope": "group",
      "id": "forest-trees:dark-bush",
      "before": "mixed",
      "after": "lower"
    },
    {
      "scope": "group",
      "id": "forest-trees:small-bush",
      "before": "mixed",
      "after": "lower"
    },
    {
      "scope": "group",
      "id": "forest-enclosure:북서쪽 굽은 숲",
      "before": "lower",
      "after": "mixed"
    },
    {
      "scope": "group",
      "id": "forest-enclosure:북동쪽 감싸는 숲",
      "before": "lower",
      "after": "mixed"
    },
    {
      "scope": "group",
      "id": "forest-diagonal:2",
      "before": "lower",
      "after": "mixed"
    },
    {
      "scope": "group",
      "id": "forest-diagonal:3",
      "before": "lower",
      "after": "mixed"
    },
    {
      "scope": "group",
      "id": "forest-trunk-assembly:3",
      "before": "lower",
      "after": "mixed"
    },
    {
      "scope": "group",
      "id": "forest-dark-seams:3",
      "before": "lower",
      "after": "mixed"
    },
    {
      "scope": "tile",
      "id": 85,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 87,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 144,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 147,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 148,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 174,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 175,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 176,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 177,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 202,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 203,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 204,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 205,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 206,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 207,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 231,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 234,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 235,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 236,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 237,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 259,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 260,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 261,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 262,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 263,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 266,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 267,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 268,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 288,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 289,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 290,
      "before": "mixed",
      "after": "lower"
    },
    {
      "scope": "tile",
      "id": 291,
      "before": "mixed",
      "after": "lower"
    },
    {
      "scope": "tile",
      "id": 292,
      "before": "mixed",
      "after": "lower"
    },
    {
      "scope": "tile",
      "id": 293,
      "before": "mixed",
      "after": "lower"
    },
    {
      "scope": "tile",
      "id": 296,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 297,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 318,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 319,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 320,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 322,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 323,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 327,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 328,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 348,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 349,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 350,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 351,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 352,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 353,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 358,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 378,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 379,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 380,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 381,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 382,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 383,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 388,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 408,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 409,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 410,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 438,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 439,
      "before": "lower",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 440,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 468,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 469,
      "before": "mixed",
      "after": "upper"
    },
    {
      "scope": "tile",
      "id": 470,
      "before": "mixed",
      "after": "upper"
    }
  ],
  "proseCorrections": [
    {
      "id": "forest-trees:round-bush",
      "before": {
        "description": "사용자 제공 숲 시트에서 옮긴 둥근 덤불(3×3 칸). 수관은 상위, 밑동은 하위+잔디 받침.",
        "placementRules": "물체 전체를 한 덩이로 찍는다 — 수관 칸은 상위 레이어, 밑동·덤불 칸은 하위 레이어(통행 불가). 잔디 위에만 놓는다."
      },
      "after": {
        "description": "사용자 제공 숲 시트에서 옮긴 둥근 덤불(3×3 칸). 이 덤불은 그림 조각 전부가 하위이며 상위 배열은 -1이다.",
        "placementRules": "previewMap의 전체 하위 배열을 온전하게 배치한다. 상위 칸은 -1이며, 받침은 타일별 layerBacking 정책을 따른다."
      }
    },
    {
      "id": "forest-trees:dark-bush",
      "before": {
        "description": "사용자 제공 숲 시트에서 옮긴 짙은 덤불(3×3 칸). 수관은 상위, 밑동은 하위+잔디 받침.",
        "placementRules": "물체 전체를 한 덩이로 찍는다 — 수관 칸은 상위 레이어, 밑동·덤불 칸은 하위 레이어(통행 불가). 잔디 위에만 놓는다."
      },
      "after": {
        "description": "사용자 제공 숲 시트에서 옮긴 짙은 덤불(3×3 칸). 이 덤불은 그림 조각 전부가 하위이며 상위 배열은 -1이다.",
        "placementRules": "previewMap의 전체 하위 배열을 온전하게 배치한다. 상위 칸은 -1이며, 받침은 타일별 layerBacking 정책을 따른다."
      }
    },
    {
      "id": "forest-trees:small-bush",
      "before": {
        "description": "사용자 제공 숲 시트에서 옮긴 작은 덤불(2×2 칸). 수관은 상위, 밑동은 하위+잔디 받침.",
        "placementRules": "물체 전체를 한 덩이로 찍는다 — 수관 칸은 상위 레이어, 밑동·덤불 칸은 하위 레이어(통행 불가). 잔디 위에만 놓는다."
      },
      "after": {
        "description": "사용자 제공 숲 시트에서 옮긴 작은 덤불(2×2 칸). 이 덤불은 그림 조각 전부가 하위이며 상위 배열은 -1이다.",
        "placementRules": "previewMap의 전체 하위 배열을 온전하게 배치한다. 상위 칸은 -1이며, 받침은 타일별 layerBacking 정책을 따른다."
      }
    }
  ]
}
```

