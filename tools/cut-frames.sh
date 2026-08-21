#!/usr/bin/env bash
# Cut a source video into a scroll-scrub frame sequence.
#
#   ./tools/cut-frames.sh <video> [outdir] [count] [format] [maxwidth]
#
#   video     source file
#   outdir    default: assets/frames-hd
#   count     how many frames to end up with. default 240 (matches the
#             existing sequence). "native" keeps every frame in the video.
#   format    webp (default) | jpg | png
#   maxwidth  cap the long edge, default 1920. "native" = don't resize.
#
# Frames are spread evenly across the WHOLE duration, so the scrub always
# covers the full camera move regardless of how many frames you ask for.

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

VIDEO=${1:?usage: cut-frames.sh <video> [outdir] [count] [format] [maxwidth]}
OUTDIR=${2:-assets/frames-hd}
COUNT=${3:-240}
FORMAT=${4:-webp}
MAXW=${5:-1920}

[[ -f "$VIDEO" ]] || { echo "no such file: $VIDEO" >&2; exit 1; }

# ---- probe ----------------------------------------------------------------
read -r SRC_W SRC_H SRC_FPS SRC_DUR < <(
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate \
    -show_entries format=duration \
    -of default=nw=1:nk=1 "$VIDEO" | paste -sd' ' -
)
FPS=$(awk -F/ '{printf "%.4f", ($2 ? $1/$2 : $1)}' <<<"$SRC_FPS")
SRC_FRAMES=$(awk -v f="$FPS" -v d="$SRC_DUR" 'BEGIN{printf "%d", f*d}')

printf 'source : %sx%s · %.3f fps · %.2fs · ~%s frames\n' \
  "$SRC_W" "$SRC_H" "$FPS" "$SRC_DUR" "$SRC_FRAMES"

# ---- build the filter chain ----------------------------------------------
FILTERS=()

if [[ "$COUNT" == "native" ]]; then
  TARGET=$SRC_FRAMES
  printf 'sampling: native, %s frames\n' "$TARGET"
else
  TARGET=$COUNT
  OUT_FPS=$(awk -v n="$TARGET" -v d="$SRC_DUR" 'BEGIN{printf "%.6f", n/d}')

  if (( TARGET > SRC_FRAMES )); then
    # Asking for MORE frames than the clip has: synthesise the in-betweens with
    # motion-compensated interpolation rather than duplicating frames, so a
    # scroll scrub reads as continuous motion instead of stepping. Done at
    # source resolution — interpolating after the upscale is far slower for an
    # identical result.
    FILTERS+=("minterpolate=fps=${OUT_FPS}:mi_mode=mci:mc_mode=aobmc:vsbmc=1")
    printf 'sampling: %s -> %s frames (%.3f fps, motion-interpolated)\n' \
      "$SRC_FRAMES" "$TARGET" "$OUT_FPS"
  else
    # Even sampling across the whole clip.
    FILTERS+=("fps=${OUT_FPS}")
    printf 'sampling: %s -> %s frames (%.3f fps, decimated)\n' \
      "$SRC_FRAMES" "$TARGET" "$OUT_FPS"
  fi
fi

if [[ "$MAXW" != "native" ]] && (( SRC_W != MAXW )); then
  FILTERS+=("scale=${MAXW}:-2:flags=lanczos")
  # An upscale cannot invent detail, but a mild unsharp restores the local edge
  # contrast lanczos softens, and that survives the browser's own scaling of the
  # full-bleed canvas. Amount stays low (0.9) to avoid halos on the skyline.
  if (( MAXW > SRC_W )); then
    FILTERS+=("unsharp=5:5:0.9:5:5:0.0")
    printf 'scaling : %sx%s -> %s wide (lanczos UP + unsharp)\n' "$SRC_W" "$SRC_H" "$MAXW"
  else
    printf 'scaling : %sx%s -> %s wide (lanczos down)\n' "$SRC_W" "$SRC_H" "$MAXW"
  fi
