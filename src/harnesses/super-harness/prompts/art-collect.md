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

사람 선택 화면은 감독의 art_choices.py가 실제 receipt에서 만든다. 현재 지원 receipt:
- modern-chipset parking-kit: contractSha256, candidates[].candidate/imageSha256/machine/independent,
  receipt와 같은 폴더의 A~E.png. independent는 png_sha256와 13품목 items[].id/verdict를 포함한다.
- interior-props: runs(해당 native DB 행), candidateImages(path/sha256). 각 run.review의 pack/ctx-cand.png를 보존한다.
다른 하네스는 선택 예시 어댑터가 필요하다고 remaining에 적는다. 검사 결과를 만들어 맞추거나 후보를 대신 선택하지 않는다.
