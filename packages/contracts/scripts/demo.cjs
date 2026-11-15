const { ethers } = require("hardhat");
const assert = require("node:assert/strict");
const deployment = require("../../../apps/web/src/generated/deployment.json");

async function main() {
  if (
    Number((await ethers.provider.getNetwork()).chainId) !== 31337 ||
    deployment.chainId !== 31337
  )
    throw new Error("This seed/demo only runs on local Hardhat. Run npm run deploy:local first.");
  const [admin, parent, child, food, school] = await ethers.getSigners();
  const token = await ethers.getContractAt("MockToken", deployment.token);
  const vault = await ethers.getContractAt("MoneyWithRulesVault", deployment.vault);
  await (await token.connect(admin).mint(parent.address, ethers.parseEther("2500"))).wait();
  await (await token.connect(parent).approve(vault.target, ethers.parseEther("2500"))).wait();
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const rules = {
    category: 0,
    startsAt: now - 1,
    endsAt: now + 30 * 86400,
    maxPerPayment: ethers.parseEther("150"),
    dailyLimit: ethers.parseEther("250"),
  };
  const firstId = await vault.nextBudgetId();
  for (const [name, amount, category] of [
    ["Makan & minum", "1200", 0],
    ["Belajar & berkembang", "800", 1],
    ["Perjalanan harian", "500", 2],
  ])
    await (
      await vault
        .connect(parent)
        .createBudget(
          child.address,
          name,
          { ...rules, category },
          ethers.parseEther(amount),
          false,
          [],
        )
    ).wait();
  const amount = ethers.parseEther("45");
  assert.equal(await vault.checkPayment(firstId, child.address, food.address, amount), 0n);
  const merchantBefore = await token.balanceOf(food.address);
  const tx = await vault.connect(child).pay(firstId, food.address, amount);
  const receipt = await tx.wait();
  assert.equal(await token.balanceOf(food.address), merchantBefore + amount);
  assert.equal((await vault.getBudget(firstId)).balance, ethers.parseEther("1155"));
  assert.equal((await vault.getBudget(firstId + 1n)).balance, ethers.parseEther("800"));
  assert.equal(await vault.checkPayment(firstId, child.address, school.address, amount), 8n);
  const before = await token.balanceOf(vault.target);
  await assert.rejects(
    vault.connect(child).pay(firstId, school.address, amount),
    /PaymentRejected/,
  );
  assert.equal(await token.balanceOf(vault.target), before);
  assert.equal(await token.balanceOf(vault.target), await vault.totalEscrow());
  console.log(
    JSON.stringify(
      {
        result: "PASS",
        minted: "2500 DCR",
        budgetId: String(firstId),
        paid: "45 DCR",
        remaining: "1155 DCR",
        receipt: receipt.hash,
        rejectedWrongCategory: true,
        isolatedAccounting: true,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
