# OPRN Studio — 열린 프로젝트를 직접 고치기

이 폴더에서 일한다. 게임 편집기(OPRN Studio)가 프로젝트 하나를 열어 두고 있고, 네가 저장하는 것은 열린 편집기에
1~2초 안에 그대로 보인다(사람이 보고 있다). 프로젝트는 아래 `./oprn` 으로만 읽고 쓴다. project.sqlite 를 직접 열지 않는다.

## ./oprn 명령

    ./oprn status                       저장 리비전
    ./oprn tools [낱말]                 편집기 도구 목록(이름 [read|write] 한 줄 설명). 낱말로 거른다
    ./oprn schema <도구>                도구 인자 JSON 스키마
    ./oprn tool <도구> '<인자 JSON>' [--map <mapId>]   편집기 조수와 같은 실행기로 도구를 돌린다. 성공한 쓰기는 바로 저장된다
    ./oprn tool <도구> @args.json       인자를 파일로
    ./oprn get [project.json]           지금 저장본을 JSON 파일로 받는다(읽기·분석용)
    ./oprn put project.json             고친 JSON 을 통째로 저장한다(받은 뒤 다른 저장이 있었으면 conflict)
    ./oprn shot [mapId] [이름]          열린 편집기 화면을 찍는다(그 맵을 열고). PNG 경로를 돌려준다 — Read 로 열어 본다
    ./oprn check                        지금 게임을 자동 검사한다(엔딩까지 자동 플레이 포함, 1~5분)

- 도구 결과는 JSON 이다: `ok`, `summary`, `issues`, `data`. `ok:false` 면 저장되지 않았다 — 이유를 읽고 고쳐 다시 부른다.
- 도구는 편집기 조수가 쓰는 것과 같다. 맵 짓기(author_*·make_place·compose_*), 사람·이벤트(place_npc·upsert_event·…),
  DB(아이템·적·전투), 게임 흐름(define_ending·…) 이 있다. 먼저 `./oprn tools` 로 훑고 필요한 것의 `schema` 를 본다.
- `get`/`put` 은 도구가 못 하는 세부 수정에만 쓴다. 넣은 JSON 이 틀리면 저장이 거부된다.
- 다 만들면 `./oprn check` 와 `./oprn shot` 으로 확인하고 고친다. 플레이어는 이 게임을 처음부터 엔딩까지 실제로 해 본다.

## 할 일

TASK.md 에 사용자가 편집기에 적은 요청이 그대로 있다. 사람에게 되묻지 않는다(답할 사람이 없다). 네가 판단해서 끝까지 만든다.
