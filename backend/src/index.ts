import * as dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import express from 'express';
import { createYoga } from 'graphql-yoga';
import { createSchema } from 'graphql-yoga';
import cors from 'cors';
import cron from 'node-cron';
import { typeDefs } from './schema/graphql';
import { resolvers as cryptoResolvers } from './resolvers/cryptoResolvers';
import { userPreferencesResolvers } from './resolvers/userPreferencesResolvers';
import { notificationResolvers } from './resolvers/notificationResolvers';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { apiRateLimiter } from './middleware/rateLimiter';
import { optionalJwtAuth, AuthenticatedRequest } from './middleware/jwtAuth';
import { runCrossoverChecker } from './jobs/crossoverChecker';

const app = express();
const port = process.env.PORT || 4000;

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

app.use(express.json());

// Security middleware - Applied to ALL routes
app.use(apiRateLimiter); // Rate limiting by IP
app.use(apiKeyAuth); // API key validation

// Merge resolvers
const resolvers = {
  Query: {
    ...cryptoResolvers.Query,
    ...userPreferencesResolvers.Query,
    ...notificationResolvers.Query,
  },
  Mutation: {
    ...cryptoResolvers.Mutation,
    ...userPreferencesResolvers.Mutation,
    ...notificationResolvers.Mutation,
  },
};

const schema = createSchema({
  typeDefs,
  resolvers,
});

// Create Yoga instance with proper Express integration
const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  cors: false, // CORS is handled by Express
  maskedErrors: process.env.NODE_ENV === 'production', // Show full errors in development
  graphiql: process.env.NODE_ENV !== 'production' && {
    headers: JSON.stringify({ 'x-api-key': process.env.API_KEY }),
  },
  context: (initialContext) => {
    // When using Yoga with Express, the context includes req and res
    const req = (initialContext as any).req as AuthenticatedRequest;
    return {
      user: req?.user || null,
    };
  },
});

// Apply JWT extraction middleware before GraphQL
app.use('/graphql', optionalJwtAuth, yoga);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📊 GraphQL endpoint: http://localhost:${port}/graphql`);

  // Schedule crossover checker to run every 5 minutes
  if (process.env.ENABLE_CROSSOVER_CHECKER !== 'false') {
    cron.schedule('*/5 * * * *', async () => {
      console.log('[Cron] Running crossover checker...');
      try {
        await runCrossoverChecker();
      } catch (error) {
        console.error('[Cron] Crossover checker failed:', error);
      }
    });
    console.log('📊 Crossover checker scheduled (every 5 minutes)');
  }
});
