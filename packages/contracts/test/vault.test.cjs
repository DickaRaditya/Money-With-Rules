const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const dcr = ethers.parseEther;

async function fixture() {
  const [admin, parent, child, food, school, otherParent, otherChild, stranger, food2] =
    await ethers.getSigners();
  const token = await ethers.deployContract("MockToken", [admin.address]);
  const registry = await ethers.deployContract("MerchantRegistry", [admin.address]);
  const vault = await ethers.deployContract("MoneyWithRulesVault", [token.target, registry.target]);
  await token.mint(parent.address, dcr("10000"));
  await token.mint(otherParent.address, dcr("10000"));
  await registry.setMerchant(food.address, 1);
  await registry.setMerchant(food2.address, 1);
  await registry.setMerchant(school.address, 2);
  await token.connect(parent).approve(vault.target, ethers.MaxUint256);
  await token.connect(otherParent).approve(vault.target, ethers.MaxUint256);
  const now = await time.latest();
  const rules = {
    category: 0,
    startsAt: now - 10,
    endsAt: now + 86400 * 30,
    maxPerPayment: dcr("100"),
    dailyLimit: dcr("150"),
  };
  await vault.connect(parent).createBudget(child.address, "Lunch", rules, dcr("1000"), false, []);
  return {
    admin,
    parent,
    child,
    food,
    school,
    otherParent,
    otherChild,
    stranger,
    food2,
    token,
    registry,
    vault,
    rules,
  };
}

