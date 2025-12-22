import { getUserPreferences, saveUserPreferences, UserPreferences } from '../db/dynamodb';

export const userPreferencesResolvers = {
  Query: {
    userPreferences: async (
      _: unknown,
      { userId }: { userId: string },
      context: any
    ): Promise<UserPreferences | null> => {
      // Debug logging
      console.log('userPreferences query - userId:', userId);
      console.log('userPreferences query - context.user:', context.user);

      // Verify user can only access their own preferences
      if (!context.user) {
        console.error('No user in context - authentication required');
        throw new Error('Authentication required');
      }

      if (context.user.sub !== userId) {
        throw new Error('Forbidden: Cannot access other users\' preferences');
      }

      return await getUserPreferences(userId);
    },
  },
  Mutation: {
    saveUserPreferences: async (
      _: unknown,
      { input }: { input: UserPreferences },
      context: any
    ): Promise<UserPreferences> => {
      // Verify user can only modify their own preferences
      if (!context.user) {
        throw new Error('Authentication required');
      }

      if (context.user.sub !== input.userId) {
        throw new Error('Forbidden: Cannot modify other users\' preferences');
      }

      return await saveUserPreferences(input);
    },
  },
};
