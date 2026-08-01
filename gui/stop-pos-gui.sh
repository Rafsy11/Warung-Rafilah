#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/pos-stop.log"

mkdir -p "$LOG_DIR"
cd "$APP_DIR" || exit 1

show_error() {
  local title="$1"
  local message="$2"
  if command -v zenity >/dev/null 2>&1; then
    zenity --error --title="$title" --width=520 --text="$message"
  else
    notify-send "$title" "$message" 2>/dev/null || true
  fi
}

show_info() {
  local title="$1"
  local message="$2"
  if command -v zenity >/dev/null 2>&1; then
    zenity --info --title="$title" --width=520 --text="$message"
  else
    notify-send "$title" "$message" 2>/dev/null || true
  fi
}

get_env_value() {
  local key="$1"
  local line

  if [ ! -f "$APP_DIR/.env" ]; then
    printf ''
    return 0
  fi

  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$APP_DIR/.env" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

if ! command -v zenity >/dev/null 2>&1; then
  show_error "Zenity not found" "Install zenity first:
sudo apt install zenity"
  exit 1
fi

if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
  show_error "Missing docker-compose.yml" "docker-compose.yml was not found in:
$APP_DIR"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  show_error "Docker not found" "Docker is not installed or is not in PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  show_info "POS already stopped" "Docker is not running. POS containers are not active."
  exit 0
fi

COMPOSE_FILES=(-f docker-compose.yml)
if [ -f "$APP_DIR/docker-compose.linux.yml" ]; then
  COMPOSE_FILES+=(-f docker-compose.linux.yml)
fi

{
  echo "===== POS stop: $(date -Is) ====="
  echo "Working directory: $APP_DIR"
} >>"$LOG_FILE"

(
  echo "25"
  echo "# Gracefully stopping POS services..."
  docker compose "${COMPOSE_FILES[@]}" down --remove-orphans --timeout 10 >>"$LOG_FILE" 2>&1

  echo "100"
  echo "# Done."
) | zenity --progress \
  --title="Stopping POS" \
  --text="Stopping POS..." \
  --width=520 \
  --percentage=0 \
  --auto-close

STATUS=$?
if [ "$STATUS" -ne 0 ]; then
  show_error "Stop cancelled" "The stop operation was cancelled."
  exit 1
fi

show_info "POS stopped" "POS services have been stopped.

Log:
$LOG_FILE"
