#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -s "$ROOT/ssl/local-key.pem" || ! -s "$ROOT/ssl/local-cert.pem" ]]; then
  command -v openssl >/dev/null
  umask 077
  openssl req -x509 -nodes -newkey rsa:3072 -days 365 \
    -keyout "$ROOT/ssl/local-key.pem" -out "$ROOT/ssl/local-cert.pem" \
    -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
  chmod 600 "$ROOT/ssl/local-key.pem"
fi