describe("MoneyWithRulesVault: policy and accounting", function () {
  it("creates a unique budget with exact escrow and ownership", async function () {
    const { vault, token, parent, child } = await loadFixture(fixture);
    const b = await vault.getBudget(1);
    expect(b.parent).to.equal(parent.address);
    expect(b.beneficiary).to.equal(child.address);
    expect(b.balance).to.equal(dcr("1000"));
    expect(b.totalFunded).to.equal(dcr("1000"));
    expect(await token.balanceOf(vault.target)).to.equal(await vault.totalEscrow());
    expect(await vault.budgetIds(parent.address, true, 0, 100)).to.deep.equal([1n]);
    expect(await vault.budgetCount(child.address, false)).to.equal(1);
    expect(await vault.budgetIds(child.address, false, 1, 10)).to.deep.equal([]);
    await expect(vault.budgetIds(parent.address, true, 0, 101)).to.be.revertedWithCustomError(
      vault,
      "InvalidConfiguration",
    );
  });
  it("requires approval; failed create rolls back budget ID and all accounting", async function () {
    const { vault, token, parent, child, rules } = await loadFixture(fixture);
    await token.connect(parent).approve(vault.target, 0);
    await expect(vault.connect(parent).createBudget(child.address, "New", rules, 10, false, [])).to
      .be.reverted;
    expect(await vault.nextBudgetId()).to.equal(2);
    expect(await vault.totalEscrow()).to.equal(dcr("1000"));
  });
  it("isolates multiple parents and children and pays only the selected budget", async function () {
    const { vault, parent, child, otherParent, otherChild, rules, food } =
      await loadFixture(fixture);
    await vault
      .connect(otherParent)
      .createBudget(child.address, "Second parent", rules, 500, false, []);
    await vault
      .connect(parent)
      .createBudget(otherChild.address, "Second child", rules, 700, false, []);
    await vault.connect(child).pay(2, food.address, 100);
    expect((await vault.getBudget(1)).balance).to.equal(dcr("1000"));
    expect((await vault.getBudget(2)).balance).to.equal(400);
    expect((await vault.getBudget(3)).balance).to.equal(700);
  });
  it("sends tokens directly to a verified merchant and emits unique receipts", async function () {
    const { vault, child, food, token } = await loadFixture(fixture);
    await expect(vault.connect(child).pay(1, food.address, dcr("60")))
      .to.emit(vault, "PaymentCompleted")
      .withArgs(1, child.address, food.address, dcr("60"), 1);
    await expect(vault.connect(child).pay(1, food.address, dcr("40")))
      .to.emit(vault, "PaymentCompleted")
      .withArgs(1, child.address, food.address, dcr("40"), 2);
    expect(await token.balanceOf(food.address)).to.equal(dcr("100"));
    expect((await vault.getBudget(1)).balance).to.equal(dcr("900"));
    expect(await token.balanceOf(child.address)).to.equal(0);
  });

  const cases = [
    ["unknown budget", 1, async (f) => [999, f.child, f.food.address, 1]],
    ["wrong beneficiary", 2, async (f) => [1, f.stranger, f.food.address, 1]],
    [
      "paused budget",
      3,
      async (f) => {
        await f.vault.connect(f.parent).setPaused(1, true);
        return [1, f.child, f.food.address, 1];
      },
    ],
    [
      "not started",
      4,
      async (f) => {
        await f.vault
          .connect(f.parent)
          .updateRules(1, { ...f.rules, startsAt: (await time.latest()) + 1000 });
        return [1, f.child, f.food.address, 1];
      },
    ],
    [
      "expired budget",
      5,
      async (f) => {
        await time.increaseTo(f.rules.endsAt + 1);
        return [1, f.child, f.food.address, 1];
      },
    ],
    ["zero amount", 6, async (f) => [1, f.child, f.food.address, 0]],
    ["unverified merchant", 7, async (f) => [1, f.child, f.stranger.address, 1]],
    ["wrong category", 8, async (f) => [1, f.child, f.school.address, 1]],
    [
      "not whitelisted",
      9,
      async (f) => {
        await f.vault.connect(f.parent).setWhitelistEnabled(1, true);
        return [1, f.child, f.food.address, 1];
      },
    ],
    ["insufficient funds", 10, async (f) => [1, f.child, f.food.address, dcr("1001")]],
    ["transaction limit", 11, async (f) => [1, f.child, f.food.address, dcr("101")]],
    [
      "daily limit",
      12,
      async (f) => {
        await f.vault.connect(f.child).pay(1, f.food.address, dcr("100"));
        return [1, f.child, f.food.address, dcr("51")];
      },
    ],
    [
      "self-payment",
      13,
      async (f) => {
        await f.registry.setMerchant(f.child.address, 1);
        return [1, f.child, f.child.address, 1];
      },
    ],
    [
      "payment to parent",
      13,
      async (f) => {
        await f.registry.setMerchant(f.parent.address, 1);
        return [1, f.child, f.parent.address, 1];
      },
    ],
    ["payment to vault", 13, async (f) => [1, f.child, f.vault.target, 1]],
  ];
  for (const [name, reason, prepare] of cases)
    it(`rejects ${name}; preview agrees and no tokens, IDs or logs persist`, async function () {
      const f = await loadFixture(fixture);
      const [id, signer, merchant, amount] = await prepare(f);
      const balance = await f.token.balanceOf(f.vault.target);
      const before = await f.vault.getBudget(1);
      const paymentId = await f.vault.nextPaymentId();
      const logCount = (await f.vault.queryFilter(f.vault.filters.PaymentCompleted())).length;
      expect(await f.vault.checkPayment(id, signer.address, merchant, amount)).to.equal(reason);
      await expect(f.vault.connect(signer).pay(id, merchant, amount))
        .to.be.revertedWithCustomError(f.vault, "PaymentRejected")
        .withArgs(reason);
      expect(await f.token.balanceOf(f.vault.target)).to.equal(balance);
      expect((await f.vault.getBudget(1)).balance).to.equal(before.balance);
      expect(await f.vault.nextPaymentId()).to.equal(paymentId);
      expect((await f.vault.queryFilter(f.vault.filters.PaymentCompleted())).length).to.equal(
        logCount,
      );
    });

  it("allows exact limits and resets the daily window only at midnight UTC", async function () {
    const f = await loadFixture(fixture);
    await time.increaseTo((Math.floor((await time.latest()) / 86400) + 1) * 86400 + 60);
    await f.vault.connect(f.child).pay(1, f.food.address, dcr("100"));
    await f.vault.connect(f.child).pay(1, f.food.address, dcr("50"));
    expect(await f.vault.checkPayment(1, f.child.address, f.food.address, 1)).to.equal(12);
    await time.increaseTo((Math.floor((await time.latest()) / 86400) + 1) * 86400);
    expect(await f.vault.checkPayment(1, f.child.address, f.food.address, dcr("100"))).to.equal(0);
  });
  it("does not reset daily spending by editing limits or toggling pause", async function () {
    const f = await loadFixture(fixture);
    await f.vault.connect(f.child).pay(1, f.food.address, dcr("100"));
    await f.vault.connect(f.parent).setPaused(1, true);
    await f.vault.connect(f.parent).updateRules(1, { ...f.rules, dailyLimit: dcr("90") });
    await f.vault.connect(f.parent).setPaused(1, false);
    expect(await f.vault.checkPayment(1, f.child.address, f.food.address, 1)).to.equal(12);
  });
  it("supports unlimited daily policy without ignoring per-transaction limits", async function () {
    const f = await loadFixture(fixture);
    await f.vault.connect(f.parent).updateRules(1, { ...f.rules, dailyLimit: 0 });
    for (let i = 0; i < 3; i++) await f.vault.connect(f.child).pay(1, f.food.address, dcr("100"));
    expect((await f.vault.getBudget(1)).totalSpent).to.equal(dcr("300"));
  });
  it("enforces whitelist in addition to registry approval", async function () {
    const f = await loadFixture(fixture);
    await f.vault
      .connect(f.parent)
      .createBudget(f.child.address, "Only canteen", f.rules, 100, true, [
        f.food.address,
        f.school.address,
      ]);
    await f.vault.connect(f.child).pay(2, f.food.address, 10);
    expect(await f.vault.checkPayment(2, f.child.address, f.food2.address, 10)).to.equal(9);
    expect(await f.vault.checkPayment(2, f.child.address, f.school.address, 10)).to.equal(8);
    await f.vault.connect(f.parent).setMerchantAllowed(2, f.food.address, false);
    expect(await f.vault.checkPayment(2, f.child.address, f.food.address, 10)).to.equal(9);
  });
  it("applies merchant suspension, category disablement, and revocation immediately", async function () {
    const f = await loadFixture(fixture);
    await f.registry.setSuspended(f.food.address, true);
    expect(await f.vault.checkPayment(1, f.child.address, f.food.address, 10)).to.equal(7);
    await f.registry.setMerchant(f.food.address, 3); // Does not remove suspension.
    expect(await f.registry.isVerified(f.food.address)).to.equal(false);
    await f.registry.setSuspended(f.food.address, false);
    await f.registry.setCategoryEnabled(0, false);
    expect(await f.vault.checkPayment(1, f.child.address, f.food.address, 10)).to.equal(8);
    await f.registry.setCategoryEnabled(0, true);
    await f.registry.revokeMerchant(f.food.address);
    expect(await f.vault.checkPayment(1, f.child.address, f.food.address, 10)).to.equal(7);
  });
  it("prevents beneficiary, stranger, and administrator from all parent operations", async function () {
    const f = await loadFixture(fixture);
    for (const account of [f.child, f.stranger, f.admin]) {
      const v = f.vault.connect(account);
      for (const action of [
        () => v.addFunds(1, 1),
        () => v.updateRules(1, f.rules),
        () => v.setPaused(1, true),
        () => v.setWhitelistEnabled(1, true),
        () => v.setMerchantAllowed(1, f.food.address, true),
        () => v.withdrawUnused(1, 1),
        () => v.reallocate(1, 2, 1),
      ]) {
        await expect(action()).to.be.revertedWithCustomError(f.vault, "NotParent");
      }
    }
  });
  it("adds funds by exact transferFrom", async function () {
    const f = await loadFixture(fixture);
    await expect(f.vault.connect(f.parent).addFunds(1, 500))
      .to.emit(f.vault, "BudgetFunded")
      .withArgs(1, 500);
    expect((await f.vault.getBudget(1)).balance).to.equal(dcr("1000") + 500n);
  });
  it("controls parent withdrawals and records them on chain", async function () {
    const f = await loadFixture(fixture);
    await expect(f.vault.connect(f.parent).withdrawUnused(1, 100)).to.be.revertedWithCustomError(
      f.vault,
      "BudgetMustBePausedOrExpired",
    );
    await f.vault.connect(f.parent).setPaused(1, true);
    await expect(f.vault.connect(f.parent).withdrawUnused(1, 100))
      .to.emit(f.vault, "ParentWithdrawal")
      .withArgs(1, f.parent.address, 100);
    expect((await f.vault.getBudget(1)).totalWithdrawn).to.equal(100);
    expect(await f.token.balanceOf(f.vault.target)).to.equal(await f.vault.totalEscrow());
  });
  it("permits unused withdrawal after expiry without an extra pause", async function () {
    const f = await loadFixture(fixture);
    await time.increaseTo(f.rules.endsAt + 1);
    await f.vault.connect(f.parent).withdrawUnused(1, dcr("1000"));
    expect(await f.vault.totalEscrow()).to.equal(0);
  });
  it("reallocates only between same-parent same-child budgets with a paused source", async function () {
    const f = await loadFixture(fixture);
    await f.vault
      .connect(f.parent)
      .createBudget(f.child.address, "Books", { ...f.rules, category: 1 }, 500, false, []);
    await expect(f.vault.connect(f.parent).reallocate(1, 2, 100)).to.be.revertedWithCustomError(
      f.vault,
      "InvalidReallocation",
    );
    await f.vault.connect(f.parent).setPaused(1, true);
    const escrow = await f.vault.totalEscrow();
    await expect(f.vault.connect(f.parent).reallocate(1, 2, 100))
      .to.emit(f.vault, "FundsReallocated")
      .withArgs(1, 2, 100);
    expect((await f.vault.getBudget(2)).balance).to.equal(600);
    expect(await f.vault.totalEscrow()).to.equal(escrow);
    await f.vault
      .connect(f.parent)
      .createBudget(f.otherChild.address, "Other child", f.rules, 500, false, []);
    await expect(f.vault.connect(f.parent).reallocate(1, 3, 100)).to.be.revertedWithCustomError(
      f.vault,
      "InvalidReallocation",
    );
    await f.vault
      .connect(f.otherParent)
      .createBudget(f.child.address, "Other parent", f.rules, 500, false, []);
    await expect(f.vault.connect(f.parent).reallocate(1, 4, 100)).to.be.revertedWithCustomError(
      f.vault,
      "NotParent",
    );
  });
  it("prevents double-spend and preserves the full accounting identity", async function () {
    const f = await loadFixture(fixture);
    await f.vault
      .connect(f.parent)
      .updateRules(1, { ...f.rules, maxPerPayment: dcr("1000"), dailyLimit: 0 });
    await f.vault.connect(f.child).pay(1, f.food.address, dcr("1000"));
    await expect(f.vault.connect(f.child).pay(1, f.food.address, 1))
      .to.be.revertedWithCustomError(f.vault, "PaymentRejected")
      .withArgs(10);
    const b = await f.vault.getBudget(1);
    expect(b.balance + b.totalSpent + b.totalWithdrawn + b.movedOut).to.equal(
      b.totalFunded + b.movedIn,
    );
    expect(await f.vault.totalEscrow()).to.equal(0);
  });
  it("maintains accounting under a deterministic sequence of payments, top-ups, and withdrawals", async function () {
    const f = await loadFixture(fixture);
    await f.vault.connect(f.parent).updateRules(1, { ...f.rules, dailyLimit: 0 });
    for (let i = 1; i <= 24; i++) {
      if (i % 4 === 0) await f.vault.connect(f.parent).addFunds(1, BigInt(i * 7));
      else await f.vault.connect(f.child).pay(1, f.food.address, BigInt(i * 13));
      const b = await f.vault.getBudget(1);
      expect(b.balance + b.totalSpent + b.totalWithdrawn + b.movedOut).to.equal(
        b.totalFunded + b.movedIn,
      );
      expect(await f.token.balanceOf(f.vault.target)).to.equal(await f.vault.totalEscrow());
    }
  });
  it("rejects malformed budgets and bounds whitelist initialization", async function () {
    const f = await loadFixture(fixture);
    for (const rules of [
      { ...f.rules, category: 4 },
      { ...f.rules, startsAt: f.rules.endsAt },
      { ...f.rules, maxPerPayment: 0 },
      { ...f.rules, endsAt: 1 },
    ])
      await expect(
        f.vault.connect(f.parent).createBudget(f.child.address, "Bad", rules, 100, false, []),
      ).to.be.revertedWithCustomError(f.vault, "InvalidConfiguration");
    await expect(
      f.vault
        .connect(f.parent)
        .createBudget(f.child.address, "Bad", f.rules, 100, true, Array(33).fill(f.food.address)),
    ).to.be.revertedWithCustomError(f.vault, "InvalidConfiguration");
    await expect(
      f.vault.connect(f.parent).createBudget(f.parent.address, "Self", f.rules, 100, false, []),
    ).to.be.revertedWithCustomError(f.vault, "InvalidConfiguration");
  });
});

