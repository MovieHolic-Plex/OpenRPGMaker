# 작은 일 요청 코퍼스

각 유닛은 자기 이름의 JSON 배열을 채운다. 배열의 사례마다 고정 픽스처, 대상, 한국어 요청, 호출할 동작과 인자, 기대 결과를 적는다. 픽스처 `blank`는 빈 저작 도구 프로젝트, `built`는 작은 일 검증의 완성 게임, `maou`는 마왕 편의점 데모다. 맵과 이벤트 선택에서 `mapId`를 생략하면 시작 맵을 쓴다. 영역을 고르는 테스트에는 `selection: {"rect":{"x":1,"y":2,"w":3,"h":4}}`를 제공한다.

```json
{
  "request": "안내인의 첫 줄만 지워 줘",
  "fixture": "built",
  "target": { "kind": "event", "mapId": "map_example", "eventId": "ev_guide", "pageId": "page_hello" },
  "primitive": "cmd.delete",
  "args": { "index": 0, "expectedHash": "32e14fdad43d44f5df1d5619c2d53fdb" },
  "expect": [
    { "at": "maps.map_example.events[id=ev_guide].pages[0].commands", "count": 1 },
    { "at": "maps.map_example.events[id=ev_guide].pages[0].commands[-1].kind", "equals": "text" },
    { "at": "maps.map_example.events[id=ev_guide].pages[0].commands[0].body", "includes": "반가워요" }
  ]
}
```

예시의 맵, 이벤트, 페이지 이름은 각 픽스처의 실제 식별자로 바꾼다. `cmd.delete`와 `cmd.move`에는 해당 픽스처 명령의 `eventCommandHash`를 넣는다. 나머지 대상은 `{"kind":"map","mapId":"map_example"}` 또는 `{"kind":"dbEntry","collection":"items","id":"item_potion"}`처럼 쓴다. 실패를 기대하는 사례는 `"expectRefusal": true`로 표시한다.

`seed`와 `setup`은 각 사례에만 적용한다. 두 필드가 있으면 `seed`부터 적용한다. `system`과 `database`는 지정한 필드와 컬렉션을 덮어쓰고, `difficulties`는 시스템 난이도 목록을 지정한다. `events`는 선택 맵에, `switches`, `variables`, `commonEvents`, `endings`는 각 프로젝트 목록에 덧붙인다. `commands`는 선택한 이벤트 페이지의 명령 목록을 대체한다. `refusalMessage`로 한국어 거절 사유를 확인할 수 있다. 초기 데이터와 `expectRefusal`, `expect`를 모두 적으면 원래 픽스처에서 거절되고 준비한 픽스처에서 성공하는지 확인한다.

유닛 하나의 코퍼스를 확인하려면 `OPRN_CORPUS_UNIT=08-cmd-time-social`처럼 확장자를 뺀 유닛 이름을 설정하고 `test/smallTaskPrimitives/corpus.test.ts`를 실행한다.

시드를 적용하기 전의 동작 자체가 거절되는지 확인하려면 원래 픽스처에서 해석되는 대상을 고르고 `refusalMessage`에 동작의 거절 사유를 적는다. 시드가 대상을 처음 만드는 사례에서 `refusalMessage`를 생략하면, 원래 픽스처의 대상 해석 오류도 예상한 거절로 집계될 수 있다.

경로는 점으로 속성에 들어가고, `[0]`으로 0부터 시작하는 배열 위치를, `[-1]`로 마지막을, `[id=...]`로 배열 행을 고른다. 검사는 `equals`(구조가 같음), `includes`(배열의 항목과 같거나 글 안에 포함), `count`(배열의 항목 수 또는 글자 수)다. 하나의 경로에서 여러 검사를 함께 쓸 수 있다. 성공을 검사할 때 대상 해석에 실패하면 사례가 실패한다. 정상 완료 사례는 실제 편집 기록에 적용하고 되돌린 뒤 원본 프로젝트를 비교한다.
