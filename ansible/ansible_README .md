# Kubernetes Cluster Setup - Ansible Playbooks

## Overview
This directory contains Ansible playbooks for automated Kubernetes cluster setup on CentOS 9.

**Components Setup:**
- Docker container runtime
- Kubernetes 1.28 (kubeadm, kubelet, kubectl)
- Calico CNI for pod networking
- Firewall configuration
- SELinux handling
- System prerequisites

---

## Prerequisites

### Hardware Requirements
- 2 CentOS 9 instances (1 Master, 1 Worker)
- Minimum: 2 CPU, 2GB RAM per node
- Recommended: 4 CPU, 4GB RAM per node

### Network Requirements
- Security group must allow:
  - Port 22 (SSH)
  - Port 6443 (Kubernetes API)
  - Port 10250 (Kubelet)
  - Port 30000-32767 (NodePort services)
  - Port 2379-2380 (etcd)

### Local Machine Requirements
- SSH key file: `~/.ssh/depi_key`
- Ansible installed: `pip install ansible`
- Network access to EC2 instances

---

## Setup Instructions

### Step 1: Prepare Inventory File

Edit `inventory/hosts.yml`:

Replace placeholders:
- `MASTER_IP_HERE` → Your Master EC2 public IP
- `WORKER_IP_HERE` → Your Worker EC2 public IP

Example:
```yaml
[masters]
k8s-master ansible_host=34.200.227.9 ansible_user=root

[workers]
k8s-worker-1 ansible_host=44.204.132.61 ansible_user=root
```

### Step 2: Verify SSH Key

```bash
# Check key exists
ls -la ~/.ssh/depi_key

# Verify permissions (should be 600)
chmod 600 ~/.ssh/depi_key
```

### Step 3: Test Connectivity

```bash
ansible all -i inventory/hosts.yml -m ping
```

**Expected Output:**
```
k8s-master | SUCCESS => {
    "ping": "pong"
}
k8s-worker-1 | SUCCESS => {
    "ping": "pong"
}
```

If this fails:
- Check security group allows port 22
- Verify IP addresses are correct
- Ensure SSH key path is correct

### Step 4: Run Playbook

**Option A: From your local machine (with Ansible installed)**
```bash
ansible-playbook -i inventory/hosts.yml playbooks/kubernetes-setup.yml -v
```

**Option B: From Master node (recommended for Windows users)**
```bash
# SSH into Master
ssh -i ~/.ssh/depi_key root@MASTER_IP

# On Master, install Ansible
apt-get update && apt-get install -y git ansible

# Clone repo and checkout branch
git clone https://github.com/Ahmed-Mahmoud-Elsawy-Sabra/NHA-4-145.git
cd NHA-4-145
git checkout ansible-k8s

# Run playbook
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/kubernetes-setup.yml -v
```

### Step 5: Wait for Completion

The playbook will take 15-20 minutes to complete. Output will show:
- ✅ Task names as they execute
- ⚙️ Configuration changes
- ✓ Final cluster status

### Step 6: Verify Cluster

SSH into Master and check:

```bash
# Check nodes
kubectl get nodes

# Expected output:
# NAME           STATUS   ROLES           AGE   VERSION
# k8s-master     Ready    control-plane   2m    v1.28.0
# k8s-worker-1   Ready    <none>          1m    v1.28.0
```

All nodes should be **Ready**.

```bash
# Check system pods
kubectl get pods -n kube-system

# Check networking (Calico)
kubectl get pods -n calico-system
```

---

## File Structure

```
ansible/
├── inventory/
│   └── hosts.yml                    # EC2 IP configuration
├── playbooks/
│   └── kubernetes-setup.yml         # Main playbook (500+ lines)
├── site.yml                         # Entry point
└── README.md                        # This file
```

---

## Playbook Sections

### Phase 1: Common Setup (All Nodes)
- System package updates
- Kernel module loading
- Sysctl configuration
- Swap disable
- Firewall setup (firewalld)
- SELinux configuration

### Phase 2: Docker Installation
- Add Docker repository
- Install Docker and dependencies
- Configure Docker daemon
- Start Docker service

### Phase 3: Kubernetes Installation
- Add Kubernetes repository
- Install kubeadm, kubelet, kubectl
- Enable and start kubelet

### Phase 4: Master Initialization
- Run kubeadm init
- Configure kubeconfig
- Generate worker join command
- Install Calico CNI plugin

### Phase 5: Worker Setup
- Join worker nodes to cluster
- Verify node status

### Phase 6: Verification
- Wait for nodes to be Ready
- Display cluster information
- Verify pod status

---

## Troubleshooting

### Problem: Nodes NotReady

```bash
# SSH to Master
ssh -i ~/.ssh/depi_key root@MASTER_IP

# Check node status
kubectl describe node k8s-master

# Check kubelet logs
journalctl -u kubelet -f

# Check Calico status
kubectl get pods -n calico-system
kubectl logs -n calico-system -l app=calico-node
```

**Common Causes:**
- Calico not running yet (wait 5 minutes)
- Firewall rules not applied
- SELinux still enforcing

### Problem: SSH Connection Failed

```bash
# Verify key permissions
ls -la ~/.ssh/depi_key

# Key should show: -rw------- (600)
chmod 600 ~/.ssh/depi_key

# Test SSH directly
ssh -i ~/.ssh/depi_key root@MASTER_IP

# Check security group
# Port 22 must be open
```

### Problem: Ansible Command Not Found

**Windows Users:**
- Use SSH option (SSH into Master first)
- Or install WSL (Windows Subsystem for Linux)
- Or use Docker container with Ansible

**Linux/Mac Users:**
```bash
pip install ansible
ansible --version
```

### Problem: Playbook Hangs

- Network issue (check internet speed)
- Image download slow (large images ~2GB)
- Resource constraints (increase EC2 size)

Wait at least 20 minutes before interrupting.

---

## Resuming Failed Playbook

If playbook fails at a task:

```bash
# View last failed task
# Then resume from that point
ansible-playbook -i inventory/hosts.yml playbooks/kubernetes-setup.yml -v \
  --start-at-task="Task Name"
```

---

## Post-Deployment

### Next Steps:
1. Deploy monitoring (Prometheus/Grafana)
2. Deploy logging (LOKI)
3. Deploy Smart Meds application
4. Configure ArgoCD for GitOps

See `/docs/` for detailed guides.

---

## Support & Documentation

- **Architecture:** See `docs/architecture.md`
- **Troubleshooting:** See `docs/troubleshooting.md`
- **Scaling:** See `docs/scaling.md`
- **Backup:** See `docs/backup.md`

---

## Author
Ahmed Mahmoud Elsawy  
DevOps Engineer - Smart Meds Project

## Last Updated
June 30, 2026

## Status
✅ Ready for Production
