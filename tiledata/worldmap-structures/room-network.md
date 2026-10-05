# 방 · 발견과 재탐색

횡스크롤 방을 연결하고 발견한 방과 능력 관문, 지도 핀을 기록합니다.

## 실제 저작 순서

1. list_worldmap_structures로 이동 방식을 고른다.
2. author_worldmap_structure({id:"my_world",structure:"room-network",seed:7})로 실제 맵과 이벤트를 만든다. id는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄·하이픈을 쓴다.
3. inspect_worldmap_structure({id})의 audit.ok, 실제 맵·출입구·착지·관문을 확인한다.
4. show_map_region으로 실제 타일을 보고 플레이에서 M으로 지도를 연다.
5. 실제 SQLite 프로젝트 저장 후 같은 저장소에서 다시 읽어 지도 정의와 맵을 확인한다.

## 정본 표본

프로젝트 64f38f6a-2237-425b-86e4-15fd499989ed. 맵 10개, 연결 11개. 해금 뒤 10/10 장소 도달. PNG는 저장소를 닫고 다시 연 프로젝트의 타일 렌더와 공용 지도 렌더러를 사용했다.

## 데이터와 그림의 계약

세계관 theme과 이동 structure는 독립이다. 현재 생성기는 여섯 구조별 고정 연결 레시피이며 완성된 상용 게임을 재현한 것은 아니다. 이 표본은 새 공용 atlas_cartography 32px 지형을 사용한다. 지형 원본은 scripts/content/build-atlas-cartography.py이며, 거점은 사람이 승인한 기존 아이콘의 원본 화소를 재사용한다. 필드의 강·호수·절벽과 굴곡 길은 실제 통행 타일이다. 방 지도는 roomShape가 가리키는 실제 방 윤곽을 쓰고 사다리에는 실제 climbable 지형 기록을 연결한다. 스테이지는 하늘과 풀 절벽 발판이 있는 횡스크롤 코스다. 특정 상용 게임의 타일을 복사한 것이 아니다. 공개 타일의 원래 참고문서는 해당 타일셋(list_tileset_references)에서 읽는다.

발견·클리어·능력·핀은 session.switches에 저장한다. 지도에 들어오거나 그림을 여는 것만으로 관문이 통과되지 않는다. stage-nodes/run-path는 열린 인접 장소만 이동한다. run-path는 이전 층과 방문한 분기를 재진입하지 않는다. region-routes/field-overview/room-network는 실제 출입구 이벤트로 왕복한다. scaled-world는 실제 대륙의 거점 입구로 출입한다. 비밀 출구는 일반 클리어와 별도 스위치다.

## 정상과 오류 확인

정상: 닿는 출구, 통행 가능한 착지 칸, 귀환 문을 밟지 않는 착지, 관문을 통과한 뒤 해금, 방의 발견/핀 저장. 오류: 겹친 문, 막힌 착지, 자기 열쇠 뒤 잠긴 관문, 월드맵 점을 아무거나 눌러 순간이동, 런에서 이전 층 재진입. inspect 도구가 좌표·연결 불일치를 보고하며 플레이 화면을 함께 확인한다.

## 표본 전체 연결 정의

