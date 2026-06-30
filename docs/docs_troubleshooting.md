# Kubernetes Cluster Troubleshooting Guide

## Common Issues & Solutions

---

## 1. NODES NOT READY

### Symptom
```bash
$ kubectl get nodes
NAME           STATUS     ROLES           AGE   VERSION
k8s-master     NotReady   control-plane   2m    v1.28.0
k8s-worker-1   NotReady   <none>          1m    v1.28.0
```

### Diagnosis

```bash
# Detailed node info
kubectl describe node k8s-master

# Check node conditions
kubectl get nodes -o json | jq '.items[].status.conditions'

# Kubelet logs
ssh -i ~/.ssh/depi_key root@NODE_IP
journalctl -u kubelet -n 50
```

### Common Causes & Solutions

#### Cause 1: Calico Not Ready

```bash
# Check Calico status
kubectl get pods -n calico-system

# If pods pending or crashing:
kubectl logs -n calico-system -l app=calico-node

# Wait for Calico (takes 5 minutes)
kubectl wait --for=condition=ready pod \
  -l k8s-app=calico-operator \
  -n calico-system \
  --timeout=300s
```

**Solution:** Wait 5-10 minutes for Calico to initialize.

---

#### Cause 2: Kubelet Service Not Running

```bash
# SSH to node
ssh -i ~/.ssh/depi_key root@NODE_IP

# Check kubelet status
systemctl status kubelet

# Restart kubelet
systemctl restart kubelet
systemctl enable kubelet

# Verify
systemctl is-active kubelet
```

**Solution:** Restart kubelet service.

---

#### Cause 3: Firewall Blocking Communication

```bash
# Check firewall rules
firewall-cmd --list-all

# If ports missing, add them:
firewall-cmd --add-port=6443/tcp --permanent
firewall-cmd --add-port=10250/tcp --permanent
firewall-cmd --reload
```

**Solution:** Configure firewall rules.

---

#### Cause 4: Disk Space Issues

```bash
# Check disk usage
df -h /

# Clean up Docker images
docker rmi $(docker images -q -f "dangling=true")

# Prune Docker
docker system prune -a
```

**Solution:** Free up disk space.

---

## 2. PODS STUCK IN PENDING

### Symptom
```bash
$ kubectl get pods
NAME                      READY   STATUS    RESTARTS   AGE
smart-meds-deployment-1   0/1     Pending   0          5m
```

### Diagnosis

```bash
# Detailed pod info
kubectl describe pod smart-meds-deployment-1

# Check events
kubectl get events --sort-by='.lastTimestamp'

# Check node resources
kubectl top nodes
kubectl top pods
```

### Common Causes & Solutions

#### Cause 1: No Available Nodes

```bash
# Check node capacity
kubectl describe nodes

# Check taints/tolerations
kubectl describe node k8s-master | grep Taints
```

**Solution:** 
- Ensure workers are Ready
- Remove master taints if needed: `kubectl taint nodes k8s-master node-role.kubernetes.io/control-plane:NoSchedule-`

---

#### Cause 2: Insufficient Resources

```bash
# Check resource requests
kubectl describe pod POD_NAME

# Check node capacity
kubectl describe node NODE_NAME

# See resource usage
kubectl top node
kubectl top pod
```

**Solution:**
- Increase node resources (EC2 instance type)
- Reduce pod resource requests
- Add more worker nodes

---

#### Cause 3: Image Pull Issues

```bash
# Check image
kubectl describe pod POD_NAME

# Pull image manually
docker pull IMAGE_NAME

# Check Docker logs
docker logs CONTAINER_ID
```

**Solution:**
- Verify image exists and name is correct
- Check image registry credentials
- Ensure worker can pull from registry

---

## 3. NODES COMMUNICATION ISSUES

### Symptom
```
Worker cannot join cluster
Worker nodes NotReady
Cannot run kubectl commands
```

### Diagnosis

```bash
# From Master, try to reach Worker
ping WORKER_IP

# From Worker, try to reach Master
ping MASTER_IP

# Check network policies
kubectl get networkpolicies -A

# Check CNI status
kubectl get daemonset -n calico-system
```

### Solutions

#### Network Connectivity

```bash
# SSH to both nodes
ssh -i ~/.ssh/depi_key root@MASTER_IP
ping WORKER_IP

# If timeout, check:
# 1. Security group allows all traffic
# 2. Network ACLs allow traffic
# 3. Firewall rules on OS
```

#### Calico Network Plugin

```bash
# Check Calico installation
kubectl get pods -n calico-system

# If not running:
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/tigera-operator.yaml

# Wait for operator
kubectl wait --for=condition=ready pod \
  -l k8s-app=calico-operator \
  -n calico-system \
  --timeout=300s
```

---

## 4. DOCKER IMAGE ISSUES

### Symptom
```
ImagePullBackOff
ErrImagePull
Pull ratelimit exceeded
```

### Diagnosis

```bash
# Check pod status
kubectl describe pod POD_NAME

# SSH to worker and check image
ssh -i ~/.ssh/depi_key root@WORKER_IP
docker images
docker pull IMAGE_NAME:TAG
```

### Solutions

#### Image Doesn't Exist

```bash
# Build and push image
docker build -t your-repo/image:tag .
docker push your-repo/image:tag

# Update deployment
kubectl set image deployment/app app=your-repo/image:tag
```

#### Image Pull Ratelimit

```bash
# Create registry secret
kubectl create secret docker-registry regcred \
  --docker-server=docker.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_TOKEN

# Use in pod spec:
# imagePullSecrets:
# - name: regcred
```

---

## 5. PERSISTENT VOLUME ISSUES

