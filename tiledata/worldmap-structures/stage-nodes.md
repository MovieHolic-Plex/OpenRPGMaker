# 스테이지 · 클리어와 비밀길

코스를 클리어하면 다음 코스, 비밀 출구를 찾으면 지름길을 엽니다.

## 실제 저작 순서

1. list_worldmap_structures로 이동 방식을 고른다.
2. author_worldmap_structure({id:"my_world",structure:"stage-nodes",seed:7})로 실제 맵과 이벤트를 만든다. id는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄·하이픈을 쓴다.
3. inspect_worldmap_structure({id})의 audit.ok, 실제 맵·출입구·착지·관문을 확인한다.
4. show_map_region으로 실제 타일을 보고 플레이에서 M으로 지도를 연다.
5. 실제 SQLite 프로젝트 저장 후 같은 저장소에서 다시 읽어 지도 정의와 맵을 확인한다.

## 정본 표본

프로젝트 331c6a6c-4459-4edf-a250-5bcb9af7982b. 맵 8개, 연결 8개. 해금 뒤 8/8 장소 도달. PNG는 저장소를 닫고 다시 연 프로젝트의 타일 렌더와 공용 지도 렌더러를 사용했다.

## 데이터와 그림의 계약

세계관 theme과 이동 structure는 독립이다. 현재 생성기는 여섯 구조별 고정 연결 레시피이며 완성된 상용 게임을 재현한 것은 아니다. 이 표본은 새 공용 atlas_cartography 32px 지형을 사용한다. 지형 원본은 scripts/content/build-atlas-cartography.py이며, 거점은 사람이 승인한 기존 아이콘의 원본 화소를 재사용한다. 필드의 강·호수·절벽과 굴곡 길은 실제 통행 타일이다. 방 지도는 roomShape가 가리키는 실제 방 윤곽을 쓰고 사다리에는 실제 climbable 지형 기록을 연결한다. 스테이지는 하늘과 풀 절벽 발판이 있는 횡스크롤 코스다. 특정 상용 게임의 타일을 복사한 것이 아니다. 공개 타일의 원래 참고문서는 해당 타일셋(list_tileset_references)에서 읽는다.

발견·클리어·능력·핀은 session.switches에 저장한다. 지도에 들어오거나 그림을 여는 것만으로 관문이 통과되지 않는다. stage-nodes/run-path는 열린 인접 장소만 이동한다. run-path는 이전 층과 방문한 분기를 재진입하지 않는다. region-routes/field-overview/room-network는 실제 출입구 이벤트로 왕복한다. scaled-world는 실제 대륙의 거점 입구로 출입한다. 비밀 출구는 일반 클리어와 별도 스위치다.

## 정상과 오류 확인

정상: 닿는 출구, 통행 가능한 착지 칸, 귀환 문을 밟지 않는 착지, 관문을 통과한 뒤 해금, 방의 발견/핀 저장. 오류: 겹친 문, 막힌 착지, 자기 열쇠 뒤 잠긴 관문, 월드맵 점을 아무거나 눌러 순간이동, 런에서 이전 층 재진입. inspect 도구가 좌표·연결 불일치를 보고하며 플레이 화면을 함께 확인한다.

## 표본 전체 연결 정의

