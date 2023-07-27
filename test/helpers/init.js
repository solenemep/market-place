const { ethers, upgrades } = require('hardhat');

const args = process.env;

let registry;

let erc721H;
let erc1155H;
let nftIdentifier;

let wallet;
let nftRegistry;
let listing;
let auction;

let daoAddress;

const init = async () => {
  const users = await ethers.getSigners();

  await deployContracts();
  await deployImplementations();

  await addContracts();
  await addProxies();

  await deployProxies();
  await initContracts();

  await setDependencies();

  await setUps();

  return {
    users,
    registry,
    erc721H,
    erc1155H,
    nftIdentifier,
    wallet,
    nftRegistry,
    listing,
    auction,
    daoAddress,
  };
};

async function deployContracts() {
  // Registry
  registry = await ethers.deployContract('Registry');
  await registry.waitForDeployment();
  // ERC721H
  erc721H = await ethers.deployContract('ERC721H', [args.ERC721H_NAME, args.ERC721H_SYMBOL]);
  await erc721H.waitForDeployment();
  // ERC1155H
  erc1155H = await ethers.deployContract('ERC1155H', [args.ERC1155H_BASE_TOKEN_URI]);
  await erc1155H.waitForDeployment();
  // NFTIdentifier
  nftIdentifier = await ethers.deployContract('NFTIdentifier');
  await nftIdentifier.waitForDeployment();
}

async function deployImplementations() {
  // Wallet
  wallet = await ethers.deployContract('Wallet');
  await wallet.waitForDeployment();
  // NFTRegistry
  nftRegistry = await ethers.deployContract('NFTRegistry');
  await nftRegistry.waitForDeployment();
  // Listing
  listing = await ethers.deployContract('Listing');
  await listing.waitForDeployment();
  // Auction
  auction = await ethers.deployContract('Auction');
  await auction.waitForDeployment();
}

async function addContracts() {
  // ERC721H
  await registry.addContract(args.ERC721H_ID, await erc721H.getAddress());
  // ERC1155H
  await registry.addContract(args.ERC1155H_ID, await erc1155H.getAddress());
  // NFTIdentifier
  await registry.addContract(args.NFT_IDENTIFIER_ID, await nftIdentifier.getAddress());
  // DAO
  await registry.addContract(args.DAO_ID, args.DAO_ADDRESS);
}

async function addProxies() {
  // Wallet
  await registry.addProxyContract(args.WALLET_ID, await wallet.getAddress());
  // NFTRegistry
  await registry.addProxyContract(args.NFT_REGISTRY_ID, await nftRegistry.getAddress());
  // Listing
  await registry.addProxyContract(args.LISTING_ID, await listing.getAddress());
  // Auction
  await registry.addProxyContract(args.AUCTION_ID, await auction.getAddress());
}

async function deployProxies() {
  // Wallet
  const Wallet = await hre.ethers.getContractFactory('Wallet');
  wallet = Wallet.attach(await registry.getContract(args.WALLET_ID));
  // NFTRegistry
  const NFTRegistry = await hre.ethers.getContractFactory('NFTRegistry');
  nftRegistry = NFTRegistry.attach(await registry.getContract(args.NFT_REGISTRY_ID));
  // Listing
  const Listing = await hre.ethers.getContractFactory('Listing');
  listing = Listing.attach(await registry.getContract(args.LISTING_ID));
  // Auction
  const Auction = await hre.ethers.getContractFactory('Auction');
  auction = Auction.attach(await registry.getContract(args.AUCTION_ID));
}

async function initContracts() {
  // Wallet
  await wallet.__Wallet_init();
  // NFTRegistry
  await nftRegistry.__NFTRegistry_init();
  // Listing
  await listing.__Listing_init();
  // Auction
  await auction.__Auction_init();
}

async function setDependencies() {
  // Wallet
  await wallet.setDependencies(await registry.getAddress());
  // NFTRegistry
  await nftRegistry.setDependencies(await registry.getAddress());
  // Listing
  await listing.setDependencies(await registry.getAddress());
  // Auction
  await auction.setDependencies(await registry.getAddress());
}

async function setUps() {
  daoAddress = await registry.getContract(args.DAO_ID);
}

module.exports.init = init;
