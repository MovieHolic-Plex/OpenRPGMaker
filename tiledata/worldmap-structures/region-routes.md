# 지역 · 마을과 도로

지역 지도와 실제 마을·도로를 분리하고 출입구로 왕복합니다.

## 실제 저작 순서

1. list_worldmap_structures로 이동 방식을 고른다.
2. author_worldmap_structure({id:"my_world",structure:"region-routes",seed:7})로 실제 맵과 이벤트를 만든다. id는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄·하이픈을 쓴다.
3. inspect_worldmap_structure({id})의 audit.ok, 실제 맵·출입구·착지·관문을 확인한다.
4. show_map_region으로 실제 타일을 보고 플레이에서 M으로 지도를 연다.
5. 실제 SQLite 프로젝트 저장 후 같은 저장소에서 다시 읽어 지도 정의와 맵을 확인한다.

## 정본 표본

프로젝트 380b537f-432e-4023-808e-a1ee990d1930. 맵 8개, 연결 8개. 해금 뒤 8/8 장소 도달. PNG는 저장소를 닫고 다시 연 프로젝트의 타일 렌더와 공용 지도 렌더러를 사용했다.

## 데이터와 그림의 계약

세계관 theme과 이동 structure는 독립이다. 이 표본은 공용 숲마을/던전 타일과 판타지 대륙을 사용한다. 특정 상용 게임의 타일을 복사한 것이 아니다. 공개 타일의 원래 참고문서는 해당 타일셋(list_tileset_references)에서 읽는다.

발견·클리어·능력·핀은 session.switches에 저장한다. 지도에 들어오거나 그림을 여는 것만으로 관문이 통과되지 않는다. stage-nodes/run-path는 열린 인접 장소만 이동한다. run-path는 이전 층과 방문한 분기를 재진입하지 않는다. region-routes/field-overview/room-network는 실제 출입구 이벤트로 왕복한다. scaled-world는 실제 대륙의 거점 입구로 출입한다. 비밀 출구는 일반 클리어와 별도 스위치다.

## 정상과 오류 확인

정상: 닿는 출구, 통행 가능한 착지 칸, 귀환 문을 밟지 않는 착지, 관문을 통과한 뒤 해금, 방의 발견/핀 저장. 오류: 겹친 문, 막힌 착지, 자기 열쇠 뒤 잠긴 관문, 월드맵 점을 아무거나 눌러 순간이동, 런에서 이전 층 재진입. inspect 도구가 좌표·연결 불일치를 보고하며 플레이 화면을 함께 확인한다.

## 표본 전체 연결 정의

