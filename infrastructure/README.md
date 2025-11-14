# Infrastructure Overview

This directory contains all infrastructure-as-code and deployment configurations for the Crypto Analytics platform on AWS.

## Directory Structure

```
infrastructure/
├── terraform/               # OpenTofu/OpenTofu configurations
│   ├── modules/
│   │   ├── vpc/            # VPC with multi-AZ networking
│   │   ├── eks/            # EKS cluster and node groups
│   │   └── route53/        # DNS and SSL certificates
│   └── environments/
│       └── production/     # Production environment config
├── kubernetes/             # Kubernetes manifests
│   ├── namespace.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   └── ingress.yaml
├── scripts/
│   └── deploy.sh          # Automated deployment script
├── DEPLOYMENT.md          # Full deployment guide
├── QUICK_START.md         # Quick deployment guide
└── README.md             # This file
```

## Quick Links

- **[Quick Start Guide](./QUICK_START.md)** - Get up and running fast
- **[Full Deployment Guide](./DEPLOYMENT.md)** - Comprehensive instructions
- **[Deployment Script](./scripts/deploy.sh)** - Automated deployment

## Architecture

### AWS Resources Created

1. **Networking**
   - VPC (10.0.0.0/16)
   - 3 Public Subnets (across 3 AZs)
   - 3 Private Subnets (across 3 AZs)
   - 3 NAT Gateways (one per AZ)
   - Internet Gateway
   - Route Tables

2. **Compute**
   - EKS Cluster (Kubernetes 1.28)
   - Node Group (t3.medium, 2-4 nodes)
   - Auto-scaling enabled

3. **Load Balancing**
   - Application Load Balancer
   - SSL/TLS termination
   - Health checks

4. **DNS & Certificates**
   - Route 53 Hosted Zone
   - ACM SSL Certificate (*.cryptoquantlab.com)
   - External DNS integration

5. **Container Registry**
   - ECR repositories for backend and frontend

### Kubernetes Resources

1. **Deployments**
   - Backend (2-10 replicas)
   - Frontend (2-10 replicas)
   - Rolling updates
   - Health checks (liveness/readiness)

2. **Services**
   - Backend (ClusterIP)
   - Frontend (ClusterIP)

3. **Ingress**
   - ALB-based ingress controller
   - SSL/TLS certificates
   - Path-based routing
   - Host-based routing

4. **Autoscaling**
   - Horizontal Pod Autoscaler (HPA)
   - CPU-based scaling
   - Memory-based scaling

## Domain Configuration

The infrastructure is configured for **cryptoquantlab.com** with the following subdomains:

- `cryptoquantlab.com` → Frontend
- `www.cryptoquantlab.com` → Frontend
- `api.cryptoquantlab.com` → Backend GraphQL API

## Deployment Methods

### Method 1: Automated Script (Recommended)

```bash
cd scripts
./deploy.sh
```

This script handles:
- ECR setup
- Docker builds
- Image pushes
- Kubernetes deployments
- DNS configuration

### Method 2: Manual Deployment

Follow the [Full Deployment Guide](./DEPLOYMENT.md) for step-by-step manual deployment.

### Method 3: CI/CD Pipeline

Set up a CI/CD pipeline using:
- GitHub Actions
- AWS CodePipeline
- GitLab CI
- Jenkins

## Prerequisites

- AWS CLI configured
- kubectl installed
- Docker installed
- OpenTofu or OpenTofu installed
- Domain ready (cryptoquantlab.com)

## Estimated Costs

| Resource | Monthly Cost |
|----------|-------------|
| EKS Cluster | $73 |
| EC2 Nodes (2x t3.medium) | $60 |
| NAT Gateways (3x) | $97 |
| Application Load Balancer | $22 |
| Route 53 | $1 |
| Data Transfer | Variable |
| **Total** | **~$250-300** |

### Cost Optimization Tips

1. **Reduce NAT Gateways**: Use 1 instead of 3 (saves ~$65/month)
2. **Use Spot Instances**: 60-90% savings on compute
3. **Use Fargate**: Pay only for pods running
4. **Reserved Instances**: Commit to 1-3 years for savings

## Security Features

- Private subnets for application workloads
- Public subnets only for load balancers
- Security groups with least privilege
- SSL/TLS encryption (HTTPS only)
- Kubernetes RBAC
- Network policies
- Pod security policies
- Secrets management via Kubernetes secrets

## Monitoring & Logging

Recommendations for production:

1. **CloudWatch Logs**
   - EKS control plane logs
   - Application logs

2. **CloudWatch Metrics**
   - EKS cluster metrics
   - ALB metrics
   - Custom application metrics

3. **AWS X-Ray**
   - Distributed tracing
   - Performance insights

4. **Prometheus & Grafana**
   - Kubernetes metrics
   - Custom dashboards
   - Alerting

## High Availability

The infrastructure is designed for high availability:

- Multi-AZ deployment (3 availability zones)
- Auto-scaling node groups
- Horizontal pod autoscaling
- Load balancer health checks
- Rolling updates with zero downtime
- Pod anti-affinity rules

## Disaster Recovery

### Backup Strategy

1. **Infrastructure**
   - OpenTofu state in S3 (versioned)
   - Infrastructure as Code in Git

2. **Application**
   - Docker images in ECR
   - Configuration in Git
   - Kubernetes manifests in Git

### Recovery Procedures

1. **Complete Rebuild**
   ```bash
   tofu apply
   ./scripts/deploy.sh
   ```

2. **Rollback Application**
   ```bash
   kubectl rollout undo deployment/backend -n crypto-analytics
   ```

## Troubleshooting

See the [Full Deployment Guide](./DEPLOYMENT.md#troubleshooting) for detailed troubleshooting steps.

Common issues:
- Pods not starting
- Ingress not working
- DNS not resolving
- SSL certificate issues

## Updates & Maintenance

### Update Kubernetes Version

```bash
cd terraform/environments/production
# Edit variables.tf - update cluster_version
tofu apply
```

### Update Application

```bash
# Build new images
docker build -t ...

# Update deployment
kubectl set image deployment/backend ...
```

### Update Infrastructure

```bash
cd terraform/environments/production
# Edit configuration files
tofu plan
tofu apply
```

## Support

For issues or questions:
- Review [DEPLOYMENT.md](./DEPLOYMENT.md)
- Check [QUICK_START.md](./QUICK_START.md)
- Review AWS CloudWatch logs
- Check Kubernetes events
- Consult AWS documentation

## License

MIT
