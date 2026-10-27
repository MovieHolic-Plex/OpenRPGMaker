# 2D 탑다운 / 3-4 뷰 픽셀 RPG 타운용 매싱(Massing) 유형 카탈로그

**범위:** 지붕·평면·층수·부속체(jetty, lean-to, dormer, turret, chimney) 등 **매싱만** 다룬다. 텍스처·팔레트·재질 묘사는 제외한다.  
**기준:** 기존 20종(단층 오두막, 박공 정면 오두막, 2층 젯티, 3층 협폭 연립, lean-to 긴집, T자 박공-wing, L자 농가, U자 안뜰집, 2층 힙 지붕 상인집, 계단식 박공 길드홀, 마구간 lean-to 여관, 대장간+작업장+큰 굴뚝, 원형 사일로 제분소, 측면 첨탑 예배당, 원형 망루 딸린 집, 쌍탑 성문, 다락창 3층, 교차 박공집, 전면 2익+포치 저택, 총안 사각 킵)와 **중복되지 않는 52종**을 제안한다.  
**표기:** `[관찰]` = 실제 게임 화면/맵에서 읽은 매싱, `[추정]` = 건축 유형에서 게임 적용을 추론. 게임별 근거 URL은 2장에 모았다.

## 요약

1. 픽셀 RPG 타운의 매싱 다양성은 **“지붕 능선 방향 × 층수 × 부속체 1개”**의 조합으로 대부분 만들어진다. 새 유형은 대부분 이 세 축의 재조합이거나, **평면이 바뀌는 유형**(안뜰·ㄱ자·탑 결합)이다.
2. 실재 버내큘러에서 실루엣이 강한 것은 **제트리(상층 내밀기), 계단/벨 박공, 원뿔 지붕(둥지·오스트·트룰로), 스틸트 위 곡물창, 원형 탑, 성문 아치**다. 16px에서 1~3픽셀 실루엣 차이로 읽힌다.
3. 게임들은 **층수 리듬(1-2-3-2-1)**, **연속 처마선 + 간헐적 박공**, **광장 모서리 랜드마크(교회·성·길드홀)**, **경사 테라스**로 변주를 만든다.
4. 도시 건설 게임은 매싱 문법을 **필지(burgage) 폭**, **티어별 주택**, **성벽/탑**, **광장 인접성**으로 명시적으로 코딩한다. 이 규칙은 타일셋 생성기의 배치 규칙으로 그대로 이식 가능하다.
5. 아래 52종은 “한 필지에 하나”로 배치 가능한 **독립 매싱 단위**로 골랐고, 각 항목에 평면·층수·지붕·16px 실루엣·용도·출처를 붙였다.

---

## 1. 신규 매싱 52종

### A. 목조·가로형 주거 (유럽 온대)

**M01. 위얼든 홀 하우스 (Wealden hall house)**
- 평면: 긴 직사각형. `[2층 bay][후퇴한 중앙 홀][2층 bay]`
- 층수: 1.5~2층(중앙 홀은 지붕까지 열린 1층)
- 지붕: 가로 능선 1개, 양 끝 bay가 도로 쪽으로 **젯티**, 중앙은 처마가 낮게 꺼짐
- 16px 실루엣: 가운데가 1~2px 꺼지고 양 끝이 솟은 “안장” 실루엣 + 상층 오버행
- 용도: 촌장·요먼의 집, 마을 여관, 곡물 창고 겸 주거
- 출처: https://en.wikipedia.org/wiki/Wealden_hall_house , https://en.wikipedia.org/wiki/Jettying

**M02. 아이즐 십일조 헛간 (Aisled tithe barn)**
- 평면: 아주 긴 직사각형 + 양측 aisle(측랑)
- 층수: 1층(높은 단일 공간)
- 지붕: 긴 박공 + 양측 낮은 lean-to 지붕, 중앙에 작은 박공 포치
- 16px 실루엣: 낮고 긴 몸통 위 작은 박공 하나, 측면에 2단 처마선
- 용도: 마을 곡물 창고, 교회 소유 창고, 축제장
- 출처: https://en.wikipedia.org/wiki/Tithe_barns_in_Europe , https://en.wikipedia.org/wiki/Lean-to

**M03. 뱅크 헛간 (Bank barn)**
- 평면: 직사각형, 언덕에 반쯤 묻힘. 상층과 하층이 각각 지면에 접함
- 층수: 2층(지형 이용)
- 지붕: 박공 또는 gambrel, 언덕 쪽 램프/다리
- 16px 실루엣: 지붕 아래 2단 개구부 + 옆으로 뻗은 흙램프
- 용도: 농가 헛간, 마구간, 마을 외곽 저장
- 출처: https://en.wikipedia.org/wiki/Bank_barn , https://en.wikipedia.org/wiki/Gambrel

**M04. 스태들 곡물창 (Staddle granary)**
- 평면: 작은 정사각형(2~3타일)
- 층수: 1층, 지면에서 띄움
- 지붕: 피라미드 힙 또는 짧은 박공, 처마 깊음
- 16px 실루엣: 버섯 모양 받침돌 위에 떠 있는 작은 상자
- 용도: 곡물·씨앗 저장, 세금 곡물
- 출처: https://en.wikipedia.org/wiki/Staddle_stones , https://en.wikipedia.org/wiki/H%C3%B3rreo

**M05. 비둘기탑 (Dovecote)**
- 평면: 원형 또는 정사각형, 독립 소형
- 층수: 1~2층
- 지붕: 원뿔(conical) 또는 피라미드, 꼭대기 개구부
- 16px 실루엣: 지붕 폭보다 몸통이 좁은 “연필” 실루엣
- 용도: 영주·수도원의 식량 저장, 마을 상징
- 출처: https://en.wikipedia.org/wiki/Dovecote

