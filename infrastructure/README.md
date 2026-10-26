# Infrastructure

Everything CryptoQuantLab runs on in AWS (`us-east-1`) is defined in OpenTofu under [`terraform/`](terraform/): one environment, `production`, built from the modules below. The top-level [README](../README.md) has the architecture diagram.

## Modules

| Module | What it creates |
|---|---|
| `vpc` | VPC with public subnets in two availability zones and an internet gateway. There's no NAT gateway: tasks get public IPs and accept no inbound traffic except from the load balancer |
| `route53` | The `cryptoquantlab.com` hosted zone and the ACM certificate with its validation records |
| `frontend_cdn` | Private S3 bucket and CloudFront distribution for the React app, using origin access control |
| `backend_service` | ECR repository, ECS cluster, Fargate service for the GraphQL API, the load balancer that accepts only CloudFront traffic (checked by a secret origin header), SSM parameters for secrets, and the API's task role |
| `api_cdn` | CloudFront distribution and AWS WAF web ACL in front of the API at `api.cryptoquantlab.com` |
| `cognito` | User pool and web client; DynamoDB tables for preferences, notification rules and notifications; the policy letting the API look up a user's email |
| `email` | SES domain identity with DKIM, Google Workspace MX and DKIM records, and the policy allowing the API to send from `noreply@` and `support@` |
| `data` | DynamoDB `price-history` (deletion protection and point-in-time recovery, since rows older than a year can't be re-fetched) and `coin-metrics` (recomputable), each with read and write policies |
| `scheduled_jobs` | One Fargate task definition and EventBridge Scheduler schedule per job, a shared task role and log group, and missed-run and failed-run alarms per job |
| `monitoring` | SNS alerts topic, Route 53 health checks, and alarms for site and API health, 5xx errors, CPU, memory and the crossover checker |
| `github_oidc` | Two roles that trust the account's GitHub Actions OIDC provider: `github-deploy` for the deploy workflow and `github-terraform` for the infrastructure workflow |

## State

State is in S3 (`crypto-analytics-opentofu-state`, key `production/opentofu.tfstate`), locked by the DynamoDB table `crypto-analytics-opentofu-locks`. OpenTofu 1.10.7 is used, with the AWS provider `~> 5.0`.

## Making a change

Plan to a file, review the plan, then apply exactly that file:

```bash
cd infrastructure/terraform/environments/production
tofu init

# The DKIM value is a sensitive variable kept out of the repository. Read it from the live record,
# or the plan will delete the record and break Google Workspace mail signing.
export TF_VAR_google_dkim_value="$(aws route53 list-resource-record-sets \
  --hosted-zone-id "$(aws route53 list-hosted-zones-by-name --dns-name cryptoquantlab.com --query 'HostedZones[0].Id' --output text)" \
  --query "ResourceRecordSets[?Type=='TXT' && starts_with(Name,'google._domainkey')].ResourceRecords[0].Value" \
  --output text | sed -E 's/" "//g; s/^"//; s/"$//')"

tofu plan -var-file=terraform.tfvars.cost-optimized -out=change.tfplan
tofu apply change.tfplan
```

Plan files are gitignored because they can contain secrets. Delete them after applying.

The **Terraform Infrastructure Deployment** workflow runs the same plan or apply from GitHub Actions on manual dispatch. It uses the `github-terraform` role, and the `production` environment requires a reviewer's approval.

### Things to know before changing something

- **The API's task definition** is registered by Terraform, but the deploy workflow registers a new revision for each image and the service ignores Terraform's revision. Environment variable changes take effect on the next deploy.
- **Task-role policy lists** (`task_role_policy_arns`) are attached by index. Append new policies at the end; inserting one in the middle detaches and reattaches the ones after it, briefly removing their permissions.
- **Ordering:** when code needs new permissions or a new table, apply first, then merge. Merging to `master` deploys.
- **Scheduled jobs** are a map in `environments/production/main.tf`. Each entry needs a `schedule`, `command`, `max_silence_hours` and an `about` sentence for its alarm emails. CloudWatch limits alarm descriptions to 1,024 characters, and a plan fails if one is longer. Each job's failed-run alarm description includes the `aws ecs run-task` command to run it by hand.
- **A new job's missed-run alarm** fires falsely on its first day, before any run has been counted, and clears itself after the first successful run.

## Kept outside OpenTofu

- **SNS email subscriptions** for the alerts topic, so no addresses are in the repository.
- **The secret values in SSM.** Terraform creates the parameters; the deploy workflow writes the CoinGecko key from a GitHub secret.
- **The account-wide `BillingAlarm` and the `crypto-analytics-monthly` budget,** which cover other projects in the account too.

## Email

SES has production access. Cognito sends sign-up and password emails through SES (`email_sending_account = "DEVELOPER"`) from `noreply@cryptoquantlab.com`, and the API sends alert emails from the same address.

## Deployments

`.github/workflows/deploy.yml` runs on every push to `master`, one run at a time:
1. Runs the tests.
2. Builds the backend image and pushes it to ECR, tagged with the commit SHA and `latest`. Scheduled jobs run `latest`.
3. Builds the frontend, syncs it to S3, and invalidates CloudFront.
4. Writes secrets to SSM.
5. Registers a new task definition revision with the image, updates the ECS service and waits for it to be stable. A deployment that never becomes healthy rolls back.
