#!/usr/bin/env bash
# convert-avatars.sh
# Converts all JPEG files in avatars/image-sources to 256×256 grayscale GIFs
# (16-colour palette, thumbnail fit, minimum file size) in avatars/images-output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_DIR/materials/avatars/image-sources"
OUT_DIR="$PROJECT_DIR/materials/avatars/image-output"

mkdir -p "$OUT_DIR"

shopt -s nullglob
files=("$SRC_DIR"/*.jpg "$SRC_DIR"/*.jpeg "$SRC_DIR"/*.JPG "$SRC_DIR"/*.JPEG)

if [[ ${#files[@]} -eq 0 ]]; then
    echo "No JPEG files found in $SRC_DIR"
    exit 0
fi

index=0
for src in "${files[@]}"; do
    filename="$(basename "$src")"
    dst="$OUT_DIR/$(printf 'avatar-%03d.png' $index)"

    echo "  $filename  →  $(basename "$dst")"

    convert "$src" \
        -gravity center \
        -crop "$(convert "$src" -format "%[fx:min(w,h)]x%[fx:min(w,h)]" info:)+0+0" \
        +repage \
        -resize 96x96 \
        -colorspace Gray \
        -colors 16 \
        -dither FloydSteinberg \
        PNG8:"$dst"
    index=$((index + 1))
done

mv "$OUT_DIR"/*.png "$PROJECT_DIR"/public/assets/images/avatars/

echo "Done."
