import express from 'express';
import { createYoga } from 'graphql-yoga';
import { createSchema } from 'graphql-yoga';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { typeDefs } from './schema/graphql';
import { resolvers as cryptoResolvers } from './resolvers/cryptoResolvers';
import { userPreferencesResolvers } from './resolvers/userPreferencesResolvers';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { apiRateLimiter } from './middleware/rateLimiter';
import { optionalJwtAuth, AuthenticatedRequest } from './middleware/jwtAuth';

dotenv.config();

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
  },
  Mutation: {
    ...cryptoResolvers.Mutation,
    ...userPreferencesResolvers.Mutation,
  },
};

const schema = createSchema({
  typeDefs,
  resolvers,
});

// Create Yoga instance with proper Express integration
const yoga = createYoga<{
  req: AuthenticatedRequest;
  res: express.Response;
}>({
  schema,
  graphqlEndpoint: '/graphql',
  cors: false, // CORS is handled by Express
  context: ({ req }) => {
    console.log('[Yoga Context] Creating context');
    console.log('[Yoga Context] req.user:', req?.user);
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
});
