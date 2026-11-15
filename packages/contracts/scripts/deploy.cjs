const { ethers, network } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const [deployer, parent, child, food, education, transport, other] = await ethers.getSigners();
  if (!deployer) throw new Error("Set DEPLOYER_PRIVATE_KEY and fund it with Base Sepolia ETH.");
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (![31337, 84532].includes(chainId))
    throw new Error("Only local and Base Sepolia are supported.");
  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  const token = await ethers.deployContract("MockToken", [admin]);
  await token.waitForDeployment();
  const registry = await ethers.deployContract("MerchantRegistry", [admin]);
  await registry.waitForDeployment();
  const vault = await ethers.deployContract("MoneyWithRulesVault", [token.target, registry.target]);
  await vault.waitForDeployment();
  const receipt = await token.deploymentTransaction().wait();
  const result = {
    chainId,
    token: token.target,
    registry: registry.target,
    vault: vault.target,
    blockNumber: receipt.blockNumber,
    merchants: [],
    wallets: {},
  };
  if (chainId === 31337) {
    if (admin.toLowerCase() !== deployer.address.toLowerCase())
      throw new Error("Unset ADMIN_ADDRESS for the local seed.");
    const rows = [
      [food, "Kantin Nusantara", 0, "Kampus • Makanan"],
      [education, "Ruang Buku", 1, "Kampus • Pendidikan"],
      [transport, "Jalan Bersama", 2, "Jakarta • Transportasi"],
      [other, "Toko Serba Ada", 3, "Jakarta • Lainnya"],
    ];
    for (const [wallet, name, category, location] of rows) {
      await (await registry.setMerchant(wallet.address, 1 << category)).wait();
      result.merchants.push({ address: wallet.address, name, category, location });
    }
    await (await token.mint(parent.address, ethers.parseEther("5000"))).wait();
    result.wallets = { admin: deployer.address, parent: parent.address, child: child.address };
  }
  const directory = path.resolve(__dirname, "../../../apps/web/src/generated");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "deployment.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ network: network.name, ...result }, null, 2));
  console.log(
    "Deployment addresses written to apps/web/src/generated/deployment.json. Restart Next.js after redeployment.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
