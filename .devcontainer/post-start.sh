#!/usr/bin/env bash
set -e

# Start the static file server in the background if it isn't already running,
# so the forwarded port (8080) has something listening on it.
if ! curl -s -o /dev/null http://localhost:8080; then
  nohup http-server -p 8080 -c-1 /workspaces/wifi-qrcode-generator > /tmp/http-server.log 2>&1 &
fi
