# 공간 기획과 텍스트 도면 작성

개념: {{CONCEPT}}
사용자 교정(최우선): {{FEEDBACK}}
기획 반려 사유: {{REASONS}}
저장소: {{ROOT}}
결과: {{CDIR}}/planning.json
세계관: {{WORLDVIEWS}}

이 작업의 종료 조건은 planning.json 작성과 스스로 하는 도면 형식·연결 확인이다.
별도 에이전트를 생성하거나 검수자를 호출/기다리지 않는다. 적대적 A/B 검수는 이 작업이 종료된 뒤 하네스가 별도 작업으로 실행한다.
planning-reviews 파일을 쓰거나 PASS를 만들지 않는다. 기획 파일을 저장하면 이 세션을 종료한다.

이 단계는 공간의 기획이다. 맵·card.json·예제 호출·타일 배치를 만들지 않는다.
기존 planning.json이 있으면 반려 이유를 반영해 수정한다. 옛 card.json은 실패한 참고일 수 있으며 정답으로 복사하지 않는다.
같은 세계관·기능의 공간을 사람이 알아보고 사용할 수 있는지 먼저 정한다.
기존 재료와 조립 지침을 참고하되 재료가 없다는 이유로 정체성을 바꾸지 않는다. 부족한 재료는 필수 목록에 그대로 남긴다.
주차장은 진입/출차/회전/보행, 교실은 수업/칠판 시야/책상 사이 이동, 주막은 손님/주인/조리/수납 동선을 기획한다.
일상 공간에 임의의 함정·구출·전투를 넣지 않는다. 감옥도 사용자 요청이 단순 시설이면 구출 퀘스트를 필수로 붙이지 않는다.

먼저 구역과 연결을 결정하고 **ASCII 평면도로 직접 그려라**. 기획자와 독립된 두 검수자가 이 도면만 보고 반박할 것이다.
도면은 타일 원본이 아니라 약식 공간 계획이다. 한 칸의 축척을 명시하고 차량·문·가구·통로 폭을 그 축척으로 설명한다.
문을 지웠더니 옆으로 우회 가능한지, 출입구가 막혔는지, 사용자가 목적 공간을 찾을 수 있는지 스스로 걸어 본다.

## 크기는 내용으로 산출한다 — open/corridor도 필수
scaleReason에 현재 전체/실내 가로×세로, 가구 수와 점유, 통로 폭을 적는다.
더 좁은 안과 더 짧은 안을 최소 하나씩 좌표로 비교하고, 불필요한 패딩·중복 면적을 제거한 안을 도면으로 채택한다. 수학적인 최소 면적 증명은 요구하지 않는다. 가구 사이 가독성·구역 구분·동시 이용에 필요한 여유는 위치와 용도를 설명한다.
각 안의 가로×세로·면적, 줄인 행/열, 실제로 통과/실패한 동작과 좌표를 scaleReason에 남긴다.
같은 통로에서 가능한 여러 활동을 별도 면적으로 중복 합산하지 않는다.
사용자 요청이 교실12석이면 좌석 수·책상/인물 크기는 보존한다. 줄일 것은 남는 바닥과 외곽이다.
구체 동작이 아니라 '시야/안전/분산/발표용'이라는 이름만 붙인 전폭 빈 띠는 면적 근거로 인정하지 않는다.

