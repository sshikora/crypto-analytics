# Deployment Guide - Crypto Analytics on AWS EKS

This guide covers deploying the Crypto Analytics application to AWS using EKS (Elastic Kubernetes Service) and OpenTofu/Terraform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Route 53                                 │
│              cryptoquantlab.com                              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Application Load Balancer                       │
│                (HTTPS/SSL)                                   │
└─────┬──────────────────────────────────────────┬───────────┘
      │                                          │
      │ www/root                                 │ api
      │                                          │
┌─────▼─────────────┐                   ┌───────▼───────────┐
│    Frontend       │                   │     Backend       │
│  (React/Nginx)    │                   │  (Express/Node)   │
│   Port 8080       │                   │    Port 4000      │
│                   │                   │                   │
│  - 2-10 pods      │                   │  - 2-10 pods      │
│  - Auto-scaling   │                   │  - Auto-scaling   │
└───────────────────┘                   └───────────────────┘
         │                                       │
         └───────────────┬───────────────────────┘
                         │
                ┌────────▼─────────┐
                │   EKS Cluster    │
                │   Multi-AZ       │
                │   t3.medium      │
                └──────────────────┘
```

## Prerequisites

### Required Tools

1. **AWS CLI** (v2.x or higher)
   ```bash
   aws --version
   ```

2. **kubectl** (v1.28 or higher)
   ```bash
   kubectl version --client
   ```

3. **OpenTofu or Terraform** (v1.6+ or v1.5+)
   ```bash
   tofu version
   # or
   terraform version
   ```

4. **Docker** (for building images)
   ```bash
   docker --version
   ```

5. **Git**
   ```bash
   git --version
   ```

### AWS Requirements

- AWS Account with appropriate permissions
- AWS credentials configured (`aws configure`)
- Domain registered (cryptoquantlab.com) or transferred to Route 53
- Minimum permissions required:
  - EC2 (VPC, Subnets, Security Groups)
  - EKS (Cluster, Node Groups)
  - ECR (Repository management)
  - Route 53 (Hosted Zones, Records)
  - ACM (Certificate Manager)
  - IAM (Roles, Policies)
  - S3 (Terraform state)
  - DynamoDB (Terraform locks)

## Step 1: Prepare AWS Account

### 1.1 Create S3 Bucket for Terraform State

```bash
# Set your AWS region
export AWS_REGION=us-east-1

# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket crypto-analytics-terraform-state \
  --region $AWS_REGION

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket crypto-analytics-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket crypto-analytics-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### 1.2 Create DynamoDB Table for State Locking

```bash
aws dynamodb create-table \
  --table-name crypto-analytics-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region $AWS_REGION
```

## Step 2: Configure Domain (Route 53)

If your domain is not yet in Route 53:

```bash
# Transfer domain to Route 53 or update nameservers
# This will be done automatically by Terraform, but you need to update
# your domain registrar's nameservers after applying Terraform
```

## Step 3: Deploy Infrastructure with OpenTofu/Terraform

### 3.1 Initialize Terraform

```bash
cd infrastructure/terraform/environments/production

# Initialize Terraform
terraform init
```

### 3.2 Review and Plan

```bash
# Review the plan
terraform plan

# Save the plan
terraform plan -out=tfplan
```

### 3.3 Apply Infrastructure

```bash
# Apply the infrastructure
terraform apply tfplan

# Or apply without saving plan
terraform apply

# This will create:
# - VPC with public/private subnets across 3 AZs
# - NAT Gateways for private subnet internet access
# - EKS Cluster (v1.28)
# - EKS Node Groups (t3.medium, 2-4 nodes)
# - Route 53 hosted zone
# - ACM certificate (with DNS validation)
# - IAM roles and policies
# - Security groups
# - AWS Load Balancer Controller
# - External DNS
# - Cert Manager
```

**Note:** The initial apply will take 15-20 minutes to create the EKS cluster.

### 3.4 Update Domain Nameservers

After Terraform completes, get the Route 53 nameservers:

```bash
terraform output route53_name_servers
```

Update your domain registrar to use these nameservers. This is required for:
- SSL certificate validation
- DNS routing to work
- External DNS to function

