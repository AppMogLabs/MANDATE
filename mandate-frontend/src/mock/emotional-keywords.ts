export const EMOTIONAL_KEYWORDS = [
  'please',
  'careful',
  'try to',
  'be smart',
  'do your best',
  'make sure',
  "don't let",
  'hope',
  'maybe',
  'if possible',
  'kind of',
  'sort of',
  'I think',
  'perhaps',
  'nicely',
] as const;

export const EMOTIONAL_TRANSLATIONS: Readonly<Record<string, string>> = {
  'please be careful with CHIPS': 'Maintain minimum 500 CHIPS reserve at all times',
  'try to get a good price': 'Set maximum buy price at current market + 10%',
  "don't let them take advantage": 'Reject any trade where we give more value than we receive',
  'be smart about trading': 'Compare prices across all counterparties before executing',
  'make sure we have enough ENERGY': 'Maintain ENERGY reserve above 200 at all times',
  'please be careful with COMPUTE': 'Maintain minimum 300 COMPUTE reserve at all times',
  'try to save resources': 'Set reserve floors for all resources at 100 units minimum',
  "don't let anyone cheat us": 'Set minimum counterparty reputation to 50',
  'do your best to profit': 'Target net positive PnL each round. Sell above 1.3x acquisition cost',
  'be smart about alliances': 'Accept alliance offers only from counterparties with reputation above 60',
  'make sure we stay competitive': 'Maintain COMPUTE production above consumption rate at all times',
  'I think we should trade carefully': 'Set trade aggressiveness to 3. Cap single trade at 100 RATE',
  'maybe sell some DATA': 'Sell DATA when price exceeds 1.5 RATE and reserves are above 200',
  'hope we can get more TALENT': 'Place standing buy orders for TALENT below 1.0 RATE',
  'if possible get CLEARANCE': 'Buy CLEARANCE when available below 3.0 RATE, maintain floor of 50',
};

/**
 * Check if mandate text contains emotional/subjective language.
 * Returns the first matching keyword phrase and its translation, or null.
 */
export function detectEmotionalLanguage(
  text: string,
): { keyword: string; original: string; suggestion: string } | null {
  const lower = text.toLowerCase();

  // Check for full-phrase translations first (more specific matches)
  for (const [original, suggestion] of Object.entries(EMOTIONAL_TRANSLATIONS)) {
    if (lower.includes(original.toLowerCase())) {
      const keyword = EMOTIONAL_KEYWORDS.find((k) => original.toLowerCase().includes(k)) ?? original;
      return { keyword, original, suggestion };
    }
  }

  // Fall back to keyword detection with generic suggestion
  for (const keyword of EMOTIONAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        keyword,
        original: keyword,
        suggestion: `Replace "${keyword}" with a specific numeric constraint or threshold`,
      };
    }
  }

  return null;
}
