import assert from "node:assert/strict";
import { extractInboundTransfersFromParsedTx } from "../pastAirdrops";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export function testPastAirdropParsing() {
  const tx = {
    blockTime: 1735689600,
    meta: {
      err: null,
      preTokenBalances: [
        {
          accountIndex: 1,
          mint: "Mint1111111111111111111111111111111111111",
          owner: "Wallet11111111111111111111111111111111111",
          uiTokenAmount: { uiAmount: 1, decimals: 6 },
        },
      ],
      postTokenBalances: [
        {
          accountIndex: 1,
          mint: "Mint1111111111111111111111111111111111111",
          owner: "Wallet11111111111111111111111111111111111",
          uiTokenAmount: { uiAmount: 3, decimals: 6 },
        },
      ],
    },
    transaction: {
      message: {
        instructions: [
          {
            parsed: {
              info: {
                mint: "Mint1111111111111111111111111111111111111",
                source: "Sender11111111111111111111111111111111111",
              },
            },
            programId: { toBase58: () => TOKEN_PROGRAM },
          },
        ],
      },
    },
  } as never;

  const events = extractInboundTransfersFromParsedTx(
    tx,
    "Wallet11111111111111111111111111111111111",
    "sig-1",
  );

  assert.equal(events.length, 1);
  assert.equal(events[0]?.uiAmount, 2);
  assert.equal(events[0]?.mint, "Mint1111111111111111111111111111111111111");
}

testPastAirdropParsing();
