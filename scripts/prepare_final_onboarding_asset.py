#!/usr/bin/env python3
"""Prepare the approved final onboarding artwork for the PWA."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: prepare_final_onboarding_asset.py /absolute/path/to/reference.png"
        )

    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Reference not found: {source}")

    project = Path(__file__).resolve().parents[1]
    approved = project / "references" / "approved" / "onboarding-step-3.png"
    full_screen_asset = project / "public" / "assets" / "final-screen.png"
    title_asset = project / "public" / "assets" / "final-title.png"
    journey_asset = project / "public" / "assets" / "final-journey.png"
    approved.parent.mkdir(parents=True, exist_ok=True)
    title_asset.parent.mkdir(parents=True, exist_ok=True)

    shutil.copy2(source, approved)

    with Image.open(source) as image:
        image = image.convert("RGB")
        width, height = image.size
        if width != 853 or height != 1844:
            raise SystemExit(
                f"Unexpected reference size {width}x{height}; expected 853x1844"
            )

        image.save(full_screen_asset, format="PNG", optimize=True)

        title = image.crop((0, 270, width, 660))
        title.save(title_asset, format="PNG", optimize=True)

        # Includes the approved landscape and the visible button artwork.
        # A real accessible button is positioned directly over the artwork.
        journey = image.crop((0, 930, width, 1745))
        journey.save(journey_asset, format="PNG", optimize=True)

    print(f"Saved approved reference to {approved}")
    print(f"Saved complete final screen to {full_screen_asset}")
    print(f"Saved final title to {title_asset}")
    print(f"Saved final journey artwork to {journey_asset}")


if __name__ == "__main__":
    main()
