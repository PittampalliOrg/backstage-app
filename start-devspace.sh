#!/bin/bash
set -e

echo "Starting Backstage in DevSpace environment..."

# Ensure we're in the correct directory
cd /app

# Kill any existing processes
echo "Cleaning up existing processes..."

# Kill processes on specific ports
if command -v lsof &> /dev/null; then
    lsof -ti:7007 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
else
    fuser -k 7007/tcp 2>/dev/null || true
    fuser -k 3000/tcp 2>/dev/null || true
fi

# Kill any node processes running backstage
ps aux | grep -E "node.*backstage|backstage-cli" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true

# Wait for ports to be released
sleep 2

# Start backend only (frontend can be started separately if needed)
echo "Starting Backstage backend on port 7007..."
yarn workspace backend start --config /app/app-config.yaml