```json
{
  "version": 1,
  "id": "examples_stage_nodes",
  "name": "스테이지 · 클리어와 비밀길",
  "structure": "stage-nodes",
  "seed": 7,
  "width": 120,
  "height": 84,
  "startNodeId": "examples_stage_nodes_n0",
  "nodes": [
    {
      "id": "examples_stage_nodes_n0",
      "name": "새싹 언덕",
      "mapId": "examples_stage_nodes_map0",
      "kind": "stage",
      "x": 10,
      "y": 58,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_stage_nodes_visit0",
      "clearSwitchId": "examples_stage_nodes_clear0",
      "grants": []
    },
    {
      "id": "examples_stage_nodes_n1",
      "name": "개울길",
      "mapId": "examples_stage_nodes_map1",
      "kind": "stage",
      "x": 30,
      "y": 58,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_stage_nodes_visit1",
      "clearSwitchId": "examples_stage_nodes_clear1",
      "grants": []
    },
    {
      "id": "examples_stage_nodes_n2",
      "name": "햇살 숲",
      "mapId": "examples_stage_nodes_map2",
      "kind": "stage",
      "x": 48,
      "y": 42,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_stage_nodes_visit2",
      "clearSwitchId": "examples_stage_nodes_clear2",
      "grants": [
        "examples_stage_nodes_ability0"
      ]
    },
    {
      "id": "examples_stage_nodes_n3",
      "name": "호수 요새",
      "mapId": "examples_stage_nodes_map3",
      "kind": "stage",
      "x": 76,
      "y": 42,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_stage_nodes_visit3",
      "clearSwitchId": "examples_stage_nodes_clear3",
      "grants": []
    },
    {
      "id": "examples_stage_nodes_n4",
      "name": "돌 고개",
      "mapId": "examples_stage_nodes_map4",
      "kind": "stage",
      "x": 96,
      "y": 26,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_stage_nodes_visit4",
      "clearSwitchId": "examples_stage_nodes_clear4",
      "grants": []
    },
    {
      "id": "examples_stage_nodes_n5",
      "name": "별빛 성",
      "mapId": "examples_stage_nodes_map5",
      "kind": "stage",
      "x": 96,
      "y": 10,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_stage_nodes_visit5",
      "clearSwitchId": "examples_stage_nodes_clear5",
      "grants": []
    },
    {
      "id": "examples_stage_nodes_n6",
      "name": "비밀 섬",
      "mapId": "examples_stage_nodes_map6",
      "kind": "stage",
      "x": 30,
      "y": 20,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_stage_nodes_visit6",
      "clearSwitchId": "examples_stage_nodes_clear6",
      "grants": []
    },
    {
      "id": "examples_stage_nodes_n7",
      "name": "무지개 샛길",
      "mapId": "examples_stage_nodes_map7",
      "kind": "stage",
      "x": 63,
      "y": 12,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_stage_nodes_visit7",
      "clearSwitchId": "examples_stage_nodes_clear7",
      "grants": []
    }
  ],
  "edges": [
    {
      "id": "examples_stage_nodes_edge0",
      "from": "examples_stage_nodes_n0",
      "to": "examples_stage_nodes_n1",
      "requires": [
        "examples_stage_nodes_clear0"
      ],
      "oneWay": false
    },
    {
      "id": "examples_stage_nodes_edge1",
      "from": "examples_stage_nodes_n1",
      "to": "examples_stage_nodes_n2",
      "requires": [
        "examples_stage_nodes_clear1"
      ],
      "oneWay": false
    },
    {
      "id": "examples_stage_nodes_edge2",
      "from": "examples_stage_nodes_n2",
      "to": "examples_stage_nodes_n3",
      "requires": [
        "examples_stage_nodes_clear2"
      ],
      "oneWay": false
    },
    {
      "id": "examples_stage_nodes_edge3",
      "from": "examples_stage_nodes_n3",
      "to": "examples_stage_nodes_n4",
      "requires": [
        "examples_stage_nodes_clear3"
      ],
      "oneWay": false
    },
    {
      "id": "examples_stage_nodes_edge4",
      "from": "examples_stage_nodes_n4",
      "to": "examples_stage_nodes_n5",
      "requires": [
        "examples_stage_nodes_clear4"
      ],
      "oneWay": false
    },
    {
      "id": "examples_stage_nodes_edge5",
      "from": "examples_stage_nodes_n2",
      "to": "examples_stage_nodes_n6",
      "requires": [
        "examples_stage_nodes_ability0"
      ],
      "oneWay": false,
      "secret": true
    },
    {
      "id": "examples_stage_nodes_edge6",
      "from": "examples_stage_nodes_n6",
      "to": "examples_stage_nodes_n7",
      "requires": [
        "examples_stage_nodes_clear6"
      ],
      "oneWay": false
    },
    {
      "id": "examples_stage_nodes_edge7",
      "from": "examples_stage_nodes_n7",
      "to": "examples_stage_nodes_n5",
      "requires": [
        "examples_stage_nodes_clear7"
      ],
      "oneWay": false
    }
  ],
  "abilities": [
    {
      "name": "숲의 비밀 출구",
      "switchId": "examples_stage_nodes_ability0"
    }
  ],
  "pins": [
    {
      "nodeId": "examples_stage_nodes_n0",
      "switchId": "examples_stage_nodes_pin0"
    },
    {
      "nodeId": "examples_stage_nodes_n1",
      "switchId": "examples_stage_nodes_pin1"
    },
    {
      "nodeId": "examples_stage_nodes_n2",
      "switchId": "examples_stage_nodes_pin2"
    },
    {
      "nodeId": "examples_stage_nodes_n3",
      "switchId": "examples_stage_nodes_pin3"
    },
    {
      "nodeId": "examples_stage_nodes_n4",
      "switchId": "examples_stage_nodes_pin4"
    },
    {
      "nodeId": "examples_stage_nodes_n5",
      "switchId": "examples_stage_nodes_pin5"
    },
    {
      "nodeId": "examples_stage_nodes_n6",
      "switchId": "examples_stage_nodes_pin6"
    },
    {
      "nodeId": "examples_stage_nodes_n7",
      "switchId": "examples_stage_nodes_pin7"
    }
  ]
}
```
