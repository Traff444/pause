from pathlib import Path

from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "fonts" / "PauzaDisplay.ttf"


def corrected_font() -> TTFont:
    font = TTFont(SOURCE)
    for table in font["cmap"].tables:
        if table.isUnicode() and 0x0422 in table.cmap:
            # The source sheet omitted Р, so the following three outlines
            # retained glyph names one Unicode position earlier. Map by the
            # visible outlines rather than by those internal names.
            table.cmap[0x0421] = "uni0420"  # С outline
            table.cmap[0x0422] = "uni0421"  # Т outline
            table.cmap[0x0423] = "uni0422"  # У outline
    return font


ttf = corrected_font()
ttf.flavor = None
ttf.save(SOURCE)

woff = corrected_font()
woff.flavor = "woff"
woff.save(ROOT / "public" / "fonts" / "PauzaDisplay.woff")
