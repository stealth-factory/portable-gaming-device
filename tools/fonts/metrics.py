"""Generate shared advances from the pinned font: python3 tools/fonts/metrics.py.

Requires fonttools==4.61.1 (generation only). The font and its OFL licence sit
beside this script; no font download is needed to reproduce the table.
"""
import hashlib
import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).with_name("Silkscreen-Regular.ttf")
FONT = TTFont(SOURCE)
UNITS = FONT["head"].unitsPerEm
ADVANCES = {
    str(code): FONT["hmtx"][glyph][0]
    for code, glyph in sorted(FONT.getBestCmap().items())
}
# Mark attachment changes positions, not advances. No kerning is enabled.
assert "kern" not in FONT
assert all(
    record.FeatureTag in ("mark", "mkmk")
    for record in FONT["GPOS"].table.FeatureList.FeatureRecord
)
DATA = {
    "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "unitsPerEm": UNITS,
    "missingAdvance": FONT["hmtx"][".notdef"][0],
    "advances": ADVANCES,
}
TARGET = ROOT / "src/kit/platform/font-metrics.json"
TARGET.write_text(json.dumps(DATA, ensure_ascii=True, indent=2) + "\n")