**M06. 리치게이트 (Lychgate)**
- 평면: 담장/울타리 선을 가로지르는 1칸 통로
- 층수: 1층(지붕만)
- 지붕: 작은 박공, 기둥 4개 위에 얹힘
- 16px 실루엣: 공중에 뜬 지붕 + 아래 빈 공간(문)
- 용도: 교회 마당 입구, 묘지 입구
- 출처: https://en.wikipedia.org/wiki/Lychgate

**M07. 앨름하우스 연립 (Almshouse row)**
- 평면: 긴 연립동 + 안쪽 마당, 끝에 예배당
- 층수: 1~1.5층
- 지붕: 연속 박공 1개, 일정 간격 굴뚝, 개별 작은 박공 다락창
- 16px 실루엣: 낮고 긴 처마 + 굴뚝 리듬(3~4칸마다)
- 용도: 자선 주택, 노인·병자 수용, 수도원 부속
- 출처: https://en.wikipedia.org/wiki/Almshouse

**M08. 기둥 위 시장홀 (Market hall on piers)**
- 평면: 직사각형, 1층은 개방(기둥/아치), 2층은 닫힌 홀
- 층수: 2층
- 지붕: 박공 또는 힙, 중앙에 작은 종탑 가능
- 16px 실루엣: 아래가 뚫린 무거운 상자 — “다리 4개 + 큰 지붕”
- 용도: 시장, 경매, 축제, 세금 징수
- 출처: https://en.wikipedia.org/wiki/Market_hall , https://en.wikipedia.org/wiki/Arcade_(architecture)

**M09. 개방 로지아 시청사 (Open-loggia town hall / Rathaus)**
- 평면: 블록 + 후면/측면 종탑
- 층수: 2~3층
- 지붕: 가파른 박공 또는 힙, 종탑은 첨탑/벨 지붕
- 16px 실루엣: 아케이드 보이드 + 지붕 위 종탑 하나(마을 최고점)
- 용도: 마을 중심 랜드마크, 의회·길드·법정
- 출처: https://en.wikipedia.org/wiki/Guildhall , https://en.wikipedia.org/wiki/Belfry

**M10. 버기지 상점 열 (Burgage shop row)**
- 평면: 좁은 정면(2~3타일) × 긴 깊이의 필지 연속
- 층수: 2~3층, 층마다 젯티
- 지붕: 도로 쪽 박공(제각각), 1층 위 연속 차양(pentice)
- 16px 실루엣: 톱니 같은 박공 열 + 수평 차양선
- 용도: 대로변 상점·공방, 여관, 길드 사무소
- 출처: https://en.wikipedia.org/wiki/Burgage , https://en.wikipedia.org/wiki/Jettying

**M11. 움게빈데하우스 (Umgebindehaus)**
- 평면: 직사각형, 전면에 목조 기둥 열
- 층수: 1~2층
- 지붕: 박공, 지붕 하중을 기둥 열이 받는 구조
- 16px 실루엣: 하부는 흰 벽/석조, 상부는 통나무+프레임 띠 — **가로 줄무늬 2단**
- 용도: 직조공·방직공의 집, 국경 산지 마을
- 출처: https://en.wikipedia.org/wiki/Upper_Lusatian_house

### B. 저지대·남유럽·계획도시

**M12. 벨 박공 운하 주택 (Dutch bell-gable canal house)**
- 평면: 좁고 깊은 직사각형(정면 2~3타일)
- 층수: 4층(지하 저장 + 3층 거주)
- 지붕: 도로와 **평행한** 용마루 + 곡선 벨 박공 + 꼭대기 페디먼트, 박공에 **호이스트 빔**
- 16px 실루엣: 곡선으로 솟는 지붕 + 튀어나온 들보 1px
- 용도: 부유 상인 주택, 창고 겸 거주
- 출처: https://en.wikipedia.org/wiki/Canal_house , https://en.wikipedia.org/wiki/Dutch_gable

**M13. 계단 박공 창고 (Stepped-gable pakhuis)**
- 평면: 좁고 깊은 직사각형, 창문 적음
- 층수: 4~5층
- 지붕: 평행 용마루 + **계단식 박공 벽**, 호이스트 빔, 하역문
- 16px 실루엣: 지붕 위로 올라가는 계단 3~5칸 + 들보
- 용도: 항구 창고, 곡물·직물 보관
- 출처: https://en.wikipedia.org/wiki/Stepped_gable , https://en.wikipedia.org/wiki/Canal_house

**M14. 롱제르 (Longère)**
- 평면: 아주 긴 단일 동, 끝에 헛간이 같은 지붕 아래 붙음
- 층수: 1~1.5층
- 지붕: 낮은 박공/초가, 능선이 길게 이어짐
- 16px 실루엣: “한 줄” 수평 지붕 — 마을에서 가장 긴 처마
- 용도: 브르타뉴·노르망디 농가, 마을 외곽
- 출처: https://en.wikipedia.org/wiki/Long%C3%A8re , https://en.wikipedia.org/wiki/Longhouse

**M15. 피죠니에 탑 딸린 마스 (Mas with pigeonnier)**
- 평면: L자 또는 U자 + 모서리 소형 탑
- 층수: 2층 + 탑 3층
- 지붕: 낮은 힙, 탑은 작은 힙/원뿔
- 16px 실루엣: 낮고 넓은 지붕 + 작은 탑 하나가 점처럼 솟음
- 용도: 프로방스 대농가, 포도·올리브 농장
- 출처: https://en.wikipedia.org/wiki/Mas_(Mediterranean_farmhouse) , https://en.wikipedia.org/wiki/Dovecote

