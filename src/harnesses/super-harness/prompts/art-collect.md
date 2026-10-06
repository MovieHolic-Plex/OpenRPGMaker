# 전용 하네스 후보 결과 수집

격리 워크트리: {{ROOT}}
개념 폴더: {{CDIR}}
감독이 art-execution.json의 전용 하네스를 직접 실행했다. art-execution-result.json과 해당 판의 실제 검사·독립 검수 결과를 읽는다.
새 하위 작업자를 시작하거나 그림을 직접 수정하지 않는다. 후보 선택·공용 설치·굽기·머지를 하지 않는다.
실제 후보 PNG를 열어 보고, 후보별 검사 상태가 드러나는 보기용 시트/확대 이미지를 해당 하네스 기능으로 준비한다.
통과·실패·검수 누락을 구분한다. 기계 검사나 개별 그림 검수 PASS를 공간 배치/도구 통합 완료로 표시하지 않는다.
결과는 {{CDIR}}/art-result.json에 원자적으로 덮어쓴다. 실행 요청 execution 필드는 결과에 남기지 않는다.

```json
{
 "candidates":[{
   "harness":"interior-props 또는 modern-chipset",
   "items":["요구사항 id"],
   "receipt":{"path":"워크트리 상대 경로의 실제 하네스 검사 JSON","sha256":"파일 해시"},
   "images":[{"path":"워크트리 상대 경로의 후보 PNG","sha256":"파일 해시","label":"후보 이름과 현재 검수 상태"}],
   "selection":"사람이 후보를 확인할 시트/번호 안내"
 }],
 "reasons":[],"remaining":["사람 선택·공용 등록", "미구현 도구/미검수 항목"]
}
```
실제 후보가 없으면 candidates=[]와 정확한 실패 이유를 기록한다. 다른 판의 PNG나 승인 결과를 가져오지 않는다.

전용 테마는 이번 실행에서 만든 모든 원본 PNG를 `themeCoverage`의 실제 요구사항 id에 연결한다.
아직 만들지 않은 재료는 빈 배열/누락 목록으로 정직하게 남긴다. 이번 실행의 candidates/receipt만 반환한다.
감독이 `art-batches/`의 이전 실행 영수증을 해시 확인하여 누적하고, 누락 재료는 다음 제작으로 넘긴다.
현재 실행이 만들지 않은 이전 PNG를 이번 영수증에 넣거나 기존 영수증을 덮어쓰지 않는다.

사람 선택 화면은 감독의 art_choices.py가 실제 receipt에서 만든다. 현재 지원 receipt:
- modern-chipset parking-kit: contractSha256, candidates[].candidate/imageSha256/machine/independent,
  receipt와 같은 폴더의 A~E.png. independent는 png_sha256와 13품목 items[].id/verdict를 포함한다.
- interior-props: runs(해당 native DB 행), candidateImages(path/sha256). 각 run.review의 pack/ctx-cand.png를 보존한다.
다른 하네스는 선택 예시 어댑터가 필요하다고 remaining에 적는다. 검사 결과를 만들어 맞추거나 후보를 대신 선택하지 않는다.

parking-kit은 부품별 PASS 외에 실제 조립 예시의 독립 검수가 필요하다. 감독의
art-context-review.json(identity/scale/attachments/circulation/style)을 준비 없이 PASS로 만들지 않는다.
사용자 반려와 parking-repair-brief.json이 있으면 작은 실제 자동차 기준 표본의 범위를 먼저 따른다.

자동 수정 판에서는 art-feedback.json의 반영 내역을 남기고 원본/새 후보를 혼동하지 않는다.
작은 주차장 표본의 receipt.candidates[].contextImages(path/sha256/label)는 실제 native 조립 PNG를,
contextSources는 같은 장면의 기준 자동차 등 출처 파일을 가리킨다. 해당 파일을 새로 그리거나 결과를 위조하지 않는다.
감독이 조립 예시를 별도 독립 작업자에게 검수시키며 실패하면 그 지적으로 다시 제작한다. 수집 작업자는 조립 PASS를 만들지 않는다.


수집 뒤 필수 art-demo 단계가 모든 품목을 함께 사용한 공간 전체를 조립한다.
부품 선택에서 멈추거나 사용자에게 등록·조립을 떠넘기지 않는다. 수집자는 원본 receipt와 PNG를
보존하여 데모 조립에 넘긴다. 데모는 그림의 품질 불합격을 숨기지 않고 독립 검수·기존 자동 수정 경로로 이어진다.
