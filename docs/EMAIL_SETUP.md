# Email Setup Guide

Complete guide for setting up email infrastructure for Crypto Quant Lab using:
- **Google Workspace** for receiving email (inbox: support@cryptoquantlab.com)
- **AWS SES** for sending transactional emails (password resets, notifications)

## Overview

### Architecture
```
┌──────────────────────┐
│  Google Workspace   │  ← Receiving email (support@cryptoquantlab.com)
│  ($6/month)         │
└──────────────────────┘
          ↓
    MX Records in Route53 (managed by Terraform)

┌──────────────────────┐
│     AWS SES         │  ← Sending email (password resets, notifications)
│  (~$1/month)        │
└──────────────────────┘
          ↓
    DKIM/SPF in Route53 (managed by Terraform)
          ↓
    Backend sends via SES (IAM role permissions)
```

### Cost
- **Google Workspace**: $6/month for support@cryptoquantlab.com inbox
- **AWS SES**: ~$0.88/month for 150,000 emails/month (5,000/day)
- **Total**: ~$7/month

### What Gets Automated
✅ All DNS records created via Terraform (infrastructure as code)
✅ Backend email service integrated with SES
✅ IAM permissions automatically configured
✅ Secrets managed via GitHub Secrets
✅ Deployments automated via GitHub Actions

## Step 1: Sign Up for Google Workspace

1. Go to https://workspace.google.com/
2. Click "Get Started"
3. Enter business details:
   - **Business name**: Crypto Quant Lab
   - **Number of employees**: Just you
   - **Region**: United States
4. Enter your domain: **cryptoquantlab.com**
   - Choose "Yes, I have one I can use"
5. Create admin account:
   - **Email**: support@cryptoquantlab.com
   - **Password**: [Create a strong password]
6. Choose **Business Starter** plan ($6/user/month)
7. Enter payment information

## Step 2: Get Google Workspace DKIM Key

After signing up, you need to get the DKIM authentication key:

1. Log into **Google Workspace Admin Console**: https://admin.google.com
2. Navigate to: **Apps → Google Workspace → Gmail**
3. Click **Authenticate email**
4. Click **Generate new record**
5. You'll see a DKIM TXT record that looks like:
   ```
   Host: google._domainkey
   Value: v=DKIM1; k=rsa; p=MIIBIjANBgkqhki....(very long key)
   ```

**IMPORTANT**: Copy the entire `Value` (starting with `v=DKIM1;`). You'll add this to GitHub Secrets in the next step.

**Note**: The MX records are already configured in Terraform, so you don't need to copy those.

## Step 3: Add Google DKIM to GitHub Secrets

Store the DKIM value as a GitHub Secret so it's available for automated deployments.

### Option A: GitHub Web Interface (Easiest)

1. Go to your repository: https://github.com/YOUR_USERNAME/crypto-analytics
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Enter:
   - **Name**: `GOOGLE_DKIM_VALUE`
   - **Value**: Paste the DKIM key from Step 2 (e.g., `v=DKIM1; k=rsa; p=MIIBIjAN...`)
5. Click **"Add secret"**

### Option B: GitHub CLI

```bash
gh secret set GOOGLE_DKIM_VALUE --body "v=DKIM1; k=rsa; p=YOUR_LONG_KEY_HERE"
```

✅ **Done!** The secret is now available to GitHub Actions for automated infrastructure deployments.

## Step 4: Deploy Email Infrastructure

Now deploy the infrastructure (DNS records, SES configuration, IAM permissions).

### Recommended: Deploy via GitHub Actions

This is the recommended approach as it:
- Uses GitHub Secrets automatically (no manual secret management)
- Creates an audit trail of infrastructure changes
- Works the same way in CI/CD and locally

**Steps:**

1. **Commit and push the email infrastructure code:**
   ```bash
   git add .
   git commit -m "Add email infrastructure with Google Workspace and AWS SES"
   git push origin master
   ```

2. **Run the Terraform workflow:**
   - Go to your repository on GitHub
   - Click **"Actions"** tab
   - Click **"Terraform Infrastructure Deployment"** workflow
   - Click **"Run workflow"** dropdown
   - Select:
     - **Environment**: `production`
     - **Action**: `plan` (to preview changes first)
   - Click **"Run workflow"** button

3. **Review the planned changes:**
   - Wait for the workflow to complete
   - Click on the workflow run to see details
   - Review what Terraform will create:
     - AWS SES domain identity
     - SES DKIM records (3 CNAME records)
     - Google MX records (5 records)
     - SPF record (TXT allowing both Google and SES)
     - Google DKIM record (TXT)
     - IAM policy for backend to send email via SES

4. **Apply the changes:**
   - Run the workflow again with **Action**: `apply`
   - This will create all the infrastructure

✅ **Infrastructure deployed!**

### Alternative: Deploy Locally

If you prefer to run Terraform from your local machine:

