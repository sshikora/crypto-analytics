export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  termsAccepted?: boolean;
  termsAcceptedDate?: string;
}

export interface UserPreferences {
  userId: string;
  colorMode: 'default' | 'colorblind' | 'grayscale';
  enabledMAPeriods: number[];
  defaultTimeRange: string;
  showDifference: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
