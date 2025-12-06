# AWS SES Production Access

## Current Status

**SES is currently in SANDBOX mode**, which means:
- Can only send emails to verified email addresses
- Limited to 200 emails per 24 hours
- Maximum send rate of 1 email per second
- Cannot send to arbitrary user email addresses

**Temporary Solution**: Cognito is configured to use `COGNITO_DEFAULT` email sending, which:
- Uses AWS-managed email infrastructure
- Works with any email address (no sandbox restrictions)
- Sends from `no-reply@verificationemail.com`
- Has default AWS branding

## Requesting SES Production Access

To enable custom domain emails (noreply@cryptoquantlab.com), you need to request production access for SES:

### Steps:

1. **Open AWS Console** → Navigate to Amazon SES (us-east-1 region)

2. **Request Production Access**:
   - Go to "Account dashboard" in SES console
   - Click "Request production access"
   - Fill out the form:

3. **Form Details**:
   ```
   Mail type: Transactional
   Website URL: https://cryptoquantlab.com
   Use case description:
   "CryptoQuantLab is a cryptocurrency analytics platform that requires
   sending transactional emails to users including:
   - Email verification codes during signup
   - Password reset emails
   - Account notifications

   We expect to send approximately 50-100 emails per day initially,
   growing as our user base expands. All emails are user-initiated
   transactional messages, not marketing emails."

   Additional contacts: [your email]
   Acknowledge compliance: Yes
   ```

4. **Wait for Approval** (usually 24-48 hours)

5. **After Approval**, update Cognito configuration:

   Edit `infrastructure/terraform/modules/cognito/main.tf`:

   ```hcl
   email_configuration {
     email_sending_account  = "DEVELOPER"
     source_arn             = aws_ses_domain_identity.main.arn
     from_email_address     = "noreply@${var.domain_name}"
     reply_to_email_address = "support@${var.domain_name}"
   }
   ```

6. **Apply changes**:
   ```bash
   cd infrastructure/terraform/environments/production
   tofu apply -var-file=terraform.tfvars.cost-optimized
   ```

## Benefits of SES Production Access

- **Custom branding**: Emails from noreply@cryptoquantlab.com
- **Higher limits**: 50,000 emails per 24 hours (can be increased further)
- **Better deliverability**: DKIM signing already configured
- **Professional appearance**: Custom domain increases trust

## Current Configuration

### Domain Verification
- ✅ Domain `cryptoquantlab.com` verified
- ✅ DKIM tokens configured in Route53
- ✅ DNS records properly set up

### What's Ready
Once production access is granted, simply uncomment the email configuration in the Cognito module - all DNS records and domain verification are already in place.

## Monitoring SES

Check SES status:
```bash
# Check if production access is enabled
aws sesv2 get-account --region us-east-1 --query 'ProductionAccessEnabled'

# Check send quota
aws ses get-send-quota --region us-east-1

# View send statistics
aws ses get-send-statistics --region us-east-1
```

## Resources

- [AWS SES Production Access Documentation](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [SES Sandbox Restrictions](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [DKIM Signing with SES](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim.html)
