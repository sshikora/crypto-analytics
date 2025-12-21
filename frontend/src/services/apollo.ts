import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { fetchAuthSession } from 'aws-amplify/auth';

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql',
});

// Auth link to add API key and JWT token to requests
const authLink = setContext(async (_, { headers }) => {
  const apiKey = import.meta.env.VITE_API_KEY;

  // Get JWT token from Cognito (if user is logged in)
  let token: string | undefined;
  try {
    const session = await fetchAuthSession();
    token = session.tokens?.idToken?.toString();
  } catch (error) {
    // User not authenticated, continue without token
  }

  return {
    headers: {
      ...headers,
      // Add API key for all requests
      'x-api-key': apiKey || '',
      // Add JWT token if user is authenticated
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Cryptocurrency: {
        keyFields: ['coinGeckoId'], // Use coinGeckoId as the unique identifier instead of id
      },
      Query: {
        fields: {
          topCryptocurrencies: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
          cryptocurrencies: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only',
    },
    query: {
      fetchPolicy: 'network-only',
    },
  },
});