else
  printf 'scaling : none, keeping %sx%s\n' "$SRC_W" "$SRC_H"
fi

VF=$(IFS=,; echo "${FILTERS[*]:-null}")

# ---- encode --------------------------------------------------------------
rm -rf "$OUTDIR"; mkdir -p "$OUTDIR"

# This ffmpeg build has no libwebp/libavif encoder, so webp and avif go out
# through the standalone cwebp/avifenc tools instead: ffmpeg lays down lossless
# PNG at native resolution, then we compress and drop the intermediates.
case "$FORMAT" in
  webp) command -v cwebp   >/dev/null || { echo "cwebp not found: brew install webp" >&2; exit 1; }; STAGE=png ;;
  avif) command -v avifenc >/dev/null || { echo "avifenc not found: brew install libavif" >&2; exit 1; }; STAGE=png ;;
  jpg)  STAGE=jpg ;;
  png)  STAGE=png ;;
  *)    echo "format must be webp|avif|jpg|png" >&2; exit 1 ;;
esac

case "$STAGE" in
  jpg) ENC=(-c:v mjpeg -q:v 3 -pix_fmt yuvj420p) ;;
  png) ENC=(-c:v png) ;;
esac

echo "encoding: $STAGE via ffmpeg -> $OUTDIR/"
ffmpeg -nostdin -v error -stats -i "$VIDEO" \
  -vf "$VF" -fps_mode passthrough -an "${ENC[@]}" \
  "$OUTDIR/%05d.$STAGE"

if [[ "$FORMAT" != "$STAGE" ]]; then
  echo "compress: $STAGE -> $FORMAT"
  n=0; failed=0
  for f in "$OUTDIR"/*."$STAGE"; do
    # Only drop the lossless intermediate once the compressor has actually
    # produced a non-empty file. Removing it unconditionally loses the frame
    # outright when the compressor fails, leaving a hole in the sequence.
    out="${f%.$STAGE}.$FORMAT"
    case "$FORMAT" in
      webp) cwebp   -quiet -q 82 -m 6 "$f" -o "$out" || true ;;
      avif) avifenc --speed 6 --qcolor 72 "$f" -o "$out" >/dev/null || true ;;
    esac
    if [[ -s "$out" ]]; then
      rm -f "$f"
    else
      echo "  WARN: $FORMAT encode failed for $(basename "$f"), keeping intermediate" >&2
      failed=$((failed+1))
    fi
    n=$((n+1))
    (( n % 20 == 0 )) && printf '  ..%s\n' "$n"
  done
  printf '  ..%s done\n' "$n"
fi

# ---- report --------------------------------------------------------------
GOT=$(ls "$OUTDIR"/*."$FORMAT" 2>/dev/null | wc -l | tr -d ' ')
FIRST=$(basename "$(ls "$OUTDIR"/*."$FORMAT" | head -1)")
LAST=$(basename "$(ls "$OUTDIR"/*."$FORMAT" | tail -1)")
DIMS=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
        -of csv=p=0:s=x "$OUTDIR/$FIRST")

printf '\nresult  : %s frames · %s · %s\n' "$GOT" "$DIMS" "$(du -sh "$OUTDIR" | cut -f1)"
printf 'range   : %s .. %s\n' "$FIRST" "$LAST"

if [[ "$COUNT" != "native" ]] && (( GOT != TARGET )); then
  printf 'NOTE    : asked for %s, got %s (rounding at the clip tail)\n' "$TARGET" "$GOT"
fi

# The frame count the app must be told about. Emitted explicitly because the
# tail of a clip rarely divides evenly into the requested count.
printf 'app     : set FRAME_LAST = %s in app.js (FRAME_EXT = .%s)\n' "$GOT" "$FORMAT"
(( ${failed:-0} > 0 )) && printf 'WARN    : %s frame(s) failed to compress\n' "$failed"
exit 0
