# Full 행동 검토판

full-normals-1.png, full-normals-2.png, full-bosses.png는 **실제 기술 레코드와 실제 전투엔진 실행 기록**을 배치한 검토판이다. 게임 화면/새 몬스터 그림이 아니다.

몬스터 그림은 다른 담당의 원본15시트(native64/보스96)를 직접 읽어 idle cell과 nearest 배율로 표시한다. 직접 원본·검토판을 열었다. 원본/결과 해시는 content-packs/joseon-folklore/behavior/provenance.json과 status.json 참조. MP0 네 종의 양성 검사 보충과 원본 능력치 검사 결과를 구분한다.

```bash
python3 scripts/content/joseon-folklore/behavior/render-review.py
```

새 코드 조립은 behavior 세션 저작. 원본 그림의 새로운 소유권/외부 재배포 권한을 주장하지 않는다. 사용자 승인 여부는 별도다.
