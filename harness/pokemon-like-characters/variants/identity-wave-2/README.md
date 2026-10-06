# 외형 수정 2차: 박사 · 레인저 · 선장

상인 수정 방향을 이어 머리 외곽·얼굴·복장을 다시 저작한 세 후보다.

- 박사 해명: 둥근 이마와 흰 옆머리, 안경, 자주색 조끼와 연구복.
- 레인저 솔찬: 모자 없는 적갈색 머리, 짧은 주황 목수건, 숲색 조끼.
- 선장 해준: 챙이 넓은 금장 모자, 회색 수염, 단추/소매 장식이 있는 항해복.

각각 원작 prof_birch / bug_catcher / sailor의 보행과 발 접지를 유지한 파생이다.
모든 포즈의 머리·옷은 author.py의 명시적 픽셀 행/문자열 교체로 저작한다.
이미지 생성 모델·무작위 합성·축소·색 양자화는 사용하지 않았다.

## 다시 만들기

독립 하네스 폴더에서:

```bash
node variants/identity-wave-2/register.mjs
# 별도 저장소:
node variants/identity-wave-2/register.mjs --data /path/to/store
```

원하는 한 명만 수정하려면 해당 역할 폴더의 template.json/candidate.json을 편집하고
`node cli.mjs render --draft variants/identity-wave-2/professor --out /new/bundle`로 새 안을 등록한다.
`author.py`는 저작 원본 재출력용이다. 이를 다시 실행하면 역할별 template.json의 수동 변경을 덮어쓴다.

`comparison.gif`: 각 역할 왼쪽 V1 / 오른쪽 V2. 위부터 뒤/오른쪽/정면/왼쪽.
`*-decoded.png`: 실제 새 GIF의 모든 4프레임을 디코딩한 검토 증거.
구조/원본 재현/GIF 픽셀 검사 통과 후 각 이미지에서 머리·의상·등판의 프레임 연속성을 확인했다.
규격 통과가 미감 승인이라는 뜻은 아니며, 사용자 Allow/Deny는 대기 중이다.

검토 묶음은 `?wave=identity-wave-2`, 이전 후보와 함께 보는 묶음은 `?wave=identity-wave-2-compare`다.
