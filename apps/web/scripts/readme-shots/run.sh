#!/bin/sh
# Regenerates docs/screenshots/*.png from the mock workspace. Needs the web dev server running
# (pnpm --filter @corvo/web dev); no API or database is used. Run from apps/web.
set -e
OUT_DIR="${OUT_DIR:-../../docs/screenshots}"
mkdir -p "$OUT_DIR"
shoot() { name="$1"; shift; env "$@" OUT="$OUT_DIR/$name.png" node scripts/readme-shots/shoot.mjs >/dev/null; }
shoot hero SCENE=/app/g/support
shoot channels SCENE=/app/g/releases
shoot approvals SCENE=/app/g/support CLIP=425,295,830,250
shoot store SCENE="click:Store|Agents"
shoot computer SCENE=/app CLICK_TEXT=Fabio MONITOR=1
shoot routines SCENE=/app/routines
shoot usage SCENE=/app/usage
