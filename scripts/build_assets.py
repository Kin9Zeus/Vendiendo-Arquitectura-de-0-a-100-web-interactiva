"""Genera los recursos gráficos del sitio a partir de recursos_iniciales/.

Uso:  npm run assets   (python -I scripts/build_assets.py)

Salida:
  src/assets/book/{front,back,spine}.jpg   caras del libro 3D
  src/assets/author.jpg                    retrato del autor (recorte de portada)
  public/og.jpg                            imagen social 1200x630
  public/icons/*.png, public/favicon.ico   iconos
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "recursos_iniciales"
OUT_ASSETS = ROOT / "src" / "assets"
OUT_PUBLIC = ROOT / "public"

INK = (20, 20, 22)        # --ink   #141416
GRID = (38, 39, 44)       # --grid  #26272c
VIOLET = (160, 124, 230)  # --violet #a07ce6


def save_jpg(im: Image.Image, path: Path, quality: int = 88) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    print("ok", path.relative_to(ROOT), im.size)


def grid(draw: ImageDraw.ImageDraw, w: int, h: int, step: int) -> None:
    for x in range(0, w, step):
        draw.line([(x, 0), (x, h)], fill=GRID, width=1)
    for y in range(0, h, step):
        draw.line([(0, y), (w, y)], fill=GRID, width=1)


def main() -> None:
    front = Image.open(SRC / "Portada_aprobacion.jpg")          # 1913x2646
    jacket = Image.open(SRC / "Sobrecubierta_maqueta.jpg")      # 3130x1358

    # --- Libro 3D -----------------------------------------------------------
    save_jpg(front.resize((900, round(900 * front.height / front.width)), Image.LANCZOS),
             OUT_ASSETS / "book" / "front.jpg")
    back = jacket.crop((548, 0, 1502, 1358))
    save_jpg(back.resize((900, round(900 * back.height / back.width)), Image.LANCZOS),
             OUT_ASSETS / "book" / "back.jpg")
    spine = jacket.crop((1502, 0, 1612, 1358))
    save_jpg(spine, OUT_ASSETS / "book" / "spine.jpg")

    # --- Retrato del autor (zona derecha de la portada) ----------------------
    author = front.crop((600, 880, 1913, 2646))
    save_jpg(author, OUT_ASSETS / "author.jpg", quality=86)

    # --- Imagen social 1200x630 ---------------------------------------------
    og = Image.new("RGB", (1200, 630), INK)
    d = ImageDraw.Draw(og)
    grid(d, 1200, 630, 30)
    title = front.crop((120, 120, 1350, 830)).copy()           # bloque tipográfico de la portada
    ImageDraw.Draw(title).rectangle([1000, 640, title.width, title.height], fill=(21, 21, 23))  # tapa el círculo
    title = title.resize((640, round(640 * title.height / title.width)), Image.LANCZOS)
    og.paste(title, (56, 130))
    cover = front.resize((390, round(390 * front.height / front.width)), Image.LANCZOS)
    shadow = Image.new("RGB", (cover.width + 8, cover.height + 8), (8, 8, 9))
    og.paste(shadow, (760, 66))
    og.paste(cover.crop((0, 0, cover.width, 540)), (752, 58))
    d.rectangle([752, 58, 752 + cover.width - 1, 597], outline=VIOLET, width=2)
    d.rectangle([56, 540, 136, 546], fill=VIOLET)
    og.save(OUT_PUBLIC / "og.jpg", "JPEG", quality=86, optimize=True, progressive=True)
    print("ok public/og.jpg")

    # --- Iconos -------------------------------------------------------------
    logo = Image.open(ROOT / "logo-uva.png").convert("RGBA")
    alpha = logo.getchannel("A")
    icons = OUT_PUBLIC / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    for size in (32, 180, 192, 512):
        canvas = Image.new("RGBA", (size, size), INK + (255,))
        pad = round(size * 0.16)
        target_w = size - 2 * pad
        a = alpha.resize((target_w, round(target_w * alpha.height / alpha.width)), Image.LANCZOS)
        ink = Image.new("RGBA", a.size, VIOLET + (255,))
        ink.putalpha(a)
        canvas.alpha_composite(ink, (pad, (size - a.height) // 2))
        canvas.save(icons / f"icon-{size}.png", optimize=True)
    Image.open(icons / "icon-32.png").save(OUT_PUBLIC / "favicon.ico", sizes=[(32, 32)])
    # logo coloreable por máscara CSS
    (OUT_PUBLIC / "brand").mkdir(exist_ok=True)
    logo.save(OUT_PUBLIC / "brand" / "logo-uva.png", optimize=True)
    print("ok icons")


if __name__ == "__main__":
    main()
