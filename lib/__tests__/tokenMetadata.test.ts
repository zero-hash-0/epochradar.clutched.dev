import assert from "node:assert/strict";
import { resolveTokenMetadata } from "../tokenMetadata";

export async function testTokenMetadataResolution() {
  const originalFetch = global.fetch;

  global.fetch = async () => {
    return {
      ok: true,
      json: async () => [
        {
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          symbol: "USDC",
          name: "USD Coin",
        },
      ],
    } as Response;
  };

  const connection = { getAccountInfo: async () => null } as never;
  const usdc = await resolveTokenMetadata("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", connection);
  assert.equal(usdc.symbol, "USDC");

  global.fetch = async () => ({ ok: true, json: async () => [] } as Response);
  const unknown = await resolveTokenMetadata("UnknownMint111111111111111111111111111111111", connection);
  assert.equal(unknown.symbol, "UNKNOWN");

  global.fetch = originalFetch;
}

void testTokenMetadataResolution();
