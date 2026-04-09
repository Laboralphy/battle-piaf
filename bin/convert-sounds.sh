#!/usr/bin/env bash
set -euo pipefail

FLAC_DIR="$(dirname "$0")/../public/assets/sounds/flac"
OGG_DIR="$(dirname "$0")/../public/assets/sounds/ogg"
MP3_DIR="$(dirname "$0")/../public/assets/sounds/mp3"

mkdir -p "$OGG_DIR" "$MP3_DIR"
rm -f "$OGG_DIR"/*.ogg "$MP3_DIR"/*.mp3

shopt -s nullglob
flac_files=("$FLAC_DIR"/*.flac)

if [[ ${#flac_files[@]} -eq 0 ]]; then
  echo "No .flac files found in $FLAC_DIR"
  exit 0
fi

for src in "${flac_files[@]}"; do
  name="$(basename "$src" .flac)"

  echo "Converting: $name"

  ffmpeg -y -i "$src" -c:a libvorbis -q:a 6             "$OGG_DIR/$name.ogg" -loglevel warning
  ffmpeg -y -i "$src" -c:a libmp3lame -q:a 2 -id3v2_version 3 "$MP3_DIR/$name.mp3" -loglevel warning

  echo "  → $name.ogg"
  echo "  → $name.mp3"
done

echo "Done. Converted ${#flac_files[@]} file(s)."
