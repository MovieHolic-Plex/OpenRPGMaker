"""Rebuild the common hand-pixel sheets, source cells and review evidence.

python3 scripts/asset-gen/pixel-enemy/refresh/run.py
python3 scripts/asset-gen/pixel-enemy/refresh/run.py --species dragon-blue
python3 scripts/asset-gen/pixel-enemy/refresh/run.py --group organic
"""
import argparse,json
from registry import ENTRIES,draw_entry,export_species,helper

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group()
    group.add_argument('--group',choices=['organic','arcane','humanoid','bosses','accepted'])
    group.add_argument('--species',choices=list(ENTRIES))
    args=parser.parse_args()
    if args.species:
        reports=export_species([args.species])
        target=helper.ROOT/'verify-shots/monster-refresh'/ENTRIES[args.species]['group']/(args.species+'-report.json')
        target.write_text(json.dumps(reports,indent=2)+'\n')
    else:
        for name in ([args.group] if args.group else ['organic','arcane','humanoid','bosses','accepted']):
            helper.run_group(name,lambda slug,pose,cell:draw_entry(slug,pose))

if __name__=='__main__':main()
