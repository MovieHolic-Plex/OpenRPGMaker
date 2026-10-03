"""조선 실내 조각 보기: python3 in_show.py <모듈> <출력.png> [배율] [이름접두]  — 조각 + 같은 배율의 v5 기준(REFS 표)."""
import sys, importlib
sys.path.insert(0, '.')
import in_preview as PV
import tk

REFS = {
 'in_ibuljang': ['wardrobe', 'cupboard'], 'in_nong_1': ['wardrobe', 'cupboard'], 'in_nong_2': ['wardrobe', 'sideboard 2x1'],
 'in_bandaji_2': ['chest', 'sideboard 2x1'], 'in_bandaji_1': ['chest'], 'in_munggap': ['sideboard 2x1', 'cupboard'],
 'in_hwaro': ['brazier', 'pot'], 'in_deungjan': ['candle'], 'in_chotdae': ['candle'], 'in_geolsang_2': ['bench 2'],
 'in_stool': ['stool'], 'in_bumak_2': ['kitchen range', 'stove'], 'in_bumak_3': ['kitchen range'], 'in_hangari_s': ['pot', 'water jar'], 'in_hangari_m': ['pot', 'water jar'], 'in_dok_big': ['pot'], 'in_muldongi': ['water jar'], 'in_betul': ['loom'], 'in_mulle': ['spinning wheel'], 'in_moru': ['anvil'], 'in_hwadeok_3': ['forge', 'bread oven'], 'in_dameum': ['quench barrel', 'barrel'], 'in_sutdeomi': ['coal bin'], 'in_jangjak': ['firewood bundle'], 'in_seonban_2': ['bookshelf 2w'], 'in_gongjang': ['work 2x1'], 'in_pungmu': ['bellows'], 'in_sokuri_veg': ['basket:cabbage'], 'in_sang_low_2': ['dining 2x1', 'desk 2x1'], 'in_gyojasang_2': ['dining 2x1', 'tea 2x1'],
}
if __name__ == '__main__':
    mod, out = sys.argv[1], sys.argv[2]
    sc = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    pre = sys.argv[4] if len(sys.argv) > 4 else ''
    m = importlib.import_module(mod)
    o = m.objects()
    items = [(k, v.img()) for k, v in o.items() if k.startswith(pre)]
    PV.sheet(items, out, scale=sc, refs=REFS)
    print(len(items), 'pieces; palette violations:', tk.VIOLATIONS)
