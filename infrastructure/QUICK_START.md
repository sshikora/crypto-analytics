# Quick Start - Deploy to AWS EKS

This is a condensed guide for deploying Crypto Analytics to AWS. For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Prerequisites

- AWS CLI configured
- kubectl installed
- Docker installed
- OpenTofu or OpenTofu installed
- Domain `cryptoquantlab.com` ready (or update variables)

## 1. Setup AWS Backend (One-time)

```bash
export AWS_REGION=us-east-1

# Create S3 bucket for OpenTofu state
aws s3api create-bucket \
  --bucket crypto-analytics-opentofu-state \
  --region $AWS_REGION

aws s3api put-bucket-versioning \
  --bucket crypto-analytics-opentofu-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for locks
aws dynamodb create-table \
  --table-name crypto-analytics-opentofu-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region $AWS_REGION
```

## 2. Deploy Infrastructure

### Option A: Standard Configuration (~$250-300/month)

```bash
cd infrastructure/terraform/environments/production

# Initialize and apply
tofu init
tofu plan
tofu apply

# This takes ~15-20 minutes
```

### Option B: Cost-Optimized Configuration (~$90-120/month) ⭐ RECOMMENDED

For low traffic applications, use the cost-optimized configuration:

```bash
cd infrastructure/terraform/environments/production

tofu init
tofu plan -var-file=terraform.tfvars.cost-optimized
tofu apply -var-file=terraform.tfvars.cost-optimized

# This saves 60-70% on costs!
```

See [COST_OPTIMIZATION.md](./COST_OPTIMIZATION.md) for details.

## 3. Update Domain Nameservers

```bash
# Get nameservers
tofu output route53_name_servers

# Update your domain registrar to use these nameservers
# Wait 10-30 minutes for propagation
```

## 4. Deploy Application

```bash
cd ../../scripts

# Run automated deployment
./deploy.sh
```

## 5. Verify

```bash
# Check pods
kubectl get pods -n crypto-analytics

# Get ALB URL
kubectl get ingress crypto-analytics -n crypto-analytics \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Access application
open https://cryptoquantlab.com
```

## Common Commands

```bash
# View logs
kubectl logs -f deployment/backend -n crypto-analytics
kubectl logs -f deployment/frontend -n crypto-analytics

# Scale
kubectl scale deployment backend -n crypto-analytics --replicas=3

# Update image
kubectl set image deployment/backend \
  backend=$ECR_BACKEND_REPO:new-tag \
  -n crypto-analytics

# Rollback
kubectl rollout undo deployment/backend -n crypto-analytics
```

## Cleanup

```bash
# Delete app
kubectl delete namespace crypto-analytics

# Wait 5 minutes for ALB deletion

# Destroy infrastructure
cd infrastructure/terraform/environments/production
tofu destroy
```

## Costs

### Standard Configuration
Estimated monthly cost: **$250-300**
- EKS Cluster: $73
- 2x t3.medium nodes: $60
- 3x NAT Gateways: $97
- ALB: $22
- Other services: ~$20

### Cost-Optimized Configuration ⭐
Estimated monthly cost: **$90-120** (60-70% savings!)
- EKS Cluster: $73
- 2x t3.small SPOT nodes: $6-12
- 1x NAT Gateway: $32
- ALB: $22
- Other services: ~$10

See [COST_OPTIMIZATION.md](./COST_OPTIMIZATION.md) for full details and trade-offs.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pods not starting | `kubectl describe pod <name> -n crypto-analytics` |
| DNS not resolving | Check External DNS logs and Route 53 records |
| SSL errors | Verify ACM certificate status and validation |
| 502/503 errors | Check backend health and logs |

For detailed troubleshooting, see [DEPLOYMENT.md](./DEPLOYMENT.md).