**M16. 아케이드 안뜰집 (Arcaded courtyard house)**
- 평면: 중정을 감싸는 ㅁ자, 안쪽에 아케이드/로지아
- 층수: 2층
- 지붕: 낮은 힙 또는 평지붕(옥상 테라스), 외벽 창문 적음
- 16px 실루엣: 바깥은 창 없는 벽, 안쪽은 아치 그림자 줄
- 용도: 지중해 상인 저택, 여관, 영사관
- 출처: https://en.wikipedia.org/wiki/Courtyard_house , https://en.wikipedia.org/wiki/Loggia

**M17. 트룰로 (Trullo)**
- 평면: 원형/정사각형 소형
- 층수: 1층
- 지붕: 회색 석회 원뿔, 꼭대기 장식
- 16px 실루엣: 흰 몸통 + 뾰족한 회색 원뿔(주변 지붕과 완전히 다른 곡선)
- 용도: 창고, 농막, 마을 외곽 저장
- 출처: https://en.wikipedia.org/wiki/Trullo

**M18. 이탈리아 타워 하우스 (Italian tower house)**
- 평면: 정사각형, 벽 두껍고 개구부 적음
- 층수: 3~4층
- 지붕: 평지붕 또는 낮은 피라미드, 처마 돌출
- 16px 실루엣: 주변 1~2층 지붕 위로 솟은 **직육면체 기둥**
- 용도: 도시 귀족 거주, 방어, 언덕 마을
- 출처: https://en.wikipedia.org/wiki/Tower_house

**M19. 바스티드 아케이드 블록 (Bastide arcade block)**
- 평면: 계획된 격자 광장을 감싸는 균일한 연립 블록
- 층수: 2~3층
- 지붕: 연속 처마선, 가끔 박공, 1층 아케이드
- 16px 실루엣: 완벽히 평평한 지붕선 + 아래 아치 구멍 줄 — “계획도시” 느낌
- 용도: 신도시 광장, 상가, 시장
- 출처: https://en.wikipedia.org/wiki/Bastide , https://en.wikipedia.org/wiki/Arcade_(architecture)

**M20. 베긴하위지 안뜰 (Beguinage court)**
- 평면: 중앙 예배당 + 주위를 둘러싼 작은 집들, 좁은 입구
- 층수: 1~2층
- 지붕: 반복되는 작은 박공, 안뜰 쪽 처마
- 16px 실루엣: 큰 지붕 1개 + 주위 작은 지붕 고리
- 용도: 여성 공동체, 자선 주거, 병원·양조장 부속
- 출처: https://en.wikipedia.org/wiki/Beguinage

### C. 알프스·북유럽·일본

**M21. 석조 기단 + 발코니 샬레 (Chalet)**
- 평면: 직사각형, 전면 발코니
- 층수: 1~2층 + 다락
- 지붕: **완만한 큰 박공**, 처마가 매우 깊고 박공 쪽으로 돌출, 지붕 아래 발코니
- 16px 실루엣: 몸통보다 지붕이 훨씬 넓은 “버섯” + 수평 발코니 선
- 용도: 알프스 농가, 산악 여관, 스키 마을
- 출처: https://en.wikipedia.org/wiki/Chalet

**M22. 스타브 교회 (Stave church)**
- 평면: 신랑 + 후진, 외곽 회랑
- 층수: 2~3단 지붕
- 지붕: 아주 가파른 **겹친 박공/힙**, 지붕마루 용머리 장식, 검은 목재
- 16px 실루엣: 계단처럼 겹친 삼각 지붕 3개
- 용도: 북유럽 교회, 수도원 예배당
- 출처: https://en.wikipedia.org/wiki/Stave_church

**M23. 스타부르 / 오레오 (Stabbur / Hórreo)**
- 평면: 작은 정사각형, 지면에서 띄운 통나무 상자
- 층수: 1층
- 지붕: 박공 또는 힙, 넓은 처마
- 16px 실루엣: 4개 기둥(또는 버섯돌) 위에 떠 있는 오두막
- 용도: 곡물·육류 저장, 마을 외곽
- 출처: https://en.wikipedia.org/wiki/H%C3%B3rreo , https://en.wikipedia.org/wiki/Staddle_stones

**M24. 로르부 (Rorbu)**
- 평면: 직사각형, 한쪽 끝이 물 위 말뚝에 걸침
- 층수: 1~2층
- 지붕: 박공, 붉은 목재 벽
- 16px 실루엣: 물가에서 비스듬히 걸친 집 + 말뚝 그림자
- 용도: 어부 숙소, 항구 마을, 창고
- 출처: https://en.wikipedia.org/wiki/Rorbu

**M25. 마치야 (Machiya)**
- 평면: 좁은 정면 × 깊은 필지, 안쪽에 작은 정원
- 층수: 2층
- 지붕: 도로와 평행한 기와 용마루, 1층 위 **긴 처마**, 2층 창은 작은 격자
- 16px 실루엣: 긴 수평 처마 띠 + 낮은 용마루, 박공 없음
- 용도: 상점·공방 겸 주거, 상인 거리
- 출처: https://en.wikipedia.org/wiki/Machiya

