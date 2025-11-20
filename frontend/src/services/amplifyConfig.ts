import { Amplify } from 'aws-amplify';

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
      signUpVerificationMethod: 'code' as const,
      loginWith: {
        email: true,
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
};

export const configureAmplify = () => {
  if (awsConfig.Auth.Cognito.userPoolId && awsConfig.Auth.Cognito.userPoolClientId) {
    Amplify.configure(awsConfig);
  } else {
    console.warn('Cognito configuration not found. Authentication features will be disabled.');
  }
};

export default awsConfig;
