# RPG 오프닝 조사와 적용 — 2026-10-04

범위: 아래 일곱 작품의 개발사·퍼블리셔 공식 설명, 공식 오프닝 공개 자료를 읽었다.
영상의 전 컷을 재생·계측한 비교가 아니다. 공식 자료가 말하는 사실과 OPRN에 적용할 설계 판단을 구분한다.
원작 그림·음악·영상은 게임 에셋이나 저장소로 복사하지 않는다.

| 작품 | 공식 자료에서 확인한 내용 | OPRN 적용 판단 (추론) |
|---|---|---|
| FFVII Remake | Midgar를 소개하는 오프닝 영상과 새롭게 편곡한 음악을 공개한다. [Square Enix](https://na.finalfantasy.com/news/1299) | 세계의 인상과 음악이 같은 장면을 설명해야 한다. 아무 배경에 확대 효과만 붙이지 않는다. |
| Octopath Traveler II | HD-2D의 발전에 역동적인 카메라와 감정을 전달하는 인물 동작을 포함한다. [Nintendo](https://www.nintendo.com/us/whatsnew/embark-on-an-adventure-with-eight-new-travelers-in-octopath-traveler-ii/) | 구도·초점과 인물 행동이 정보를 줘야 한다. 원경/클로즈업/중경을 실제로 구분한다. |
| Sea of Stars | 개발사의 Sunset Edition 설명은 과거 영웅의 얼굴과 비극을 보여 주는 새 시네마틱 도입, 확장한 스프라이트 이야기 연출을 설명한다. [Sabotage 개발 업데이트](https://sea-of-stars.backerkit.com/hosted_preorders/project_updates) | 모험이 시작되는 원인을 보여 준다. 서술만으로 사건이 있었다고 선언하지 않는다. |
| Tales of Arise | Ufotable이 제작한 오프닝은 앞으로의 여정을 예고한다. 주요 이야기 지점에도 애니메이션을 사용한다. [공식 오프닝](https://en.bandainamcoent.eu/tales-of/news/discover-tales-of-arise-opening-movie-animated-ufotable), [공식 게임 소개](https://en.bandainamcoent.eu/tales-of/tales-of-arise) | 독립 애니메이션은 별도 저작 자산이다. 스틸+카메라+입자를 인물 애니메이션과 같은 품질이라고 부르지 않는다. |
| Persona 5 Royal | 공식 소개가 타이틀 화면까지 이어지는 시각적 표현, 음악·미술·컷신을 함께 다룬다. [PlayStation](https://blog.playstation.com/2020/03/04/persona-5-royal-hands-on-see-whats-in-store-for-the-phantom-thieves/) | 타이틀·오프닝·게임의 색과 물체 디자인을 유지한다. 그림은 이전 컷을 실제 참조로 보내 생성한다. |
| Chrono Trigger | 일상적인 인물, 박람회의 발명품 사고, 시간의 균열이 모험의 계기라는 연결을 설명한다. [퍼블리셔 제공 Nintendo 소개](https://www.nintendo.com/en-gb/Games/Nintendo-DS/Chrono-Trigger-270297.html) | 첫 장소에서 보이는 물체와 첫 조사 행동이 도입 사건에 이어져야 한다. 거대한 설정 설명부터 길게 하지 않는다. |
| Dragon Quest XI S | 공식 데모는 이야기의 첫 장을 플레이하고 진행을 본편에 이어가는 구조다. [Square Enix 작성 PlayStation 소개](https://blog.playstation.com/2020/11/02/dragon-quest-xi-s-echoes-of-an-elusive-age-definitive-edition-demo-out-now/) | 오프닝이 끝나면 실제 입력·진행으로 이어져야 한다. 화려한 영상만 있고 첫 행동이 막히면 완료가 아니다. |

## 이번 적용

- 첫 제작 계약: 장소 소개 → 구체적 사건 → 첫 행동의 세 컷, 서로 다른 실제 원화 두 장 이상, 자동 진행 총 12초 이내, 건너뛰기 허용.
- 이미지 생성: 원경 강제 지시 제거. 요청한 촬영 거리와 시점 준수. `referenceResourceId`로 동일 인물·물체·장소·화풍을 유지한다.
- 장면 연출: `direction.camera`, `transition`, 좌표 기반 빛/입자/안개/발광, 한 번의 효과음, 자막 지연. 효과 좌표는 실제 원화를 보고 정한다.
- 준비: 타이틀 첫 프레임 뒤 그림 두 장/엔진 모듈/사용 이미지의 준비 시작. 그림은 로드·decode 완료 뒤 장면 시간과 연출을 시작한다. 다음 컷을 준비하는 동안 현재 컷을 유지한다.
- 인계: 마지막 오프닝 그림을 남은 엔진/맵 준비의 배경으로 사용한다. 실제 게임 세션·Phaser 씬은 새 게임 시작 이후에만 만든다.

현재 구현은 **여러 스틸 컷의 연출**이다. 인물의 걷기·표정·손 동작을 프레임 단위로 애니메이션하는 기능은 추가하지 않았다.
이 조사만으로 일곱 게임의 모든 오프닝을 프레임별 연구했다고 보고하지 않는다. 출하 플레이어의 실제 재생과 정본 재로드는 별도 증거로 남긴다.