**M26. 쿠라 (Kura)**
- 평면: 작은 정사각형, 두꺼운 흙벽
- 층수: 2층(창고)
- 지붕: 박공, 두꺼운 처마, 창문은 작고 철제 셔터
- 16px 실루엣: 흰 상자 + 검은 지붕, 창문 거의 없음 — 주거와 대비
- 용도: 곡물·재산 저장, 상인 저택 부속
- 출처: https://en.wikipedia.org/wiki/Kura_(storehouse)

**M27. 이리모야 초가 민가 (Minka with irimoya thatch)**
- 평면: 직사각형, 넓은 마루
- 층수: 1.5층(다락)
- 지붕: **힙+박공 결합(irimoya)** 의 두꺼운 초가, 처마 두껍고 어두움
- 16px 실루엣: 지붕이 몸통의 2배 두께로 보이는 거대한 덩어리
- 용도: 농가, 촌장 집, 산촌
- 출처: https://en.wikipedia.org/wiki/Minka , https://en.wikipedia.org/wiki/East_Asian_hip-and-gable_roof

### D. 산업·인프라

**M28. 물레방아 제분소 (Watermill)**
- 평면: 제분동 + 측면 수차, 도랑/수로
- 층수: 1~2층
- 지붕: 박공, 수차 쪽에 작은 lean-to
- 16px 실루엣: 지붕 옆으로 튀어나온 **원형 수차** + 물길
- 용도: 마을 제분, 제재, 방앗간
- 출처: https://en.wikipedia.org/wiki/Watermill

**M29. 포스트 밀 (Post mill)**
- 평면: 중앙 기둥 1개 위에 몸통
- 층수: 1~2층
- 지붕: 몸통 박공, 뒤쪽 tailpole/팬테일
- 16px 실루엣: **기울어진 상자**가 기둥에 얹힌 모양 + 꼬리 막대
- 용도: 언덕 위 제분, 마을 랜드마크
- 출처: https://en.wikipedia.org/wiki/Post_mill

**M30. 타워 밀 (Tower mill)**
- 평면: 원형/다각형 석조 탑
- 층수: 3층 + 회전 캡
- 지붕: 회전하는 캡 + 4개 날개, 중간 갤러리
- 16px 실루엣: 원뿔 지붕 + 십자 날개(가장 강한 원거리 실루엣)
- 용도: 제분, 마을 외곽
- 출처: https://en.wikipedia.org/wiki/Tower_mill

**M31. 오스트 하우스 (Oast house)**
- 평면: 직사각형 stowage + 원형/사각 kiln 1~3개
- 층수: 1~2층
- 지붕: 박공 + **원뿔형 cowl**(바람에 도는 꼭대기)
- 16px 실루엣: 지붕 위에 얹힌 원뿔 1~3개
- 용도: 홉 건조, 양조장 부속, 농촌 산업
- 출처: https://en.wikipedia.org/wiki/Oast_house

**M32. 양조장 (Brewhouse)**
- 평면: 직사각형 + 후면 보일러/굴뚝
- 층수: 2층
- 지붕: 박공, 높은 벽돌 굴뚝
- 16px 실루엣: 지붕보다 높은 **가는 굴뚝** 1개
- 용도: 맥주·에일 양조, 수도원 양조
- 출처: https://en.wikipedia.org/wiki/Brewery

**M33. 빵집 / 베이크하우스 (Bakehouse)**
- 평면: 작은 정사각형 + 뒤쪽 돔 오븐
- 층수: 1층
- 지붕: 박공, 오븐 위 작은 굴뚝
- 16px 실루엣: 낮은 집 + 옆으로 붙은 반원 덩어리
- 용도: 마을 공동 오븐, 빵·과자
- 출처: https://en.wikipedia.org/wiki/Bakery , https://en.wikipedia.org/wiki/Kiln

**M34. 무두질·염색 공방 (Tannery / dye works)**
- 평면: 열린 헛간 + 야외 통(vat) 여러 개 + 건조대
- 층수: 1층
- 지붕: lean-to/박공, 벽 일부 없음
- 16px 실루엣: 지붕 아래 기둥만 보이고, 마당에 원형 통·수직 건조대
- 용도: 가죽·염색, 하천 하류의 악취 산업
- 출처: https://en.wikipedia.org/wiki/Tanning_(leather)

**M35. 우물집 (Well house)**
- 평면: 1~2타일, 우물 위 지붕
- 층수: 1층
- 지붕: 작은 피라미드/박공, 기둥 4개, 도르래
- 16px 실루엣: 기둥 4개 + 지붕 + 아래 어두운 구멍
- 용도: 광장·마을 중심 급수, 수도원
- 출처: https://banished.fandom.com/wiki/Buildings_and_Construction

**M36. 지붕 있는 다리 (Covered bridge)**
- 평면: 선형(강 건너), 트러스
- 층수: 1층
- 지붕: 긴 박공, 측면 판벽, 입구 박공
- 16px 실루엣: 물 위를 가로지르는 **지붕 달린 관**
- 용도: 하천·계곡 통행, 톨게이트 결합
- 출처: https://en.wikipedia.org/wiki/Covered_bridge

**M37. 톨하우스 (Tollhouse)**
- 평면: 도로/다리 옆 소형, 차단봉
- 층수: 2층
- 지붕: 박공, 도로 쪽 bay window
- 16px 실루엣: 작은 집 + 도로를 가로지르는 막대
- 용도: 통행세, 다리 관리
- 출처: https://en.wikipedia.org/wiki/Tollhouse

