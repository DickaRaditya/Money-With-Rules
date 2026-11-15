import test from "node:test";
import assert from "node:assert/strict";
import { createSiweMessage } from "viem/siwe";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { amount } from "../src/lib/utils";
import { parsePaymentRequest } from "../src/lib/qr";
import { hashSession, sameOrigin, validChallenge } from "../src/lib/auth-policy";

const merchant = "0x1111111111111111111111111111111111111111";
const vault = "0x2222222222222222222222222222222222222222";
test("amount parsing is exact for 18 decimals and rejects unsafe or ambiguous input", () => {
  assert.equal(amount("12.000000000000000001"), 12000000000000000001n);
  assert.equal(amount("0", true), 0n);
  for (const input of [
    "0",
    "-1",
    "1,000",
    "1e3",
    "1.0000000000000000001",
    "Infinity",
    "",
    "9".repeat(79),
  ])
    assert.throws(() => amount(input));
});
test("QR requests bind version, chain, deployment, destination, and positive amount", () => {
  const request = { v: 1, chainId: 31337, vault, merchant, amount: "45.25" };
  assert.deepEqual(parsePaymentRequest(JSON.stringify(request), 31337, vault), request);
  for (const changes of [
    { chainId: 84532 },
    { vault: merchant },
    { v: 2 },
    { merchant: "javascript:alert(1)" },
    { amount: "-1" },
    { amount: 45 },
    { amount: "0" },
  ])
    assert.throws(() =>
      parsePaymentRequest(JSON.stringify({ ...request, ...changes }), 31337, vault),
    );
  for (const input of ["null", "{}", "not-json"])
    assert.throws(() => parsePaymentRequest(input, 31337, vault));
});
test("same-origin policy rejects absent, hostile, and deceptively prefixed origins", () => {
  assert.equal(sameOrigin("http://localhost:3000", "http://localhost:3000"), true);
  for (const input of [
    null,
    "null",
    "https://evil.example",
    "http://localhost:3000.evil.example",
    "http://localhost:3001",
  ])
    assert.equal(sameOrigin(input, "http://localhost:3000"), false);
});
test("SIWE challenge binds wallet, chain, domain, URI, nonce, and expiration", async () => {
  const account = privateKeyToAccount(generatePrivateKey()); // Ephemeral, never persisted.
  const now = new Date("2026-11-15T00:00:00Z");
  const input = {
    address: account.address,
    chainId: 31337,
    domain: "localhost:3000",
    uri: "http://localhost:3000",
    version: "1" as const,
    nonce: "abcdef1234567890",
    issuedAt: now,
    expirationTime: new Date(now.getTime() + 300000),
  };
  const message = createSiweMessage(input);
  assert.equal(validChallenge(message, account.address, input.nonce, 31337, input.uri, now), true);
  assert.equal(validChallenge(message, merchant, input.nonce, 31337, input.uri, now), false);
  assert.equal(
    validChallenge(message, account.address, "differentnonce", 31337, input.uri, now),
    false,
  );
  assert.equal(validChallenge(message, account.address, input.nonce, 84532, input.uri, now), false);
  assert.equal(
    validChallenge(message, account.address, input.nonce, 31337, "https://evil.example", now),
    false,
  );
  assert.equal(
    validChallenge(
      message,
      account.address,
      input.nonce,
      31337,
      input.uri,
      new Date(now.getTime() + 301000),
    ),
    false,
  );
  const signature = await account.signMessage({ message });
  assert.equal(await verifyMessage({ address: account.address, message, signature }), true);
  assert.equal(await verifyMessage({ address: merchant, message, signature }), false);
});
test("session storage uses a one-way digest, not the raw bearer token", () => {
  const token = "a".repeat(64);
  assert.notEqual(hashSession(token), token);
  assert.equal(hashSession(token).length, 64);
  assert.notEqual(hashSession(token), hashSession("b".repeat(64)));
});
