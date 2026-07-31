#!/usr/bin/env python3
"""Prepare the approved entry-screen artwork for the PWA."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: prepare_entry_asset.py /absolute/path/to/reference.png")

    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Reference not found: {source}")

    project = Path(__file__).resolve().parents[1]
    approved = project / "references" / "approved" / "entry-login.png"
    asset = project / "public" / "assets" / "entry-hands.png"
    approved.parent.mkdir(parents=True, exist_ok=True)
    asset.parent.mkdir(parents=True, exist_ok=True)

    shutil.copy2(source, approved)

    with Image.open(source) as image:
        image = image.convert("RGB")
        width, height = image.size
        if width != 913 or height != 1723:
            raise SystemExit(
                f"Unexpected reference size {width}x{height}; expected 913x1723"
            )

        # Remove the captured iOS status bar. At the bottom, preserve the full
        # tapered end of the lower arm while painting out the wordmark that
        # begins beside it. This avoids the hard horizontal crop visible when
        # the artwork ended at y=890.
        cleaned = image.copy()
        for y in range(890, 934):
            row_color = cleaned.getpixel((800, y))
            for x in range(180, width):
                cleaned.putpixel((x, y), row_color)
        hero = cleaned.crop((0, 80, width, 934))
        hero.save(asset, format="PNG", optimize=True)

    print(f"Saved approved reference to {approved}")
    print(f"Saved entry artwork to {asset}")


if __name__ == "__main__":
    main()
