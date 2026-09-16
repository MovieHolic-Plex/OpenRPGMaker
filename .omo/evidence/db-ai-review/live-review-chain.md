# 실모델 DB 턴: 검토 승인까지 도달, 적용은 게이트에서 막힌다 (2026-09-16)

## 지금 되는 것 (실모델 라이브, 반복 관측)
```
phase:review
independent-review {"status":"approved","revision":2,
  "summary":"슬라임(enemy_slime)의 최대 HP가 기존 78에서 300으로 정상 변경되었으며, 다른 스탯 및 데이터베이스 레코드는 변경 없이 보존되었습니다.","findings":[]}
CARDS [{"id":"enemy_slime","change":"changed","fields":["최대 HP 78→300 +222"]}]
STORE_DURING_REVIEW {"maxHp":78,"unchanged":true}     ← 검토 단계에서는 적용되지 않는다(정직한 보류)
AFTER {"maxHp":78, "statusText":"적용 실패 — 변경을 적용하지 못했습니다 — 커밋 게이트가 반려했거나 기준 프로젝트가 바뀜습니다."}
```
즉 실모델이 초안을 만들고, 독립 검수가 **승인**하고, 표면에 바뀐 레코드 카드가 뜬다. 남은 것은 **적용 클릭** 하나다.

## 적용이 막히던 조건 — 계측으로 특정하고 고쳤다

`assistantSession.isDraftReviewApproved()` 에 임시 계측을 넣어 적용 시점 값을 떴다(계측은 되돌렸다):
```
검토 중   {"composerMode":"do","baselineCurrent":true,"hasReviewTurn":true,"signalAborted":false,"reviewStatus":"approved","identityMatch":true}
적용 시점  {..., "signalAborted":true, ...}
```
승인·기준선·정체성은 살아 있는데 **런 시그널만** 죽어 있었다. retire 주체를 스택으로 잡으니
`aiTurnRunner.finishTurn` 이었고(턴 종료 시 무조건 `session.retireRun()`), 승인이 런 시그널에 묶여 있어
**지연 적용(deferred)의 승인이 무효화**됐다.

고침: 검토 대기로 초안을 넘 턴(`heldProposalForReview`)은 `finishTurn` 에서 런을 retire 하지 않는다.
사용자가 적용/폐기하거나 다음 턴이 시작될 때 `beginRunOperation` 이 retire 한다.

## 라이브 실증 — 검토 → 적용 / 검토 → 폐기 (실모델)
```
[적용] independent-review {"status":"approved","revision":2}
       STORE_DURING_REVIEW {"maxHp":78,"unchanged":true}
       AFTER {"maxHp":300,"phase":"done","statusText":"적용됐어요 · 레코드 1건 — 화면에 바로 반영됩니다",
              "undoHidden":false,"undoLabel":"되돌리기: AI: 적 '슬라임' 수정 외 1건"}

[폐기] independent-review {"status":"approved","revision":3}
       STORE_DURING_REVIEW {"maxHp":78,"unchanged":true}
       AFTER {"maxHp":78,"phase":"done","statusText":"버렸어요 · 레코드 1건 — 프로젝트는 그대로입니다","undoHidden":true}
```
두 경우 모두 검토 단계에서는 프로젝트가 바뀌지 않고, 적용은 store 에 반영되며 되돌리기가 남고,
폐기는 아무것도 남기지 않는다.

## 그 전에 고친 세 가지 (같은 라이브로 확정)
1. **정확한 평가자 없음** — DB 레코드 속성 변경이 `functionalUnresolved` 로 남고 모델이 `repair_acceptance` 로 닫으려다 라운드를 태웠다(16라운드 중 9회 헛 조회). → `dbRecordValues` 기준 추가(PR #863).
2. **주입 컨텍스트가 요청으로 회계됨** — 코드가 붙인 `[컨텍스트] …` footer 가 "인용되지 않은 요청 텍스트" 로 계산돼 닫을 수 없는 항목이 됐다. → footer 를 요청 텍스트에서 제거(PR #863).
3. **감사는 읽기 전에 돌아 id 를 모른다** — "Identify the database record ID for '슬라임' …" 이라는 닫을 수 없는 항목이 생겼다. → recordName(유일 해석) 허용(PR #863).

## 아직 남은 한계
- 라운드 예산이 빠듯해 검토 도달이 **비결정적**이다: 같은 조건에서 phase:review 도달과 미도달(max-tool-calls)이 모두 관측됐다.
- `dbRecordValues` 는 저장된 필드값만 증명한다 — 타임 전투 동작은 여전히 미평가 항목으로 남는다.
- 이 검증은 dev showcase 프로젝트 + 원격 저장이 꺼진 경로다(프로젝트 행을 쓰지 않는다).
