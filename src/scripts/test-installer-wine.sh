#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIX="$ROOT/artifacts/wine-installer-test"
SETUP="$ROOT/artifacts/installer/Perfecto-Next-0.2.0-preview.1-win-x64-setup.exe"
WORK=/tmp/perfecto-wine-installer-test
DISPLAY_NUMBER=:101

command -v wine >/dev/null
command -v Xvfb >/dev/null
command -v bwrap >/dev/null
test -s "$SETUP"

rm -rf "$PREFIX" "$WORK"
mkdir -p "$PREFIX" "$WORK/cache"
Xvfb "$DISPLAY_NUMBER" -screen 0 1280x800x24 -nolisten tcp >"$WORK/xvfb.log" 2>&1 &
XVFB_PID=$!
trap 'kill "$XVFB_PID" 2>/dev/null || true; WINEPREFIX="$PREFIX" wineserver -k 2>/dev/null || true' EXIT
sleep 2

export DISPLAY="$DISPLAY_NUMBER"
export WINEPREFIX="$PREFIX"
export WINEARCH=win64
export WINEDEBUG=-all
export XDG_CACHE_HOME=/tmp/cache

sandboxed_wine() {
  bwrap --unshare-net \
    --ro-bind / / \
    --bind "$PREFIX" "$PREFIX" \
    --tmpfs /tmp \
    --bind /tmp/.X11-unix /tmp/.X11-unix \
    --dev-bind /dev /dev \
    --proc /proc \
    wine "$@"
}

sandboxed_wine wineboot -u
sandboxed_wine "$SETUP" /S /D=C:\\PerfectoNextTest
wineserver -w

INSTALL_DIR="$PREFIX/drive_c/PerfectoNextTest"
test -s "$INSTALL_DIR/Perfecto.Windows.exe"
test -s "$INSTALL_DIR/Uninstall.exe"
file "$INSTALL_DIR/Perfecto.Windows.exe"

sandboxed_wine "$INSTALL_DIR/Uninstall.exe" /S
wineserver -w
sleep 3

test ! -d "$INSTALL_DIR"
printf 'Installation et désinstallation silencieuses réussies.\n'
