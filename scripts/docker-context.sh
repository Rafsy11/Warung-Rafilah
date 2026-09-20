#!/usr/bin/env bash
# Explicit override wins; the production host uses Docker Desktop for Linux.
if [[ -n "${POS_DOCKER_CONTEXT:-}" ]]; then
  export DOCKER_CONTEXT="$POS_DOCKER_CONTEXT"
elif docker context inspect desktop-linux >/dev/null 2>&1; then
  export DOCKER_CONTEXT=desktop-linux
fi
