# Smart Meds Complete Deployment Guide

## Overview

This guide covers the complete deployment of Smart Meds on Kubernetes with:
- Monitoring (Prometheus + Grafana)
- Logging (LOKI)
- GitOps (ArgoCD)
- Application deployment (Helm)

---

## Prerequisites

✅ Kubernetes cluster running (from Ansible playbooks)  
✅ kubectl configured  
✅ Helm installed  
✅ Access to Master node  

---

## Step 1: Deploy Monitoring Stack (Prometheus + Grafana + LOKI)

### On the Master node:

```bash
# SSH to master
ssh -i ~/.ssh/depi_key root@MASTER_IP

# Run monitoring playbook
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/monitoring-stack.yml -v
```

### Wait 5-10 minutes for all pods to be ready

```bash
# Check monitoring stack
kubectl get pods -n monitoring

# Expected output:
# NAME                           READY   STATUS    RESTARTS   AGE
# prometheus-0                   2/2     Running   0          5m
# grafana-xxxxx                  1/1     Running   0          5m
# loki-0                         1/1     Running   0          5m
# promtail-xxxxx                 1/1     Running   0          5m
```

### Access Prometheus

```bash
# Port forward
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090

# Open browser
http://localhost:9090

# Check targets
Prometheus UI → Status → Targets
```

### Access Grafana

```bash
# Port forward
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Open browser
http://localhost:3000

# Login
Username: admin
Password: admin
```

### Configure Grafana Data Sources

In Grafana UI:
1. Configuration → Data Sources
2. Add Prometheus:
   - URL: `http://prometheus-operated:9090`
   - Name: "Prometheus"
3. Add LOKI:
   - URL: `http://loki:3100`
   - Name: "LOKI"

---

## Step 2: Deploy ArgoCD (GitOps)

### Run ArgoCD playbook

```bash
# SSH to master
ssh -i ~/.ssh/depi_key root@MASTER_IP

# Run ArgoCD playbook
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/argocd-setup.yml -v
```

### Wait 3-5 minutes

```bash
# Check ArgoCD
kubectl get pods -n argocd

# Expected output:
# argocd-server-xxxxx            1/1     Running   0          3m
# argocd-controller-xxxxx        1/1     Running   0          3m
# argocd-repo-server-xxxxx       1/1     Running   0          3m
```

### Access ArgoCD

```bash
# Port forward
kubectl port-forward -n argocd svc/argocd-server 8080:443

# Open browser (ignore SSL warning)
https://localhost:8080

# Login
Username: admin
Password: admin
```

### Check Smart Meds Application

In ArgoCD UI:
- Applications → smart-meds
- Status should show "Synced"

---

## Step 3: Deploy Helm Charts

### Create Helm Chart Directory Structure

```bash
mkdir -p helm/smart-meds/templates
```

### Files needed:

```
helm/smart-meds/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-prod.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml
    ├── ingress.yaml
    └── _helpers.tpl
```

### Deploy Helm Chart

**Option A: Direct Helm deployment**

```bash
helm install smart-meds ./helm/smart-meds \
  -n smart-meds \
  --create-namespace
```

**Option B: Via ArgoCD (Recommended)**

ArgoCD automatically syncs from Git. Just push to repo and ArgoCD deploys automatically.

### Verify Helm Deployment

```bash
# Check release
helm list -n smart-meds

# Check pods
kubectl get pods -n smart-meds

# Check services
kubectl get svc -n smart-meds

# Check ingress
kubectl get ingress -n smart-meds
```

---

## Step 4: Monitor the Application

### View Metrics in Grafana

```
Prometheus dashboard:
- Pod CPU usage
- Pod memory usage
- API latency
- Error rates
```

### View Logs in Grafana (via LOKI)

```
Grafana → Explore → LOKI
Query: {namespace="smart-meds"}
```

### Create Custom Dashboards

In Grafana UI:
1. Create → Dashboard
2. Add Panels for:
   - API latency
   - Error rate
   - Pod restarts
   - Memory usage

---

## Step 5: GitOps Workflow

### Update Smart Meds (CI/CD Pipeline)

```
1. Developer commits code
   ↓
2. GitHub Actions builds Docker image
   ↓
3. Push image to Docker Hub
   ↓
4. Update Helm values.yaml with new image tag
   ↓
5. Push to repository
   ↓
6. ArgoCD detects changes
   ↓
7. ArgoCD syncs → Kubernetes deploys new version
```

### Manual Sync (if needed)

```bash
argocd app sync smart-meds
```

### Rollback (if needed)

```bash
# View history
helm history smart-meds -n smart-meds

# Rollback to previous version
helm rollback smart-meds 0 -n smart-meds
```

---

## Complete Access URLs & Credentials

### Prometheus
- URL: `http://localhost:9090`
- Port forward: `kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090`

### Grafana
- URL: `http://localhost:3000`
- Username: `admin`
- Password: `admin`
- Port forward: `kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80`

### ArgoCD
- URL: `https://localhost:8080`
- Username: `admin`
- Password: `admin`
- Port forward: `kubectl port-forward -n argocd svc/argocd-server 8080:443`

### Smart Meds App
- Namespace: `smart-meds`
- Service: `smart-meds`
- Replicas: 3 (auto-scaling 3-10)

---

## Troubleshooting

### Pods not ready

```bash
# Check pod status
kubectl describe pod POD_NAME -n monitoring

# Check logs
kubectl logs POD_NAME -n monitoring

# Check events
kubectl get events -n monitoring --sort-by='.lastTimestamp'
```

### ArgoCD not syncing

```bash
# Check ArgoCD application
kubectl describe application smart-meds -n argocd

# Check sync status
argocd app get smart-meds
```

### Metrics not appearing

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check scrape configs
kubectl get prometheus -A
```

### Logs not appearing in LOKI

```bash
# Check Promtail status
kubectl get ds -n monitoring

# Check Promtail logs
kubectl logs -n monitoring -l app=promtail --tail=50
```

---

## Next Steps

1. ✅ Monitoring stack running
2. ✅ ArgoCD for GitOps
3. ✅ Helm charts ready
4. 📊 Create dashboards in Grafana
5. 🔔 Setup alerts in Prometheus
6. 📝 Setup log queries in LOKI
7. 🚀 Deploy Smart Meds app via ArgoCD

---

## Reference Commands

```bash
# Kubernetes
kubectl get all -A
kubectl get pods -n smart-meds
kubectl logs -f deployment/smart-meds -n smart-meds
kubectl describe svc smart-meds -n smart-meds

# Helm
helm list -A
helm status smart-meds -n smart-meds
helm values smart-meds -n smart-meds

# ArgoCD
argocd app list
argocd app get smart-meds
argocd app sync smart-meds

# Monitoring
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

---

**Status: Ready for Production Deployment** ✅
