#!/bin/bash
set -e

echo "Starting Backstage backend only..."

# Ensure we're in the correct directory
cd /app

# Kill any existing process using port 7007
echo "Checking for processes on port 7007..."
if command -v lsof &> /dev/null; then
    # If lsof is available, use it
    lsof -ti:7007 | xargs kill -9 2>/dev/null || true
else
    # Try fuser as an alternative
    fuser -k 7007/tcp 2>/dev/null || true
fi

# Also try to kill any node processes running backstage
ps aux | grep -E "node.*backstage|backstage-cli" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true

# Wait a moment for ports to be released
sleep 2

# Start backend with the mounted config
echo "Starting backend on port 7007..."
yarn workspace backend start --config /app/app-config.yaml