describe("Registry and mint authority", function () {
  it("reserves minting and merchant administration to the owner", async function () {
    const f = await loadFixture(fixture);
    await expect(f.token.connect(f.child).mint(f.child.address, 1)).to.be.revertedWithCustomError(
      f.token,
      "OwnableUnauthorizedAccount",
    );
    await expect(f.token.mint(f.child.address, dcr("1000000"))).to.be.revertedWithCustomError(
      f.token,
      "SupplyCapExceeded",
    );
    for (const action of [
      () => f.registry.connect(f.parent).setMerchant(f.stranger.address, 1),
      () => f.registry.connect(f.parent).setSuspended(f.food.address, true),
      () => f.registry.connect(f.parent).revokeMerchant(f.food.address),
      () => f.registry.connect(f.parent).setCategoryEnabled(0, false),
    ])
      await expect(action()).to.be.revertedWithCustomError(
        f.registry,
        "OwnableUnauthorizedAccount",
      );
  });
  it("supports multiple categories, bounded types, and two-step ownership", async function () {
    const f = await loadFixture(fixture);
    await f.registry.setMerchant(f.food.address, 3);
    expect(await f.registry.isAllowed(f.food.address, 0)).to.equal(true);
    expect(await f.registry.isAllowed(f.food.address, 1)).to.equal(true);
    expect(await f.registry.isAllowed(f.food.address, 4)).to.equal(false);
    await expect(f.registry.setMerchant(f.food.address, 16)).to.be.revertedWithCustomError(
      f.registry,
      "InvalidCategory",
    );
    await f.registry.transferOwnership(f.otherParent.address);
    expect(await f.registry.owner()).to.equal(f.admin.address);
    await f.registry.connect(f.otherParent).acceptOwnership();
    expect(await f.registry.owner()).to.equal(f.otherParent.address);
  });
});

