#!/bin/bash
set -e

echo "Starting Backstage frontend..."

# Ensure we're in the correct directory
cd /app

# Kill any existing frontend process
echo "Checking for processes on port 3000..."
if command -v lsof &> /dev/null; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
else
    fuser -k 3000/tcp 2>/dev/null || true
fi

# Also kill any node processes running the app
ps aux | grep -E "node.*packages/app|webpack" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true

# Wait for port to be released
sleep 2

# Start frontend
echo "Starting frontend on port 3000..."
yarn workspace app start