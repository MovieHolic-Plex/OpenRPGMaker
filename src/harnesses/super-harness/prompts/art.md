# 부족한 칩을 실제 후보로 제작

개념: {{CONCEPT}}
독립 작업 워크트리: {{ROOT}}
재료 조사/부족분: {{CDIR}}/materials.json, {{CDIR}}/gaps.json
결과: {{CDIR}}/art-result.json

이 작업은 전용 하네스 실행에 필요한 주문서·격리 데이터·판을 준비한다. 실제 그림은 감독 프로세스가 이어서 실행하며, 결과 수집 작업자가 PNG와 검수 결과를 화면에 올린다.
지원 범위를 확장할 때도 후보를 하나도 그리지 않은 채 문서/시드만 쓰고 끝내지 않는다. 필요한 각 품목당 후보 수는 해당 하네스 기본값을 따른다. 부족한 재료의 실제 후보 그림을 만들고 해당 하네스 검사 결과를 남긴다.
먼저 `{{CDIR}}/reference-source.json`이 있으면 읽는다. 정본에서 읽고 소유 번들 표지를 복원한 참고문서 추출본과 출처가 제공되면 그 INDEX의 해당 용도 MD 전 페이지와 이미지를 읽고 사용한다. DB에 referenceDocumentsOwner=bundle만 저장된 것은 자료 없음이 아니다. 이미 추출한 자료가 있으면 프로젝트 연결을 다시 찾느라 후보 제작을 멈추지 않는다.
먼저 워크트리 AGENTS.md와 대상 하네스 문서를 읽는다. 다른 워크트리/프로젝트 정본을 수정하지 않는다.
조선에는 joseon-baram, 현대에는 modern-chipset, 일본에는 jp-city, 중세 실내에는 interior-props를 사용한다.
후보 생성·검사 실행을 위한 시드와 판을 준비한다. 이 작업자 안에서 하위 LLM을 실행하지 않는다. 임의의 공통 생성기로 시대/팔레트 계약을 우회하지 않는다.
등록되지 않은 종류라면 이 워크트리에서 해당 하네스의 시드/후보 생성 경로를 필요한 범위만 확장한다.
조선은 코드 도트·팔레트 잠금·조각 관문·독립 culture/view 검수 계약을 따른다.
생성 이미지와 생성 캐릭터 금지. 구조 마감에는 벽 네 방향·모서리·연결·문 개구부·통행 정보를 함께 만든다.
이벤트 그림은 닫힘/열림 상태와 동일 원점·축척을 갖춘다. 새 그림의 공용 번들/참고문서 등록 소스도 준비한다.

후보 선택은 사람의 몫이다. 대신 pick/accept 하지 않는다. 자동 머지·설치·발행하지 않는다.
하위 풀/선택/출력 폴더는 이 워크트리 아래로 격리한다. 다른 서비스의 후보·선택을 건드리지 않는다.
워크트리 밖 공유 데이터만 지원하는 도구는 먼저 이 워크트리의 도구에 데이터 경로 옵션을 추가한다.
interior-props의 draw는 판만 준비하고 pool은 실행하지 않는다. modern-chipset은 draw가 바로 작업자를 띄우므로
시드와 make_brief/state.json 준비를 수행하는 prepare 경로를 추가해 그 명령만 실행한다.
새로운 모델 선택·임의 생성기·delegate 백엔드로 우회하지 않는다. 각 하네스의 기본 후보 수/모델을 유지한다.
기존 프로젝트의 해당 용도 참고문서를 확인해야 하는 경우 연결된 정본에서 추출하고 실제 이미지를 읽는다.
연결/참고문서가 없으면 사유를 적고 막힘으로 끝낸다. 임시 그림을 승인된 칩으로 속이지 않는다.

준비가 끝나면 art-result.json에 아래 execution만 기록하고 종료한다. 감독이 해당 하네스를 직접 실행한다.
경로는 전부 이 워크트리 기준이며 실제로 만들어진 디렉터리여야 한다.

interior-props:
```json
{"execution":{"harness":"interior-props","data":"art-output/data","picks":"art-output/picks"},"remaining":[]}
```
modern-chipset (기본 5개 후보가 있는 준비된 state.json을 갖는 판):
```json
{"execution":{"harness":"modern-chipset","data":"harness-data/isolated","runs":"qa-runs/isolated","viz":"qa-runs/isolated-viz","round":"준비된-판-id"},"remaining":[]}
```
감독은 interior-props pool 또는 modern-chipset _run만 실행한다. pick/bake/설치는 실행하지 않는다.
joseon-baram/jp-city는 아직 감독 직접 실행 어댑터가 없으므로 사유를 적고 막힘으로 반환한다.
준비하지 못했다면 candidates=[]와 구체적인 reasons를 쓴다. 직접 그렸거나 완료했다고 주장하지 않는다.