```bash
cd infrastructure/terraform/environments/production

# Initialize Terraform (if first time)
tofu init

# Set the Google DKIM value as environment variable
export TF_VAR_google_dkim_value="v=DKIM1; k=rsa; p=YOUR_LONG_KEY_HERE"

# Preview changes
tofu plan

# Apply changes
tofu apply
```

Type `yes` when prompted.

**Note**: The DKIM value is marked as `sensitive = true` in Terraform, so it won't appear in logs.

## Step 5: Verify DNS Records in Route53

Check that all records were created:

```bash
# Check MX records
aws route53 list-resource-record-sets \
  --hosted-zone-id $(aws route53 list-hosted-zones --query "HostedZones[?Name=='cryptoquantlab.com.'].Id" --output text | cut -d'/' -f3) \
  --query "ResourceRecordSets[?Type=='MX']"

# Check DKIM records (SES)
aws route53 list-resource-record-sets \
  --hosted-zone-id $(aws route53 list-hosted-zones --query "HostedZones[?Name=='cryptoquantlab.com.'].Id" --output text | cut -d'/' -f3) \
  --query "ResourceRecordSets[?Type=='CNAME' && contains(Name, '_domainkey')]"

# Check SPF record
aws route53 list-resource-record-sets \
  --hosted-zone-id $(aws route53 list-hosted-zones --query "HostedZones[?Name=='cryptoquantlab.com.'].Id" --output text | cut -d'/' -f3) \
  --query "ResourceRecordSets[?Type=='TXT' && Name=='cryptoquantlab.com.']"
```

## Step 6: Verify SES Domain

AWS SES requires domain verification before you can send email:

1. Check verification status:

```bash
aws ses get-identity-verification-attributes --identities cryptoquantlab.com
```

2. If not verified, wait a few minutes for DNS to propagate
3. Once verified, request production access (removes sending limits):

```bash
# Check current sending limits
aws ses get-send-quota

# Request production access via AWS Console
# Go to: https://console.aws.amazon.com/ses/ → Account Dashboard → Request Production Access
```

## Step 7: Verify Google Workspace

1. Go back to Google Workspace Admin Console
2. Click "Verify" under MX records
3. Google will check the DNS records (may take up to 48 hours for DNS propagation)
4. Once verified, you can start receiving email at support@cryptoquantlab.com

## Step 8: Test Email Sending

### 8a. Test SES Locally

Create a test script:

```typescript
// test-email.ts
import { emailService } from './src/services/emailService';

async function test() {
  await emailService.sendEmail({
    to: 'your-personal-email@gmail.com',  // Use your actual email
    subject: 'Test Email from Crypto Quant Lab',
    htmlBody: '<h1>Hello!</h1><p>This is a test email.</p>',
    textBody: 'Hello! This is a test email.',
  });
  console.log('Email sent successfully!');
}

test().catch(console.error);
```

Run it:

```bash
cd backend
npx tsx test-email.ts
```

### 8b. Test Google Workspace

Send an email to `support@cryptoquantlab.com` from your personal email and verify you receive it in Google Workspace.

## Step 9: Deploy Backend with Email Service

The backend email service will be automatically deployed via GitHub Actions.

### Automatic Deployment

When you pushed your code in Step 4, the `deploy.yml` workflow automatically:

1. ✅ Built the backend Docker image with the new email service
2. ✅ Pushed the image to ECR
3. ✅ Deployed to Kubernetes (EKS)
4. ✅ Backend pods now have:
   - Email service code (`emailService.ts`)
   - SES permissions via IAM role (configured by Terraform)
   - Environment variables (`DOMAIN_NAME`, `EMAIL_FROM_NAME`)

**Check deployment status:**

```bash
# View the GitHub Actions deployment
# Go to: Actions tab → "Build and Deploy to AWS EKS"

# Or check pod status
kubectl get pods -n crypto-analytics -l app=backend

# View backend logs
kubectl logs -n crypto-analytics -l app=backend --tail=50
```

✅ **Backend deployed with email capabilities!**

## Step 10: Configure Gmail "Send As" (Optional)

To reply from support@cryptoquantlab.com in your personal Gmail:

1. Open Gmail (your personal account)
2. Settings → Accounts and Import
3. "Send mail as" → Add another email address
4. Enter: support@cryptoquantlab.com
5. Use Google Workspace SMTP:
   - **SMTP Server**: smtp.gmail.com
   - **Port**: 587
   - **Username**: support@cryptoquantlab.com
   - **Password**: [Your Google Workspace password]
6. Verify the email address

Now you can send from support@cryptoquantlab.com in your personal Gmail!

---

## Complete Setup Summary

### What You Did

1. ✅ **Signed up for Google Workspace** ($6/month)
   - Created support@cryptoquantlab.com inbox
   - Got Google DKIM authentication key

2. ✅ **Added DKIM to GitHub Secrets**
   - Stored `GOOGLE_DKIM_VALUE` securely
   - Available for automated deployments

3. ✅ **Deployed Infrastructure via Terraform**
   - Created DNS records in Route53 (MX, DKIM, SPF)
   - Configured AWS SES for sending
   - Set up IAM permissions for backend

