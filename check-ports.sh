#!/bin/bash

echo "Checking for processes using Backstage ports..."
echo ""

# Function to check a port
check_port() {
    local port=$1
    echo "Port $port:"
    
    if command -v lsof &> /dev/null; then
        lsof -i :$port 2>/dev/null | grep LISTEN || echo "  No process listening on port $port"
    else
        # Alternative using netstat
        netstat -tlnp 2>/dev/null | grep :$port || echo "  No process listening on port $port"
    fi
    echo ""
}

# Check common Backstage ports
check_port 3000
check_port 3001
check_port 7007
check_port 7008
check_port 9229
check_port 9230

# Show all node processes
echo "Node processes running:"
ps aux | grep -E "node|yarn" | grep -v grep || echo "No node/yarn processes found"