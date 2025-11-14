# Cost Optimization Guide

This guide explains how to reduce AWS costs for the Crypto Analytics platform, especially during the early stages when traffic is low.

## Cost Comparison

| Configuration | Monthly Cost | Savings | Trade-offs |
|--------------|-------------|---------|------------|
| **Standard (High Availability)** | ~$250-300 | Baseline | Best reliability, 3 AZs, on-demand |
| **Cost-Optimized** | ~$90-120 | 60-70% | Good reliability, 2 AZs, spot instances |
| **Ultra-Low Cost** | ~$75-90 | 70-75% | Basic reliability, 2 AZs, smaller instances |

## Cost Breakdown

### Standard Configuration (~$250-300/month)

| Resource | Monthly Cost | Details |
|----------|-------------|----------|
| EKS Cluster | $73 | Fixed cost |
| EC2 Nodes (2x t3.medium) | $60 | On-demand pricing |
| NAT Gateways (3x) | $97 | $32/each across 3 AZs |
| Application Load Balancer | $22 | ~$0.0225/hour + LCU costs |
| Route 53 Hosted Zone | $0.50 | Per zone |
| Data Transfer | $5-20 | Variable based on traffic |
| **Total** | **~$257-277** | |

### Cost-Optimized Configuration (~$90-120/month)

| Resource | Monthly Cost | Savings | Details |
|----------|-------------|---------|----------|
| EKS Cluster | $73 | $0 | Fixed cost |
| EC2 Nodes (2x t3.small SPOT) | $6-12 | ~$48 | 70% cheaper with spot |
| NAT Gateway (1x) | $32 | ~$65 | Single NAT instead of 3 |
| Application Load Balancer | $22 | $0 | Same |
| Route 53 Hosted Zone | $0.50 | $0 | Same |
| Data Transfer | $5-10 | $5-10 | Lower due to less traffic |
| **Total** | **~$138-150** | **~$120** | **48% savings** |

## Optimization Strategies

### 1. Use Single NAT Gateway (Saves ~$65/month)

**What it does:** Uses one NAT gateway instead of one per availability zone.

**Trade-off:** If the NAT gateway's AZ goes down, instances in other AZs lose internet access temporarily.

**Implementation:**

```bash
cd infrastructure/terraform/environments/production

# Use the cost-optimized configuration
tofu apply -var-file=terraform.tfvars.cost-optimized
```

Or set the variable:

```hcl
# In terraform.tfvars
single_nat_gateway = true
availability_zones = ["us-east-1a", "us-east-1b"]  # Use 2 AZs instead of 3
```

**Recommendation:** ✅ **Do this for low-traffic applications**. The risk is minimal, and AWS availability zones rarely go down.

### 2. Use Spot Instances (Saves 60-90%)

**What it does:** Uses spare EC2 capacity at discounted rates.

**Trade-off:** AWS can reclaim spot instances with 2-minute warning. Kubernetes handles this gracefully with pod rescheduling.

**Implementation:**

```hcl
# In terraform.tfvars or terraform.tfvars.cost-optimized
node_groups = {
  spot-general = {
    desired_size   = 2
    min_size       = 2
    max_size       = 3
    instance_types = ["t3.small", "t3a.small"]  # Multiple types for better availability
    capacity_type  = "SPOT"
  }
}
```

**Recommendation:** ✅ **Highly recommended for stateless applications like this one**. Your app is designed to handle node failures.

### 3. Use Smaller Instance Types (Saves ~$30/month)

**What it does:** Uses t3.small (2 vCPU, 2GB RAM) instead of t3.medium (2 vCPU, 4GB RAM).

**Trade-off:** Less memory per node, but should be sufficient for your workload.

**Implementation:**

```hcl
node_groups = {
  general = {
    desired_size   = 2
    min_size       = 2
    max_size       = 4
    instance_types = ["t3.small"]  # Changed from t3.medium
    capacity_type  = "ON_DEMAND"
  }
}
```

**Recommendation:** ✅ **Good for low traffic**. Monitor memory usage and scale up if needed.

### 4. Reduce Number of Availability Zones (Saves ~$32/month)

**What it does:** Deploy to 2 AZs instead of 3.

**Trade-off:** Slightly less redundancy, but still highly available.

**Implementation:**

```hcl
availability_zones = ["us-east-1a", "us-east-1b"]
private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
public_subnets = ["10.0.101.0/24", "10.0.102.0/24"]
```

**Recommendation:** ✅ **Recommended for cost savings**. 2 AZs is still production-grade.

### 5. Use Fargate (Pay-per-use)

**What it does:** Serverless containers - pay only for pod runtime, no EC2 instances.

**Trade-off:** Slightly more expensive per pod-hour, but no minimum costs when traffic is low.

**Cost Example:**
- 2 backend pods (256MB, 0.25 vCPU): ~$7/month
- 2 frontend pods (256MB, 0.25 vCPU): ~$7/month
- EKS Cluster: $73/month
- **Total: ~$87/month + ALB + NAT**

**Implementation:**

