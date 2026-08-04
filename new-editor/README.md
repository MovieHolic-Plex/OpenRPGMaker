# new-editor — 이벤트 에디터를 목업과 같게 만드는 루프

```
new-editor/
  README.md                        ← 지금 이 파일. 루프 진입점.
  SPEC.md                          ← 자세한 지시사항 (영역별 계약 · 전역 규칙 · 검증)
  CHECKLIST.md                     ← 라운드마다 채점하는 표. 루프 종료 조건.
  render-mockup.mjs                ← 목업 HTML → PNG 재렌더
  mockup/
    event-editor-mockup.html       ← 목업 정본 (여기를 고친다)
    event-editor-mockup.png        ← 위 파일의 렌더 (감독 검수용)
```

## 루프에 넣을 프롬프트

`/loop` 나 스케줄러에 아래를 그대로 준다. 한 라운드에 한 영역만 간다.

```
new-editor/SPEC.md 와 new-editor/CHECKLIST.md 를 읽어라.
new-editor/mockup/event-editor-mockup.png 가 목표 그림이다.

1. 현재 화면을 캡처한다:
   npx playwright test eventEditorMockupShots.spec.ts --reporter=line
2. output/evidence/event-editor-mockup/01-shell.png 과 목업 PNG 를 실제로 열어서
   나란히 비교한다. 숫자만 보지 말고 그림을 봐라.
3. CHECKLIST.md 의 A~G 를 0~3 으로 채점하고, 점수를 표에 갱신한다.
4. 가장 점수가 낮은 영역 하나만 고른다. 여러 영역을 한 번에 건드리지 마라.
5. SPEC.md §2 의 해당 파일만 고친다. 목업 CSS 를 복사하지 마라.
6. 다시 캡처해서 눈으로 확인한다. [parity] 10항목이 전부 true 여야 한다.
7. npm run typecheck:app 통과를 확인한다.
8. 한 커밋으로 남긴다. 커밋 메시지에 "무엇이 몇 점에서 몇 점이 됐는지"를 적는다.

고칠 게 없다고 판단되면 그렇게 말하고 멈춰라. 억지로 바꾸지 마라.
```

## 종료 조건

- `CHECKLIST.md` 의 A~G 가 **전부 3점**이고,
- `[parity]` 10/10 이고,
- 연속 2라운드 동안 새로 내릴 점수가 없으면 멈춘다.

## 목업을 바꾸고 싶을 때

목업이 틀렸다고 판단되면 **코드가 아니라 목업을 고친다.**

```bash
# 1) mockup/event-editor-mockup.html 을 편집
# 2) PNG 재렌더
node new-editor/render-mockup.mjs
# 3) SPEC.md 의 해당 영역 계약도 같이 갱신 (그림과 글이 어긋나면 루프가 흔들린다)
```

## 출처에 대한 정직한 메모

`docs`/커밋 메시지가 말하는 "승인된 목업(v1)"은 **리포에 커밋된 적이 없다.**
대화로만 전달됐던 것으로 보인다. 그래서 이 디렉토리의 목업은 **원본 복구가 아니라**,
현재 구현 + 스크린샷 7장 기반 적대적 리뷰 결과를 반영해 새로 그린 **목표안(v2)** 이다.

원본 v1 이미지를 갖고 계시면 `mockup/event-editor-mockup.png` 를 그것으로 교체하고,
`mockup/event-editor-mockup.html` 은 지우거나 참고용으로 남기면 된다.
그 경우 SPEC.md §4 의 수치도 원본에 맞춰 다시 적어야 한다.
