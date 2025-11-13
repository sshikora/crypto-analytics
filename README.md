# Crypto Analytics Platform

A comprehensive cryptocurrency analytics web application built with React, Redux, TypeScript, Tailwind CSS, GraphQL, Drizzle ORM, and Express.

## Features

- **Real-time Crypto Data**: Live cryptocurrency prices, market caps, and trading volumes
- **Interactive Charts**: Price history visualization with multiple time ranges (24h, 7d, 1m, 1y, all)
- **Market Analytics**:
  - Current price and 24h price changes
  - Market capitalization
  - Trading volume (24h)
  - All-time high/low prices
  - Supply information (circulating, total, max)
  - 24h high/low prices
- **Dashboard View**: Quick overview of top cryptocurrencies
- **Markets View**: Comprehensive table view of 50+ cryptocurrencies
- **Detailed Crypto Pages**: In-depth analytics for individual cryptocurrencies

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Redux Toolkit** - State management
- **Apollo Client** - GraphQL client
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **React Router** - Navigation
- **Vite** - Build tool

### Backend
- **Express** - Web server
- **GraphQL Yoga** - GraphQL server
- **TypeScript** - Type safety
- **Drizzle ORM** - Database ORM
- **PostgreSQL** - Database (optional, data is fetched from CoinGecko API)
- **Node Cache** - API response caching
- **Axios** - HTTP client for external APIs

## Project Structure

```
crypto-analytics/
├── backend/
│   ├── src/
│   │   ├── db/              # Database connection
│   │   ├── schema/          # Database & GraphQL schemas
│   │   ├── resolvers/       # GraphQL resolvers
│   │   ├── services/        # External API services
│   │   └── index.ts         # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # Apollo Client & queries
│   │   ├── store/           # Redux store & slices
│   │   ├── types/           # TypeScript types
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL (optional, if you want to persist data)

## Installation

### 1. Clone or navigate to the project

```bash
cd crypto-analytics
```

### 2. Set up Backend

```bash
cd backend
npm install

# Copy environment variables
cp .env.example .env

# Edit .env if needed (optional for database)
# PORT=4000
# DATABASE_URL=postgresql://user:password@localhost:5432/crypto_analytics
```

### 3. Set up Frontend

```bash
cd ../frontend
npm install

# Copy environment variables
cp .env.example .env
```

## Running the Application

### Start Backend Server

```bash
cd backend
npm run dev
```

The GraphQL server will run on `http://localhost:4000`
GraphQL Playground: `http://localhost:4000/graphql`

### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

## GraphQL API

### Queries

#### Get Top Cryptocurrencies
```graphql
query {
  topCryptocurrencies(limit: 10) {
    id
    symbol
    name
    currentPrice
    marketCap
    volume24h
    priceChangePercentage24h
  }
}
```

#### Get Specific Cryptocurrency
```graphql
query {
  cryptocurrency(symbol: "BTC") {
    name
    symbol
    currentPrice
    marketCap
    athPrice
    athDate
  }
}
```

#### Get Price History
```graphql
query {
  priceHistory(symbol: "BTC", timeRange: WEEK) {
    symbol
    data {
      timestamp
      price
      volume24h
    }
  }
}
```

#### Get Market Stats
```graphql
query {
  marketStats(symbol: "ETH") {
    high24h
    low24h
    athPrice
    circulatingSupply
    totalSupply
  }
}
```

### Mutations

#### Refresh Crypto Data
```graphql
mutation {
  refreshCryptoData(symbol: "BTC") {
    symbol
    currentPrice
    marketCap
  }
}
```

## Features Implementation

### Financial Analytics

1. **Price Tracking**: Real-time price updates with 24h change percentages
2. **Market Capitalization**: Current market cap with formatted display
3. **Trading Volume**: 24h trading volume analysis
4. **Price History**: Historical price data with interactive charts
5. **All-Time Statistics**: ATH/ATL prices and dates
6. **Supply Metrics**: Circulating, total, and max supply information

### Data Visualization

- **Area Charts**: Price history with gradient fills
- **Responsive Design**: Charts adapt to screen size
- **Multiple Time Ranges**: 24h, 7d, 1m, 1y, all-time views
- **Tooltips**: Detailed information on hover

### User Interface

- **Clean Design**: Simple, intuitive interface built with Tailwind CSS
- **Card Components**: Reusable card-based layouts
- **Table Views**: Sortable market data tables
- **Loading States**: Smooth loading indicators
- **Error Handling**: User-friendly error messages

## Data Source

The application uses the **CoinGecko API** to fetch real-time cryptocurrency data. The free tier provides:

- Top 100 cryptocurrencies by market cap
- Real-time price data
- Historical price data
- Market statistics
- 5-minute cache for optimal performance

## Optional Database Setup

If you want to persist cryptocurrency data:

```bash
cd backend

# Generate database migrations
npm run db:generate

# Push schema to database
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Production Build

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

## Environment Variables

### Backend (.env)
```env
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/crypto_analytics
NODE_ENV=development
COINGECKO_API_KEY=  # Optional, for rate limit increases
```

### Frontend (.env)
```env
VITE_GRAPHQL_URL=http://localhost:4000/graphql
```

## API Rate Limiting

The CoinGecko free API has rate limits:
- 10-50 calls/minute (depending on endpoint)
- Data is cached for 5 minutes to minimize API calls
- Consider upgrading to CoinGecko Pro for higher limits

## Future Enhancements

- [ ] User authentication and watchlists
- [ ] Portfolio tracking
- [ ] Price alerts
- [ ] More advanced charting (candlestick, indicators)
- [ ] News integration
- [ ] Multi-currency support
- [ ] Mobile app version
- [ ] WebSocket for real-time updates

## Troubleshooting

### Backend won't start
- Ensure PostgreSQL is running (if using database)
- Check if port 4000 is available
- Verify DATABASE_URL in .env

### Frontend API errors
- Ensure backend is running on port 4000
- Check VITE_GRAPHQL_URL in .env
- Clear browser cache

### Rate limit errors
- Wait a few minutes before retrying
- Increase cache time in backend
- Consider using CoinGecko API key

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
