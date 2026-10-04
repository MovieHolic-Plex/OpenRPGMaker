# 축척 월드 · 대륙 걷기

작게 그린 대륙을 직접 걷고 거점의 실제 맵으로 들어갑니다.

## 실제 저작 순서

1. list_worldmap_structures로 이동 방식을 고른다.
2. author_worldmap_structure({id:"my_world",structure:"scaled-world",seed:7})로 실제 맵과 이벤트를 만든다. id는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄·하이픈을 쓴다.
3. inspect_worldmap_structure({id})의 audit.ok, 실제 맵·출입구·착지·관문을 확인한다.
4. show_map_region으로 실제 타일을 보고 플레이에서 M으로 지도를 연다.
5. 실제 SQLite 프로젝트 저장 후 같은 저장소에서 다시 읽어 지도 정의와 맵을 확인한다.

## 정본 표본

프로젝트 70c0476c-bfc0-4137-b902-f03abbf1069c. 맵 9개, 연결 7개. 해금 뒤 8/8 장소 도달. PNG는 저장소를 닫고 다시 연 프로젝트의 타일 렌더와 공용 지도 렌더러를 사용했다.

## 데이터와 그림의 계약

세계관 theme과 이동 structure는 독립이다. 이 표본은 공용 숲마을/던전 타일과 판타지 대륙을 사용한다. 특정 상용 게임의 타일을 복사한 것이 아니다. 공개 타일의 원래 참고문서는 해당 타일셋(list_tileset_references)에서 읽는다.

발견·클리어·능력·핀은 session.switches에 저장한다. 지도에 들어오거나 그림을 여는 것만으로 관문이 통과되지 않는다. stage-nodes/run-path는 열린 인접 장소만 이동한다. run-path는 이전 층과 방문한 분기를 재진입하지 않는다. region-routes/field-overview/room-network는 실제 출입구 이벤트로 왕복한다. scaled-world는 실제 대륙의 거점 입구로 출입한다. 비밀 출구는 일반 클리어와 별도 스위치다.

## 정상과 오류 확인

정상: 닿는 출구, 통행 가능한 착지 칸, 귀환 문을 밟지 않는 착지, 관문을 통과한 뒤 해금, 방의 발견/핀 저장. 오류: 겹친 문, 막힌 착지, 자기 열쇠 뒤 잠긴 관문, 월드맵 점을 아무거나 눌러 순간이동, 런에서 이전 층 재진입. inspect 도구가 좌표·연결 불일치를 보고하며 플레이 화면을 함께 확인한다.

## 표본 전체 연결 정의

