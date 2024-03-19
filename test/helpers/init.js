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
let commissionAddress;

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
    commissionAddress,
  };
};

async function deployContracts() {
  const users = await ethers.getSigners();

  // Registry
  registry = await ethers.deployContract('Registry');
  await registry.waitForDeployment();
  // ERC721H
  erc721H = await ethers.deployContract('ERC721HMock', [args.ERC721H_NAME, args.ERC721H_SYMBOL, users[0].address]);
  await erc721H.waitForDeployment();
  // ERC1155H
  erc1155H = await ethers.deployContract('ERC1155HMock', [args.ERC1155H_BASE_TOKEN_URI, users[0].address]);
  await erc1155H.waitForDeployment();
  // NFTIdentifier
  nftIdentifier = await ethers.deployContract('NFTIdentifierMock');
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
  listing = await ethers.deployContract('ListingMock');
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
  // DAO
  await registry.addContract(args.DAO_ID, args.DAO_ADDRESS);
  // COMMISSION
  await registry.addContract(args.COMMISSION_ID, args.COMMISSION_ADDRESS);
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
  const Wallet = await ethers.getContractFactory('Wallet');
  wallet = Wallet.attach(await registry.getContract(args.WALLET_ID));
  // NFTRegistry
  const NFTRegistry = await ethers.getContractFactory('NFTRegistry');
  nftRegistry = NFTRegistry.attach(await registry.getContract(args.NFT_REGISTRY_ID));
  // Listing
  const Listing = await ethers.getContractFactory('ListingMock');
  listing = Listing.attach(await registry.getContract(args.LISTING_ID));
  // Auction
  const Auction = await ethers.getContractFactory('Auction');
  auction = Auction.attach(await registry.getContract(args.AUCTION_ID));
}

async function initContracts() {
  // Wallet
  await wallet.initialize();
  // NFTRegistry
  await nftRegistry.initialize();
  // Listing
  await listing.initialize();
  // Auction
  await auction.initialize();
}

async function setDependencies() {
  // ERC721H
  await erc721H.setDependencies(await registry.getAddress());
  // ERC1155H
  await erc1155H.setDependencies(await registry.getAddress());
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
  commissionAddress = await registry.getContract(args.COMMISSION_ID);
}

module.exports.init = init;