**M38. 등대 (Lighthouse)**
- 평면: 원형/팔각형, 절벽·방파제 끝
- 층수: 3~5층
- 지붕: lantern room + 돔, 외부 계단/갤러리
- 16px 실루엣: 위로 좁아지는 원뿔대 + 꼭대기 등
- 용도: 항구 입구, 해안 마을 랜드마크
- 출처: https://en.wikipedia.org/wiki/Lighthouse

### E. 종교·공공

**M39. 원형탑 교회 (Round-tower church)**
- 평면: 신랑 + 서쪽 원형 탑
- 층수: 신랑 1~2층, 탑 3층
- 지붕: 신랑 박공 + 탑 원뿔/팔각 첨탑
- 16px 실루엣: 낮은 몸통 옆에 **원기둥 + 원뿔**
- 용도: 교구 교회, 동앵글리아·북유럽
- 출처: https://en.wikipedia.org/wiki/Round-tower_church

**M40. 베스트베르크 교회 (Westwork church)**
- 평면: 신랑 + 서쪽의 거대한 다층 전면 블록
- 층수: 2~3층(서쪽 블록)
- 지붕: 서쪽 블록이 신랑보다 넓고 높으며 양쪽 소탑
- 16px 실루엣: 서쪽이 “성벽 같은” 넓은 직사각형 + 탑 2개
- 용도: 수도원 교회, 대성당, 도시 랜드마크
- 출처: https://en.wikipedia.org/wiki/Westwork

**M41. 후진 딸린 십자형 교회 (Cruciform church with apse)**
- 평면: 십자(신랑 + transept + apse)
- 층수: 1~2층
- 지붕: 교차 용마루 + 동쪽 반원 후진(반원뿔)
- 16px 실루엣: 지붕이 십자로 교차, 끝에 둥근 반원
- 용도: 대교회, 성당, 수도원
- 출처: https://en.wikipedia.org/wiki/Apse

**M42. 종탑(bellcote) 예배당 (Chapel with bellcote)**
- 평면: 작은 직사각형
- 층수: 1층
- 지붕: 박공, 박공 꼭대기에 작은 종틀/아치
- 16px 실루엣: 지붕 꼭대기의 1~2px 종 아치
- 용도: 마을 예배당, 병원·영지 예배당
- 출처: https://en.wikipedia.org/wiki/Bell-cot

**M43. 회랑 수도원 (Cloister)**
- 평면: ㅁ자 회랑 + 중정, 북쪽에 교회
- 층수: 2층(회랑은 1층)
- 지붕: 회랑 lean-to 지붕이 중정을 향해 기울고, 외곽은 박공
- 16px 실루엣: 중정 구멍 + 네 면의 낮은 지붕 띠 + 교회 지붕
- 용도: 수도원, 대성당 부속, 학교
- 출처: https://en.wikipedia.org/wiki/Cloister

**M44. 수도원 그랜지 (Monastic grange)**
- 평면: 헛간 + 예배당 + 비둘기탑 + 주거의 클러스터
- 층수: 1~2층
- 지붕: 긴 박공 헛간 + 작은 박공 예배당 + 원뿔 탑
- 16px 실루엣: “큰 지붕 1 + 작은 지붕 2 + 점 같은 탑”
- 용도: 수도원 농장, 십일조 수납, 산업
- 출처: https://en.wikipedia.org/wiki/Monastic_grange

### F. 성채·방어

**M45. 모트 앤 베일리 (Motte-and-bailey)**
- 평면: 인공 언덕(motte) + 아래 마당(bailey)
- 층수: 탑 1~2층, 담장
- 지붕: 탑 박공 + 목책/팰리세이드
- 16px 실루엣: **둥근 언덕** 위 탑 + 아래 타원 담장
- 용도: 초기 성, 영주 거점, 마을 위 언덕
- 출처: https://en.wikipedia.org/wiki/Motte-and-bailey_castle

**M46. 셸 킵 (Shell keep)**
- 평면: 모트 위를 둘러싸는 원형 벽
- 층수: 1~2층(벽 안쪽 건물)
- 지붕: 벽 위 walkway, 안쪽 건물 박공
- 16px 실루엣: **원형 고리** + 안쪽에 작은 지붕
- 용도: 노르만 성 개조, 영주 거점
- 출처: https://en.wikipedia.org/wiki/Shell_keep

**M47. 동심원 성 (Concentric castle)**
- 평면: 안/밖 2겹 커튼월, 외벽이 낮음
- 층수: 탑 2~3층
- 지붕: 벽 위 walkway + 모서리 원형 탑
- 16px 실루엣: **이중 고리** + 4~8개 탑, 중앙 킵 없음
- 용도: 후기 중세 대성, 왕성
- 출처: https://en.wikipedia.org/wiki/Concentric_castle

**M48. 사각 안뜰 성 (Quadrangular castle)**
- 평면: ㅁ자로 이어진 range + 모서리 탑
- 층수: 2~3층
- 지붕: 안뜰을 향한 단일 지붕, 모서리 원뿔 탑
- 16px 실루엣: **네 모서리 탑** + 가운데 구멍(안뜰)
- 용도: 영주 저택, 성곽 도시의 성
- 출처: https://en.wikipedia.org/wiki/Quadrangular_castle

**M49. 물 성 (Water castle)**
- 평면: 해자/섬 위 사각 성 + 다리
- 층수: 2~3층
- 지붕: 박공/힙, 게이트하우스, 모서리 탑
- 16px 실루엣: 물에 비친 성 + **다리 1개**
- 용도: 저지대 영주 성, 귀족 저택
- 출처: https://en.wikipedia.org/wiki/Water_castle

