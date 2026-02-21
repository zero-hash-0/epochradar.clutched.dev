import assert from "node:assert/strict";
import { isTrustedClaimDomain } from "../airdropProviders/trustedDomains";

export function testTrustedDomainValidation() {
  assert.equal(isTrustedClaimDomain("https://jup.ag/claim", ["jup.ag"]), true);
  assert.equal(isTrustedClaimDomain("https://app.marginfi.com/claim", ["marginfi.com"]), true);
  assert.equal(isTrustedClaimDomain("http://jup.ag/claim", ["jup.ag"]), false);
  assert.equal(isTrustedClaimDomain("https://evil-jup.ag/claim", ["jup.ag"]), false);
}

testTrustedDomainValidation();
