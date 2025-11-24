import express from 'express';
import { createYoga } from 'graphql-yoga';
import { createSchema } from 'graphql-yoga';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { typeDefs } from './schema/graphql';
import { resolvers as cryptoResolvers } from './resolvers/cryptoResolvers';
import { userPreferencesResolvers } from './resolvers/userPreferencesResolvers';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  cors: false, // CORS is handled by Express
});

app.use('/graphql', yoga);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📊 GraphQL endpoint: http://localhost:${port}/graphql`);
});
