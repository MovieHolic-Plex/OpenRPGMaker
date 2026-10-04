# 필드 · 지형과 능력

연속된 필드의 지형을 지도에 그대로 표시하고 능력으로 새 길을 엽니다.

## 실제 저작 순서

1. list_worldmap_structures로 이동 방식을 고른다.
2. author_worldmap_structure({id:"my_world",structure:"field-overview",seed:7})로 실제 맵과 이벤트를 만든다. id는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄·하이픈을 쓴다.
3. inspect_worldmap_structure({id})의 audit.ok, 실제 맵·출입구·착지·관문을 확인한다.
4. show_map_region으로 실제 타일을 보고 플레이에서 M으로 지도를 연다.
5. 실제 SQLite 프로젝트 저장 후 같은 저장소에서 다시 읽어 지도 정의와 맵을 확인한다.

## 정본 표본

프로젝트 63423c08-057f-4cd9-bc1f-d15463f83d72. 맵 9개, 연결 12개. 해금 뒤 9/9 장소 도달. PNG는 저장소를 닫고 다시 연 프로젝트의 타일 렌더와 공용 지도 렌더러를 사용했다.

## 데이터와 그림의 계약

세계관 theme과 이동 structure는 독립이다. 이 표본은 공용 숲마을/던전 타일과 판타지 대륙을 사용한다. 특정 상용 게임의 타일을 복사한 것이 아니다. 공개 타일의 원래 참고문서는 해당 타일셋(list_tileset_references)에서 읽는다.

발견·클리어·능력·핀은 session.switches에 저장한다. 지도에 들어오거나 그림을 여는 것만으로 관문이 통과되지 않는다. stage-nodes/run-path는 열린 인접 장소만 이동한다. run-path는 이전 층과 방문한 분기를 재진입하지 않는다. region-routes/field-overview/room-network는 실제 출입구 이벤트로 왕복한다. scaled-world는 실제 대륙의 거점 입구로 출입한다. 비밀 출구는 일반 클리어와 별도 스위치다.

## 정상과 오류 확인

정상: 닿는 출구, 통행 가능한 착지 칸, 귀환 문을 밟지 않는 착지, 관문을 통과한 뒤 해금, 방의 발견/핀 저장. 오류: 겹친 문, 막힌 착지, 자기 열쇠 뒤 잠긴 관문, 월드맵 점을 아무거나 눌러 순간이동, 런에서 이전 층 재진입. inspect 도구가 좌표·연결 불일치를 보고하며 플레이 화면을 함께 확인한다.

## 표본 전체 연결 정의

