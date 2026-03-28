import type { EpochState } from './types';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const SIXTEEN_HOURS_MS = 16 * 60 * 60 * 1000;

const startTimestamp = 1711584000000 - TWO_DAYS_MS;
const endTimestamp = 1711584000000 + SIXTEEN_HOURS_MS;

export const epochState: EpochState = {
  epochNumber: 3,
  startTimestamp,
  endTimestamp,
  timeRemaining: SIXTEEN_HOURS_MS,
};
