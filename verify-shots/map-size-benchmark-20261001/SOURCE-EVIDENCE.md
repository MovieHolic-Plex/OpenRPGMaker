# 맵 크기 증가에 민감한 코드

측정 대상은 최적화 전 커밋 e8005d88ddd7b2a271965250b853c9d81a3031b3의 출하 플레이어 경로다. 아래 줄 좌표는 이 기준선의 좌표이며 최적화 후 작업 파일과 다를 수 있다. 설치된 Phaser는 3.90.0이다.
성능 수치는 `SUMMARY.md`, 전체 실행·프레임 표본은 `raw-results.json`에 있다.

## 1. 맵 진입에서 전체 타일을 생성한다

`src/player/playSceneMapRuntime.ts:187`의 `loadMap`은 맵을 복제하고 `renderTiles`를 호출한다.
같은 파일 261행의 두 반복문은 가로×세로 전체 칸을 순회한다.
측정용 합본 마을 타일 360은 쿼터 합성으로 칸당 이미지 4개를 만든다.
실제 관측값은 256²에서 262,144개, 512²에서 1,048,576개다.

## 2. 생성 비용에는 단순 선형이 아닌 구간이 있다

`src/player/playSceneMapRuntime.ts:446`은 각 이미지를 `.add(image)`로 컨테이너에 넣는다.
Phaser의 `node_modules/phaser/src/gameobjects/container/Container.js:543`은
`ArrayUtils.Add(this.list, child, ...)`를 호출한다.
`node_modules/phaser/src/utils/array/Add.js:48`은 이미 존재하는지 확인하기 위해
매번 `array.indexOf(item)`으로 기존 목록을 검색한 다음 `push`한다.

모두 서로 다른 이미지를 차례로 넣으면 검색 대상 개수의 합은
`0 + 1 + ... + (N-1) = N(N-1)/2`다. 이미지 수 N이 4배가 되면 이 구간의
검색량은 약 16배가 된다. 실제 브라우저 맵 진입 시간은 이 검색 외에도 객체 생성,
맵 복제, 런타임 초기화 등을 포함하므로 전체 시간이 정확히 16배라는 뜻은 아니다.
개별 함수 CPU 프로파일로 원인별 시간 비중을 분리한 실험은 하지 않았다.

## 3. 화면 밖 숨김은 전체 목록 순회를 제거하지 않는다

`src/player/playSceneTileCulling.ts:122` 이후는 화면 밖 객체의 표시를 끈다.
Phaser의 `node_modules/phaser/src/gameobjects/container/ContainerWebGLRenderer.js:64`는
매 프레임 모든 자식을 순회하고 68행에서 `willRender`를 검사한다.
따라서 실제로 표시되는 타일 객체 수가 같아도 전체 목록을 확인하는 비용은 늘어난다.
측정에서는 두 크기 모두 보이는 객체가 2,000개였지만 전체 객체 수는 4배였다.

## 4. 편집기와 게임의 최적화는 다르다

`src/editor/editSceneRender.ts:111`의 기준은 2,048칸이다. 이를 넘는 맵은
카메라 주변 칸만 생성하는 경로를 사용한다. 이번 실측은 게임 런타임이며,
편집기의 붓·되돌리기·파일 저장 시간을 측정한 결과로 대체할 수 없다.

## 해석 범위

이 실험은 메모리 부족이나 GC 임계점을 찾는 실험이 아니다.
정적 바닥, NPC 0명, 동일 카메라·화면·타일 밀도를 통제한 크기 비교이며
복잡한 실제 맵이나 사용자의 GPU에서 동일한 절대 시간·FPS를 보장하지 않는다.