```json
{
  "version": 1,
  "id": "examples_field_overview",
  "name": "필드 · 지형과 능력",
  "structure": "field-overview",
  "seed": 7,
  "width": 120,
  "height": 90,
  "startNodeId": "examples_field_overview_n6",
  "nodes": [
    {
      "id": "examples_field_overview_n0",
      "name": "북서 숲",
      "mapId": "examples_field_overview_map0",
      "kind": "field",
      "x": 0,
      "y": 0,
      "w": 40,
      "h": 30,
      "entry": {
        "x": 22,
        "y": 15
      },
      "visitSwitchId": "examples_field_overview_visit0",
      "clearSwitchId": "examples_field_overview_clear0",
      "grants": [
        "examples_field_overview_ability0"
      ]
    },
    {
      "id": "examples_field_overview_n1",
      "name": "산길",
      "mapId": "examples_field_overview_map1",
      "kind": "field",
      "x": 40,
      "y": 0,
      "w": 40,
      "h": 30,
      "entry": {
        "x": 20,
        "y": 15
      },
      "visitSwitchId": "examples_field_overview_visit1",
      "clearSwitchId": "examples_field_overview_clear1",
      "grants": []
    },
    {
      "id": "examples_field_overview_n2",
      "name": "고대 성문",
      "mapId": "examples_field_overview_map2",
      "kind": "field",
      "x": 80,
      "y": 0,
      "w": 40,
      "h": 30,
      "entry": {
        "x": 16,
        "y": 15
      },
      "visitSwitchId": "examples_field_overview_visit2",
      "clearSwitchId": "examples_field_overview_clear2",
      "grants": [
        "examples_field_overview_ability1"
      ]
    },
    {
      "id": "examples_field_overview_n3",
      "name": "서쪽 강변",
      "mapId": "examples_field_overview_map3",
      "kind": "field",
      "x": 0,
      "y": 30,
      "w": 40,
      "h": 30,
      "entry": {
        "x": 20,
        "y": 15
      },
      "visitSwitchId": "examples_field_overview_visit3",
      "clearSwitchId": "examples_field_overview_clear3",
      "grants": []
    },
    {
      "id": "examples_field_overview_n4",
      "name": "중앙 들판",
      "mapId": "examples_field_overview_map4",
      "kind": "field",
      "x": 40,
      "y": 30,
      "w": 40,
      "h": 30,
      "entry": {
        "x": 20,
        "y": 15
      },
      "visitSwitchId": "examples_field_overview_visit4",
      "clearSwitchId": "examples_field_overview_clear4",
      "grants": []
    },
    {
      "id": "examples_field_overview_n5",
      "name": "동쪽 호수",
      "mapId": "examples_field_overview_map5",
      "kind": "field",
      "x": 80,
      "y": 30,
      "w": 40,
      "h": 30,
      "entry": {
        "x": 20,
        "y": 15
      },
      "visitSwitchId": "examples_field_overview_visit5",
      "clearSwitchId": "examples_field_overview_clear5",
      "grants": []
    },
    {
      "id": "examples_field_overview_n6",
      "name": "시작 마을",
      "mapId": "examples_field_overview_map6",
      "kind": "town",
      "x": 0,
      "y": 60,
      "w": 40,
      "h": 30,
      "entry": {
        "x": 20,
        "y": 14
      },
      "visitSwitchId": "examples_field_overview_visit6",
      "clearSwitchId": "examples_field_overview_clear6",
      "grants": []
    },
    {
      "id": "examples_field_overview_n7",
      "name": "나루터",
      "mapId": "examples_field_overview_map7",
      "kind": "field",
      "x": 40,
      "y": 60,
      "w": 40,
      "h": 30,
      "entry": {
        "x": 16,
        "y": 15
      },
      "visitSwitchId": "examples_field_overview_visit7",
      "clearSwitchId": "examples_field_overview_clear7",
      "grants": []
    },
    {
      "id": "examples_field_overview_n8",
      "name": "묻힌 신전",
      "mapId": "examples_field_overview_map8",
      "kind": "dungeon",
      "x": 80,
      "y": 60,
      "w": 40,
      "h": 30,
      "entry": {
        "x": 2,
        "y": 15
      },
      "visitSwitchId": "examples_field_overview_visit8",
      "clearSwitchId": "examples_field_overview_clear8",
      "grants": []
    }
  ],
  "edges": [
    {
      "id": "examples_field_overview_edge0",
      "from": "examples_field_overview_n6",
      "to": "examples_field_overview_n3",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 0
      },
      "toExit": {
        "x": 20,
        "y": 29
      }
    },
    {
      "id": "examples_field_overview_edge1",
      "from": "examples_field_overview_n3",
      "to": "examples_field_overview_n0",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 0
      },
      "toExit": {
        "x": 20,
        "y": 29
      }
    },
    {
      "id": "examples_field_overview_edge2",
      "from": "examples_field_overview_n0",
      "to": "examples_field_overview_n1",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 39,
        "y": 15
      },
      "toExit": {
        "x": 0,
        "y": 15
      }
    },
    {
      "id": "examples_field_overview_edge3",
      "from": "examples_field_overview_n1",
      "to": "examples_field_overview_n2",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 39,
        "y": 15
      },
      "toExit": {
        "x": 0,
        "y": 15
      }
    },
    {
      "id": "examples_field_overview_edge4",
      "from": "examples_field_overview_n3",
      "to": "examples_field_overview_n4",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 39,
        "y": 15
      },
      "toExit": {
        "x": 0,
        "y": 15
      }
    },
    {
      "id": "examples_field_overview_edge5",
      "from": "examples_field_overview_n4",
      "to": "examples_field_overview_n1",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 0
      },
      "toExit": {
        "x": 20,
        "y": 29
      }
    },
    {
      "id": "examples_field_overview_edge6",
      "from": "examples_field_overview_n6",
      "to": "examples_field_overview_n7",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 39,
        "y": 15
      },
      "toExit": {
        "x": 0,
        "y": 15
      }
    },
    {
      "id": "examples_field_overview_edge7",
      "from": "examples_field_overview_n7",
      "to": "examples_field_overview_n4",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 0
      },
      "toExit": {
        "x": 20,
        "y": 29
      }
    },
    {
      "id": "examples_field_overview_edge8",
      "from": "examples_field_overview_n4",
      "to": "examples_field_overview_n5",
      "requires": [
        "examples_field_overview_ability0"
      ],
      "oneWay": false,
      "fromExit": {
        "x": 39,
        "y": 15
      },
      "toExit": {
        "x": 0,
        "y": 15
      }
    },
    {
      "id": "examples_field_overview_edge9",
      "from": "examples_field_overview_n5",
      "to": "examples_field_overview_n2",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 0
      },
      "toExit": {
        "x": 20,
        "y": 29
      }
    },
    {
      "id": "examples_field_overview_edge10",
      "from": "examples_field_overview_n7",
      "to": "examples_field_overview_n8",
      "requires": [
        "examples_field_overview_ability1"
      ],
      "oneWay": false,
      "fromExit": {
        "x": 39,
        "y": 15
      },
      "toExit": {
        "x": 1,
        "y": 15
      }
    },
    {
      "id": "examples_field_overview_edge11",
      "from": "examples_field_overview_n8",
      "to": "examples_field_overview_n5",
      "requires": [
        "examples_field_overview_ability1"
      ],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 1
      },
      "toExit": {
        "x": 20,
        "y": 29
      }
    }
  ],
  "abilities": [
    {
      "name": "수문 열쇠",
      "switchId": "examples_field_overview_ability0"
    },
    {
      "name": "유적 열쇠",
      "switchId": "examples_field_overview_ability1"
    }
  ],
  "pins": [
    {
      "nodeId": "examples_field_overview_n0",
      "switchId": "examples_field_overview_pin0"
    },
    {
      "nodeId": "examples_field_overview_n1",
      "switchId": "examples_field_overview_pin1"
    },
    {
      "nodeId": "examples_field_overview_n2",
      "switchId": "examples_field_overview_pin2"
    },
    {
      "nodeId": "examples_field_overview_n3",
      "switchId": "examples_field_overview_pin3"
    },
    {
      "nodeId": "examples_field_overview_n4",
      "switchId": "examples_field_overview_pin4"
    },
    {
      "nodeId": "examples_field_overview_n5",
      "switchId": "examples_field_overview_pin5"
    },
    {
      "nodeId": "examples_field_overview_n6",
      "switchId": "examples_field_overview_pin6"
    },
    {
      "nodeId": "examples_field_overview_n7",
      "switchId": "examples_field_overview_pin7"
    },
    {
      "nodeId": "examples_field_overview_n8",
      "switchId": "examples_field_overview_pin8"
    }
  ]
}
```
