import os

from PIL import Image, ImageDraw


def create_gradient_icon(src_path: str) -> Image.Image:
    src = Image.open(src_path).convert("RGBA")
    w, h = src.size

    # Definir paleta de cores exigida pelo usuário:
    # 1º: #1DCDFE (Azul celeste)
    # 2º: #21D0B2 (Verde-azulado / Turquesa)
    # 3º: #34F5C5 (Verde menta / Menta claro)
    c1 = (0x1D, 0xCD, 0xFE)  # (29, 205, 254)
    c2 = (0x21, 0xD0, 0xB2)  # (33, 208, 178)
    c3 = (0x34, 0xF5, 0xC5)  # (52, 245, 197)

    pixels = list(src.getdata())
    new_pixels = []
    denom = w + h - 2

    for idx, (r, g, b, a) in enumerate(pixels):
        if a == 0:
            new_pixels.append((0, 0, 0, 0))
            continue

        x = idx % w
        y = idx // w

        # Gradiente linear diagonal (topo-esquerdo para base-direita)
        t = (x + y) / denom

        if t <= 0.5:
            f = t * 2.0
            nr = int(c1[0] + (c2[0] - c1[0]) * f)
            ng = int(c1[1] + (c2[1] - c1[1]) * f)
            nb = int(c1[2] + (c2[2] - c1[2]) * f)
        else:
            f = (t - 0.5) * 2.0
            nr = int(c2[0] + (c3[0] - c2[0]) * f)
            ng = int(c2[1] + (c3[1] - c2[1]) * f)
            nb = int(c2[2] + (c3[2] - c2[2]) * f)

        new_pixels.append((nr, ng, nb, a))

    grad_img = Image.new("RGBA", (w, h))
    grad_img.putdata(new_pixels)
    return grad_img


def create_pwa_icon(grad_img: Image.Image, size: int, pad_ratio: float = 0.22) -> Image.Image:
    """
    Cria ícone com fundo dark (#09090b) e logo centralizada, ideal para PWA maskable / home screen.
    pad_ratio garante que o logo fique dentro da safe area (80%) do Android/iOS.
    """
    bg = Image.new("RGBA", (size, size), (9, 9, 11, 255)) # #09090b
    
    # Adicionar sutil radial glow no centro para acabamento premium
    draw = ImageDraw.Draw(bg)
    center = size // 2
    glow_radius = int(size * 0.45)
    for r in range(glow_radius, 0, -2):
        alpha = int(14 * (1.0 - r / glow_radius))
        draw.ellipse(
            [center - r, center - r, center + r, center + r],
            fill=(33, 208, 178, alpha)
        )

    # Redimensionar logo transparente
    target_w = int(size * (1.0 - pad_ratio * 2))
    target_h = int(size * (1.0 - pad_ratio * 2))
    resized_logo = grad_img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    offset_x = (size - target_w) // 2
    offset_y = (size - target_h) // 2

    bg.alpha_composite(resized_logo, (offset_x, offset_y))
    return bg


def create_favicon_icon(grad_img: Image.Image, size: int) -> Image.Image:
    """
    Cria favicon nítido para abas de navegador.
    Utiliza fundo com cantos levemente arredondados para garantir alto contraste em abas claras ou escuras.
    """
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bg)
    radius = max(2, int(size * 0.22))
    # Retângulo arredondado escuro
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=(9, 9, 11, 255))

    pad = max(1, int(size * 0.12))
    target_size = size - pad * 2
    resized = grad_img.resize((target_size, target_size), Image.Resampling.LANCZOS)
    bg.alpha_composite(resized, (pad, pad))
    return bg


def main():
    src_file = "C:/Users/jvher/.gemini/antigravity/brain/5b31a3e0-c313-4389-a5a2-f8efe0b556f5/.user_uploaded/media_1793157923432_b90a0300.png"
    public_dir = "frontend/public"
    icons_dir = os.path.join(public_dir, "icons")
    os.makedirs(icons_dir, exist_ok=True)

    print("Processando logo com degradê #1DCDFE -> #21D0B2 -> #34F5C5...")
    grad_logo = create_gradient_icon(src_file)

    # 1. Salvar logo transparente máster
    logo_path = os.path.join(public_dir, "logo.png")
    grad_logo.save(logo_path, format="PNG")
    print(f"Salvo: {logo_path}")

    # 2. Gerar ícones PWA para celular (manifest)
    pwa_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    for sz in pwa_sizes:
        icon_img = create_pwa_icon(grad_logo, sz)
        out_path = os.path.join(icons_dir, f"icon-{sz}x{sz}.png")
        icon_img.save(out_path, format="PNG")
        print(f"Salvo PWA icon: {out_path}")

    # 3. Apple Touch Icon para iOS Safari (180x180)
    apple_icon = create_pwa_icon(grad_logo, 180, pad_ratio=0.20)
    apple_path = os.path.join(public_dir, "apple-touch-icon.png")
    apple_icon.save(apple_path, format="PNG")
    print(f"Salvo Apple Touch Icon: {apple_path}")

    # 4. Favicon PNG (32x32 e 16x16)
    fav_32 = create_favicon_icon(grad_logo, 32)
    fav_32.save(os.path.join(public_dir, "favicon-32x32.png"), format="PNG")
    fav_16 = create_favicon_icon(grad_logo, 16)
    fav_16.save(os.path.join(public_dir, "favicon-16x16.png"), format="PNG")

    # 5. Favicon ICO multi-camada (16, 32, 48)
    fav_48 = create_favicon_icon(grad_logo, 48)
    ico_path = os.path.join(public_dir, "favicon.ico")
    fav_48.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"Salvo Favicon ICO: {ico_path}")

    print("Todas as imagens de branding geradas com sucesso!")

if __name__ == "__main__":
    main()
