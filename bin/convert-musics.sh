#!/usr/bin/env bash
set -euo pipefail

WAV_DIR="$(dirname "$0")/../public/assets/musics/wav"
OGG_DIR="$(dirname "$0")/../public/assets/musics/ogg"
MP3_DIR="$(dirname "$0")/../public/assets/musics/mp3"

mkdir -p "$OGG_DIR" "$MP3_DIR"
rm -f "$OGG_DIR"/*.ogg "$MP3_DIR"/*.mp3

shopt -s nullglob
wav_files=("$WAV_DIR"/*.wav)

if [[ ${#wav_files[@]} -eq 0 ]]; then
  echo "No .wav files found in $WAV_DIR"
  exit 0
fi

for src in "${wav_files[@]}"; do
  name="$(basename "$src" .wav)"

  echo "Converting: $name"

  ffmpeg -y -i "$src" -c:a libvorbis -q:a 6 "$OGG_DIR/$name.ogg" -loglevel warning
  ffmpeg -y -i "$src" -c:a libmp3lame -q:a 2 -id3v2_version 3 "$MP3_DIR/$name.mp3" -loglevel warning

  echo "  → $name.ogg"
  echo "  → $name.mp3"
done

echo "Done. Converted ${#wav_files[@]} file(s)."