```json
{
  "version": 1,
  "id": "examples_room_network",
  "name": "방 · 발견과 재탐색",
  "structure": "room-network",
  "seed": 7,
  "width": 120,
  "height": 90,
  "startNodeId": "examples_room_network_n0",
  "nodes": [
    {
      "id": "examples_room_network_n0",
      "name": "지상의 우물",
      "mapId": "examples_room_network_map0",
      "kind": "room",
      "x": 9,
      "y": 4,
      "w": 15,
      "h": 19,
      "entry": {
        "x": 2,
        "y": 25
      },
      "visitSwitchId": "examples_room_network_visit0",
      "clearSwitchId": "examples_room_network_clear0",
      "grants": [],
      "roomShape": 0
    },
    {
      "id": "examples_room_network_n1",
      "name": "잊힌 교차로",
      "mapId": "examples_room_network_map1",
      "kind": "room",
      "x": 9,
      "y": 32,
      "w": 24,
      "h": 14,
      "entry": {
        "x": 2,
        "y": 19
      },
      "visitSwitchId": "examples_room_network_visit1",
      "clearSwitchId": "examples_room_network_clear1",
      "grants": [],
      "roomShape": 1
    },
    {
      "id": "examples_room_network_n2",
      "name": "순례자의 방",
      "mapId": "examples_room_network_map2",
      "kind": "room",
      "x": 35,
      "y": 32,
      "w": 19,
      "h": 17,
      "entry": {
        "x": 2,
        "y": 23
      },
      "visitSwitchId": "examples_room_network_visit2",
      "clearSwitchId": "examples_room_network_clear2",
      "grants": [
        "examples_room_network_ability0"
      ],
      "roomShape": 2
    },
    {
      "id": "examples_room_network_n3",
      "name": "푸른 회랑",
      "mapId": "examples_room_network_map3",
      "kind": "room",
      "x": 61,
      "y": 35,
      "w": 24,
      "h": 12,
      "entry": {
        "x": 2,
        "y": 15
      },
      "visitSwitchId": "examples_room_network_visit3",
      "clearSwitchId": "examples_room_network_clear3",
      "grants": [],
      "roomShape": 3
    },
    {
      "id": "examples_room_network_n4",
      "name": "바람의 탑",
      "mapId": "examples_room_network_map4",
      "kind": "room",
      "x": 66,
      "y": 1,
      "w": 13,
      "h": 29,
      "entry": {
        "x": 2,
        "y": 37
      },
      "visitSwitchId": "examples_room_network_visit4",
      "clearSwitchId": "examples_room_network_clear4",
      "grants": [
        "examples_room_network_ability1"
      ],
      "roomShape": 4
    },
    {
      "id": "examples_room_network_n5",
      "name": "이끼 저장고",
      "mapId": "examples_room_network_map5",
      "kind": "room",
      "x": 9,
      "y": 55,
      "w": 22,
      "h": 16,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_room_network_visit5",
      "clearSwitchId": "examples_room_network_clear5",
      "grants": [],
      "roomShape": 5
    },
    {
      "id": "examples_room_network_n6",
      "name": "깊은 수로",
      "mapId": "examples_room_network_map6",
      "kind": "room",
      "x": 35,
      "y": 55,
      "w": 27,
      "h": 11,
      "entry": {
        "x": 2,
        "y": 13
      },
      "visitSwitchId": "examples_room_network_visit6",
      "clearSwitchId": "examples_room_network_clear6",
      "grants": [],
      "roomShape": 6
    },
    {
      "id": "examples_room_network_n7",
      "name": "침묵의 서고",
      "mapId": "examples_room_network_map7",
      "kind": "room",
      "x": 61,
      "y": 55,
      "w": 24,
      "h": 18,
      "entry": {
        "x": 2,
        "y": 27
      },
      "visitSwitchId": "examples_room_network_visit7",
      "clearSwitchId": "examples_room_network_clear7",
      "grants": [],
      "roomShape": 7
    },
    {
      "id": "examples_room_network_n8",
      "name": "어둠의 관문",
      "mapId": "examples_room_network_map8",
      "kind": "room",
      "x": 87,
      "y": 55,
      "w": 15,
      "h": 16,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_room_network_visit8",
      "clearSwitchId": "examples_room_network_clear8",
      "grants": [],
      "roomShape": 8
    },
    {
      "id": "examples_room_network_n9",
      "name": "깊은 성소",
      "mapId": "examples_room_network_map9",
      "kind": "room",
      "x": 87,
      "y": 75,
      "w": 24,
      "h": 13,
      "entry": {
        "x": 2,
        "y": 25
      },
      "visitSwitchId": "examples_room_network_visit9",
      "clearSwitchId": "examples_room_network_clear9",
      "grants": [],
      "roomShape": 9
    }
  ],
  "edges": [
    {
      "id": "examples_room_network_edge0",
      "from": "examples_room_network_n0",
      "to": "examples_room_network_n1",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 28,
        "y": 25
      },
      "toExit": {
        "x": 52,
        "y": 19
      }
    },
    {
      "id": "examples_room_network_edge1",
      "from": "examples_room_network_n1",
      "to": "examples_room_network_n2",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 19
      },
      "toExit": {
        "x": 1,
        "y": 23
      }
    },
    {
      "id": "examples_room_network_edge2",
      "from": "examples_room_network_n2",
      "to": "examples_room_network_n3",
      "requires": [
        "examples_room_network_ability0"
      ],
      "oneWay": false,
      "fromExit": {
        "x": 34,
        "y": 23
      },
      "toExit": {
        "x": 1,
        "y": 15
      }
    },
    {
      "id": "examples_room_network_edge3",
      "from": "examples_room_network_n3",
      "to": "examples_room_network_n4",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 54,
        "y": 15
      },
      "toExit": {
        "x": 1,
        "y": 37
      }
    },
    {
      "id": "examples_room_network_edge4",
      "from": "examples_room_network_n1",
      "to": "examples_room_network_n5",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 9,
        "y": 19
      },
      "toExit": {
        "x": 36,
        "y": 21
      }
    },
    {
      "id": "examples_room_network_edge5",
      "from": "examples_room_network_n5",
      "to": "examples_room_network_n6",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 21
      },
      "toExit": {
        "x": 1,
        "y": 13
      }
    },
    {
      "id": "examples_room_network_edge6",
      "from": "examples_room_network_n6",
      "to": "examples_room_network_n7",
      "requires": [
        "examples_room_network_ability0"
      ],
      "oneWay": false,
      "fromExit": {
        "x": 58,
        "y": 13
      },
      "toExit": {
        "x": 1,
        "y": 27
      }
    },
    {
      "id": "examples_room_network_edge7",
      "from": "examples_room_network_n7",
      "to": "examples_room_network_n3",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 42,
        "y": 27
      },
      "toExit": {
        "x": 20,
        "y": 15
      }
    },
    {
      "id": "examples_room_network_edge8",
      "from": "examples_room_network_n7",
      "to": "examples_room_network_n8",
      "requires": [
        "examples_room_network_ability1"
      ],
      "oneWay": false,
      "fromExit": {
        "x": 20,
        "y": 27
      },
      "toExit": {
        "x": 1,
        "y": 21
      }
    },
    {
      "id": "examples_room_network_edge9",
      "from": "examples_room_network_n8",
      "to": "examples_room_network_n9",
      "requires": [],
      "oneWay": false,
      "fromExit": {
        "x": 30,
        "y": 21
      },
      "toExit": {
        "x": 46,
        "y": 25
      }
    },
    {
      "id": "examples_room_network_edge10",
      "from": "examples_room_network_n4",
      "to": "examples_room_network_n8",
      "requires": [
        "examples_room_network_ability1"
      ],
      "oneWay": false,
      "secret": true,
      "fromExit": {
        "x": 22,
        "y": 37
      },
      "toExit": {
        "x": 20,
        "y": 21
      }
    }
  ],
  "abilities": [
    {
      "name": "봉인 해제",
      "switchId": "examples_room_network_ability0"
    },
    {
      "name": "깊은 성소 열쇠",
      "switchId": "examples_room_network_ability1"
    }
  ],
  "pins": [
    {
      "nodeId": "examples_room_network_n0",
      "switchId": "examples_room_network_pin0"
    },
    {
      "nodeId": "examples_room_network_n1",
      "switchId": "examples_room_network_pin1"
    },
    {
      "nodeId": "examples_room_network_n2",
      "switchId": "examples_room_network_pin2"
    },
    {
      "nodeId": "examples_room_network_n3",
      "switchId": "examples_room_network_pin3"
    },
    {
      "nodeId": "examples_room_network_n4",
      "switchId": "examples_room_network_pin4"
    },
    {
      "nodeId": "examples_room_network_n5",
      "switchId": "examples_room_network_pin5"
    },
    {
      "nodeId": "examples_room_network_n6",
      "switchId": "examples_room_network_pin6"
    },
    {
      "nodeId": "examples_room_network_n7",
      "switchId": "examples_room_network_pin7"
    },
    {
      "nodeId": "examples_room_network_n8",
      "switchId": "examples_room_network_pin8"
    },
    {
      "nodeId": "examples_room_network_n9",
      "switchId": "examples_room_network_pin9"
    }
  ]
}
```
