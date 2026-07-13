#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/pos-start.log"

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

run_logged() {
  "$@" >>"$LOG_FILE" 2>&1
}

get_env_value() {
  local key="$1"
  local line

  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$APP_DIR/.env" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

wait_for_docker() {
  local attempts="${1:-20}"
  local delay="${2:-3}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    show_error "Docker not found" "Docker is not installed or is not in PATH."
    return 1
  fi

  if docker info >/dev/null 2>&1; then
    return 0
  fi

  if systemctl --user list-unit-files 2>/dev/null | grep -q '^docker-desktop'; then
    run_logged systemctl --user start docker-desktop || true
    if wait_for_docker 20 3; then
      return 0
    fi
  fi

  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^docker.service'; then
    if command -v pkexec >/dev/null 2>&1; then
      run_logged pkexec systemctl start docker || true
      if wait_for_docker 20 3; then
        return 0
      fi
    fi
  fi

  show_error "Docker is not running" "Docker could not be started from the launcher.

Production fix:
- Use Docker Desktop and enable its user service, or
- Install Docker Engine, add the user to the docker group, then log out and log back in."
  return 1
}

if [ ! -f "$APP_DIR/.env" ]; then
  show_error "Missing .env" "The file .env was not found in:
$APP_DIR"
  exit 1
fi

if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
  show_error "Missing docker-compose.yml" "docker-compose.yml was not found in:
$APP_DIR"
  exit 1
fi

if ! command -v zenity >/dev/null 2>&1; then
  show_error "Zenity not found" "Install zenity first:
sudo apt install zenity"
  exit 1
fi

{
  echo "===== POS start: $(date -Is) ====="
  echo "Working directory: $APP_DIR"
} >>"$LOG_FILE"

if ! ensure_docker; then
  exit 1
fi

COMPOSE_FILES=(-f docker-compose.yml)
CASH_DRAWER_PATH="$(get_env_value CASH_DRAWER_DEVICE)"
CASH_DRAWER_PATH="${CASH_DRAWER_PATH:-/dev/usb/lp0}"
if [ -f "$APP_DIR/docker-compose.linux.yml" ] && [ -e "$CASH_DRAWER_PATH" ]; then
  COMPOSE_FILES+=(-f docker-compose.linux.yml)
fi

(
  echo "10"
  echo "# Checking Docker..."
  sleep 1

  echo "40"
  echo "# Building POS services (using local images)..."
  docker compose "${COMPOSE_FILES[@]}" up -d --build --pull never >>"$LOG_FILE" 2>&1

  echo "90"
  echo "# Waiting for services to become healthy..."
  sleep 5

  echo "100"
  echo "# Done."
) | zenity --progress \
  --title="Starting POS" \
  --text="Starting POS..." \
  --width=520 \
  --percentage=0 \
  --auto-close

STATUS=$?
if [ "$STATUS" -ne 0 ]; then
  show_error "Start cancelled" "The start operation was cancelled."
  exit 1
fi

if docker compose "${COMPOSE_FILES[@]}" ps --status running | grep -q 'pos_nextjs\|pos_app'; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
  fi

  show_info "POS started" "POS is running.

Browser URL:
http://localhost:3000

Log:
$LOG_FILE"
else
  show_error "POS failed to start" "POS did not reach a running state.

Check log:
$LOG_FILE"
  exit 1
fi
