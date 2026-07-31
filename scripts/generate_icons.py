from pathlib import Path

from PIL import Image, ImageDraw


OUTPUT = Path(__file__).resolve().parents[1] / "public"


def create_icon(size: int, filename: str) -> None:
    image = Image.new("RGB", (size, size), "#1246B8")
    draw = ImageDraw.Draw(image)
    radius = round(size * 0.235)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill="#1246B8")
    width = round(size * 0.12)
    left = round(size * 0.29)
    right = round(size * 0.71)
    top = round(size * 0.25)
    bottom = round(size * 0.75)
    draw.line((left, top, left, bottom), fill="white", width=width)
    draw.line((right, top, right, bottom), fill="white", width=width)
    draw.line((left, top, right, top), fill="white", width=width)
    image.save(OUTPUT / filename, optimize=True)


create_icon(192, "icon-192.png")
create_icon(512, "icon-512.png")
create_icon(180, "apple-touch-icon.png")
