#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CLUSTER_NAME="crypto-analytics-production"
ECR_BACKEND_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/crypto-analytics-backend"
ECR_FRONTEND_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/crypto-analytics-frontend"

echo -e "${GREEN}=== Crypto Analytics Deployment Script ===${NC}"
echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo "Cluster Name: $CLUSTER_NAME"
echo ""

# Function to print section headers
print_section() {
    echo -e "\n${YELLOW}>>> $1${NC}"
}

# Check prerequisites
print_section "Checking prerequisites"
command -v aws >/dev/null 2>&1 || { echo -e "${RED}AWS CLI is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}kubectl is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required but not installed. Aborting.${NC}" >&2; exit 1; }

echo -e "${GREEN}✓ All prerequisites installed${NC}"

# Create ECR repositories if they don't exist
print_section "Setting up ECR repositories"

aws ecr describe-repositories --repository-names crypto-analytics-backend --region $AWS_REGION >/dev/null 2>&1 || \
    aws ecr create-repository --repository-name crypto-analytics-backend --region $AWS_REGION

aws ecr describe-repositories --repository-names crypto-analytics-frontend --region $AWS_REGION >/dev/null 2>&1 || \
    aws ecr create-repository --repository-name crypto-analytics-frontend --region $AWS_REGION

echo -e "${GREEN}✓ ECR repositories ready${NC}"

# Login to ECR
print_section "Logging into ECR"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
echo -e "${GREEN}✓ ECR login successful${NC}"

# Build and push backend
print_section "Building and pushing backend image"
cd ../../backend
docker build -t crypto-analytics-backend:latest .
docker tag crypto-analytics-backend:latest $ECR_BACKEND_REPO:latest
docker tag crypto-analytics-backend:latest $ECR_BACKEND_REPO:$(git rev-parse --short HEAD)
docker push $ECR_BACKEND_REPO:latest
docker push $ECR_BACKEND_REPO:$(git rev-parse --short HEAD)
echo -e "${GREEN}✓ Backend image pushed${NC}"

# Build and push frontend
print_section "Building and pushing frontend image"
cd ../frontend

# Create production .env file
cat > .env.production << EOF
VITE_GRAPHQL_URL=https://api.cryptoquantlab.com/graphql
EOF

docker build -t crypto-analytics-frontend:latest .
docker tag crypto-analytics-frontend:latest $ECR_FRONTEND_REPO:latest
docker tag crypto-analytics-frontend:latest $ECR_FRONTEND_REPO:$(git rev-parse --short HEAD)
docker push $ECR_FRONTEND_REPO:latest
docker push $ECR_FRONTEND_REPO:$(git rev-parse --short HEAD)
echo -e "${GREEN}✓ Frontend image pushed${NC}"

# Configure kubectl
print_section "Configuring kubectl"
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME
echo -e "${GREEN}✓ kubectl configured${NC}"

# Get certificate ARN
print_section "Getting ACM certificate ARN"
CERTIFICATE_ARN=$(aws acm list-certificates --region $AWS_REGION \
    --query "CertificatesSummaryList[?DomainName=='cryptoquantlab.com'].CertificateArn | [0]" \
    --output text)

if [ -z "$CERTIFICATE_ARN" ]; then
    echo -e "${RED}Certificate not found for cryptoquantlab.com${NC}"
    echo "Please ensure the ACM certificate is created and validated"
    exit 1
fi

echo "Certificate ARN: $CERTIFICATE_ARN"

# Get security group ID
print_section "Getting cluster security group ID"
SECURITY_GROUP_ID=$(aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION \
    --query "cluster.resourcesVpcConfig.clusterSecurityGroupId" --output text)

echo "Security Group ID: $SECURITY_GROUP_ID"

# Deploy Kubernetes resources
print_section "Deploying Kubernetes resources"
cd ../infrastructure/kubernetes

# Create namespace
kubectl apply -f namespace.yaml

# Process and apply backend deployment
envsubst < backend-deployment.yaml | kubectl apply -f -

# Process and apply frontend deployment
envsubst < frontend-deployment.yaml | kubectl apply -f -

# Process and apply ingress
export CERTIFICATE_ARN
export SECURITY_GROUP_ID
envsubst < ingress.yaml | kubectl apply -f -

echo -e "${GREEN}✓ Kubernetes resources deployed${NC}"

# Wait for deployments
print_section "Waiting for deployments to be ready"
kubectl rollout status deployment/backend -n crypto-analytics --timeout=300s
kubectl rollout status deployment/frontend -n crypto-analytics --timeout=300s
echo -e "${GREEN}✓ All deployments ready${NC}"

# Get load balancer URL
print_section "Getting load balancer information"
sleep 10  # Wait for ingress to create ALB
ALB_URL=$(kubectl get ingress crypto-analytics -n crypto-analytics -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo ""
echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo ""
echo "Load Balancer URL: $ALB_URL"
echo ""
echo "Configure your DNS:"
echo "  - Create a CNAME record for cryptoquantlab.com pointing to: $ALB_URL"
echo "  - Create a CNAME record for www.cryptoquantlab.com pointing to: $ALB_URL"
echo "  - Create a CNAME record for api.cryptoquantlab.com pointing to: $ALB_URL"
echo ""
echo "Or if using Route53, the External DNS should automatically create the records."
echo ""
echo "Check deployment status:"
echo "  kubectl get pods -n crypto-analytics"
echo "  kubectl get svc -n crypto-analytics"
echo "  kubectl get ingress -n crypto-analytics"
echo ""