4. ✅ **Verified Email Systems**
   - SES domain verified
   - Google Workspace verified
   - Tested sending and receiving

5. ✅ **Backend Automatically Deployed**
   - Email service integrated
   - SES permissions configured
   - Ready to send transactional emails

### What You Can Do Now

**Receive Email:**
- Check support@cryptoquantlab.com inbox in Google Workspace
- Get notifications on your phone (Gmail app)
- Reply from support@cryptoquantlab.com

**Send Email from Backend:**
```typescript
// Password reset emails
await emailService.sendPasswordResetEmail(user.email, resetToken);

// Welcome emails
await emailService.sendWelcomeEmail(user.email, user.name);

// Custom emails
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Your Subject',
  htmlBody: '<p>HTML content</p>',
});
```

### Infrastructure Overview

**All managed as code:**
- DNS records: Terraform (`modules/email/`)
- Backend service: TypeScript (`services/emailService.ts`)
- Secrets: GitHub Secrets
- Deployments: GitHub Actions

**Cost: ~$7/month**
- Google Workspace: $6/month
- AWS SES: ~$1/month

### Maintenance

**No ongoing maintenance required!**

All deployments are automated:
- Code changes: Push to master → Auto deploy
- Infrastructure changes: Run Terraform workflow
- Secrets: Update in GitHub Secrets UI

### Next Steps

Now that email is set up, you can:

1. **Implement password reset functionality** using `emailService.sendPasswordResetEmail()`
2. **Send welcome emails** to new users with `emailService.sendWelcomeEmail()`
3. **Add support contact form** that sends to support@cryptoquantlab.com
4. **Monitor email metrics** in AWS SES console
5. **Track email events** in PostHog (already integrated)

---

## Quick Reference

For a condensed version of this guide, see: `docs/EMAIL_SETUP_SUMMARY.md`

## Environment Variables

The following environment variables are used by the email service:

### Production (Kubernetes ConfigMap)
```yaml
DOMAIN_NAME: "cryptoquantlab.com"
EMAIL_FROM_NAME: "Crypto Quant Lab"
AWS_REGION: "us-east-1"
```

### Local Development (.env)
```bash
DOMAIN_NAME=cryptoquantlab.com
EMAIL_FROM_NAME=Crypto Quant Lab
AWS_REGION=us-east-1
```

## Usage in Backend Code

### Send Password Reset Email

```typescript
import { emailService } from './services/emailService';

// In your password reset endpoint
await emailService.sendPasswordResetEmail(
  user.email,
  resetToken
);
```

### Send Welcome Email

```typescript
import { emailService } from './services/emailService';

// After user signs up
await emailService.sendWelcomeEmail(
  user.email,
  user.name
);
```

### Send Custom Email

```typescript
import { emailService } from './services/emailService';

await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Your Custom Subject',
  htmlBody: '<p>HTML content</p>',
  textBody: 'Plain text content',
});
```

## Troubleshooting

### Email Not Sending

1. **Check SES verification status**:
   ```bash
   aws ses get-identity-verification-attributes --identities cryptoquantlab.com
   ```

2. **Check IAM permissions**:
   ```bash
   aws iam get-role-policy --role-name <eks-node-role-name> --policy-name <ses-policy-name>
   ```

3. **Check backend logs**:
   ```bash
   kubectl logs -n crypto-analytics -l app=backend --tail=50
   ```

### Email Not Receiving

1. **Check MX records**:
   ```bash
   dig MX cryptoquantlab.com
   ```

2. **Verify Google Workspace**:
   - Log into admin console
   - Check domain verification status

3. **Wait for DNS propagation** (up to 48 hours)

### SES Sandbox Mode

If you're in SES sandbox mode, you can only send to verified email addresses:

1. Verify your email address:
   ```bash
   aws ses verify-email-identity --email-address your-email@example.com
   ```

2. Request production access in AWS Console

## Monitoring

### Check Email Sending Stats

```bash
# Get sending quota
aws ses get-send-quota

# Get sending statistics
aws ses get-send-statistics
```

### PostHog Events

Email events are automatically tracked in PostHog:
- `email_sent` - When an email is successfully sent
- `email_failed` - When email sending fails

## Security Best Practices

1. **Never commit secrets to git** ✅ (Handled by GitHub Secrets)
2. **Use IAM roles for SES** ✅ (EKS pods use IAM role)
3. **Validate email addresses** before sending
4. **Implement rate limiting** (already in place with rate limiter middleware)
5. **Monitor bounce rates** via SES console

## Cost Optimization

To reduce costs:

1. **Monitor SES usage**:
   ```bash
   aws ses get-send-statistics
   ```

2. **Set up billing alerts** in AWS Console
3. **Review Google Workspace plan** (Business Starter is cheapest)

## Next Steps

- [ ] Sign up for Google Workspace
- [ ] Get Google DKIM value
- [ ] Apply Terraform changes
- [ ] Verify SES domain
- [ ] Test email sending
- [ ] Deploy to production
- [ ] Configure "Send As" in Gmail (optional)
