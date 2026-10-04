"""Canonical refresh renderer, including the approved separately authored hydra.

Older authoring entry points delegate here so regenerating a batch cannot bring
back the retired drawings. Import isolation also works from the old arcane code,
which has a different module called common.
"""
import importlib.util, sys
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent

def _module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    sys.modules[name]=module
    spec.loader.exec_module(module)
    return module

helper=_module('_monster_refresh_common',HERE/'common.py')
ENTRIES={entry['slug']:entry for entry in helper.entries()}
_modules={}

def draw_entry(slug,pose):
    if isinstance(pose,int):pose=helper.POSES[pose]
    assert pose in helper.POSES
    entry=ENTRIES[slug]; group=entry['group']
    if slug in ('kappa-01', 'wolf-grey', 'bat-cave', 'skeleton-knight'):
        key='revised_kappa' if slug=='kappa-01' else 'revised_studies'
        if key not in _modules:
            sys.path.insert(0,str(HERE.parent))
            try:
                path=HERE.parent/('kappa-redraw-draft.py' if slug=='kappa-01' else 'monster-redraw-studies.py')
                _modules[key]=_module('_monster_refresh_'+key,path)
            finally:
                sys.path.pop(0)
        function='draw' if slug=='kappa-01' else {'wolf-grey':'wolf','bat-cave':'bat','skeleton-knight':'skeleton'}[slug]
        return getattr(_modules[key],function)(pose)
    revised=HERE.parent/'redraw'/(group+'.py')
    if group!='accepted':
        if not revised.is_file():
            raise FileNotFoundError(f'Missing current pixel source: {revised}')
        key='redraw_'+group
        if key not in _modules:
            sys.path.insert(0,str(revised.parent))
            try:
                _modules[key]=_module('_monster_'+key,revised)
            finally:
                sys.path.pop(0)
        return _modules[key].draw(slug,pose,entry['cell'])
    if group not in _modules:
        old_common=sys.modules.get('common');sys.modules['common']=helper
        sys.path.insert(0,str(HERE))
        try:
            path=HERE.parent/'hydra-three.py' if group=='accepted' else HERE/(group+'.py')
            _modules[group]=_module('_monster_refresh_'+group,path)
        finally:
            sys.path.pop(0)
            if old_common is None:sys.modules.pop('common',None)
            else:sys.modules['common']=old_common
    module=_modules[group]
    return module.draw(pose) if group=='accepted' else module.draw(slug,pose,entry['cell'])

def export_species(slugs):
    reports=[]
    for slug in slugs:
        entry=ENTRIES[slug]
        reports.append(helper.export_frames(entry,[draw_entry(slug,p) for p in helper.POSES]))
        print(slug,entry['cell'],reports[-1]['colors'],flush=True)
    return reports
