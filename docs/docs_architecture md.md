# Kubernetes Architecture - Smart Meds

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AWS Cloud                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              VPC (Virtual Private Cloud)          │  │
│  │                                                   │  │
│  │  ┌──────────────┐    ┌──────────────┐           │  │
│  │  │ Master Node  │    │ Worker Node  │           │  │
│  │  │ (Control     │    │ (Compute)    │           │  │
│  │  │  Plane)      │    │              │           │  │
│  │  │ 34.200.227.9 │    │ 44.204.132.61│           │  │
│  │  └──────────────┘    └──────────────┘           │  │
│  │         │                    │                   │  │
│  │         └────────┬───────────┘                   │  │
│  │                  │                               │  │
│  │         ┌────────▼────────┐                      │  │
│  │         │ Pod Network     │                      │  │
│  │         │ (Calico CNI)    │                      │  │
│  │         │ 10.244.0.0/16   │                      │  │
│  │         └─────────────────┘                      │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────┐    │  │
│  │  │       Add-ons & Services                │    │  │
│  │  │ - Prometheus (Metrics)                  │    │  │
│  │  │ - Grafana (Dashboards)                  │    │  │
│  │  │ - LOKI (Logging)                        │    │  │
│  │  │ - ArgoCD (GitOps)                       │    │  │
│  │  └─────────────────────────────────────────┘    │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌────────────────────────┐                           │
│  │  RDS PostgreSQL        │                           │
│  │  (Database)            │                           │
│  └────────────────────────┘                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Network Topology

### CIDR Ranges

| Component | CIDR Range | Purpose |
|-----------|-----------|---------|
| VPC | 10.0.0.0/16 | Network isolation |
| Public Subnet | 10.0.1.0/24 | Master & Worker |
| Private Subnet | 10.0.2.0/24 | Database & internal |
| Pod Network | 10.244.0.0/16 | Pod-to-pod communication |
| Service Network | 10.96.0.0/12 | Kubernetes services |

### Network Ports

| Port | Service | Protocol | Purpose |
|------|---------|----------|---------|
| 22 | SSH | TCP | Remote administration |
| 6443 | Kubernetes API | TCP | API server access |
| 10250 | Kubelet | TCP | Node communication |
| 2379-2380 | etcd | TCP | Cluster state |
| 30000-32767 | NodePort | TCP/UDP | Service exposure |

---

## Component Architecture

### Master Node (Control Plane)

```
Master Node (34.200.227.9)
├── API Server (port 6443)
│   └─ HTTP/HTTPS server for cluster communication
├── Scheduler
│   └─ Assigns pods to worker nodes
├── Controller Manager
│   └─ Manages cluster state
└── etcd
    └─ Distributed key-value store (cluster state)
```

**Responsibilities:**
- Receive and process API requests
- Schedule pods on workers
- Manage cluster state
- Monitor node health

### Worker Node (Compute)

```
Worker Node (44.204.132.61)
├── Kubelet (Agent)
│   └─ Manages pods on node
├── Container Runtime (Docker)
│   └─ Runs containerized applications
├── kube-proxy
│   └─ Network proxy for services
└── Pods (Application containers)
    └─ Running Smart Meds applications
```

**Responsibilities:**
- Run containerized applications
- Report node status to master
- Execute kubelet commands
- Manage pod networking

---

## Kubernetes Architecture

```
Control Plane (Master)
├── Cluster API
├── Cluster Scheduler
├── Cluster Controller
└── etcd Database

Data Plane (Workers)
├── kubelet (Node Agent)
├── kube-proxy (Service Proxy)
├── Container Runtime
└── Pod Runtime

Network Layer
├── Calico CNI (Pod Networking)
├── CoreDNS (Service Discovery)
└── Ingress Controller (External Access)

Storage Layer
├── Persistent Volumes (PV)
├── Persistent Volume Claims (PVC)
└── Storage Classes (Dynamic Provisioning)

Observability
├── Prometheus (Metrics Collection)
├── Grafana (Metrics Visualization)
└── LOKI (Log Aggregation)
```

---

## Pod Network (Calico)

Calico provides network connectivity between pods across nodes.

