import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchUserAttributes,
} from 'aws-amplify/auth';
import { User, UserPreferences } from '../types/auth';
import { posthog } from '../services/posthog';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  preferences: UserPreferences | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, acceptedTerms: boolean) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendSignUpCode: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmResetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  savePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  loadPreferences: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  const isAuthenticated = !!user;

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Check if Cognito is configured
    const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

    if (!userPoolId || !clientId) {
      console.warn('Cognito not configured, auth disabled');
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();

      const userData = {
        id: currentUser.userId,
        email: attributes.email || '',
        emailVerified: attributes.email_verified === 'true',
        termsAccepted: attributes['custom:terms_accepted'] === 'true',
        termsAcceptedDate: attributes['custom:terms_accepted_date'],
      };

      setUser(userData);

      // Identify user in PostHog
      if (posthog) {
        posthog.identify(userData.id, {
          email: userData.email,
          emailVerified: userData.emailVerified,
          termsAccepted: userData.termsAccepted,
        });
      }

      // Load preferences after auth
      await loadPreferencesInternal(currentUser.userId);
    } catch {
      setUser(null);
      setPreferences(null);
      // Reset PostHog identity for anonymous tracking
      if (posthog) {
        posthog.reset();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    try {
      await signIn({ username: email, password });
      await checkAuth();
    } catch (error) {
      throw error;
    }
  };

  const handleSignUp = async (email: string, password: string, acceptedTerms: boolean) => {
    if (!acceptedTerms) {
      throw new Error('You must accept the Terms of Service to create an account.');
    }

    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            'custom:terms_accepted': 'true',
            'custom:terms_accepted_date': new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      throw error;
    }
  };

  const handleConfirmSignUp = async (email: string, code: string) => {
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
    } catch (error) {
      throw error;
    }
  };

  const handleResendSignUpCode = async (email: string) => {
    try {
      await resendSignUpCode({ username: email });
    } catch (error) {
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setPreferences(null);
      // Reset PostHog identity to track as anonymous
      if (posthog) {
        posthog.reset();
      }
    } catch (error) {
      throw error;
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await resetPassword({ username: email });
    } catch (error) {
      throw error;
    }
  };

  const handleConfirmResetPassword = async (email: string, code: string, newPassword: string) => {
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword,
      });
    } catch (error) {
      throw error;
    }
  };

  const loadPreferencesInternal = async (userId: string) => {
    try {
      const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql';
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetUserPreferences($userId: String!) {
              userPreferences(userId: $userId) {
                userId
                colorMode
                enabledMAPeriods
                defaultTimeRange
                showDifference
                dashboardCoins
              }
            }
          `,
          variables: { userId },
        }),
      });

      const data = await response.json();
      if (data.data?.userPreferences) {
        setPreferences(data.data.userPreferences);
      } else {
        // Set default preferences
        setPreferences({
          userId,
          colorMode: 'default',
          enabledMAPeriods: [7, 21],
          defaultTimeRange: 'MONTH',
          showDifference: false,
          dashboardCoins: [],
        });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const loadPreferences = async () => {
    if (user) {
      await loadPreferencesInternal(user.id);
    }
  };

  const savePreferences = async (prefs: Partial<UserPreferences>) => {
    if (!user) return;

    const newPreferences = {
      ...preferences,
      ...prefs,
      userId: user.id,
    } as UserPreferences;

    try {
      const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql';
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation SaveUserPreferences($input: UserPreferencesInput!) {
              saveUserPreferences(input: $input) {
                userId
                colorMode
                enabledMAPeriods
                defaultTimeRange
                showDifference
                dashboardCoins
              }
            }
          `,
          variables: {
            input: {
              userId: newPreferences.userId,
              colorMode: newPreferences.colorMode,
              enabledMAPeriods: newPreferences.enabledMAPeriods,
              defaultTimeRange: newPreferences.defaultTimeRange,
              showDifference: newPreferences.showDifference,
              dashboardCoins: newPreferences.dashboardCoins || [],
            },
          },
        }),
      });

      const data = await response.json();
      if (data.data?.saveUserPreferences) {
        setPreferences(data.data.saveUserPreferences);
        // Track preference changes
        if (posthog) {
          posthog.capture('preferences_updated', {
            colorMode: newPreferences.colorMode,
            enabledMAPeriods: newPreferences.enabledMAPeriods,
            defaultTimeRange: newPreferences.defaultTimeRange,
            showDifference: newPreferences.showDifference,
            dashboardCoinsCount: newPreferences.dashboardCoins?.length || 0,
          });
        }
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        preferences,
        signIn: handleSignIn,
        signUp: handleSignUp,
        confirmSignUp: handleConfirmSignUp,
        resendSignUpCode: handleResendSignUpCode,
        signOut: handleSignOut,
        resetPassword: handleResetPassword,
        confirmResetPassword: handleConfirmResetPassword,
        savePreferences,
        loadPreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
