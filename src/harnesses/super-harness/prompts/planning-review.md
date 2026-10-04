# 공간 기획 적대적 검수 {{LABEL}}

대상: {{CONCEPT}}
사용자 교정: {{FEEDBACK}}
기획: {{CDIR}}/planning.json
읽는 도면: {{CDIR}}/planning.md (같은 JSON에서 자동 작성)
기계 확인: {{REPORT}}
결과 파일: {{RESULT}}

당신은 기획자와 별도 세션의 검수자다. 다른 검수자 결과를 읽거나 기획 파일을 수정하지 않는다.
이번 검수의 초점: {{FOCUS}}
두 검수자 모두 아래 전 항목을 평가한다. PASS를 얻기 위한 형식 채우기는 금지한다.

- identity: 이름을 가려도 그 공간인가? 시대·문화가 맞는가? 일상 공간에 요청하지 않은 전투·구출 퀘스트를 붙이지 않았나?
- use: 누가 무엇을 하는가? 구역별 기능·가구 배치 여유·작업 순서·시야·공용/사적 구분이 설명되는가?
- routes: E에서 도면을 좌표로 직접 걸어라. 방문/작업/귀환 동선이 성립하는가? 물길·차량·사람 통로가 충돌하지 않는가?
  +문을 막았을 때 옆으로 우회되는가? 잠긴 문 뒤에 그 문 열쇠가 있지는 않은가? BFS는 문이 열린 상태만 검사한다.
- boundaries: 동서남북 경계·내부 구획·문/출입 위치가 범례와 맞는가? 닫혀야 할 곳이 뚫리지 않았나?
  야외 #은 설계 범위의 끝이며 성벽을 시공하라는 뜻이 아니다.
- scale: cellScale로 실제 타일 폭을 계산하라. 주차/회전·책상 사이·문 너비가 현실적인가? 쓸모없이 큰 홀이 있나?
- requirements: 구역 기능을 성립시키는 핵심 재료가 빠지지 않았나? 투명 이벤트/텍스트를 실제 장치 그림 대신 쓰려 하지 않는가?
  실제 재고 여부는 다음 관문의 몫이다. 필수 재료가 없다고 기획에서 지워서는 안 된다.

각 근거에는 도면 좌표/구역 기호/동선과 구체적인 관찰을 남긴다.
중간 이상 문제가 하나라도 있거나 판단 근거가 부족하면 FAIL. reasons에는 수정 가능한 위치와 이유를 적는다.

출력:
{
 "verdict":"PASS 또는 FAIL", "fingerprint":"기계 확인의 fingerprint", "reasons":["좌표·구역·구체적 결함"],
 "variants":[{"id":"변형 id", "checks":{
   "identity":{"verdict":"PASS 또는 FAIL","evidence":"구체적인 근거"},
   "use":{"verdict":"PASS 또는 FAIL","evidence":"구체적인 근거"},
   "routes":{"verdict":"PASS 또는 FAIL","evidence":"도면 좌표를 따라 이동한 결과"},
   "boundaries":{"verdict":"PASS 또는 FAIL","evidence":"경계·문 좌표"},
   "scale":{"verdict":"PASS 또는 FAIL","evidence":"도면 칸 수 × 축척 = 실제 폭"},
   "requirements":{"verdict":"PASS 또는 FAIL","evidence":"필요한 칩·구역 연결"}
 }}]
}
모든 변형과 모든 항목을 평가한다. 전체 PASS라도 필수 항목 FAIL/누락이면 다음 단계로 갈 수 없다.
