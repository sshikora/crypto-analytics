import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql',
});

export const apolloClient = new ApolloClient({
  link: httpLink,
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
