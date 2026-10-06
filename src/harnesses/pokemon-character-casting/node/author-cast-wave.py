"""Author-picked literal row replacements on role-specific walking templates.

Rules below are explicit pixel strings. Expansion retains original pose offsets;
right-facing rules mirror the existing source's left/right contract. It does not
synthesize bodies, place random details, trace images or repair failed gates.
"""
import json,sys,argparse,subprocess
from pathlib import Path
from template import base,replay
ROOT=Path(__file__).resolve().parents[4]
DEST=ROOT/'harness-data/pokemon-character-casting/templates/full-cast-v1'
# Each tuple: role, template, Korean label/name/design, palette, head row substrings, clothes row substrings.
CAST=[
('hero','brendan-walking','주인공','해솔','호박색 헤드밴드와 남색 여행복, 밝은 모자 무늬',
 {'5':'#3b4962','6':'#28364c','7':'#1e2940','8':'#152234','9':'#d9d1bd','A':'#e4ad55','B':'#997341','C':'#7298bb','D':'#416784'},
 [('FA9AAAA9AF','FA9A99A9AF'),('F5BAEEEEAB5F','F5BAE99EAB5F'),('59999EE9EE95','599EE99EE995'),('BEAAAAABB99F5','BEAA99ABBEEF5')],
 [('88DD88','88EE88'),('BEEB','BAAB'),('8FCCF','8FEEF'),('4FCCF','4FEEF'),('8FF88B4','8FFEEB4'),('D8FFB4','D8FEB4')]),
('rival','wally','라이벌','시온','짙은 보랏빛 머리와 자주색 재킷, 밝은 가슴 장식',
 {'8':'#c79cbd','9':'#855582','A':'#402d51','B':'#82738e','C':'#50415e','D':'#272538','E':'#eee4cd'},
 [('DDCCCCDD','DDBBBBDD'),('DCCCCCCDD','DCBBBBBDD')],
 [('889988','885588'),('E8888E','E5555E'),('EEEEEEEE','EE5555EE'),('98E44EE9','98544559'),('98EE44E9','98554459'),('9844EEE9','98445559')]),
('professor','prof_birch','박사','해명','회색 머리와 하얀 연구복, 청록 조끼와 연구원 배지',
 {'B':'#c8c9bd','C':'#858e8d','D':'#454e55','8':'#65aaa4','9':'#3b797b','A':'#254955','5':'#dedbcf','6':'#a6b9bc','7':'#586c80'},
 [('DDCBCDCCBCDD','DDBCCBBCCBDD'),('DDBCCCDCCBDD','DDBBCCBBCBDD'),('DCBBCCCCBBCD','DCBBCCBBBBCD'),('DDCCCCCCCBBCD','DDBBCCBBCBCCD')],
 [('E9449E','E8448E'),('55555555','55EE6655'),('555555','55EE55'),('A8E7EEE57','A8E7E8857'),('A8E777E57','A8E778857'),('A877EEE57','A877E8857')]),
('nurse','woman_3','간호사','이솔','분홍 표식 모자와 민트 의료복, 밝은 앞치마',
 {'5':'#e27d93','6':'#b65270','7':'#673e5a','8':'#dfede5','9':'#9ec5bf','A':'#4f797d','B':'#cd8790','C':'#974d64','D':'#503148'},
 [('DDBBDBDD','DDE55EDD'),('DCBBDBBBCD','DEEEE5EEED'),('DCCCBBDBCCCD','D5EE5555EE5D'),('DDBCCBDD','DDE55EDD'),('DBCCCCCCBD','DEEEEEEEED'),('DCBCCCCCCBCD','D5EEEEEEEE5D'),('DDCCCCCD','DDE5555D'),('DCCCCCCCBD','DEEEEEEE5D'),('DDCCCCCCBBCD','D5EEEEEEE55D')],
 [('6EEEE6','6E55E6'),('655556','65EE56'),('A9A5567','A9A5EE7')]),
('merchant','mart_employee','상인','도윤','갈색 머리와 남색 셔츠, 노란 명찰과 줄무늬 앞치마',
 {'5':'#e8bc62','6':'#b28344','7':'#765633','8':'#82b5c5','9':'#497c96','A':'#2a445d','B':'#c28c57','C':'#80583f','D':'#443436','E':'#f5e8c9'},
 [('DDCCCCDD','DDBBBBDD'),('DBCCCCBD','DBBBBBBD'),('DDCCCCCD','DDBBBBCD')],
 [('EE55EE','EE66EE'),('59888895','59666695'),('5988889','5966669'),('9888895','9666695'),('A95E889A','A95E559A'),('A95E899A','A95E559A')]),
('mother','mom','어머니','유나','붉은 갈색 머리와 금빛 머리핀, 살구색 블라우스와 청록 치마',
 {'5':'#75a9a1','6':'#497970','7':'#29494b','8':'#e9b79c','9':'#be7d75','A':'#80515e','B':'#e6c075','C':'#b58b5c','D':'#5f5150'},
 [('FF4444FF','FFBBBBFF'),('F4334444434F','F4BB4444BB4F'),('FF44444F','FFBBBB4F')],
 [('88BB88','88EE88'),('AAAAAA','AAEEAA'),('AAAAA','AEEAA'),('A88BBFFF','A88EEFFF'),('A889BFFF','A88EEFFF'),('A9B99FFF','A9E9EFFF')]),
('resident','man_3','주민','준서','밤색 머리와 라임색 바람막이, 어깨의 밝은 반사띠',
 {'5':'#ce9b60','6':'#966443','7':'#523c38','8':'#b3c276','9':'#798b52','A':'#40563d','E':'#efe6c5'},
 [('77666677','77555577'),('77566577','77555577'),('7666666657','7655556657'),('77666667','77555567')],
 [('98EE89','985589'),('999999','955559'),('AE99889A','AE99559A'),('A98889A','A95589A'),('448899A','445599A')]),
('gym_leader','black_belt','체육관장','태강','은회색 머리와 붉은 머리띠, 짙은 도복과 금빛 띠',
 {'B':'#d5d5cb','C':'#979da1','D':'#4a515d','5':'#b5514d','6':'#79383e','7':'#422d3c','8':'#e5bb63','9':'#a47b3d','A':'#614c38','E':'#d57865'},
 [('DBCDBCDBD','DCBDCBBBD'),('DBDCBDCBD','DCBDCCBBD'),('DDCBBBBCDD','DDCBBBCCDD'),('DDCBBBBCCD','DDCCBBBBDD')],
 [('EEE33EEE','EE8338EE'),('55EEEE55','55E88E55'),('EEEEE','EE88E'),('E6EEE767','E6E88767'),('EEEEE767','EEE88767'),('E7EEE767','E7E88767')]),
('company_agent','devon_employee','회사요원','서진','청회색 정장과 금빛 넥타이, 단정한 가르마와 가슴 명찰',
 {'5':'#e1be71','6':'#b18748','7':'#695338','8':'#8dabc0','9':'#5d7994','A':'#33475c','B':'#80737b','C':'#514750','D':'#2c2935'},
 [('DBBBCCCCCD','DBBBBBBBDD'),('DCCCCCBBBD','DBBBBCBBBD'),('DDCCCBBCD','DDBBBBBBD')],
 [('E66E','E55E'),('A44A','A55A'),('76E8889A','76E8559A'),('76E9899A','76E9559A')]),
('captain','sailor','선장','해준','흰 선장모의 금빛 문장, 남색 항해복과 금색 장식',
 {'5':'#e7c16f','6':'#bd934e','7':'#705735','8':'#e6e3d2','9':'#9daeb7','A':'#394f69','B':'#c3aa70','C':'#7e674c','D':'#393743','E':'#6c88a0'},
 [('98888889','98555589'),('99888899','99E88E99')],
 [('E8AAAA8E','E855558E'),('88888888','88555588'),('AA81188AA','AA51155AA')]),
('worker','man_1','작업자','석호','노란 안전모와 황토색 작업조끼, 남색 작업바지',
 {'5':'#d5a850','6':'#ac7a36','7':'#69512f','8':'#6f91ae','9':'#456680','A':'#283e54','B':'#e59d4b','C':'#b76b37','D':'#674634','E':'#efc879'},
 [('......4444......','......7777......'),('......44444.....','......77777.....'),('D411114D','75EEEE57'),('DC1E1111CD','75EEEEEE57'),('DCC111111CCD','75EEEEEEEE57'),('DDC211112CDD','777555555777'),('44111144','75EEEE57'),('DD1E1111DD','75EEEEEE57'),('DC21111112CD','75EEEEEEEE57'),('DC22111122CD','75EEEEEEEE57'),('DCC222222CCD','777555555777'),('44112224','75EEEE57'),('411111222D','75EEEEEE57'),('41EE1112CCCD','75EEEEEEEE57'),('41111DCCCCCD','775555555577')],
 [('EE77EE','EEBBEE'),('6666','6BB6'),('7E5EEE57','7E5BBE57')]),
('student','school_kid_m','학생','민재','밤색 머리와 푸른 안경테, 크림색 교복 조끼와 책가방',
 {'8':'#ead8b1','9':'#53889f','A':'#5b433e','B':'#b58b61','C':'#765b49','D':'#423b3c','E':'#f6e8c9'},
 [('FFAAAAFF','FFCCCCFF')],
 [('EE88EE','EE55EE'),('9E88EE','9E55EE'),('EE88E9','EE55E9'),('8EEEE8','8E55E8'),('A984489A','A954459A'),('A944889A','A944559A'),('A988449A','A955449A')]),
('ranger','bug_catcher','레인저','솔찬','숲색 챙모자의 밝은 띠, 짙은 초록 조끼와 어깨 장식',
 {'5':'#e0bd72','6':'#ad8b4c','7':'#715833','8':'#8da774','9':'#58774c','A':'#2d493e','B':'#71975a','C':'#547144','D':'#2e4532'},
 [('DB2222BD','DB5555BD'),('B22B','B55B')],
 [('98888889','98555589'),('988888','985588'),('888889','885589'),('A894488A','A854455A'),('A899448A','A855448A'),('A844988A','A844955A')]),
('moon_leader','gentleman','월영단장','백야','보랏빛 중절모와 은빛 문장, 짙은 보라 코트와 금색 브로치',
 {'5':'#e3dfd2','6':'#afb7c0','7':'#697586','8':'#d5b978','9':'#9b875d','A':'#514d50','B':'#9a82aa','C':'#655475','D':'#332c46'},
 [('DCBDDBCD','DCE55ECD'),('DCCBBCCD','DCCE5CCD'),('DCBBBBCD','DCCE5CCD')],
 [('B5995B','B5EE5B'),('CCCCCC','CCEECC'),('A95CDDCD','A95C55CD'),('A95CDBCD','A95C55CD'),('A95CBDCD','A95C55CD')]),
('hiker','hiker','등산가','산호','황토색 등산모와 남색 조끼, 연한 배낭끈과 고리',
 {'5':'#d8b777','6':'#a88855','7':'#5f533e','8':'#7e9baa','9':'#506c7e','A':'#2c4656','B':'#d1b78a','C':'#938063','D':'#4c483f'},
 [('76577567','76E55E67'),('65655656','655EE556')],
 [('8A8AA8A','8A8EE8A'),('A8AA8A','A8EE8A'),('AA8888AA','AA8EE8AA'),('A8989A9AA','A8955A9AA'),('A899999AA','A895599AA')])
]

