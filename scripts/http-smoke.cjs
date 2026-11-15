const assert = require("node:assert/strict");
const origin = process.env.SMOKE_ORIGIN || "http://localhost:3000";
async function main() {
  let checks = 0;
  for (const route of [
    "/",
    "/parent",
    "/child",
    "/budgets/new",
    "/budgets/1",
    "/merchants",
    "/pay",
    "/merchant",
    "/admin",
    "/history",
    "/connect",
    "/settings",
  ]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /Money With Rules/, route);
    checks++;
  }
  for (const route of [
    "/api/profile",
    "/api/children",
    "/api/applications",
    "/api/admin/applications",
    "/api/attempts",
  ]) {
    const response = await fetch(origin + route, {
      headers: { "x-mwr-wallet": "0x1111111111111111111111111111111111111111" },
    });
    assert.equal(response.status, 401, `${route}: wallet header alone must not authenticate`);
    checks++;
  }
  for (const attackerOrigin of ["https://evil.example", "null"]) {
    const response = await fetch(origin + "/api/auth/nonce", {
      method: "POST",
      headers: { Origin: attackerOrigin, "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: "0x1111111111111111111111111111111111111111",
        chainId: 31337,
      }),
    });
    assert.equal(response.status, 403, "Cross-origin mutation must fail before database access");
    checks++;
  }
  const invalid = await fetch(origin + "/api/auth/nonce", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ wallet: "invalid", chainId: 1 }),
  });
  assert.equal(invalid.status, 400, "Malformed challenge must be rejected");
  checks++;
  console.log(
    `PASS: ${checks} HTTP checks (12 pages, 5 protected endpoints, 2 origin rejections, 1 schema rejection).`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
