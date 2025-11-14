# Quick Start - Deploy to AWS EKS

This is a condensed guide for deploying Crypto Analytics to AWS. For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Prerequisites

- AWS CLI configured
- kubectl installed
- Docker installed
- OpenTofu or Terraform installed
- Domain `cryptoquantlab.com` ready (or update variables)

## 1. Setup AWS Backend (One-time)

```bash
export AWS_REGION=us-east-1

# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket crypto-analytics-terraform-state \
  --region $AWS_REGION

aws s3api put-bucket-versioning \
  --bucket crypto-analytics-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for locks
aws dynamodb create-table \
  --table-name crypto-analytics-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region $AWS_REGION
```

## 2. Deploy Infrastructure

```bash
cd infrastructure/terraform/environments/production

# Initialize and apply
terraform init
terraform plan
terraform apply

# This takes ~15-20 minutes
```

## 3. Update Domain Nameservers

```bash
# Get nameservers
terraform output route53_name_servers

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
terraform destroy
```

## Costs

Estimated monthly cost: **$250-300**

- EKS Cluster: $73
- 2x t3.medium nodes: $60
- 3x NAT Gateways: $97
- ALB: $22
- Other services: ~$20

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pods not starting | `kubectl describe pod <name> -n crypto-analytics` |
| DNS not resolving | Check External DNS logs and Route 53 records |
| SSL errors | Verify ACM certificate status and validation |
| 502/503 errors | Check backend health and logs |

For detailed troubleshooting, see [DEPLOYMENT.md](./DEPLOYMENT.md).