### 3.5 Configure kubectl

```bash
# Get the kubectl config command from Terraform output
terraform output configure_kubectl

# Or run directly
aws eks update-kubeconfig \
  --region us-east-1 \
  --name crypto-analytics-production

# Verify connection
kubectl get nodes
```

## Step 4: Deploy Application

### Option A: Using the Deployment Script (Recommended)

```bash
cd infrastructure/scripts

# Make script executable (if not already)
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

The script will:
1. Create ECR repositories
2. Build Docker images for backend and frontend
3. Push images to ECR
4. Deploy Kubernetes manifests
5. Configure ingress with SSL
6. Wait for deployments to be ready

### Option B: Manual Deployment

#### 4.1 Create ECR Repositories

```bash
# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create backend repository
aws ecr create-repository \
  --repository-name crypto-analytics-backend \
  --region $AWS_REGION

# Create frontend repository
aws ecr create-repository \
  --repository-name crypto-analytics-frontend \
  --region $AWS_REGION
```

#### 4.2 Build and Push Docker Images

```bash
# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push backend
cd backend
docker build -t crypto-analytics-backend:latest .
docker tag crypto-analytics-backend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/crypto-analytics-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/crypto-analytics-backend:latest

# Build and push frontend
cd ../frontend

# Create production environment file
cat > .env.production << EOF
VITE_GRAPHQL_URL=https://api.cryptoquantlab.com/graphql
EOF

docker build -t crypto-analytics-frontend:latest .
docker tag crypto-analytics-frontend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/crypto-analytics-frontend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/crypto-analytics-frontend:latest
```

#### 4.3 Deploy Kubernetes Resources

```bash
cd infrastructure/kubernetes

# Create namespace
kubectl apply -f namespace.yaml

# Get certificate ARN
CERTIFICATE_ARN=$(aws acm list-certificates --region $AWS_REGION \
  --query "CertificatesSummaryList[?DomainName=='cryptoquantlab.com'].CertificateArn | [0]" \
  --output text)

# Get security group ID
SECURITY_GROUP_ID=$(aws eks describe-cluster \
  --name crypto-analytics-production \
  --region $AWS_REGION \
  --query "cluster.resourcesVpcConfig.clusterSecurityGroupId" \
  --output text)

# Deploy backend
envsubst < backend-deployment.yaml | kubectl apply -f -

# Deploy frontend
envsubst < frontend-deployment.yaml | kubectl apply -f -

# Deploy ingress
export CERTIFICATE_ARN
export SECURITY_GROUP_ID
envsubst < ingress.yaml | kubectl apply -f -
```

## Step 5: Verify Deployment

### 5.1 Check Pods

```bash
kubectl get pods -n crypto-analytics

# Expected output:
# NAME                        READY   STATUS    RESTARTS   AGE
# backend-xxxxx-xxxxx         1/1     Running   0          2m
# backend-xxxxx-xxxxx         1/1     Running   0          2m
# frontend-xxxxx-xxxxx        1/1     Running   0          2m
# frontend-xxxxx-xxxxx        1/1     Running   0          2m
```

### 5.2 Check Services

```bash
kubectl get svc -n crypto-analytics

# Expected output:
# NAME       TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
# backend    ClusterIP   10.100.xxx.xxx   <none>        4000/TCP   2m
# frontend   ClusterIP   10.100.xxx.xxx   <none>        80/TCP     2m
```

### 5.3 Check Ingress

```bash
kubectl get ingress -n crypto-analytics

# Get ALB URL
kubectl get ingress crypto-analytics -n crypto-analytics \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### 5.4 Check Logs

```bash
# Backend logs
kubectl logs -f deployment/backend -n crypto-analytics

# Frontend logs
kubectl logs -f deployment/frontend -n crypto-analytics
```

## Step 6: Access the Application

Once External DNS has propagated (5-10 minutes), access the application at:

- **Frontend**: https://cryptoquantlab.com or https://www.cryptoquantlab.com
- **API**: https://api.cryptoquantlab.com/graphql
- **Health Check**: https://api.cryptoquantlab.com/health

