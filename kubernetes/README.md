# Backstage + Headlamp Kubernetes Deployment

This directory contains the Kubernetes manifests for deploying Backstage with Headlamp integration.

## Architecture

- **Backstage**: Deployed in the `backstage` namespace
- **Headlamp**: Deployed in the `backstage` namespace (same as Backstage)
- **Authentication**: Shared Keycloak OIDC authentication
- **Integration**: Headlamp is embedded in Backstage via iframe plugin and proxy

## Prerequisites

1. Kubernetes cluster with NGINX ingress controller
2. Keycloak instance running at `https://cnoe.localtest.me:8443/keycloak`
3. Helm 3.x installed

## Deployment Steps

### 1. Create Namespace and Secrets

```bash
# Create namespace
kubectl apply -f backstage-namespace.yaml

# Update the secrets with actual values
kubectl edit -n backstage secret backstage-secrets
```

### 2. Deploy Backstage

```bash
# Apply ConfigMap with corrected proxy configuration
kubectl apply -f backstage-configmap.yaml

# Deploy Backstage
kubectl apply -f backstage-deployment.yaml
kubectl apply -f backstage-service.yaml
kubectl apply -f backstage-ingress.yaml
```

### 3. Deploy Headlamp

```bash
# Deploy Headlamp using the provided script
./deploy-headlamp.sh
```

### 4. Verify Deployment

```bash
# Check pods
kubectl get pods -n backstage

# Check services
kubectl get svc -n backstage

# Verify Headlamp service is accessible
kubectl exec -n backstage deploy/backstage -- curl -s http://headlamp.backstage.svc.cluster.local:4466/
```

## Configuration Details

### Proxy Configuration

The proxy is configured under `backend.proxy` in the ConfigMap:

```yaml
backend:
  proxy:
    '/headlamp':
      target: 'http://headlamp.backstage.svc.cluster.local:4466'
      changeOrigin: true
      secure: false
      pathRewrite:
        '^/api/proxy/headlamp': '/'
```

### Service Discovery

- Headlamp service: `headlamp.backstage.svc.cluster.local:4466`
- Backstage proxy endpoint: `/api/proxy/headlamp`

### Authentication Flow

1. User logs into Backstage via Keycloak
2. Backstage proxies requests to Headlamp
3. Headlamp uses the same Keycloak configuration for SSO

## Troubleshooting

### Proxy Not Working

1. Verify the ConfigMap is mounted correctly:
   ```bash
   kubectl describe pod -n backstage -l app=backstage
   ```

2. Check Backstage logs for proxy errors:
   ```bash
   kubectl logs -n backstage -l app=backstage
   ```

3. Verify Headlamp service is running:
   ```bash
   kubectl get svc -n backstage headlamp
   ```

### Iframe Not Loading

1. Check browser console for CSP errors
2. Verify iframe allowlist includes all necessary domains
3. Check Headlamp is accessible directly via port-forward:
   ```bash
   kubectl port-forward -n backstage svc/headlamp 4466:4466
   ```

## Notes

- The `pathRewrite` configuration is critical for proper routing
- The proxy must be under `backend.proxy`, not at the top level
- Both services are in the same namespace for simplified networking