describe("SafeERC20 and reentrancy", function () {
  async function attackFixture() {
    const f = await fixture();
    const token = await ethers.deployContract("AdversarialToken");
    const vault = await ethers.deployContract("MoneyWithRulesVault", [
      token.target,
      f.registry.target,
    ]);
    await token.mint(f.parent.address, 10000);
    await token.connect(f.parent).approve(vault.target, 10000);
    return { ...f, token, vault };
  }
  for (const mode of [1, 2, 3])
    it(`rolls back deposits from a malicious token (mode ${mode})`, async function () {
      const f = await loadFixture(attackFixture);
      await f.token.configure(
        mode,
        f.vault.target,
        f.vault.interface.encodeFunctionData("addFunds", [1, 1]),
      );
      await expect(
        f.vault.connect(f.parent).createBudget(f.child.address, "Attack", f.rules, 100, false, []),
      ).to.be.reverted;
      expect(await f.vault.totalEscrow()).to.equal(0);
      expect(await f.vault.nextBudgetId()).to.equal(1);
    });
  for (const mode of [1, 2, 3])
    it(`rolls back outgoing token failure, fee, or reentrancy (mode ${mode})`, async function () {
      const f = await loadFixture(attackFixture);
      await f.vault
        .connect(f.parent)
        .createBudget(f.child.address, "Attack", f.rules, 100, false, []);
      await f.token.configure(
        mode,
        f.vault.target,
        f.vault.interface.encodeFunctionData("pay", [1, f.food.address, 1]),
      );
      await expect(f.vault.connect(f.child).pay(1, f.food.address, 50)).to.be.reverted;
      expect((await f.vault.getBudget(1)).balance).to.equal(100);
      expect(await f.vault.nextPaymentId()).to.equal(1);
      expect(await f.token.balanceOf(f.food.address)).to.equal(0);
      expect((await f.vault.queryFilter(f.vault.filters.PaymentCompleted())).length).to.equal(0);
    });
});