```json
{
  "version": 1,
  "id": "examples_region_routes",
  "name": "지역 · 마을과 도로",
  "structure": "region-routes",
  "seed": 7,
  "width": 120,
  "height": 84,
  "startNodeId": "examples_region_routes_n0",
  "nodes": [
    {
      "id": "examples_region_routes_n0",
      "name": "새싹 마을",
      "mapId": "examples_region_routes_map0",
      "kind": "town",
      "x": 12,
      "y": 57,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 18
      },
      "visitSwitchId": "examples_region_routes_visit0",
      "clearSwitchId": "examples_region_routes_clear0",
      "grants": []
    },
    {
      "id": "examples_region_routes_n1",
      "name": "1번 도로",
      "mapId": "examples_region_routes_map1",
      "kind": "route",
      "x": 34,
      "y": 57,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 20,
        "y": 15
      },
      "visitSwitchId": "examples_region_routes_visit1",
      "clearSwitchId": "examples_region_routes_clear1",
      "grants": []
    },
    {
      "id": "examples_region_routes_n2",
      "name": "솔바람 시티",
      "mapId": "examples_region_routes_map2",
      "kind": "town",
      "x": 55,
      "y": 57,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 18
      },
      "visitSwitchId": "examples_region_routes_visit2",
      "clearSwitchId": "examples_region_routes_clear2",
      "grants": [
        "examples_region_routes_ability0"
      ]
    },
    {
      "id": "examples_region_routes_n3",
      "name": "2번 도로",
      "mapId": "examples_region_routes_map3",
      "kind": "route",
      "x": 55,
      "y": 34,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 20,
        "y": 15
      },
      "visitSwitchId": "examples_region_routes_visit3",
      "clearSwitchId": "examples_region_routes_clear3",
      "grants": []
    },
    {
      "id": "examples_region_routes_n4",
      "name": "호수 마을",
      "mapId": "examples_region_routes_map4",
      "kind": "town",
      "x": 78,
      "y": 34,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 18
      },
      "visitSwitchId": "examples_region_routes_visit4",
      "clearSwitchId": "examples_region_routes_clear4",
      "grants": []
    },
    {
      "id": "examples_region_routes_n5",
      "name": "물결 도로",
      "mapId": "examples_region_routes_map5",
      "kind": "route",
      "x": 78,
      "y": 13,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 21,
        "y": 15
      },
      "visitSwitchId": "examples_region_routes_visit5",
      "clearSwitchId": "examples_region_routes_clear5",
      "grants": []
    },
    {
      "id": "examples_region_routes_n6",
      "name": "별빛 리그",
      "mapId": "examples_region_routes_map6",
      "kind": "town",
      "x": 100,
      "y": 13,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 18
      },
      "visitSwitchId": "examples_region_routes_visit6",
      "clearSwitchId": "examples_region_routes_clear6",
      "grants": []
    },
    {
      "id": "examples_region_routes_n7",
      "name": "숲샛길",
      "mapId": "examples_region_routes_map7",
      "kind": "route",
      "x": 34,
      "y": 34,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 22,
        "y": 15
      },
      "visitSwitchId": "examples_region_routes_visit7",
      "clearSwitchId": "examples_region_routes_clear7",
      "grants": []
    }
  ],
  "edges": [
    {
      "id": "examples_region_routes_edge0",
      "from": "examples_region_routes_n0",
      "to": "examples_region_routes_n1",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 60,
        "y": 18
      },
      "toExit": {
        "x": 0,
        "y": 15
      }
    },
    {
      "id": "examples_region_routes_edge1",
      "from": "examples_region_routes_n1",
      "to": "examples_region_routes_n2",
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
      "id": "examples_region_routes_edge2",
      "from": "examples_region_routes_n2",
      "to": "examples_region_routes_n3",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 34,
        "y": 0
      },
      "toExit": {
        "x": 20,
        "y": 29
      }
    },
    {
      "id": "examples_region_routes_edge3",
      "from": "examples_region_routes_n3",
      "to": "examples_region_routes_n4",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 39,
        "y": 15
      },
      "toExit": {
        "x": 8,
        "y": 19
      }
    },
    {
      "id": "examples_region_routes_edge4",
      "from": "examples_region_routes_n4",
      "to": "examples_region_routes_n5",
      "requires": [
        "examples_region_routes_ability0"
      ],
      "oneWay": false,
      "fromExit": {
        "x": 34,
        "y": 0
      },
      "toExit": {
        "x": 20,
        "y": 29
      }
    },
    {
      "id": "examples_region_routes_edge5",
      "from": "examples_region_routes_n5",
      "to": "examples_region_routes_n6",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 39,
        "y": 15
      },
      "toExit": {
        "x": 0,
        "y": 17
      }
    },
    {
      "id": "examples_region_routes_edge6",
      "from": "examples_region_routes_n1",
      "to": "examples_region_routes_n7",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 0
      },
      "toExit": {
        "x": 22,
        "y": 16
      }
    },
    {
      "id": "examples_region_routes_edge7",
      "from": "examples_region_routes_n7",
      "to": "examples_region_routes_n3",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 23,
        "y": 15
      },
      "toExit": {
        "x": 0,
        "y": 15
      }
    }
  ],
  "abilities": [
    {
      "name": "물길 통행증",
      "switchId": "examples_region_routes_ability0"
    }
  ],
  "pins": [
    {
      "nodeId": "examples_region_routes_n0",
      "switchId": "examples_region_routes_pin0"
    },
    {
      "nodeId": "examples_region_routes_n1",
      "switchId": "examples_region_routes_pin1"
    },
    {
      "nodeId": "examples_region_routes_n2",
      "switchId": "examples_region_routes_pin2"
    },
    {
      "nodeId": "examples_region_routes_n3",
      "switchId": "examples_region_routes_pin3"
    },
    {
      "nodeId": "examples_region_routes_n4",
      "switchId": "examples_region_routes_pin4"
    },
    {
      "nodeId": "examples_region_routes_n5",
      "switchId": "examples_region_routes_pin5"
    },
    {
      "nodeId": "examples_region_routes_n6",
      "switchId": "examples_region_routes_pin6"
    },
    {
      "nodeId": "examples_region_routes_n7",
      "switchId": "examples_region_routes_pin7"
    }
  ]
}
```
