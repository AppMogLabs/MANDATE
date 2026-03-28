import type { Mandate, GameState } from "./types.js";
import { SYSTEM_IDENTITY } from "./system-identity.js";
import { renderZone2 } from "./zone2.js";
import { renderZone3 } from "./zone3.js";
import { renderZone4 } from "./zone4.js";

export function buildContext(mandate: Mandate, gameState: GameState, externalInput: string): string {
  const zone1 = SYSTEM_IDENTITY;
  const zone2 = renderZone2(mandate);
  const zone3 = renderZone3(gameState);
  const zone4 = renderZone4(externalInput);

  return [zone1, zone2, zone3, zone4].join("\n\n");
}
