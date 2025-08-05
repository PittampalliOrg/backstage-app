#!/bin/bash
set +e  # Continue on errors

# Install system dependencies if not already installed
if ! command -v python3 &> /dev/null || ! command -v make &> /dev/null || ! command -v g++ &> /dev/null; then
    echo "Installing system dependencies..."
    apk add --no-cache python3 make g++ build-base
fi

# Install Claude Code globally if not already installed
if ! npm list -g @anthropic-ai/claude-code &> /dev/null; then
    echo "Installing Claude Code globally..."
    npm install -g @anthropic-ai/claude-code
fi

# Install Playwright Chrome for MCP server
echo "Installing Playwright Chrome..."
npx playwright install chrome

export NODE_ENV=development
# Disable browser opening to prevent PowerShell errors in container
export BROWSER=none

# Tell Backstage to load multiple config files
export APP_CONFIG="app-config.yaml"
# Add node_modules/.bin to PATH for npm binaries like vite and concurrently
export PATH="./node_modules/.bin:$PATH"
if [ -f "yarn.lock" ]; then
   echo "Installing Yarn Dependencies"
   yarn install --frozen-lockfile
   
   # Ensure concurrently is available
   if ! command -v concurrently &> /dev/null && ! npx concurrently --version &> /dev/null; then
      echo "Installing concurrently globally as fallback..."
      npm install -g concurrently
   fi
else 
   if [ -f "package.json" ]; then
      echo "Installing NPM Dependencies"
      # cd workspace
      npm install
      if [ $? -ne 0 ]; then
         echo "npm install failed. Trying with --force flag..."
         npm install --force
      fi
      
      # Ensure concurrently is installed
      if ! npm list concurrently &> /dev/null; then
         echo "Installing concurrently..."
         npm install concurrently
      fi
   fi
fi

# npm run dev

COLOR_BLUE="\033[0;94m"
COLOR_GREEN="\033[0;92m"
COLOR_RESET="\033[0m"

# Print useful output for user
echo -e "${COLOR_BLUE}
     %########%      
     %###########%       ____                 _____                      
         %#########%    |  _ \   ___ __   __ / ___/  ____    ____   ____ ___ 
         %#########%    | | | | / _ \\\\\ \ / / \___ \ |  _ \  / _  | / __// _ \\
     %#############%    | |_| |(  __/ \ V /  ____) )| |_) )( (_| |( (__(  __/
     %#############%    |____/  \___|  \_/   \____/ |  __/  \__,_| \___\\\\\___|
 %###############%                                  |_|
 %###########%${COLOR_RESET}


Welcome to your development container!

This is how you can work with it:
- Files will be synchronized between your local machine and this container
- Some ports will be forwarded, so you can access this container via localhost
- Run \`${COLOR_GREEN}./start-backend-only.sh${COLOR_RESET}\` to start just the backend (recommended)
- Run \`${COLOR_GREEN}./start-devspace.sh${COLOR_RESET}\` to start the Backstage backend (port 7007)
- Run \`${COLOR_GREEN}./start-frontend.sh${COLOR_RESET}\` to start the Backstage frontend (port 3000)
- Run \`${COLOR_GREEN}./start-combined.sh${COLOR_RESET}\` to start both frontend and backend in parallel
- Or run \`${COLOR_GREEN}npx nx serve backstage-app${COLOR_RESET}\` to start the full application
"

# Set terminal prompt
export PS1="\[${COLOR_BLUE}\]devspace\[${COLOR_RESET}\] ./\W \[${COLOR_BLUE}\]\\$\[${COLOR_RESET}\] "
if [ -z "$BASH" ]; then export PS1="$ "; fi

# Include project's bin/ folder and node_modules/.bin in PATH
export PATH="./bin:./node_modules/.bin:$PATH"

# Create a local bin directory for proxy commands if it doesn't exist
mkdir -p ~/.local/bin
export PATH="$HOME/.local/bin:$PATH"

# Ensure we're in the app directory
# cd /app

# Open shell
bash --norc