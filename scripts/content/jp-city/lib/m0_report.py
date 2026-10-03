"""rebuild-source.sh 가 모은 검사 JSON 을 tiledata/jp-city/m0-report.json 으로 합친다(이미 있으면 들어온 항목만 갱신)."""
import sys, os, json, hashlib, argparse
import jpenv
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
def main():
    ap = argparse.ArgumentParser()
    for k in ('checks', 'source_compare', 'districts_compare', 'twice'): ap.add_argument('--' + k)
    a = ap.parse_args(); path = os.path.join(jpenv.TD, 'm0-report.json')
    rep = json.load(open(path)) if os.path.exists(path) else {}
    cat = json.load(open(os.path.join(jpenv.OUT, 'jp_shopstreet16.catalog.json')))
    rep['sheet'] = {'file': 'sources/jp_shopstreet16.png', 'cells': cat['sheet']['count'], 'cols': cat['sheet']['cols'], 'sha256': sha(os.path.join(jpenv.OUT, 'jp_shopstreet16.png')),
                    'catalogSha256': sha(os.path.join(jpenv.OUT, 'jp_shopstreet16.catalog.json'))}
    rep['kit'] = {'names': len(cat['names']), 'bands': len(cat['bands']), 'decos': len(cat['decos']), 'street': len(cat['street']), 'props': len(cat['props']),
                  'recipes': len(cat['recipes']), 'lRecipes': len(cat['lRecipes']), 'doorDefault': len(cat['doorDefault'])}
    rep['people'] = {'excluded': True, 'method': '자리 유지: 원본에서 person.* 가 차지하던 고유 칸 155개(851..1005)를 투명 빈 칸으로 남겨 뒤 칸 번호를 원본과 같게 둔다.', **cat['people']}
    if a.checks: rep['checks'] = json.load(open(a.checks))
    if a.source_compare: rep['compareToOriginal'] = json.load(open(a.source_compare))
    if a.districts_compare: rep['districtsCompareToOriginal'] = json.load(open(a.districts_compare))
    if a.twice: rep['determinism'] = json.load(open(a.twice))
    json.dump(rep, open(path, 'w'), ensure_ascii=False, indent=1); print('wrote', path)
if __name__ == '__main__': main()