If External DNS hasn't propagated yet, you can test via the ALB URL directly.

## Monitoring and Maintenance

### View Application Metrics

```bash
# CPU and Memory usage
kubectl top pods -n crypto-analytics

# HPA status
kubectl get hpa -n crypto-analytics
```

### Scale Manually

```bash
# Scale backend
kubectl scale deployment backend -n crypto-analytics --replicas=5

# Scale frontend
kubectl scale deployment frontend -n crypto-analytics --replicas=5
```

### Update Application

```bash
# Build new images with updated code
cd backend
docker build -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/crypto-analytics-backend:v2 .
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/crypto-analytics-backend:v2

# Update deployment
kubectl set image deployment/backend \
  backend=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/crypto-analytics-backend:v2 \
  -n crypto-analytics

# Check rollout status
kubectl rollout status deployment/backend -n crypto-analytics
```

### Rollback Deployment

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n crypto-analytics

# Rollback to specific revision
kubectl rollout undo deployment/backend -n crypto-analytics --to-revision=2
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see events
kubectl describe pod <pod-name> -n crypto-analytics

# Check for image pull errors
kubectl get events -n crypto-analytics --sort-by='.lastTimestamp'
```

### Ingress Not Working

```bash
# Check ingress configuration
kubectl describe ingress crypto-analytics -n crypto-analytics

# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller

# Check security groups allow traffic
```

### DNS Not Resolving

```bash
# Check External DNS logs
kubectl logs -n kube-system deployment/external-dns

# Verify Route 53 records were created
aws route53 list-resource-record-sets \
  --hosted-zone-id $(terraform output -raw route53_zone_id)
```

### Certificate Issues

```bash
# Check certificate status
aws acm describe-certificate --certificate-arn $CERTIFICATE_ARN

# Verify DNS validation records exist
aws route53 list-resource-record-sets \
  --hosted-zone-id $(terraform output -raw route53_zone_id) \
  --query "ResourceRecordSets[?Type=='CNAME']"
```

## Cost Optimization

### Current Setup Costs (Approximate)

- **EKS Cluster**: ~$73/month
- **EC2 Nodes** (2x t3.medium): ~$60/month
- **NAT Gateways** (3x): ~$97/month
- **Application Load Balancer**: ~$22/month
- **Route 53**: ~$1/month
- **Data Transfer**: Variable

**Total**: ~$250-300/month

### Cost Reduction Options

1. **Use single NAT Gateway** instead of 3 (saves ~$65/month)
   - Edit `infrastructure/terraform/environments/production/main.tf`
   - Reduce NAT gateways to 1

2. **Use Fargate** instead of EC2 nodes
   - Pay only for pods running
   - No minimum cluster cost

3. **Use spot instances** for node groups
   - Edit node_groups in `variables.tf`
   - Change `capacity_type` to `SPOT`
   - Saves ~60-90%

## Cleanup

To destroy all infrastructure:

```bash
# Delete Kubernetes resources first
kubectl delete namespace crypto-analytics

# Wait for load balancers to be deleted (5 minutes)
sleep 300

# Destroy Terraform infrastructure
cd infrastructure/terraform/environments/production
terraform destroy

# Delete ECR repositories
aws ecr delete-repository --repository-name crypto-analytics-backend --force
aws ecr delete-repository --repository-name crypto-analytics-frontend --force

# Delete S3 bucket (if needed)
aws s3 rb s3://crypto-analytics-terraform-state --force

# Delete DynamoDB table
aws dynamodb delete-table --table-name crypto-analytics-terraform-locks
```

## Security Best Practices

1. **Enable AWS WAF** on the ALB for DDoS protection
2. **Use AWS Secrets Manager** for sensitive environment variables
3. **Enable VPC Flow Logs** for network monitoring
4. **Set up CloudWatch alarms** for unusual activity
5. **Enable EKS audit logging**
6. **Implement pod security policies**
7. **Use network policies** to restrict pod-to-pod communication
8. **Regularly update** node AMIs and Kubernetes versions

## Support

For issues or questions:
- Review CloudWatch logs
- Check EKS cluster events
- Review Application Load Balancer access logs
- Consult AWS EKS documentation
