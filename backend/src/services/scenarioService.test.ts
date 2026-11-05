import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { garchBootstrapModel, gbmModel, simulate, summarize } from '../models/monteCarlo';
import { logReturns, periodsPerYear } from '../models/returns';
import { getLatestScenario } from '../repositories/coinMetricsRepository';
import { getScenario, Scenario, SCENARIO_VERSION, summarizeScenario } from './scenarioService';

vi.mock('../repositories/coinMetricsRepository', () => ({ getLatestScenario: vi.fn() }));
vi.mock('../repositories/priceHistoryRepository', () => ({ getDailyPrices: vi.fn() }));

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'performance', 'btc_eth_daily.json'), 'utf8')
) as { dates: string[]; timestamps: number[]; coins: { bitcoin: { prices: number[] } } };
const prices = fixture.dates.map((date, i) => ({ date, timestamp: fixture.timestamps[i], price: fixture.coins.bitcoin.prices[i] }));
const window = prices.slice(-181);
const returns = logReturns(window.map(p => p.price));

describe('summarizeScenario', () => {
  let scenario: Scenario;
  beforeAll(() => {
    scenario = summarizeScenario('bitcoin', prices)!;
  });

  it('fits the latest 180 returns and starts from the latest close', () => {
    expect(scenario.observations).toBe(180);
    expect(scenario.asOf).toBe(fixture.dates[fixture.dates.length - 1]);
    expect(scenario.startPrice).toBe(prices[prices.length - 1].price);
    expect(scenario.models.map(m => m.model)).toEqual(['garchBootstrap', 'studentT', 'normal']);
  });

  it('needs at least 120 returns', () => {
    expect(summarizeScenario('new-coin', prices.slice(-120))).toBeNull();
    expect(summarizeScenario('new-coin', prices.slice(-121))).not.toBeNull();
  });

  it('matches simulating the engine directly with no drift', () => {
    const garch = { ...garchBootstrapModel(returns), mu: 0 };
    const direct = summarize(simulate(garch, { paths: 10_000, days: 90, seed: 20_261_105, antithetic: false }), scenario.quantiles, 0.05, [0.1, 0.2, 0.3, 0.5]);
    const model = scenario.models[0];
    const ninety = model.horizons.find(h => h.days === 90)!;
    expect(ninety.tailRisk[0].valueAtRisk).toBe(direct.valueAtRisk);
    expect(ninety.tailRisk[0].expectedShortfall).toBe(direct.expectedShortfall);
    expect(ninety.drawdownProbabilities.map(d => d.probability)).toEqual(direct.drawdownProbabilities);
    expect(model.fan.map(f => f.quantiles)).toEqual(direct.fan);
  });

  it('reports the normal model at the sample volatility', () => {
    const normal = scenario.models.find(m => m.model === 'normal')!;
    const annual = periodsPerYear(window.map(p => p.timestamp));
    expect(normal.startingVolatility).toBeCloseTo(gbmModel(returns).sigma * Math.sqrt(annual), 12);
  });

  it('centres the paths on today’s price', () => {
    for (const model of scenario.models) {
      expect(model.fan).toHaveLength(90);
      expect(Math.abs(model.fan[0].quantiles[2] - 1)).toBeLessThan(0.005);
      for (const { quantiles } of model.fan) {
        quantiles.slice(1).forEach((q, i) => expect(q).toBeGreaterThanOrEqual(quantiles[i]));
      }
    }
  });

  it('summarizes each horizon consistently', () => {
    for (const model of scenario.models) {
      expect(model.horizons.map(h => h.days)).toEqual([7, 30, 90]);
      for (const h of model.horizons) {
        const [at95, at99] = h.tailRisk;
        expect(at99.valueAtRisk).toBeGreaterThan(at95.valueAtRisk);
        expect(at95.expectedShortfall).toBeGreaterThan(at95.valueAtRisk);
        const chances = h.drawdownProbabilities.map(d => d.probability);
        chances.slice(1).forEach((p, i) => expect(p).toBeLessThanOrEqual(chances[i]));
        expect(h.distribution.reduce((s, b) => s + b.probability, 0)).toBeCloseTo(1, 12);
        h.distribution.slice(1).forEach((b, i) => expect(b.lower).toBeCloseTo(h.distribution[i].upper, 12));
      }
      const tenPercent = model.horizons.map(h => h.drawdownProbabilities[0].probability);
      tenPercent.slice(1).forEach((p, i) => expect(p).toBeGreaterThan(tenPercent[i]));
    }
  });
});

describe('getScenario', () => {
  it('serves only rows written by the current version', async () => {
    vi.mocked(getLatestScenario).mockResolvedValueOnce({
      scenario: { coinId: 'old-coin' } as Scenario,
      version: SCENARIO_VERSION - 1,
      computedAt: '2026-11-05T01:00:00Z',
    });
    expect(await getScenario('old-coin')).toBeNull();

    vi.mocked(getLatestScenario).mockResolvedValueOnce({
      scenario: { coinId: 'new-coin' } as Scenario,
      version: SCENARIO_VERSION,
      computedAt: '2026-11-05T01:00:00Z',
    });
    expect(await getScenario('new-coin')).toEqual({ coinId: 'new-coin' });
  });

  it('rejects ids that are not coin ids', async () => {
    await expect(getScenario('__market__')).rejects.toThrow('Invalid coin id');
  });
});
