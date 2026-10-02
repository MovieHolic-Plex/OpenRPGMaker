"""현대·SF 아이콘 17역할 — 장면 모음 진입점. ICONS[이름]() -> (arr, stats)."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from msf_core import ICONS, FIT, SOFT, done, icon  # noqa: F401,E402
import scenes_a  # noqa: F401,E402
import scenes_b  # noqa: F401,E402
