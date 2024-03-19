// ===================
// ||   ATTENTION   ||
// ===================
// Make sure before running script on mainnet to correctly fill .env file with DAO address and commission address

import { ethers } from "hardhat";
import { wait } from "./helpers/utils";

const args = process.env;
let tx: any;

let erc721H: any;
let erc1155H: any;

async function main() {
  // DEPLOYER
  const [deployer] = await ethers.getSigners();
  console.log(
    "deploying the contracts with the account : ",
    await deployer.getAddress()
  );

  // DEPLOYMENT
  await deployContracts();

  // DEPENDENCIES
  await setDependencies();

  console.log("END");
}

async function deployContracts() {
  // ERC721H
  erc721H = await ethers.deployContract("ERC721H", [
    args.ERC721H_NAME,
    args.ERC721H_SYMBOL,
    args.SYSTEM_ADDRESS,
  ]);
  await erc721H.waitForDeployment();
  console.log("ERC721H address : ", await erc721H.getAddress());
  await wait(30_000);
  // ERC1155H
  erc1155H = await ethers.deployContract("ERC1155H", [
    args.ERC1155H_BASE_TOKEN_URI,
    args.SYSTEM_ADDRESS,
  ]);
  await erc1155H.waitForDeployment();
  console.log("ERC1155H address : ", await erc1155H.getAddress());
  await wait(30_000);
}

async function setDependencies() {
  // ERC721H
  tx = await erc721H.setDependencies(args.REGISTRY_ADDRESS);
  await tx.wait();
  // ERC1155H
  tx = await erc1155H.setDependencies(args.REGISTRY_ADDRESS);
  await tx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
