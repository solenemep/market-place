// npx hardhat run scripts/transferOwnership.ts --network haqqTestnet

import { ethers } from "hardhat";
import { wait } from "./helpers/utils";

const args = process.env;
let tx: any;

let registry: any;

let erc721H: any;
let erc1155H: any;

let registryAddress = "0x7745617D49355BB57E67581D6e6Ab1B765B96737";

let newOwner = "0x7f13400a55B85a33189b410EF2c1bF4853F2a818";

async function main() {
  // DEPLOYER
  const [signer] = await ethers.getSigners();
  console.log("ending auctions with the account : ", await signer.getAddress());

  // CONTRACTS
  await setUpContracts();

  // LOGIC
  await transferOwnership(erc721H, newOwner);
  await transferOwnership(erc1155H, newOwner);

  console.log("END");
}

async function setUpContracts() {
  // Registry
  const Registry = await ethers.getContractFactory("Registry");
  registry = Registry.attach(registryAddress);

  // ERC721H
  const ERC721H = await ethers.getContractFactory("ERC721H");
  erc721H = ERC721H.attach(await registry.getContract(args.ERC721H_ID));
  console.log("ERC721H address : ", await erc721H.getAddress());
  await wait(30_000);

  // ERC1155H
  const ERC1155H = await ethers.getContractFactory("ERC1155H");
  erc1155H = ERC1155H.attach(await registry.getContract(args.ERC1155H_ID));
  console.log("ERC1155H address : ", await erc1155H.getAddress());
  await wait(30_000);
}

async function transferOwnership(token: any, newOwner: any) {
  try {
    tx = await token.transferOwnership(newOwner);
  } catch (e) {
    console.log("failed transaction transferOwnership : ", tx.hash);
    console.log("tx : ", tx);
    console.log(e);
  }
  console.log("tx transferOwnership : ", tx.hash);
}

main().catch((error) => {
  console.error("error", error);
  process.exit(1);
});
