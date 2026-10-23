import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

let client: CognitoIdentityProviderClient | undefined;

function getClient(): CognitoIdentityProviderClient {
  client ??= new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });
  return client;
}

// The pool signs users in by email, so each Cognito username is the user's sub, which rules store as userId.
export async function getVerifiedEmail(userId: string): Promise<string | null> {
  try {
    const user = await getClient().send(
      new AdminGetUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: userId,
      })
    );
    const attributes = Object.fromEntries(
      (user.UserAttributes ?? []).map((attribute) => [attribute.Name, attribute.Value])
    );

    if (!user.Enabled || attributes.email_verified !== 'true' || !attributes.email) {
      return null;
    }
    return attributes.email;
  } catch (error) {
    if (error instanceof Error && error.name === 'UserNotFoundException') {
      return null;
    }
    throw error;
  }
}