**M50. Z-플랜 탑 하우스 (Z-plan tower house)**
- 평면: 중앙 직사각형 + **대각선 반대 모서리**에 소탑 2개
- 층수: 3~4층
- 지붕: 중앙 박공 + 소탑 원뿔/계단 박공
- 16px 실루엣: Z자로 어긋난 탑 2개 — 위에서도 읽힘
- 용도: 스코틀랜드 영주, 변경 지대
- 출처: https://en.wikipedia.org/wiki/Z-plan_castle

**M51. 필 타워 / 배슬 (Peel tower / bastle)**
- 평면: 두꺼운 벽의 작은 정사각형, 지하 vault
- 층수: 2~3층
- 지붕: 낮은 박공 또는 parapet, 총안
- 16px 실루엣: 창문 거의 없는 **블록** + 옥상 난간
- 용도: 변경 농가, 신호탑, 피난
- 출처: https://en.wikipedia.org/wiki/Peel_tower , https://en.wikipedia.org/wiki/Bastle_house

**M52. 거리 위 성문 탑 (Town gate tower over street)**
- 평면: 도로를 가로지르는 단일 탑 + 아치
- 층수: 3층
- 지붕: 박공/힙, 아치 위 코벨, 문/철책
- 16px 실루엣: **아치 구멍 + 그 위 탑**, 성벽과 연결
- 용도: 성곽 도시 입구, 통행 검문
- 출처: https://en.wikipedia.org/wiki/Gatehouse , https://en.wikipedia.org/wiki/Defensive_wall

---

## 2. 게임별 매싱 대응표

`[관찰]`은 화면/맵에서 읽은 배치, `[추정]`은 유형 추론. 괄호 안은 대표 장소.

| 게임 | 보이는 매싱 유형 | 대표 장소 / 근거 URL |
|---|---|---|
| Chrono Trigger | M01, M02, M07, M08, M09, M45, M48, M52 [관찰] | Truce·Porre·Medina·Guardia — https://chrono.fandom.com/wiki/Truce |
| Secret of Mana | M01, M02, M08, M19, M48, M52 [관찰] | Potos·Pandora·Kakkara — https://en.wikipedia.org/wiki/Secret_of_Mana |
| Final Fantasy VI | M01, M10, M18, M19, M48, M52 [관찰] | Narshe(절벽 테라스 탄광도시), South Figaro, Zozo, Vector — https://finalfantasy.fandom.com/wiki/Narshe |
| Octopath Traveler I | M01, M12, M13, M19, M21, M39, M40, M41 [관찰] | Flamesgrace(눈, 성당), Atlasdam(학원), Grandport(항구 창고) — https://octopath-traveler.fandom.com/wiki/Flamesgrace , https://octopath-traveler.fandom.com/wiki/Atlasdam , https://octopath-traveler.fandom.com/wiki/Grandport |
| Octopath Traveler II | M01, M10, M19, M21, M25, M27, M31, M38 [관찰] | Canalbrine(운하), Winterbloom(눈), Clockbank(산업) — https://en.wikipedia.org/wiki/Octopath_Traveler_II |
| Sea of Stars | M01, M08, M16, M21, M31, M38 [관찰] | Mooncradle, Repine, Mirth — https://seaofstars.fandom.com/wiki/Mooncradle |
| Eastward | M10, M18, M24, M36 [관찰] | Potcrock Isle(지하 적층), New Dam City, Greenberg — https://en.wikipedia.org/wiki/Eastward_(video_game) |
| Stardew Valley | M01, M03, M04, M28, M35, M36, M42 [관찰] | Pelican Town, 농장 건물(외곽 7×4 barn, 6×3 coop, 3×3 silo, 4×2 mill, 3×3 well, 4×2 stable) — https://stardewvalley.fandom.com/wiki/Farm_Buildings , https://stardewvalley.fandom.com/wiki/Pelican_Town |
| Pokémon Gen 3–5 / BW2 | M01, M10, M18, M24, M26, M52 [관찰] | Fortree(나무 위 통로), Castelia(예외: 근대 고층), Opelucid(성벽) — https://pokemon.fandom.com/wiki/Fortree_City , https://pokemon.fandom.com/wiki/Castelia_City , https://en.wikipedia.org/wiki/Pok%C3%A9mon_Black_and_White |
| Dragon Quest XI (2D 모드) | M01, M02, M08, M12, M16, M19, M21, M25, M27, M39, M48, M52 [관찰] | Heliodor(성+성문), Cobblestone, Hotto(일본 산촌), Gondolia(베네치아 운하), Sniflheim(눈) — https://dragonquest.fandom.com/wiki/Gondolia , https://dragonquest.fandom.com/wiki/Hotto , https://dragonquest.fandom.com/wiki/Sniflheim |
| Moonlighter | M10, M32, M35, M52 [관찰] | Rynoka(상점 열+광장) — https://moonlighter.fandom.com/wiki/Rynoka , https://en.wikipedia.org/wiki/Moonlighter_(video_game) |
| CrossCode | M01, M16, M19, M21, M23 [관찰] | Rookie Harbor(항구 테라스), Bergen(설산), Ba'kii Kum(사막) — https://crosscode.fandom.com/wiki/Rookie_Harbor , https://crosscode.fandom.com/wiki/Bergen_Village |
| Graveyard Keeper | M01, M02, M06, M42, M43 [관찰] | 교회+묘지, 마을 공방 — https://graveyardkeeper.fandom.com/wiki/Church , https://en.wikipedia.org/wiki/Graveyard_Keeper |
| Stoneshard | M01, M03, M06, M35, M45 [관찰] | Osbrook(목책+농가) — https://stoneshard.fandom.com/wiki/Osbrook |
| Fields of Mistria | M01, M02, M08, M10, M28, M35, M42 [관찰] | Mistria(북쪽 저택 → 남쪽 상점·여관·제분소 행 배치) — https://fieldsofmistria.fandom.com/wiki/Mistria |
| The Last Spell | M47, M52 + 파괴된 셸 [관찰] | 등축 시점 폐허 도시, 성벽·탑 건설 — https://en.wikipedia.org/wiki/The_Last_Spell |
| Triangle Strategy | M19, M40, M41, M48, M52 [관찰] | Aesfrost(눈+성), Hyzante(백색 사막 도시), Glenbrook(성곽 도시) — https://en.wikipedia.org/wiki/Triangle_Strategy |
| Tactics Ogre | M19, M41, M48, M52 [관찰] | 성곽 도시·성·대성당 — https://en.wikipedia.org/wiki/Tactics_Ogre |
| Banished | M01, M02, M04, M08, M09, M35, M36, M42 [관찰] | 목재/석재 주택, boarding house, chapel, town hall, market, storage barn, well — https://banished.fandom.com/wiki/Buildings_and_Construction |
| Townscaper | M08, M16, M20, M47, M48, M49, M52 [관찰] | 복셀 인접성으로 벽·지붕·아치·계단·안뜰 생성 — https://en.wikipedia.org/wiki/Townscaper |
| Kingdoms and Castles | M01, M08, M39, M42, M48, M52 [관찰] | Castle/Town/Advanced Town/Food/Industry/Maritime 범주 — https://kingdomscastles.fandom.com/wiki/Buildings |
| Manor Lords | M03, M10, M11, M14, M35, M42, M52 [관찰] | burgage 필지(좁은 정면+확장) — https://manorlords.fandom.com/wiki/Burgage_Plot |
| Anno 1404 | M01, M08, M09, M12, M13, M19, M32, M34, M35, M39, M42, M48, M52 [관찰] | Peasant/Citizen/Patrician/Nobleman 주택, chapel, church, imperial cathedral, gatehouse, keep, city wall, watchtower, tannery, monastery brewery — https://anno1404.fandom.com/wiki/Template:Buildings |