### Symptom
```
Pod stuck in Pending
PersistentVolumeClaim not bound
```

### Diagnosis

```bash
# Check PVCs
kubectl get pvc

# Describe PVC
kubectl describe pvc PVC_NAME

# Check PVs
kubectl get pv

# Check storage class
kubectl get storageclass
```

### Solution

For testing, use `hostPath` storage:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-hostpath
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: /mnt/data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-hostpath
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

---

## 6. SERVICE CONNECTIVITY ISSUES

### Symptom
```
Cannot connect to service
Service not accessible
DNS not resolving
```

### Diagnosis

```bash
# Check service
kubectl get svc

# Describe service
kubectl describe svc SERVICE_NAME

# Check endpoints
kubectl get endpoints SERVICE_NAME

# Test DNS from pod
kubectl run -it debug --image=busybox --restart=Never -- nslookup SERVICE_NAME
```

### Solutions

#### No Endpoints

```bash
# Check pod labels
kubectl get pods --show-labels

# Verify selector in service
kubectl describe svc SERVICE_NAME

# Labels must match service selector
```

#### DNS Not Working

```bash
# Check CoreDNS pods
kubectl get pods -n kube-system | grep coredns

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns

# Test DNS
kubectl exec -it POD_NAME -- nslookup kubernetes.default
```

---

## 7. LOGGING & MONITORING ISSUES

### LOKI Not Working

```bash
# Check LOKI pods
kubectl get pods -n monitoring | grep loki

# Check Promtail
kubectl get ds -n monitoring | grep promtail

# Check LOKI logs
kubectl logs -n monitoring -l app=loki --tail=50
```

### Prometheus Not Scraping

```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090
# Open http://localhost:9090/targets

# Check scrape config
kubectl describe prometheus -n monitoring

# Check ServiceMonitor
kubectl get servicemonitor -A
```

### Grafana Dashboard Issues

```bash
# Check Grafana pods
kubectl get pods -n monitoring | grep grafana

# Port forward to Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Check datasource config
# Go to Configuration → Data Sources
# Verify Prometheus URL: http://prometheus-operated:9090
# Verify LOKI URL: http://loki:3100
```

---

## 8. CLUSTER STATE ISSUES

### Symptom
```
Cluster stuck
etcd problems
API server not responding
```

### Diagnosis

```bash
# Check API server
kubectl cluster-info

# Check etcd health (on master)
ssh -i ~/.ssh/depi_key root@MASTER_IP
ETCDCTL_API=3 etcdctl --endpoints=127.0.0.1:2379 endpoint health

# Check system pods
kubectl get pods -n kube-system
```

### Solutions

#### Restart API Server

```bash
# On Master
ssh -i ~/.ssh/depi_key root@MASTER_IP

# Check API server pod
kubectl get pods -n kube-system | grep kube-apiserver

# If managed by systemd
systemctl restart kubelet
```

#### Restart etcd

```bash
# Check etcd pod
kubectl get pods -n kube-system | grep etcd

# If corrupted, restore from backup
# (See backup procedures documentation)
```

---

## 9. QUICK DIAGNOSIS COMMANDS

```bash
# Cluster health overview
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -A

# Node diagnostics
kubectl describe node NODE_NAME
kubectl top nodes
kubectl get events

# Pod diagnostics
kubectl describe pod POD_NAME
kubectl logs POD_NAME
kubectl logs --previous POD_NAME

# Network diagnostics
kubectl get networkpolicies -A
kubectl get svc
kubectl get endpoints

# Storage diagnostics
kubectl get pv,pvc

# Resource usage
kubectl top nodes
kubectl top pods -A

# Cluster capacity
kubectl describe nodes | grep -A 5 "Allocatable"
```

---

## 10. GETTING HELP

### Useful Resources

- **Kubernetes Docs:** https://kubernetes.io/docs/
- **Calico Troubleshooting:** https://projectcalico.docs.tigera.io/reference/faq
- **Prometheus Troubleshooting:** https://prometheus.io/docs/prometheus/latest/querying/basics/
- **Grafana Help:** https://grafana.com/docs/grafana/latest/

### Logging into Nodes

```bash
# SSH to Master
ssh -i ~/.ssh/depi_key root@MASTER_IP

# SSH to Worker
ssh -i ~/.ssh/depi_key root@WORKER_IP

# View system logs
journalctl -xe

# View Docker logs
docker logs CONTAINER_ID

# View kubelet logs
journalctl -u kubelet -f
```

### Common Commands Cheatsheet

```bash
# Node commands
kubectl get nodes
kubectl describe node NODE_NAME
kubectl drain NODE_NAME          # Graceful shutdown
kubectl uncordon NODE_NAME       # Bring back online

# Pod commands
kubectl get pods -A
kubectl describe pod POD_NAME
kubectl logs POD_NAME
kubectl exec -it POD_NAME -- /bin/bash

# Service commands
kubectl get svc
kubectl describe svc SERVICE_NAME
kubectl port-forward svc/SERVICE_NAME 8080:8080

# Cluster commands
kubectl cluster-info
kubectl get events
kubectl get all
```

---

## Recovery Procedures

### Cluster Recovery

If cluster is completely broken:

1. **Backup etcd** (if possible)
2. **Reset nodes:** `kubeadm reset`
3. **Reinitialize master:** `kubeadm init`
4. **Rejoin workers:** `kubeadm join ...`

### Data Recovery

If data is lost:

1. **Check backups:** Look for etcd backups
2. **Restore from backup:** Use `etcdctl snapshot restore`
3. **Redeploy applications:** Use Helm charts

---

This guide covers most common Kubernetes issues. For additional help, check Kubernetes official documentation or consult cluster logs.