planning.json 스키마(version=1):
{
 "version":1, "concept":"개념 폴더 id",
 "variants":[{
   "id":"변형 id", "title":"사람이 읽는 이름", "worldviewId":"시드의 시대 id",
   "layout":"room|building|dungeon|outdoor", "spaceProfile":"compact|open|corridor",
   "purpose":"누가 무엇을 위해 쓰는 공간인가", "experience":"그 공간에서 하는 활동·느껴져야 할 특징",
   "cellScale":2, "scaleReason":"한 칸=2타일인 이유·주요 통로/가구/차량의 실제 폭",
   "diagram":["#######","#AA+BB#","#AA#BB#","####E##"],
   "zones":[
     {"symbol":"A","name":"구역 이름","purpose":"구역 기능과 필요 면적","requirements":["재료 id"]},
     {"symbol":"B","name":"구역 이름","purpose":"구역 기능과 필요 면적","requirements":["재료 id"]}
   ],
   "routes":[{"name":"주 동선","via":["E","B","A"],"purpose":"누가 이 순서로 움직이는지·문/잠금/되돌아오는 길"}],
   "requirements":[{"id":"재료 id","role":"floor|wall|ceiling|prop|event-graphic|terrain","what":"시대/용도에 필요한 구체적인 칩"}]
 }]
}
위 도면은 형식 예시일 뿐이며 개념에 맞게 새로 그린다. JSON 안의 enum은 한 값만 선택한다.
모든 줄 같은 폭, 3~80칸(가급적 10~40). ASCII만 사용한다. 구역 설명은 한국어 범례로 쓴다.
#=벽/구역 밖, .=통로, +=문, E=진입점(정확히 하나), X=추가 외부 출구, 나머지 대문자=구역(E/X 제외).
바깥 테두리는 #/E/X만. 야외에서도 #은 실제 벽을 요구하는 뜻이 아니라 이번 기획 범위 밖이다.
걷는 칸(모든 # 아닌 칸)은 상하좌우로 E에서 닿아야 한다. +는 문이 열린 상태의 연결이며 잠금/열쇠 조건은 routes에 설명한다.
범례는 도면의 모든 구역과 1:1로 일치하고 via는 E/X 또는 구역 기호를 쓴다. 좌표는 왼쪽 위(0,0).
필수 재료 목록에는 실내 floor/wall/ceiling, 핵심 prop/terrain, 필요한 event-graphic를 넣는다.
두 검수자 모두 기획·도면을 승인하기 전에는 다음 단계로 갈 수 없다.

공간 설계 참고(용도 판단 우선):
{{SPACE}}

## 큰 공간의 전체 배치 → 세부 구역 → 연결

cellScale>1 또는 도면 한 변>60이면 variants[].details가 필수다. 전체 배치도를 유지하되 상세 구역 2개 이상으로 나눈다.
각 세부 도면은 **한 글자=실제 1타일**이며 3~80칸이다. overview의 모든 구역 기호를 parentZones로 빠짐없이 상세화한다.
큰 평면 배열은 Python으로 작성해 행 길이를 확인한다. 계단실/차로/주차면/벽/기둥의 유효폭을 실제 칸으로 그린다.

각 details 항목은 기존 변형과 같은 purpose/experience/scaleReason/diagram/zones/routes 구조를 가지며,
requirements/worldviewId/layout/spaceProfile은 상위 기획을 상속한다. 추가 필드:
{
 "id":"north", "title":"입출차·북쪽 회전 구역", "parentZones":["R","S","T"],
 "origin":[0,0], "cellScale":1,
 "purpose":"...", "experience":"...", "scaleReason":"실제 타일 폭으로 설명",
 "diagram":["..."], "zones":[{"symbol":"A","name":"...","purpose":"...","requirements":[]}],
 "routes":[{"name":"...","via":["E","A"],"purpose":"..."}],
 "ports":[{"id":"south-lane","side":"south","offset":10,"width":4,
           "kind":"vehicle","level":-1,"connectsTo":"south/north-lane"}]
}

origin은 전체 지도에서 좌상단의 **실제 타일 좌표**다. 상세 도면의 직사각형 범위끼리는 겹치지 않는다.
전체 지도 크기는 overview diagram의 가로/세로 × cellScale. 상세 도면은 이 안에 들어가야 한다.
side=north/south/west/east. offset은 그 변의 왼쪽 또는 위에서 센 시작 좌표. width는 실제 연속 출입 칸 수.
연결부의 모든 칸은 경계 E/X로 그린다. 각 상세도의 E 하나는 그 구역의 로컬 진입점이며 나머지 출입 칸은 X.
모든 경계 E/X에 ports 선언이 필요하다. 연결부마다 반대 구역의 ports에 상호 id를 연결한다.
양쪽 연결부 좌표가 서로 한 칸 간격으로 접하고 방향·폭·kind(walk/vehicle/water)·level이 일치해야 한다.
외부 출구만 connectsTo="outside". 해당 실제 좌표를 overview 축척으로 나눴을 때 전체 도면의 E/X 칸이어야 한다.
모든 상세 구역이 ports를 통해 연결되어야 한다. 전체 구역을 재배치해야 하면 전체 도면도 함께 수정한다.
숫자 게이트만 맞추려고 벽/문을 왜곡하지 않는다. 실제 쓸 수 있는 구역과 접속 동선을 설계한다.

기획 파일 저장 후 다음 명령으로 스스로 기계 확인한다. 오류만 수정하고 파일을 저장한 뒤 종료한다:
`python3 {{ROOT}}/src/harnesses/super-harness/gates.py planning {{CDIR}} --draft`
상세 도면의 독립 검수는 하네스가 다음 단계로 실행한다. 다른 검수자를 직접 부르지 않는다.
