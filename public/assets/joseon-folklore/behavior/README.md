# 행동 AI 검토 PNG

두 파일 모두 행동 검토 자료이며 배포할 몬스터 그림/게임 화면이 아니다.

- `pilot-review.png`: 실제 엔진의 strict/gauge 행동 기록과 청동 HP 40% 진입 후 행동 변화.
- `source-poses-nearest.png`: 기존 도트의 native 3×3 포즈를 nearest neighbor 2배로 표시.

원본 출처는 `public/assets/generated/pixel-enemies/{boar-tusk,goblin-scout,ghost-pale,goblin-brute}.png`. 신규 조선 몬스터의 이름으로 설치하지 않는다. 코드 저작 진입점과 SHA-256은 `content-packs/joseon-folklore/behavior/provenance.json`에 있다. 재생성:

```bash
python3 scripts/content/joseon-folklore/behavior/render-review.py
```

검토판 조립 코드는 이번 behavior 세션 저작. 기존 그림에 새로운 소유권/외부 재배포 권한을 주장하지 않는다. 직접 이미지 검토 기록은 status.json의 해시에 묶였으며 사용자 승인과 구분한다.
