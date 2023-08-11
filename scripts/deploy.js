// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require('hardhat');
const { wait } = require('./helpers/utils');

const args = process.env;
let tx;

let registry;

let erc721H;
let erc1155H;

let wallet;
let nftRegistry;
let listing;
let auction;

let daoAddress;

async function main() {
  // DEPLOYER
  const [deployer] = await ethers.getSigners();
  console.log('deploying the contracts with the account : ', await deployer.getAddress());

  // DEPLOYMENT
  await deployContracts();
  await deployImplementations();

  // REGISTRY
  await addContracts();
  await addProxies();

  // UPGRADEABLE
  await deployProxies();
  await initContracts();

  // DEPENDENCIES
  await setDependencies();
  await setUps();

  console.log('END');
}

async function deployContracts() {
  // Registry
  registry = await ethers.deployContract('Registry');
  await registry.waitForDeployment();
  console.log('Registry address : ', await registry.getAddress());
  await wait(30_000);
  // ERC721H
  erc721H = await ethers.deployContract('ERC721H', [args.ERC721H_NAME, args.ERC721H_SYMBOL]);
  await erc721H.waitForDeployment();
  console.log('ERC721H address : ', await erc721H.getAddress());
  await wait(30_000);
  // ERC1155H
  erc1155H = await ethers.deployContract('ERC1155H', [args.ERC1155H_BASE_TOKEN_URI]);
  await erc1155H.waitForDeployment();
  console.log('ERC1155H address : ', await erc1155H.getAddress());
  await wait(30_000);
}

async function deployImplementations() {
  // Wallet
  wallet = await ethers.deployContract('Wallet');
  await wallet.waitForDeployment();
  console.log('Wallet IMPL address : ', await wallet.getAddress());
  await wait(30_000);
  // NFTRegistry
  nftRegistry = await ethers.deployContract('NFTRegistry');
  await nftRegistry.waitForDeployment();
  console.log('NFTRegistry IMPL address : ', await nftRegistry.getAddress());
  await wait(30_000);
  // Listing
  listing = await ethers.deployContract('Listing');
  await listing.waitForDeployment();
  console.log('Listing IMPL address : ', await listing.getAddress());
  await wait(30_000);
  // Auction
  auction = await ethers.deployContract('Auction');
  await auction.waitForDeployment();
  console.log('Auction IMPL address : ', await auction.getAddress());
  await wait(30_000);
}

async function addContracts() {
  // ERC721H
  tx = await registry.addContract(args.ERC721H_ID, await erc721H.getAddress());
  await tx.wait();
  // ERC1155H
  tx = await registry.addContract(args.ERC1155H_ID, await erc1155H.getAddress());
  await tx.wait();
  // DAO
  tx = await registry.addContract(args.DAO_ID, args.DAO_ADDRESS);
  await tx.wait();
}

async function addProxies() {
  // Wallet
  tx = await registry.addProxyContract(args.WALLET_ID, await wallet.getAddress());
  await tx.wait();
  // NFTRegistry
  tx = await registry.addProxyContract(args.NFT_REGISTRY_ID, await nftRegistry.getAddress());
  await tx.wait();
  // Listing
  tx = await registry.addProxyContract(args.LISTING_ID, await listing.getAddress());
  await tx.wait();
  // Auction
  tx = await registry.addProxyContract(args.AUCTION_ID, await auction.getAddress());
  await tx.wait();
}

async function deployProxies() {
  // Wallet
  const Wallet = await ethers.getContractFactory('Wallet');
  wallet = Wallet.attach(await registry.getContract(args.WALLET_ID));
  console.log('Wallet address : ', await wallet.getAddress());
  await wait(30_000);
  // NFTRegistry
  const NFTRegistry = await ethers.getContractFactory('NFTRegistry');
  nftRegistry = NFTRegistry.attach(await registry.getContract(args.NFT_REGISTRY_ID));
  console.log('NFTRegistry address : ', await nftRegistry.getAddress());
  await wait(30_000);
  // Listing
  const Listing = await ethers.getContractFactory('ListingMock');
  listing = Listing.attach(await registry.getContract(args.LISTING_ID));
  console.log('Listing address : ', await listing.getAddress());
  await wait(30_000);
  // Auction
  const Auction = await ethers.getContractFactory('Auction');
  auction = Auction.attach(await registry.getContract(args.AUCTION_ID));
  console.log('Auction address : ', await auction.getAddress());
  await wait(30_000);
}

async function initContracts() {
  // Wallet
  tx = await wallet.initialize();
  await tx.wait();
  // NFTRegistry
  tx = await nftRegistry.initialize();
  await tx.wait();
  // Listing
  tx = await listing.initialize();
  await tx.wait();
  // Auction
  tx = await auction.initialize();
  await tx.wait();
}

async function setDependencies() {
  // ERC721H
  tx = await erc721H.setDependencies(await registry.getAddress());
  await tx.wait();
  // ERC1155H
  tx = await erc1155H.setDependencies(await registry.getAddress());
  await tx.wait();
  // Wallet
  tx = await wallet.setDependencies(await registry.getAddress());
  await tx.wait();
  // NFTRegistry
  tx = await nftRegistry.setDependencies(await registry.getAddress());
  await tx.wait();
  // Listing
  tx = await listing.setDependencies(await registry.getAddress());
  await tx.wait();
  // Auction
  tx = await auction.setDependencies(await registry.getAddress());
  await tx.wait();
}

async function setUps() {
  // DAO
  daoAddress = await registry.getContract(args.DAO_ID);
  console.log('DAO address : ', daoAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
