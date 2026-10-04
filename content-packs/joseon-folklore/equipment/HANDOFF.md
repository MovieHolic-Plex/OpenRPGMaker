# Equipment 전체 36종 인계

## 완료 산출물

- 이전 샘플 8종의 실제 레코드와 원본 PNG 해시 유지. 비교 정본은 `review/pilot-baseline.json`이며 이전 커밋은 `a31181e77b`.
- 직업4 × 등급4 무기16/의복16 + 공유 머리2/장신구2 = **장비36/원본 아이콘36**.
- 등급 권장 레벨1/5/10/15. 가격·스탯 전체 목록은 `catalog.md`; 획득 지역과 형태 근거는 `design.json`.
- 코드 도트 원본은 `draw.py`, 데이터 저작 원본은 `author.py`, 출처 URL과 창작 범위는 README/design에 보존.
- `assets.json`에는 resourceId, sourcePath, 통합 대상 path, 원본 PNG SHA-256과 RGBA 픽셀 SHA-256을 기록.
- 실제 정규화와 직렬화 재로드, 직업별144 장착 조합, 초보144 거부, PNG36 decode·고유성·재생성 일치를 검증. 증거는 `review/smoke.json`과 `review/reproducibility.json`.
- 원본 PNG에서 만든 직업별/공유 검토 시트의 1배 밝은 배경과 5배 nearest 어두운 배경을 작성자가 직접 열람. 사용자 승인이라고 주장하지 않는다.

## 감독자 통합

1. 이 변경은 이전 파일럿 커밋 위의 **새 feat 커밋**이다. 이전8종 파일을 유지하면서 신규28종·전체 데이터·검토 근거를 추가한다.
2. `assets.json`의 sourcePath는 이 폴더 기준이며 경로 앞에 `public/`을 붙인 대상에 복사 후 같은 resourceId로 등록한다. 현재 public 등록은 미수행.
3. 무기·의복 계약 ID의 마지막 숫자는 등급이다. 의복 ID에는 body를 쓰되 실제 슬롯은 armor를 사용한다. 공유는 `equip_jf_shared_head_1/_2`, `equip_jf_shared_accessory_1/_2`이며 슬롯 helmet/accessory다.
4. 클래스 permissions는 `class-links.json`을 연결한다: actorIds/classIds는 []이며 equipmentIds에 해당 직업8종+공유4종만. 초보에는 이 장비를 허용하지 않는다. 포괄 클래스 허용은 엔진 OR 규칙 때문에 전용 제한을 무력화한다.
5. skills 담당의 예약 물리 속성 `element_jf_physical`와 classes 담당의 `class_jf_*`를 함께 통합한다. 다른 역할의 레코드·코어·등록기·계약을 직접 수정하지 않았다.
6. 첫 전직 초급 세트 지급과 권장 단계별 상점 배치를 제안했으나 실제 이벤트·상점은 미구현이다. 초기금80으로 초급 무기·의복을 동시에 구매할 수 없다.

## 효과와 한계

- 실제 효과는 공격·방어·정신·민첩의 고정 보정, 도적 무기의 치명타 보정, 무기의 예약 물리 속성뿐이다. 다른 effectFlags는 모두 false이며 상태저항·기력할인·자동 정화·귀신 특효·장비 전용 기술은 없다.
- 레벨은 권장 설계값이다. 실제 최소레벨 장착 강제는 엔진 계약에 없으며 추가하지 않았다.
- Actor1 이동/전투 그림을 바꾸는 장비 외형이 아닌 32px 자료집·메뉴 아이콘이다.
- 새 그림은 조선풍 창작 단순화이며 유물 사진 복제가 아니다. 도사의 접선 사용, 노리개의 성별·직업 공용 사용, 전용 클래스 제한은 게임 설정이다.
- 성장 단계의 수치·가격은 점진적으로 증가하도록 정했으나 통합 게임의 전투·경제 플레이 검수는 아직 수행하지 않았다.
- 작성자 이미지 검토와 ready는 사용자 승인/실제 게임 통합/정본 저장 완료를 뜻하지 않는다. DB·다른 프로젝트·공용 코드·전체 테스트·stash·push 작업 없음.

## 재생성

```bash
python3 content-packs/joseon-folklore/equipment/author.py
node content-packs/joseon-folklore/equipment/run-smoke.mjs
python3 content-packs/joseon-folklore/equipment/verify-assets.py
```

생성기는 ready=false로 시작한다. 그림을 다시 보고 리뷰를 갱신한 후 status를 마지막에 확정한다. 전체 상태는 `phase=full, ready=true`이며 정확한 의미는 상태 파일에 명시한다.