```hcl
# Create Fargate profile
resource "aws_eks_fargate_profile" "apps" {
  cluster_name           = aws_eks_cluster.main.name
  fargate_profile_name   = "apps"
  pod_execution_role_arn = aws_iam_role.fargate.arn

  subnet_ids = var.private_subnet_ids

  selector {
    namespace = "crypto-analytics"
  }
}
```

**Recommendation:** ⚠️ **Consider for very low traffic** (< 1000 requests/day). Not cost-effective at higher traffic.

### 6. Optimize Pod Resources

**What it does:** Reduces pod resource requests/limits.

**Implementation:**

```yaml
# In backend-deployment.yaml
resources:
  requests:
    memory: "128Mi"  # Reduced from 256Mi
    cpu: "100m"      # Reduced from 250m
  limits:
    memory: "256Mi"  # Reduced from 512Mi
    cpu: "250m"      # Reduced from 500m
```

**Recommendation:** ✅ **Do this**. Start small and scale up if needed.

## Recommended Cost-Optimized Setup

For **low to medium traffic** (< 10,000 requests/day):

```bash
# Use the provided cost-optimized configuration
cd infrastructure/terraform/environments/production
tofu apply -var-file=terraform.tfvars.cost-optimized
```

This configuration includes:
- ✅ Single NAT gateway
- ✅ 2 availability zones (instead of 3)
- ✅ Spot instances (t3.small)
- ✅ Smaller pod resources

**Expected Cost: ~$90-120/month** (vs $250-300/month standard)

## Scaling Up When Traffic Grows

When you reach **10,000+ requests/day**, consider:

1. **Add more node capacity:**
   ```hcl
   desired_size = 3
   max_size = 6
   ```

2. **Upgrade to on-demand instances:**
   ```hcl
   capacity_type = "ON_DEMAND"
   ```

3. **Add more NAT gateways for HA:**
   ```hcl
   single_nat_gateway = false
   availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
   ```

4. **Use larger instance types:**
   ```hcl
   instance_types = ["t3.medium"]
   ```

## Monitoring Costs

### AWS Cost Explorer

1. Go to AWS Console → Cost Explorer
2. Set filters:
   - Service: EKS, EC2, VPC, Route 53
   - Tags: Project=crypto-analytics
3. View daily/monthly trends

### Set Up Billing Alerts

```bash
# Create billing alarm for $150/month
aws cloudwatch put-metric-alarm \
  --alarm-name crypto-analytics-cost-alert \
  --alarm-description "Alert when costs exceed $150" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 150 \
  --comparison-operator GreaterThanThreshold
```

### Use AWS Budgets

1. Go to AWS Budgets
2. Create budget: $150/month
3. Set alerts at 80%, 100%, 120%

## Additional Cost-Saving Tips

### 1. Reserve Capacity (Long-term)

If running for 1+ years:
- **Savings Plans**: 30-50% discount on compute
- **Reserved Instances**: Similar savings for EC2

### 2. Use CloudFront (Optional)

Add CloudFront CDN in front:
- Reduces backend load
- Reduces data transfer costs
- Improves performance
- Free tier: 1TB data transfer/month

### 3. Optimize Images

- Use multi-stage Docker builds (already implemented)
- Compress Docker layers
- Use Alpine Linux base images (already implemented)

### 4. Auto-scaling Policies

Configure aggressive scale-down:

```yaml
# In HPA
minReplicas: 1  # Scale to 1 pod during low traffic
maxReplicas: 10
behavior:
  scaleDown:
    stabilizationWindowSeconds: 60  # Scale down quickly
```

### 5. Schedule Downtime (Dev/Test)

For non-production environments:
- Shut down nodes at night
- Use Lambda to stop/start cluster
- Saves ~40% on dev/test environments

## Cost Optimization Checklist

- [ ] Enable single NAT gateway
- [ ] Use spot instances for node groups
- [ ] Reduce to 2 availability zones
- [ ] Use smaller instance types (t3.small)
- [ ] Optimize pod resource requests
- [ ] Set up billing alerts
- [ ] Monitor Cost Explorer weekly
- [ ] Right-size pods based on metrics
- [ ] Consider Fargate for very low traffic
- [ ] Plan for Reserved Instances after 3 months

## When to Scale Up

Scale up when you experience:

- **High traffic**: > 10,000 requests/day
- **Memory pressure**: Pods getting OOMKilled
- **CPU throttling**: Application slowness
- **Spot interruptions**: Frequent (> 5% of instances/week)
- **Revenue justifies costs**: Application is profitable

## Emergency Cost Reduction

If you need to cut costs immediately:

1. **Scale to minimum:**
   ```bash
   kubectl scale deployment backend -n crypto-analytics --replicas=1
   kubectl scale deployment frontend -n crypto-analytics --replicas=1
   ```

2. **Use smaller nodes:**
   ```bash
   # Update terraform.tfvars
   instance_types = ["t3.micro"]  # Smallest possible
   ```

3. **Temporary shutdown:**
   ```bash
   tofu destroy  # Nuclear option
   ```

## Conclusion

**Recommended starting point:**
- Use cost-optimized configuration: **~$90-120/month**
- Monitor for 1 month
- Scale up as traffic grows
- Switch to savings plans after 3 months of stable usage

**This gives you 60-70% cost savings while maintaining good reliability for a new application.**
