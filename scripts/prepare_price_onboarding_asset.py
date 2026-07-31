#!/usr/bin/env python3
"""Prepare the approved price step artwork for the PWA."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: prepare_price_onboarding_asset.py /absolute/path/to/reference.png"
        )

    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Reference not found: {source}")

    project = Path(__file__).resolve().parents[1]
    approved = project / "references" / "approved" / "onboarding-step-2.png"
    asset = project / "public" / "assets" / "onboarding-price-screen.png"
    approved.parent.mkdir(parents=True, exist_ok=True)
    asset.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as image:
        image = image.convert("RGB")
        width, height = image.size
        if width != 853 or height != 1844:
            raise SystemExit(
                f"Unexpected reference size {width}x{height}; expected 853x1844"
            )
        image.save(asset, format="PNG", optimize=True)

    shutil.copy2(source, approved)
    print(f"Saved approved reference to {approved}")
    print(f"Saved price screen to {asset}")


if __name__ == "__main__":
    main()