def expand(template,head,clothes):
 record,palette,frames=base(template);patches=[]
 for frame,rows in frames.items():
  for y,line in enumerate(rows[:28]):
   rules=head if 10<=y<21 else clothes if 21<=y<28 else []
   current=line
   for old,new in rules:
    assert len(old)==len(new),(template,old,new)
    if frame.startswith('right_'):old,new=old[::-1],new[::-1]
    current=current.replace(old,new)
   if current!=line:patches.append({'frame':frame,'y':y,'rows':[current]})
 return record,patches

def main():
 p=argparse.ArgumentParser();p.add_argument('--render',action='store_true');a=p.parse_args();items=[];errors=[]
 DEST.mkdir(parents=True,exist_ok=True)
 for role,template,label,name,design,palette,head,clothes in CAST:
  try:
   record,patches=expand(template,head,clothes)
   spec={'version':1,'templateId':template,'templateSourceSha256':record['sha256'],'paletteOverrides':palette,'patches':patches,'protectedRows':[28,29,30,31],'design':design,'editSource':'author-cast-wave.py explicit substring replacements, expanded at original pose positions; source symmetric right view contract retained.'}
   _,image,audit=replay(spec)
   folder=DEST/role;folder.mkdir(exist_ok=True)
   (folder/'template.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
   meta={'role':role,'label':label,'variant':name+' · 판형 수정','description':design,'identity':design+' · 원작 체형과 발 교대 유지','collection':'full-cast-v1','base':template+'-'+role+'-full-cast-v1','templateId':template,'sourceNote':'에메랄드 '+template+' 원작을 판형으로 삼아 Codex가 머리·복장 부분과 팔레트를 수정한 파생 캐릭터입니다. 원작의 몸·얼굴·걷기를 유지했습니다.'}
   (folder/'candidate.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
   if a.render:
    result=subprocess.run([sys.executable,str(Path(__file__).with_name('render-template.py')),'--spec',str(folder/'template.json'),'--candidate',str(folder/'candidate.json'),'--out',str(folder)],capture_output=True,text=True)
    if result.returncode:raise ValueError(result.stderr)
   items.append({'role':role,'label':label,'name':name,'template':template,'bundle':str(folder),'headEditsMin':min(x['headIndexEdits'] for x in audit['frames']),'clothesEditsMin':min(x['clothingIndexEdits'] for x in audit['frames'])})
   print(role+' ready',flush=True)
  except Exception as e:errors.append({'role':role,'error':str(e)});print(role+' FAILED '+str(e),flush=True)
 (DEST/'manifest.json').write_text(json.dumps({'wave':'full-cast-v1','items':items,'reuseExplorer':'explorer-2fe0ce80a94b963f','errors':errors,'scope':'Sixteen walking roles, twelve poses each; fifteen newly edited templates plus existing Naru v2. User Allow required.'},ensure_ascii=False,indent=2)+'\n')
 if errors:raise SystemExit(1)
if __name__=='__main__':main()