**표 읽는 법:** 같은 유형이라도 게임마다 **층수 상한**이 다르다. SNES 3작은 1~2층이 기본이고 3층은 성·탑에만 쓰며, Octopath/Sea of Stars/DQXI는 2~3층을 일상 건물에 허용해 지붕 리듬이 풍부해진다. 이 차이가 “풍성해 보이는가”를 크게 좌우한다.

---

## 3. 타운을 변주시키는 조합 규칙

1. **버기지 필지 리듬 (가장 중요).** 중세 도시 필지는 “좁은 정면 + 긴 깊이”가 기본이며, 필지가 쪼개지고 합쳐지며 정면 폭이 불규칙해진다. 생성기에서는 정면 폭을 2/3/4타일로 번갈아 배정하고 깊이는 6~12타일로 두면 자연스러운 톱니가 나온다. 출처: https://en.wikipedia.org/wiki/Burgage
2. **지붕 능선 방향 교대.** 도로와 평행한 용마루(M12·M13·M25)와 도로 쪽 박공(M01·M10)을 2:1~3:1로 섞고, 4~6채마다 교차 박공이나 탑을 넣어 능선을 끊는다. 순수 평행만 반복하면 마치야 거리처럼 “한 줄”로 보이고, 순수 박공만 반복하면 톱니가 과해진다. [추정] — 근거 유형: M10, M25, M52
3. **높이 리듬 1-2-3-2-1.** 중심 광장으로 갈수록 3층, 외곽으로 갈수록 1층. Anno 1404의 peasant→citizen→patrician→nobleman 주택 티어, Banished의 wooden→stone house가 이 규칙을 명시적으로 쓴다. 출처: https://anno1404.fandom.com/wiki/Template:Buildings , https://banished.fandom.com/wiki/Buildings_and_Construction
4. **연속 처마선 + 간헐 돌출.** 같은 블록은 처마 높이를 1~2px만 흔들어 붙이고, 한 채만 젯티/오리엘로 1~2px 튀어나오게 한다. 젯티는 “층을 늘리지 않고 실루엣을 늘리는” 가장 싼 수단이다. 출처: https://en.wikipedia.org/wiki/Jettying
5. **모서리 건물 전용 처리.** 광장·교차로 모서리는 (a) 모서리를 45°로 깎은 입구, (b) 모서리 오리엘/소탑, (c) 지붕을 힙으로 바꿔 능선을 회전 — 셋 중 하나로 주변과 분리한다. [추정] 근거: M18, M48, M52
6. **랜드마크는 광장에서 1채 거리.** 교회·시청·길드홀·성문은 광장에 직접 붙이지 않고 한 필지 뒤에 두어 지붕 위로 탑만 보이게 한다. Fields of Mistria는 북쪽에 Manor, 중앙에 분수, 남쪽에 상점·여관·제분소를 행 단위로 배치한다. 출처: https://fieldsofmistria.fandom.com/wiki/Mistria
7. **안뜰/블록 내부를 비운다.** ㅁ자 안뜰(M16·M20·M43·M48)은 지붕 면적을 늘리지 않고 평면 다양성을 만든다. 3/4 뷰에서는 안뜰이 “지붕 4개 + 가운데 구멍”으로 읽혀 큰 덩어리를 분해한다. 출처: https://en.wikipedia.org/wiki/Courtyard_house , https://en.wikipedia.org/wiki/Cloister
8. **경사 테라스.** 언덕 마을은 옹벽+계단으로 층을 만들고, 지붕 높이를 계단식으로 올린다. Narshe(절벽 탄광도시), Bergen(설산), Grandport(항구 테라스)가 이 문법을 쓴다. 출처: https://finalfantasy.fandom.com/wiki/Narshe , https://crosscode.fandom.com/wiki/Bergen_Village
9. **물가 규칙.** 운하·항구에서는 (a) 도로 쪽 정면을 좁고 높게(M12·M13), (b) 물 쪽에 창고·수차·말뚝집(M24·M28), (c) 다리 1개를 랜드마크로. Gondolia는 운하가 도시를 가로지르고 조선소·부두가 붙는다. 출처: https://dragonquest.fandom.com/wiki/Gondolia
10. **성벽과 문으로 프레임.** 성곽 도시는 성벽 실루엣이 스카이라인을 고정하고, 문 탑(M52)이 진입 연출을 담당한다. Anno 1404는 city wall·gatehouse·keep·watchtower를 별도 건물로 분리한다. 출처: https://en.wikipedia.org/wiki/Defensive_wall , https://anno1404.fandom.com/wiki/Template:Buildings
11. **광장의 음의 공간.** 시장홀·우물·분수·시장 천막은 건물이 아니라 “비어 있는 바닥”으로 리듬을 끊는다. Banished의 market/well, Fields of Mistria의 분수+광장이 예. 출처: https://banished.fandom.com/wiki/Buildings_and_Construction
12. **복셀 인접성 규칙(Townscaper식).** 벽 셀의 인접 관계로 지붕 방향·아치·계단·안뜰이 자동 결정된다. 생성기에서도 “필지 + 이웃 필지 접합면”을 입력으로 지붕 능선과 박공을 유도하면, 수작업 유형 52종을 훨씬 적은 규칙으로 재생산할 수 있다. 출처: https://en.wikipedia.org/wiki/Townscaper

