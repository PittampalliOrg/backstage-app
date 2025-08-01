# Agent-Forge Plugin Setup Guide

## Prerequisites

The agent-forge plugin requires an A2A (Agent-to-Agent) compatible service running on port 8000. 

## Starting an Agent Service

You need to run one of the CNOE agents. Here are the available options:

### Option 1: Agent Template (Recommended for getting started)
```bash
git clone https://github.com/cnoe-io/agent-template
cd agent-template
# Follow the setup instructions in the repository
# The agent should run on http://localhost:8000
```

### Option 2: Agent ArgoCD
```bash
git clone https://github.com/cnoe-io/agent-argocd
cd agent-argocd
# Follow the setup instructions in the repository
```

### Option 3: Other Available Agents
- **agent-atlassian**: For JIRA integration
- **agent-github**: For GitHub management
- **agent-slack**: For Slack interaction

## Verifying Agent Service

Once the agent is running, verify it's accessible:

```bash
curl http://localhost:8000/.well-known/agent.json
```

You should receive a JSON response with agent information.

## Accessing the Chat Assistant

After starting the agent service and your Backstage app:

1. Navigate to http://localhost:3000
2. Access the Chat Assistant at http://localhost:3000/chat-assistant
3. The plugin will communicate with the agent through Backstage's proxy

## Troubleshooting

### CORS Issues
The plugin is configured to use Backstage's proxy to avoid CORS issues. The configuration in `app-config.yaml` should include:

```yaml
proxy:
  '/agent-forge':
    target: 'http://localhost:8000'
    changeOrigin: true
    headers:
      X-Custom-Source: 'backstage'

agentForge:
  baseUrl: http://localhost:7007/api/proxy/agent-forge
```

### Agent Not Responding
1. Check if the agent service is running on port 8000
2. Verify no other service is using port 8000
3. Check agent logs for any errors
4. Ensure the agent implements the A2A protocol correctly

For more information about CNOE agents, visit: https://github.com/cnoe-io/agentic-ai/wiki/Getting-Started