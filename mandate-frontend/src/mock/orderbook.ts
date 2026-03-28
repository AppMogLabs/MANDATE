import type { ResourceType, OrderBookSnapshot, OrderBookLevel } from './types';

const MID_PRICES: Record<ResourceType, number> = {
  COMPUTE: 1.2340,
  ENERGY: 0.8710,
  CHIPS: 2.1500,
  COOLING: 0.5620,
  TALENT: 1.7800,
  DATA: 0.9450,
  CLEARANCE: 3.4200,
};

const CHANGE_24H: Record<ResourceType, number> = {
  COMPUTE: 3.2,
  ENERGY: -1.4,
  CHIPS: 12.7,
  COOLING: 0.6,
  TALENT: -2.1,
  DATA: 2.8,
  CLEARANCE: -5.3,
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateLevels(
  mid: number,
  side: 'bid' | 'ask',
  count: number,
  rand: () => number,
): OrderBookLevel[] {
  const levels: OrderBookLevel[] = [];
  const tickSize = mid * 0.002;

  for (let i = 0; i < count; i++) {
    const offset = (i + 1) * tickSize * (0.8 + rand() * 0.4);
    const price = side === 'bid'
      ? mid - offset
      : mid + offset;

    const distanceFactor = 1 / (1 + i * 0.15);
    const volume = Math.round((50 + rand() * 400) * distanceFactor);
    const orderCount = Math.max(1, Math.round((1 + rand() * 8) * distanceFactor));

    levels.push({
      price: parseFloat(price.toFixed(4)),
      volume,
      orderCount,
    });
  }

  return levels;
}

function buildSnapshot(resource: ResourceType): OrderBookSnapshot {
  const mid = MID_PRICES[resource];
  const seed = resource.charCodeAt(0) * 1000 + resource.charCodeAt(1);
  const rand = seededRandom(seed);

  const bids = generateLevels(mid, 'bid', 20, rand);
  const asks = generateLevels(mid, 'ask', 20, rand);

  const lastOffset = (rand() - 0.5) * mid * 0.003;
  const lastTradePrice = parseFloat((mid + lastOffset).toFixed(4));

  return {
    pair: `${resource}/RATE`,
    bids,
    asks,
    lastTradePrice,
    change24h: CHANGE_24H[resource],
  };
}

export const orderBooks: OrderBookSnapshot[] = [
  buildSnapshot('COMPUTE'),
  buildSnapshot('ENERGY'),
  buildSnapshot('CHIPS'),
  buildSnapshot('COOLING'),
  buildSnapshot('TALENT'),
  buildSnapshot('DATA'),
  buildSnapshot('CLEARANCE'),
];

export function getOrderBook(resource: ResourceType): OrderBookSnapshot {
  const book = orderBooks.find((b) => b.pair === `${resource}/RATE`);
  if (!book) {
    throw new Error(`No order book for ${resource}`);
  }
  return book;
}