---

## 4. 16px 3/4 뷰 판독 규칙 (매싱 한정)

- **1픽셀 실루엣 토큰**을 유형마다 하나씩 강제한다: 굴뚝(M32·M33), 다락창(M07), 젯티 단차(M01·M10), 원뿔(M05·M17·M31), 아치 구멍(M08·M19·M52), 말뚝(M23·M24), 수차(M28), 날개(M30), 종 아치(M42), 원형 고리(M46·M47).
- 3/4 뷰에서 **지붕 윗면이 최소 1~2px 보여야** 힙/박공/원뿔이 구분된다. 박공 정면만 보이면 M12·M25 같은 “평행 용마루” 유형이 사라진다. [추정]
- 층수는 창문 줄 수보다 **처마선 개수**로 읽힌다. 2층 젯티는 “처마 2개 + 1px 단차”, 3층은 “처마 3개”로 통일하면 팔레트가 달라도 같은 문법이 유지된다. [추정]
- 부속체는 **한 유형에 하나**만 붙인다. 탑+안뜰+굴뚝을 동시에 붙이면 16px에서 덩어리로 뭉개진다. 예외는 성(M48·M50)처럼 탑이 정체성인 경우뿐이다. [추정]

---

## 5. 생성기 파라미터로 옮길 때

유형 52종을 아래 6개 필드로 정규화하면 조합 폭발 없이 확장된다. [추정]

| 필드 | 값 예 | 역할 |
|---|---|---|
| footprint | 1×2, 2×2, 2×3, 3×4, ㅁ, L, 십자 | 평면·안뜰·모서리 |
| storeys | 1, 1.5, 2, 3, 4, 5 | 높이 리듬 |
| ridge | street-parallel / street-perpendicular / cross / hip / cone / none | 지붕 실루엣 |
| appendage | jetty, lean-to, dormer, turret, chimney, hoist, balcony, arcade, stilts | 1개만 |
| edge | wall / water / slope / plaza / gate | 배치 제약 |
| landmark | 0/1 | 스카이라인 고정 |

---

## 6. 출처·한계

- 건축 유형의 정의는 모두 영어 위키백과 해당 항목의 도입부를 직접 확인했다(2026-10-22 조회). 링크는 각 항목에 붙였다.
- 게임 장소 설명은 Fandom/StrategyWiki/위키백과에서 확인한 사실(도시 성격·구성·건물 목록)이며, **특정 건물의 매싱 판독은 `[관찰]`로 표시**했다. 스크린샷을 직접 첨부하지는 않았다.
- Stardew Valley 공식 위키(stardewvalleywiki.com)는 이 환경에서 503으로 차단되어, 동일 내용의 Fandom 미러를 인용했다. 공식 위키에도 같은 Farm Buildings 표가 있다.
- The Spriters Resource와 VGMaps 개별 맵 페이지는 Cloudflare/용량 제한으로 직접 확인하지 못했다. 맵 이미지 대조가 필요하면 브라우저에서 VGMaps Atlas(https://vgmaps.com/Atlas/index.htm)를 열어 해당 게임 항목을 보라.
- 픽셀 단위 수치(2~4타일 정면, 1~2px 단차 등)는 실제 타일셋 실측이 아니라 **16px 관행에 기반한 제안**이다. 프로젝트의 기존 칩셋으로 검증해야 한다.
- 추가 조사가 필요한 부분: Octopath II의 도시별 지붕 유형, The Last Spell의 등축 폐허 셸 분류, Manor Lords의 burgage 확장(extension)별 매싱. 이 셋은 1차 출처가 얕아 `[관찰]` 수준으로만 적었다.