```json
{
  "version": 1,
  "id": "examples_scaled_world",
  "name": "축척 월드 · 대륙 걷기",
  "structure": "scaled-world",
  "seed": 7,
  "width": 96,
  "height": 72,
  "startNodeId": "examples_scaled_world_n0",
  "nodes": [
    {
      "id": "examples_scaled_world_n0",
      "name": "대성",
      "mapId": "examples_scaled_world_map0",
      "kind": "town",
      "x": 28,
      "y": 26,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 18
      },
      "visitSwitchId": "examples_scaled_world_visit0",
      "clearSwitchId": "examples_scaled_world_clear0",
      "grants": [],
      "worldEntrance": {
        "x": 28,
        "y": 26
      }
    },
    {
      "id": "examples_scaled_world_n1",
      "name": "강가 마을",
      "mapId": "examples_scaled_world_map1",
      "kind": "town",
      "x": 39,
      "y": 28,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 18
      },
      "visitSwitchId": "examples_scaled_world_visit1",
      "clearSwitchId": "examples_scaled_world_clear1",
      "grants": [
        "examples_scaled_world_ability0"
      ],
      "worldEntrance": {
        "x": 39,
        "y": 28
      }
    },
    {
      "id": "examples_scaled_world_n2",
      "name": "내해 항구",
      "mapId": "examples_scaled_world_map2",
      "kind": "dungeon",
      "x": 42,
      "y": 33,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 15
      },
      "visitSwitchId": "examples_scaled_world_visit2",
      "clearSwitchId": "examples_scaled_world_clear2",
      "grants": [],
      "worldEntrance": {
        "x": 42,
        "y": 33
      }
    },
    {
      "id": "examples_scaled_world_n3",
      "name": "설원 마을",
      "mapId": "examples_scaled_world_map3",
      "kind": "town",
      "x": 34,
      "y": 10,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 16
      },
      "visitSwitchId": "examples_scaled_world_visit3",
      "clearSwitchId": "examples_scaled_world_clear3",
      "grants": [],
      "worldEntrance": {
        "x": 34,
        "y": 10
      }
    },
    {
      "id": "examples_scaled_world_n4",
      "name": "눈 촌락",
      "mapId": "examples_scaled_world_map4",
      "kind": "town",
      "x": 20,
      "y": 11,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 18
      },
      "visitSwitchId": "examples_scaled_world_visit4",
      "clearSwitchId": "examples_scaled_world_clear4",
      "grants": [],
      "worldEntrance": {
        "x": 20,
        "y": 11
      }
    },
    {
      "id": "examples_scaled_world_n5",
      "name": "고원 마을",
      "mapId": "examples_scaled_world_map5",
      "kind": "dungeon",
      "x": 16,
      "y": 22,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 15
      },
      "visitSwitchId": "examples_scaled_world_visit5",
      "clearSwitchId": "examples_scaled_world_clear5",
      "grants": [],
      "worldEntrance": {
        "x": 16,
        "y": 22
      }
    },
    {
      "id": "examples_scaled_world_n6",
      "name": "산기슭 동굴",
      "mapId": "examples_scaled_world_map6",
      "kind": "town",
      "x": 9,
      "y": 26,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 18
      },
      "visitSwitchId": "examples_scaled_world_visit6",
      "clearSwitchId": "examples_scaled_world_clear6",
      "grants": [],
      "worldEntrance": {
        "x": 9,
        "y": 26
      }
    },
    {
      "id": "examples_scaled_world_n7",
      "name": "사막 촌락",
      "mapId": "examples_scaled_world_map7",
      "kind": "town",
      "x": 21,
      "y": 51,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 34,
        "y": 17
      },
      "visitSwitchId": "examples_scaled_world_visit7",
      "clearSwitchId": "examples_scaled_world_clear7",
      "grants": [],
      "worldEntrance": {
        "x": 21,
        "y": 51
      }
    }
  ],
  "edges": [
    {
      "id": "examples_scaled_world_edge0",
      "from": "examples_scaled_world_n0",
      "to": "examples_scaled_world_n1",
      "requires": [],
      "oneWay": false
    },
    {
      "id": "examples_scaled_world_edge1",
      "from": "examples_scaled_world_n1",
      "to": "examples_scaled_world_n2",
      "requires": [],
      "oneWay": false
    },
    {
      "id": "examples_scaled_world_edge2",
      "from": "examples_scaled_world_n2",
      "to": "examples_scaled_world_n3",
      "requires": [
        "examples_scaled_world_ability0"
      ],
      "oneWay": false
    },
    {
      "id": "examples_scaled_world_edge3",
      "from": "examples_scaled_world_n3",
      "to": "examples_scaled_world_n4",
      "requires": [],
      "oneWay": false
    },
    {
      "id": "examples_scaled_world_edge4",
      "from": "examples_scaled_world_n4",
      "to": "examples_scaled_world_n5",
      "requires": [],
      "oneWay": false
    },
    {
      "id": "examples_scaled_world_edge5",
      "from": "examples_scaled_world_n5",
      "to": "examples_scaled_world_n6",
      "requires": [],
      "oneWay": false
    },
    {
      "id": "examples_scaled_world_edge6",
      "from": "examples_scaled_world_n6",
      "to": "examples_scaled_world_n7",
      "requires": [],
      "oneWay": false
    }
  ],
  "abilities": [
    {
      "name": "옛 성문 열쇠",
      "switchId": "examples_scaled_world_ability0"
    }
  ],
  "pins": [
    {
      "nodeId": "examples_scaled_world_n0",
      "switchId": "examples_scaled_world_pin0"
    },
    {
      "nodeId": "examples_scaled_world_n1",
      "switchId": "examples_scaled_world_pin1"
    },
    {
      "nodeId": "examples_scaled_world_n2",
      "switchId": "examples_scaled_world_pin2"
    },
    {
      "nodeId": "examples_scaled_world_n3",
      "switchId": "examples_scaled_world_pin3"
    },
    {
      "nodeId": "examples_scaled_world_n4",
      "switchId": "examples_scaled_world_pin4"
    },
    {
      "nodeId": "examples_scaled_world_n5",
      "switchId": "examples_scaled_world_pin5"
    },
    {
      "nodeId": "examples_scaled_world_n6",
      "switchId": "examples_scaled_world_pin6"
    },
    {
      "nodeId": "examples_scaled_world_n7",
      "switchId": "examples_scaled_world_pin7"
    }
  ],
  "overviewMapId": "examples_scaled_world_overworld"
}
```
