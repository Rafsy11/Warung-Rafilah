#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DESKTOP_DIR="${XDG_DESKTOP_DIR:-$HOME/Desktop}"

if [ ! -d "$DESKTOP_DIR" ]; then
  DESKTOP_DIR="$HOME/Desktop"
  mkdir -p "$DESKTOP_DIR"
fi

chmod +x "$SCRIPT_DIR/start-pos-gui.sh" "$SCRIPT_DIR/stop-pos-gui.sh"

cat >"$DESKTOP_DIR/Start POS.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Start POS
Comment=Start the local POS application
Exec="$SCRIPT_DIR/start-pos-gui.sh"
Icon=utilities-terminal
Terminal=false
Categories=Utility;
StartupNotify=true
EOF

cat >"$DESKTOP_DIR/Stop POS.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Stop POS
Comment=Stop the local POS application
Exec="$SCRIPT_DIR/stop-pos-gui.sh"
Icon=process-stop
Terminal=false
Categories=Utility;
StartupNotify=true
EOF

chmod +x "$DESKTOP_DIR/Start POS.desktop" "$DESKTOP_DIR/Stop POS.desktop"

if command -v gio >/dev/null 2>&1; then
  gio set "$DESKTOP_DIR/Start POS.desktop" metadata::trusted true 2>/dev/null || true
  gio set "$DESKTOP_DIR/Stop POS.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "Created launchers:"
echo "$DESKTOP_DIR/Start POS.desktop"
echo "$DESKTOP_DIR/Stop POS.desktop"
echo
echo "On Linux Mint, right-click each launcher and select 'Allow Launching' if prompted."
