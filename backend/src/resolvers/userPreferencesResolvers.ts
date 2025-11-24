import { getUserPreferences, saveUserPreferences, UserPreferences } from '../db/dynamodb';

export const userPreferencesResolvers = {
  Query: {
    userPreferences: async (_: unknown, { userId }: { userId: string }): Promise<UserPreferences | null> => {
      return await getUserPreferences(userId);
    },
  },
  Mutation: {
    saveUserPreferences: async (
      _: unknown,
      { input }: { input: UserPreferences }
    ): Promise<UserPreferences> => {
      return await saveUserPreferences(input);
    },
  },
};
