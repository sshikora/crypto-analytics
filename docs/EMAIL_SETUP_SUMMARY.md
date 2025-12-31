# Email Setup Summary

## Quick Answer: How Secrets Are Managed

✅ **All secrets are now managed via GitHub Secrets**, including:
- `GOOGLE_DKIM_VALUE` - Google Workspace DKIM key
- `AWS_ACCESS_KEY_ID` - AWS credentials (existing)
- `AWS_SECRET_ACCESS_KEY` - AWS credentials (existing)
- `VITE_API_KEY` - API key (existing)
- `VITE_COGNITO_USER_POOL_ID` - Cognito pool (existing)
- `VITE_COGNITO_CLIENT_ID` - Cognito client (existing)

## How It Works

### For Application Deployment (existing - deploy.yml)
```
GitHub Secrets → GitHub Actions → Docker build → Kubernetes Secrets
```

### For Infrastructure Deployment (new - terraform.yml)
```
GitHub Secrets → GitHub Actions → Terraform → AWS Resources
```

## Files Created/Modified

### New Files
- ✅ `infrastructure/terraform/modules/email/` - Complete email infrastructure module
- ✅ `backend/src/services/emailService.ts` - Email sending service (SES)
- ✅ `.github/workflows/terraform.yml` - Automated Terraform deployments
- ✅ `docs/EMAIL_SETUP.md` - Complete setup guide
- ✅ `docs/EMAIL_SETUP_SUMMARY.md` - This file

### Modified Files
- ✅ `infrastructure/terraform/environments/production/main.tf` - Added email module
- ✅ `infrastructure/terraform/environments/production/variables.tf` - Added google_dkim_value (sensitive)
- ✅ `infrastructure/kubernetes/backend-deployment.yaml` - Added email env vars
- ✅ `backend/package.json` - Added @aws-sdk/client-ses
- ✅ `frontend/src/components/Header.tsx` - Fixed "Crypto Quant Lab" typo

## Next Steps

### 1. Add Google DKIM to GitHub Secrets (after Google Workspace signup)

```bash
# Option 1: GitHub Web UI
# Go to: Settings → Secrets → Actions → New secret
# Name: GOOGLE_DKIM_VALUE
# Value: [paste from Google Workspace]

# Option 2: GitHub CLI
gh secret set GOOGLE_DKIM_VALUE --body "v=DKIM1; k=rsa; p=YOUR_KEY_HERE"
```

### 2. Deploy Infrastructure

**Via GitHub Actions (Recommended)**:
1. Push code: `git push origin master`
2. Go to Actions tab
3. Run "Terraform Infrastructure Deployment"
4. Select: plan → review → apply

**Via Local Terraform**:
```bash
cd infrastructure/terraform/environments/production
export TF_VAR_google_dkim_value="v=DKIM1; k=rsa; p=YOUR_KEY_HERE"
tofu apply
```

### 3. Deploy Application (automatically triggers on push)

GitHub Actions will:
1. Build Docker images with new email service
2. Push to ECR
3. Deploy to Kubernetes
4. Backend pods get SES permissions via IAM role

## Cost

| Service | Monthly Cost | Purpose |
|---------|-------------|---------|
| Google Workspace | $6 | Inbox (support@cryptoquantlab.com) |
| AWS SES | ~$1 | Sending emails (150k/month) |
| **Total** | **$7** | Complete email solution |

## Security

✅ **No secrets in code repository**
- All secrets in GitHub Secrets (encrypted)
- Terraform variable marked as `sensitive = true`
- IAM roles used instead of hardcoded credentials

✅ **Proper email authentication**
- SPF record authorizes both Google and SES
- DKIM configured for both services
- Reduces spam/phishing risk

## Usage Examples

### Send Password Reset Email

```typescript
import { emailService } from './services/emailService';

await emailService.sendPasswordResetEmail(
  user.email,
  resetToken
);
```

### Send Welcome Email

```typescript
await emailService.sendWelcomeEmail(
  user.email,
  user.name
);
```

### Send Custom Email

```typescript
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Your Subject',
  htmlBody: '<p>HTML content</p>',
  textBody: 'Plain text content',
});
```

## Deployment Flow

### First Time Setup
1. Sign up for Google Workspace manually
2. Get Google DKIM value
3. Add `GOOGLE_DKIM_VALUE` to GitHub Secrets
4. Run Terraform (via GitHub Actions or locally)
5. Verify SES domain
6. Push code to deploy backend with email service

### Ongoing Deployments
- Application changes: Automatic via `deploy.yml` on push
- Infrastructure changes: Manual via `terraform.yml` workflow
- DNS records: Managed by Terraform, no manual Route53 changes

## What Gets Deployed

### AWS Resources (via Terraform)
- ✅ SES domain identity for cryptoquantlab.com
- ✅ SES DKIM records (3 CNAMEs)
- ✅ SES email identity for noreply@cryptoquantlab.com
- ✅ Google Workspace MX records (5 MX records)
- ✅ Google Workspace DKIM record (1 TXT)
- ✅ Combined SPF record (1 TXT)
- ✅ IAM policy for EKS pods to send email

### Kubernetes Resources (via GitHub Actions)
- ✅ Backend deployment with email service
- ✅ Environment variables (DOMAIN_NAME, EMAIL_FROM_NAME)
- ✅ IAM role permissions for SES

## Troubleshooting

### "GOOGLE_DKIM_VALUE not found"
- Add the secret to GitHub: Settings → Secrets → Actions
- For local runs: `export TF_VAR_google_dkim_value="..."`

### "Email not sending"
- Check SES verification: `aws ses get-identity-verification-attributes --identities cryptoquantlab.com`
- Check backend logs: `kubectl logs -n crypto-analytics -l app=backend`
- Verify IAM permissions on EKS node role

### "Email not receiving"
- Check MX records: `dig MX cryptoquantlab.com`
- Verify Google Workspace domain
- Wait for DNS propagation (up to 48 hours)

## Documentation

For detailed setup instructions, see: `docs/EMAIL_SETUP.md`
