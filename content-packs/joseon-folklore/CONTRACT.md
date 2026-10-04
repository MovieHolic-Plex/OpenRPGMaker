# 조선 설화 판타지 공용 팩 v1

기존 ProjectDatabaseRecords 및 retro2003 전투를 사용한다. 조선 설화에서 착안한 창작 세계, 1–20레벨, 전사·도적·주술사·도사. 기존 상용 게임의 그림/문장/정확한 기술명을 복제하지 않는다. 기존 맵·Actor1·대화 얼굴은 감독자가 유지한다.

## 병렬 소유권

각 담당은 `content-packs/joseon-folklore/<role>/`, `public/assets/joseon-folklore/<role>/`, `scripts/content/joseon-folklore/<role>/`만 수정한다. 등록기·공용 코드·다른 담당 파일·실제 SQLite 프로젝트는 감독자만 수정한다. 에셋은 코드로 직접 도트를 저작한다(그림 생성 API 사용 금지). 그림과 코드 출처 및 재생성 명령을 각 폴더 README에 적는다. PNG는 투명 배경·정수 좌표·native pixel·nearest neighbor 검토. 재사용 기존 그림에 이름만 바꾸는 것으로 완료하지 않는다.

각 `<role>/data.json`은 역할에 해당하는 ProjectDatabaseInput 배열을 담는다. 부분 레코드는 현재 normalize*Record 함수로 정상화 가능해야 한다. 설명/획득/지역/레벨 정보는 `<role>/design.json`에 기록한다. `status.json`은 phase(pilot|full), ready, counts, reviewFiles를 기록한다. 파일/레코드 ID는 `ids.json`의 계약을 따른다. 아이콘 resourceId는 `jf-icon-<slug>`; 경로는 `assets/joseon-folklore/<role>/<slug>.png`. 적은 `jf-enemy-<slug>`; 3×3 9pose cell=64, 보스96. `monsters/sheets.json`에 resourceId,path,cell,motion,idleFrameMs를 적는다. motion은 hop|swoop|stomp|breath|shoot|dash|float 중 하나.

## 초반 경제/전투 기준

초기 금80, HP단일회복35~60/가격12~20, MP단일회복12~20/가격25~40, 초급 장비50~120. 급별 장비 착용 권장레벨1/5/10/15, 드롭 재료 판매2~20. 체력회복에 붙이는 효과 설명과 실제 숫자가 일치해야 한다. 잡몹 HP60~150, 보스 HP500~800 초반 기준. 후반은 클래스 성장곡선을 참고하고 한 차례 공격으로 전멸시키지 않는다.

직업별6기술, 습득레벨1/3/5/8/12/16. 초반 물리 power8~22/MP3~7, 마법20~36/MP5~10, 회복35~55/MP5~9. 높은 데미지에는 HP대가/시전예고/상태 조건 등 실제 엔진 효과가 있어야 한다. MP 표시 이름은 현 프로젝트의 기력. resource2는 쓰지 않는다. skill_attack은 기존 기본 공격을 참조해도 된다. 필요상태/속성은 skills 담당만 `state_jf_*`/`element_jf_*`로 정의한다. other roles는 ids.json 예약 상태·속성만 참조한다. state_death·state_poison 기존 상태는 사용 가능.

## 첫 검토(파일 저장 후 종료)

consumables: 쑥단·산삼탕·정화부·환생부 + 재료2개, 각32px아이콘.
equipment: 직업별 초급무기와 의복 각1=8개, 각32px아이콘.
monsters: wild-boar, straw-dokkaebi, maiden-ghost, bronze-dokkaebi 4종, 9포즈 전부.
behavior: 위4종 행동표·조건·우선순위·대응법. 일반12/보스3의 설계 윤곽도 포함.
classes: 초보와4직업 실제 정상화 레코드, 성장·장비·기술 연결.
skills: 각직업 레벨1/3 8기술 + 위4종 적기술 + 필요한 아이템기술/상태.

첫 샘플 이후 감독자의 후속 지시로 전체 수량을 확장한다. 매 작업 단위마다 공유 steering 파일을 다시 읽는다. 출력이 실제 엔진 계약과 달라진 경우 즉시 구체적인 한계를 적는다. 구현하지 않은 효과를 설명으로 꾸미지 않는다.
