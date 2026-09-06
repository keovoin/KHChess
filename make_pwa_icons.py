"""Generate PWA icons from public/horse.png (chrome knight on white bg).

1. Flood-fill from corners: white background -> transparent
2. Composite on app dark bg (#242424)
3. Output: 192, 512, maskable 512 (subject in 80% safe zone), apple 180
"""
from PIL import Image
import sys

src = Image.open("app/public/horse.png").convert("RGBA")
w, h = src.size
px = src.load()

# Flood fill from all edge pixels that are near-white
WHITE_THRESH = 225
visited = [[False] * w for _ in range(h)]
queue = []

def is_white(x, y):
    r, g, b, a = px[x, y]
    return min(r, g, b) >= WHITE_THRESH and a > 0

for x in range(w):
    for y in (0, h - 1):
        if not visited[y][x] and is_white(x, y):
            visited[y][x] = True
            queue.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if not visited[y][x] and is_white(x, y):
            visited[y][x] = True
            queue.append((x, y))

# BFS flood fill (4-connected)
while queue:
    x, y = queue.pop()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and is_white(nx, ny):
            visited[ny][nx] = True
            queue.append((nx, ny))

# Apply: background pixels -> transparent
out = src.copy()
opx = out.load()
for y in range(h):
    for x in range(w):
        if visited[y][x]:
            opx[x, y] = (255, 255, 255, 0)

# Crop to content bbox
bbox = out.getbbox()
print("content bbox:", bbox)
kn = out.crop(bbox)
print("knight size:", kn.size)

BG = (36, 36, 36, 255)  # #242424 matches app dark --background

def make_icon(size, subject_ratio):
    canvas = Image.new("RGBA", (size, size), BG)
    k = kn.copy()
    k.thumbnail((int(size * subject_ratio), int(size * subject_ratio)), Image.LANCZOS)
    ox = (size - k.width) // 2
    oy = (size - k.height) // 2
    canvas.alpha_composite(k, (ox, oy))
    return canvas

targets = [
    ("app/public/pwa-192x192.png", 192, 0.86),
    ("app/public/pwa-512x512.png", 512, 0.86),
    ("app/public/pwa-512x512-maskable.png", 512, 0.72),  # maskable safe zone
    ("app/public/apple-touch-icon.png", 180, 0.86),
]
for path, size, ratio in targets:
    img = make_icon(size, ratio)
    img.save(path)
    print("wrote", path, img.size)
print("done")
