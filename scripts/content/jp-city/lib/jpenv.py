"""jp-city 굽기 공용 경로·옵션. 모든 모듈이 가장 먼저 `import jpenv` 한다.
저장소 밖 경로(~/gv3-work, ~/.t3/worktrees/...)는 쓰지 않는다. 글자는 tiledata/jp-city/glyphs.json 에서 읽는다(시스템 글꼴 아님)."""
import os, sys, json

LIB = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(LIB, '..', '..', '..', '..'))
ATLAS_PICK = os.path.join(ROOT, 'scripts', 'content', 'atlas-pick')     # modern_style_bible_proof (K/Cv/RAMPS), modern3_check, common
TD = os.path.join(ROOT, 'tiledata', 'jp-city')
GLYPHS = os.path.join(TD, 'glyphs.json')
PEOPLE_RESERVE = os.path.join(TD, 'people-reserve.json')
for _p in (ATLAS_PICK, LIB):                                            # LIB 이 맨 앞
    if _p not in sys.path: sys.path.insert(0, _p)
sys.path.remove(LIB); sys.path.insert(0, LIB)

# 시트·카탈로그 출력 위치. 기본은 커밋 대상 tiledata/jp-city/sources. JPCITY_OUT 으로 바꿔 재현 시험을 할 수 있다.
OUT = os.path.abspath(os.environ.get('JPCITY_OUT') or os.path.join(TD, 'sources'))
# 지구 PNG 출력 위치
DISTRICTS_OUT = os.path.abspath(os.environ.get('JPCITY_DISTRICTS_OUT') or os.path.join(TD, 'districts'))
# 행인(Actor1 person.*)은 번들에 넣지 않는다. 끄려면 JPCITY_PEOPLE=1 (원본 Actor1.png 가 있어야 하는 비교 전용 경로, 저장소에는 그 파일이 없다).
NO_PEOPLE = os.environ.get('JPCITY_PEOPLE') != '1'

def people_reserved():
    """원본 시트에서 person.* 가 차지하던 고유 칸 수. --no-people 에서는 이만큼 빈 칸으로 자리를 지켜 이후 칸 번호를 그대로 둔다."""
    with open(PEOPLE_RESERVE) as f: return json.load(f)['cells']
