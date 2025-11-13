import { pgTable, serial, varchar, decimal, timestamp, text, integer } from 'drizzle-orm/pg-core';

export const cryptocurrencies = pgTable('cryptocurrencies', {
  id: serial('id').primaryKey(),
  symbol: varchar('symbol', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  coinGeckoId: varchar('coin_gecko_id', { length: 100 }).notNull().unique(),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  cryptoId: integer('crypto_id').references(() => cryptocurrencies.id).notNull(),
  price: decimal('price', { precision: 20, scale: 8 }).notNull(),
  marketCap: decimal('market_cap', { precision: 20, scale: 2 }),
  volume24h: decimal('volume_24h', { precision: 20, scale: 2 }),
  priceChange24h: decimal('price_change_24h', { precision: 10, scale: 2 }),
  priceChangePercentage24h: decimal('price_change_percentage_24h', { precision: 10, scale: 2 }),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const marketStats = pgTable('market_stats', {
  id: serial('id').primaryKey(),
  cryptoId: integer('crypto_id').references(() => cryptocurrencies.id).notNull(),
  high24h: decimal('high_24h', { precision: 20, scale: 8 }),
  low24h: decimal('low_24h', { precision: 20, scale: 8 }),
  athPrice: decimal('ath_price', { precision: 20, scale: 8 }),
  athDate: timestamp('ath_date'),
  atlPrice: decimal('atl_price', { precision: 20, scale: 8 }),
  atlDate: timestamp('atl_date'),
  circulatingSupply: decimal('circulating_supply', { precision: 30, scale: 2 }),
  totalSupply: decimal('total_supply', { precision: 30, scale: 2 }),
  maxSupply: decimal('max_supply', { precision: 30, scale: 2 }),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
