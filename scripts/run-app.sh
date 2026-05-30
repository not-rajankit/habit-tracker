#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.app-run"
BACKEND_PID="$RUN_DIR/backend.pid"
FRONTEND_PID="$RUN_DIR/frontend.pid"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"
DEFAULT_BACKEND_PORT="3001"
DEFAULT_FRONTEND_PORT="5173"

mkdir -p "$RUN_DIR"

command_name="${1:-start}"

load_env() {
  if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$ROOT_DIR/.env"
    set +a
  fi
}

docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "Docker Compose is required to start Postgres." >&2
    exit 1
  fi
}

is_running() {
  local pid_file="$1"
  [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1
}

wait_for_backend() {
  local url="${1:-http://localhost:${PORT:-3001}/api/health}"
  local attempts=40

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  echo "Backend did not become healthy at $url." >&2
  echo "Check logs: $BACKEND_LOG" >&2
  exit 1
}

stop_process() {
  local name="$1"
  local pid_file="$2"

  if is_running "$pid_file"; then
    local pid
    pid="$(cat "$pid_file")"
    echo "Stopping $name (pid $pid)..."
    stop_pid_tree "$pid" "$name"
  fi

  rm -f "$pid_file"
}

child_pids() {
  local pid="$1"
  pgrep -P "$pid" 2>/dev/null || true
}

stop_pid_tree() {
  local pid="$1"
  local name="$2"
  local children child

  children="$(child_pids "$pid")"
  for child in $children; do
    stop_pid_tree "$child" "$name"
  done

  kill "$pid" >/dev/null 2>&1 || true

  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done

  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "$name process $pid did not stop cleanly; forcing stop..."
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
}

stop_port_listeners() {
  local name="$1"
  local port="$2"
  local pids pid

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    return 0
  fi

  for pid in $pids; do
    echo "Stopping $name listener on port $port (pid $pid)..."
    stop_pid_tree "$pid" "$name"
  done
}

start_processes() {
  load_env

  if [ ! -d "$ROOT_DIR/backend/node_modules" ] || [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo "Installing dependencies..."
    npm run install:all
  fi

  echo "Starting Postgres..."
  (cd "$ROOT_DIR" && docker_compose up -d postgres)

  echo "Running database migrations..."
  npm run migrate

  if is_running "$BACKEND_PID"; then
    echo "Backend is already running (pid $(cat "$BACKEND_PID"))."
  else
    echo "Starting backend..."
    (cd "$ROOT_DIR/backend" && nohup node --watch src/index.js >"$BACKEND_LOG" 2>&1 & echo $! >"$BACKEND_PID")
  fi

  wait_for_backend

  if is_running "$FRONTEND_PID"; then
    echo "Frontend is already running (pid $(cat "$FRONTEND_PID"))."
  else
    echo "Starting frontend..."
    (cd "$ROOT_DIR/frontend" && nohup ./node_modules/.bin/vite --host 0.0.0.0 >"$FRONTEND_LOG" 2>&1 & echo $! >"$FRONTEND_PID")
  fi

  echo
  echo "Habit Tracker is running."
  echo "Frontend: http://localhost:5173"
  echo "Backend:  http://localhost:${PORT:-3001}/api/health"
  echo "Logs:     $RUN_DIR"
}

stop_processes() {
  load_env

  stop_process "frontend" "$FRONTEND_PID"
  stop_process "backend" "$BACKEND_PID"
  stop_port_listeners "frontend" "$DEFAULT_FRONTEND_PORT"
  stop_port_listeners "backend" "${PORT:-$DEFAULT_BACKEND_PORT}"

  echo "Application processes stopped."
  echo "Postgres is still running. Stop it with: docker compose down"
}

status() {
  if is_running "$BACKEND_PID"; then
    echo "Backend:  running (pid $(cat "$BACKEND_PID"))"
  else
    echo "Backend:  stopped"
  fi

  if is_running "$FRONTEND_PID"; then
    echo "Frontend: running (pid $(cat "$FRONTEND_PID"))"
  else
    echo "Frontend: stopped"
  fi

  (cd "$ROOT_DIR" && docker_compose ps postgres)
}

case "$command_name" in
  start)
    start_processes
    ;;
  stop)
    stop_processes
    ;;
  restart)
    stop_processes
    start_processes
    ;;
  status)
    status
    ;;
  logs)
    echo "Backend log:  $BACKEND_LOG"
    echo "Frontend log: $FRONTEND_LOG"
    tail -n 80 "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null || true
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}" >&2
    exit 1
    ;;
esac
