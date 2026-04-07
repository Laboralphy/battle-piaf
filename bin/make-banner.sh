#!/usr/bin/env bash
# Generates public/assets/images/banner.png
# Retro Amiga/VGA style – transparent background, gradient-filled characters
#
# Dependencies:
#   - imagemagick   (apt install imagemagick / brew install imagemagick)
#   - python3       (standard library only, no pip packages needed)
#   - a bold TTF font (DejaVu, Liberation, or any monospace bold)
set -euo pipefail

# ── Dependency check ──────────────────────────────────────────────────────────
if ! command -v convert &>/dev/null; then
  echo "Error: imagemagick not found. Install it with:"
  echo "  apt install imagemagick   # Debian/Ubuntu"
  echo "  brew install imagemagick  # macOS"
  exit 1
fi
if ! command -v python3 &>/dev/null; then
  echo "Error: python3 not found."
  exit 1
fi

# ── Font resolution (first match wins) ───────────────────────────────────────
FONT=""
for candidate in \
  /usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf \
  /usr/share/fonts/dejavu/DejaVuSansMono-Bold.ttf \
  /usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf \
  /usr/share/fonts/liberation/LiberationMono-Bold.ttf \
  /usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf \
  "/Library/Fonts/Courier New Bold.ttf" \
  "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
do
  if [[ -f "$candidate" ]]; then
    FONT="$candidate"
    break
  fi
done
if [[ -z "$FONT" ]]; then
  FONT=$(convert -list font | awk '/Font:.*[Mm]ono.*[Bb]old/{print $2; exit}')
fi
if [[ -z "$FONT" ]]; then
  echo "Error: no suitable bold font found. Install fonts-dejavu or fonts-liberation."
  exit 1
fi
echo "Using font: $FONT"

OUT="$(dirname "$0")/../public/assets/images/banner.png"
TEXT="BATTLE PIAF"
W=640
H=120
SCALE=4
BW=$((W * SCALE))
BH=$((H * SCALE))
FS=$((75 * SCALE))

# ── Step 1: build the character gradient (top→bottom, full banner height) ────
# Stops:  0% deep sky blue | 25% cyan | 50% pale cyan | 51% dark brown | 100% yellow
python3 - <<'PYEOF'
import struct, zlib

W, H = 640, 120

stops = [
    (0.00,  0,  135, 255),   # deep sky blue
    (0.25,  0,  255, 255),   # cyan
    (0.50, 190, 245, 255),   # pale cyan
    (0.51,  70,  25,   5),   # dark brown  ← sharp split
    (1.00, 255, 210,   0),   # yellow
]

def color_at(t):
    for i in range(len(stops) - 1):
        t0, r0, g0, b0 = stops[i]
        t1, r1, g1, b1 = stops[i + 1]
        if t0 <= t <= t1:
            f = (t - t0) / (t1 - t0) if t1 != t0 else 1.0
            return (int(r0 + (r1-r0)*f), int(g0 + (g1-g0)*f), int(b0 + (b1-b0)*f))
    r, g, b = stops[-1][1], stops[-1][2], stops[-1][3]
    return r, g, b

pixels = bytearray(W * H * 3)
for y in range(H):
    r, g, b = color_at(y / (H - 1))
    off = y * W * 3
    for x in range(W):
        pixels[off + x*3:off + x*3+3] = bytes([r, g, b])

def make_png(w, h, data):
    def chunk(tag, body):
        crc = zlib.crc32(tag + body) & 0xffffffff
        return struct.pack('>I', len(body)) + tag + body + struct.pack('>I', crc)
    rows = b''.join(b'\x00' + bytes(data[y*w*3:(y+1)*w*3]) for y in range(h))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows, 9))
            + chunk(b'IEND', b''))

with open('/tmp/bp_gradient.png', 'wb') as f:
    f.write(make_png(W, H, pixels))
PYEOF

# ── Step 2: render text mask at 4× (white on black) then pixelate ────────────
convert -size ${BW}x${BH} xc:black \
  -font "$FONT" -pointsize $FS -gravity Center \
  -fill white -annotate 0 "$TEXT" \
  /tmp/bp_mask_big.png

convert /tmp/bp_mask_big.png -filter Box -resize ${W}x${H}! /tmp/bp_mask.png

# ── Step 3: clip gradient through the text mask → gradient-filled text ────────
# CopyOpacity uses the mask's luminance as the alpha channel of the gradient
convert /tmp/bp_gradient.png \
  /tmp/bp_mask.png \
  -compose CopyOpacity -composite \
  /tmp/bp_fill.png

# ── Step 4: dark outline (pixelated, same scale trick) ────────────────────────
convert -size ${BW}x${BH} xc:black \
  -font "$FONT" -pointsize $FS -gravity Center \
  -fill white -stroke white -strokewidth 20 -annotate 0 "$TEXT" \
  /tmp/bp_outline_big.png

convert /tmp/bp_outline_big.png -filter Box -resize ${W}x${H}! /tmp/bp_outline_mask.png

# Build a solid dark-navy image and clip it through the dilated mask
convert -size ${W}x${H} "xc:rgb(8,4,20)" \
  /tmp/bp_outline_mask.png \
  -compose CopyOpacity -composite \
  /tmp/bp_outline.png

# ── Step 5: composite — outline behind, gradient fill on top ─────────────────
convert /tmp/bp_outline.png /tmp/bp_fill.png -compose Over -composite -strip "$OUT"

echo "Banner saved → $OUT"
rm -f /tmp/bp_gradient.png /tmp/bp_mask_big.png /tmp/bp_mask.png \
      /tmp/bp_fill.png /tmp/bp_outline_big.png /tmp/bp_outline_mask.png /tmp/bp_outline.png