```
Master Node                    Worker Node
┌──────────────────┐          ┌──────────────────┐
│  Pod Network     │          │  Pod Network     │
│  10.244.1.0/24   │          │  10.244.2.0/24   │
│                  │          │                  │
│  ┌─────────────┐ │          │  ┌─────────────┐ │
│  │ Pod 1       │ │          │  │ Pod 3       │ │
│  │ 10.244.1.2  │◄┼──────────┼─►│ 10.244.2.2  │ │
│  └─────────────┘ │          │  └─────────────┘ │
│                  │          │                  │
│  ┌─────────────┐ │          │  ┌─────────────┐ │
│  │ Pod 2       │ │          │  │ Pod 4       │ │
│  │ 10.244.1.3  │◄┼──────────┼─►│ 10.244.2.3  │ │
│  └─────────────┘ │          │  └─────────────┘ │
│                  │          │                  │
└──────────────────┘          └──────────────────┘
        ▲                              ▲
        └──────────┬───────────────────┘
                   │
            Calico Network Plugin
            (Pod-to-Pod Communication)
```

---

## Service Architecture

Kubernetes Services expose pods:

```
External Client
      │
      ▼
┌─────────────────────┐
│  Service (ClusterIP)│
│  10.96.0.5:8080    │
└─────────────────────┘
      │ │ │
      ▼ ▼ ▼
  ┌───┴───┴───┐
  │ Pod Pool  │
  │ (3 pods)  │
  └───────────┘
```

**Service Types:**
1. **ClusterIP** (default): Internal cluster access
2. **NodePort**: External access via node port
3. **LoadBalancer**: Cloud load balancer
4. **ExternalName**: DNS CNAME

---

## Storage Architecture

```
Application Pod
      │
      ▼
Persistent Volume Claim (PVC)
      │
      ▼
Persistent Volume (PV)
      │
      ▼
Storage Backend (RDS/EBS)
```

---

## Observability Stack

### Prometheus (Metrics)

```
Kubernetes Cluster
      │
      ▼
┌─────────────────┐
│  Prometheus     │
│  (Scraping)     │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Time Series    │
│  Database       │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Grafana        │
│  (Visualization)│
└─────────────────┘
```

### LOKI (Logging)

```
All Pods
   │
   ▼
Promtail (Log Shipper)
   │
   ▼
┌─────────────┐
│  LOKI       │
│  (Aggregat.)│
└─────────────┘
   │
   ▼
┌──────────────────┐
│  Grafana         │
│  (Log Explorer)  │
└──────────────────┘
```

---

## Data Flow

### Pod Creation Flow

```
1. User/CI/CD creates Pod
              │
              ▼
2. API Server receives request
              │
              ▼
3. etcd stores state
              │
              ▼
4. Scheduler assigns to node
              │
              ▼
5. Kubelet receives assignment
              │
              ▼
6. Docker pulls image
              │
              ▼
7. Container starts
              │
              ▼
8. Pod Network assigns IP
              │
              ▼
9. Service discovers pod
              │
              ▼
10. Traffic routed to pod
```

### Monitoring Flow

```
Metrics Collection
┌──────────────────────┐
│  Kubelet exposes     │
│  /metrics endpoint   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Prometheus scrapes  │
│  every 15 seconds    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Stores in TSDB      │
│  (Time Series DB)    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Grafana queries &   │
│  visualizes          │
└──────────────────────┘
```

---

## Security Architecture

```
Security Layers
├── Network Security
│   ├─ Security Groups (AWS Firewall)
│   ├─ Network Policies (Calico)
│   └─ VPC Isolation
├── Node Security
│   ├─ SSH key-based auth
│   ├─ SELinux (disabled for K8s)
│   └─ Firewall (firewalld)
├── Cluster Security
│   ├─ RBAC (Role-Based Access Control)
│   ├─ Pod Security Standards
│   └─ Network Policies
└── Application Security
    ├─ Container image scanning (Trivy)
    ├─ Code quality (SonarQube)
    └─ Runtime scanning (OWASP ZAP)
```

---

## High Availability Considerations

Current Setup:
- **Single Master** (control plane on 1 node)
- **Single Worker** (1 compute node)
- **Single Point of Failure** in Master

For Production HA:
```
Multiple Masters
├── 3 Masters for HA
├── Load balanced API
└── Distributed etcd

Multiple Workers
├── 3+ Workers
├── Pod anti-affinity
└── Multiple zones
```

---

## Summary

This architecture provides:
- ✅ Containerized application deployment (Kubernetes)
- ✅ Automated scheduling and management (Scheduler)
- ✅ Pod-to-pod networking (Calico CNI)
- ✅ Service discovery (CoreDNS)
- ✅ Metrics collection (Prometheus)
- ✅ Metrics visualization (Grafana)
- ✅ Log aggregation (LOKI)
- ✅ Security controls (RBAC, Network Policies)

---

## Reference

- Kubernetes Docs: https://kubernetes.io/docs/
- Calico Docs: https://projectcalico.docs.tigera.io/
- Prometheus Docs: https://prometheus.io/docs/
- Grafana Docs: https://grafana.com/docs/
