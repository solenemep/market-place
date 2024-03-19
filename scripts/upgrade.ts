import { ethers } from "hardhat";
import { wait } from "./helpers/utils";

const args = process.env;
let tx: any;

let registry: any;

let erc721H: any;
let erc1155H: any;

let wallet: any;
let nftRegistry: any;
let listing: any;
let auction: any;

let registryAddress = "0x3636d12B61b3954B9c85792B1375E42d64Fc46E6";

async function main() {
  // DEPLOYER
  const [deployer] = await ethers.getSigners();
  console.log(
    "upgrading the contracts with the account : ",
    await deployer.getAddress()
  );

  // REGISTRY
  await getContracts();

  // UPGRADE
  await upgradeWallet();
  await upgradeNFTRegistry();
  await upgradeListing();
  await upgradeAuction();

  console.log("END");
}

async function getContracts() {
  // Registry
  const Registry = await ethers.getContractFactory("Registry");
  registry = Registry.attach(registryAddress);
  console.log("Registry address : ", await registry.getAddress());
  await wait(30_000);
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

async function upgradeWallet() {
  // IMPL
  wallet = await ethers.deployContract("Wallet");
  await wallet.waitForDeployment();
  const walletImpl = await wallet.getAddress();
  console.log("Wallet IMPL address : ", walletImpl);
  await wait(30_000);
  // UPGRADE
  await registry.upgradeContract(args.WALLET_ID, walletImpl);
  // CONTRACT
  const Wallet = await ethers.getContractFactory("Wallet");
  wallet = Wallet.attach(await registry.getContract(args.WALLET_ID));
  console.log("Wallet address : ", await wallet.getAddress());
  await wait(30_000);
  // DEPENDENCIES
  // NFTRegistry
  const NFTRegistry = await ethers.getContractFactory("NFTRegistry");
  nftRegistry = NFTRegistry.attach(
    await registry.getContract(args.NFT_REGISTRY_ID)
  );
  tx = await nftRegistry.setDependencies(await registry.getAddress());
  await tx.wait();
}

async function upgradeNFTRegistry() {
  // IMPL
  nftRegistry = await ethers.deployContract("NFTRegistry");
  await nftRegistry.waitForDeployment();
  const nftRegistryImpl = await nftRegistry.getAddress();
  console.log("NFTRegistry IMPL address : ", nftRegistryImpl);
  await wait(30_000);
  // UPGRADE
  await registry.upgradeContract(args.NFT_REGISTRY_ID, nftRegistryImpl);
  // CONTRACT
  const NFTRegistry = await ethers.getContractFactory("NFTRegistry");
  nftRegistry = NFTRegistry.attach(
    await registry.getContract(args.NFT_REGISTRY_ID)
  );
  console.log("NFTRegistry address : ", await nftRegistry.getAddress());
  await wait(30_000);
  // DEPENDENCIES
  // ERC721H
  tx = await erc721H.setDependencies(await registry.getAddress());
  await tx.wait();
  // ERC1155H
  tx = await erc1155H.setDependencies(await registry.getAddress());
  await tx.wait();
  // Wallet
  const Wallet = await ethers.getContractFactory("Wallet");
  wallet = Wallet.attach(await registry.getContract(args.WALLET_ID));
  tx = await wallet.setDependencies(await registry.getAddress());
  await tx.wait();
  // Listing
  const Listing = await ethers.getContractFactory("ListingMock");
  listing = Listing.attach(await registry.getContract(args.LISTING_ID));
  tx = await listing.setDependencies(await registry.getAddress());
  await tx.wait();
  // Auction
  const Auction = await ethers.getContractFactory("Auction");
  auction = Auction.attach(await registry.getContract(args.AUCTION_ID));
  tx = await auction.setDependencies(await registry.getAddress());
  await tx.wait();
}

async function upgradeListing() {
  // IMPL
  listing = await ethers.deployContract("Listing");
  await listing.waitForDeployment();
  const listingImpl = await listing.getAddress();
  console.log("Listing IMPL address : ", listingImpl);
  await wait(30_000);
  // UPGRADE
  await registry.upgradeContract(args.LISTING_ID, listingImpl);
  // CONTRACT
  const Listing = await ethers.getContractFactory("ListingMock");
  listing = Listing.attach(await registry.getContract(args.LISTING_ID));
  console.log("Listing address : ", await listing.getAddress());
  await wait(30_000);
  // DEPENDENCIES
  // Auction
  const Auction = await ethers.getContractFactory("Auction");
  auction = Auction.attach(await registry.getContract(args.AUCTION_ID));
  tx = await auction.setDependencies(await registry.getAddress());
  await tx.wait();
}

async function upgradeAuction() {
  // IMPL
  auction = await ethers.deployContract("Auction");
  await auction.waitForDeployment();
  const auctionImpl = await auction.getAddress();
  console.log("Auction IMPL address : ", auctionImpl);
  await wait(30_000);
  // UPGRADE
  await registry.upgradeContract(args.AUCTION_ID, auctionImpl);
  // CONTRACT
  const Auction = await ethers.getContractFactory("Auction");
  auction = Auction.attach(await registry.getContract(args.AUCTION_ID));
  console.log("Auction address : ", await auction.getAddress());
  await wait(30_000);
  // DEPENDENCIES
  // Listing
  const Listing = await ethers.getContractFactory("ListingMock");
  listing = Listing.attach(await registry.getContract(args.LISTING_ID));
  tx = await listing.setDependencies(await registry.getAddress());
  await tx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
