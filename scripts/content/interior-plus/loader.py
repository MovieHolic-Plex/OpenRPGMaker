"""조각 모듈을 모두 불러 REG 를 채운다."""
import importlib, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'pieces'))
import iplib

MODULES = ['structure', 'museum', 'ship', 'arena', 'puzzle', 'observatory', 'fallen']


def load(mods=None):
    for m in mods or MODULES:
        if os.path.exists(os.path.join(HERE, 'pieces', m + '.py')): importlib.import_module(m)
    return iplib.REG
