#!/usr/bin/env python3
"""Prepare the approved first onboarding illustration for the PWA."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: prepare_onboarding_asset.py /absolute/path/to/reference.png")

    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Reference not found: {source}")

    project = Path(__file__).resolve().parents[1]
    approved = project / "references" / "approved" / "onboarding-step-1.png"
    asset = project / "public" / "assets" / "onboarding-choice.png"
    title_asset = project / "public" / "assets" / "onboarding-title.png"
    approved.parent.mkdir(parents=True, exist_ok=True)
    asset.parent.mkdir(parents=True, exist_ok=True)

    shutil.copy2(source, approved)

    with Image.open(source) as image:
        image = image.convert("RGB")
        width, height = image.size
        if width != 853 or height != 1844:
            raise SystemExit(
                f"Unexpected reference size {width}x{height}; expected 853x1844"
            )

        # The crop contains only the approved hands, rope and pause mark.
        # Explanatory text and controls remain real, accessible UI elements.
        title = image.crop((0, 280, width, 555))
        title.save(title_asset, format="PNG", optimize=True)
        illustration = image.crop((0, 930, width, 1431))
        illustration.save(asset, format="PNG", optimize=True)

    print(f"Saved approved reference to {approved}")
    print(f"Saved onboarding title to {title_asset}")
    print(f"Saved onboarding artwork to {asset}")


if __name__ == "__main__":
    main()
