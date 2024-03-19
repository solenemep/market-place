// to test unlistFixedSale.ts and endAuction.ts on local network
// run : npx hardhat run scripts/testScripts.ts

import { ethers, web3 } from "hardhat";
import { wait } from "./helpers/utils";
import {
  getCurrentBlockTimestamp,
  increaseTimeTo,
  toBN,
  toWei,
} from "../test/helpers/utils";
import { init } from "../test/helpers/init";

const args = process.env;

let registry: any, registryAddress: any;
let erc721H: any, erc721HAddress: any;
let erc1155H: any, erc1155HAddress: any;
let nftRegistry: any, nftRegistryAddress: any;
let listing: any, listingAddress: any;
let auction: any, auctionAddress: any;

let tx: any;

let startTime: number, endTime: number;

const royaltyPercent = 10;

async function main() {
  // CONTRACTS
  const setups = await init();
  const signer = setups.users[0];
  const signerAddress = await signer.getAddress();
  console.log("testing with the account : ", signerAddress);

  registry = setups.registry;
  registryAddress = await registry.getAddress();

  erc721H = setups.erc721H;
  erc721HAddress = await erc721H.getAddress();

  erc1155H = setups.erc1155H;
  erc1155HAddress = await erc1155H.getAddress();

  nftRegistry = setups.nftRegistry;
  nftRegistryAddress = await nftRegistry.getAddress();

  listing = setups.listing;
  listingAddress = await listing.getAddress();

  auction = setups.auction;
  auctionAddress = await auction.getAddress();

  const WHITELISTER_ROLE = web3.utils.soliditySha3("WHITELISTER_ROLE");
  await nftRegistry.grantRole(WHITELISTER_ROLE, signerAddress);

  const hash = web3.utils.soliditySha3("");

  // LOGIC
  const price = toWei("1000000", "gwei");

  const now = await getCurrentBlockTimestamp();
  const validTime = 24 * 60 * 60;
  startTime = toBN(now)
    .plus(60 * 60)
    .toString();
  endTime = toBN(now).plus(validTime).toString();

  await erc721H.mintMock(signerAddress, 21, royaltyPercent);
  await erc1155H.mintMock(
    signerAddress,
    21,
    10,
    royaltyPercent,
    web3.utils.asciiToHex("")
  );

  await erc721H.setApprovalForAll(auctionAddress, true);
  await erc1155H.setApprovalForAll(auctionAddress, true);

  await nftRegistry.addWhitelist(erc721HAddress, 21, hash);
  await nftRegistry.addWhitelist(erc1155HAddress, 21, hash);

  await listAuctionSale(erc721HAddress, 21, price, startTime, endTime, 1); // index 1
  await listAuctionSale(erc1155HAddress, 21, price, startTime, endTime, 10); // index 2

  let saleListing1 = await listing.saleListing(1);
  let saleListing2 = await listing.saleListing(2);

  console.log("saleListing1", saleListing1);
  console.log("saleListing2", saleListing2);

  await increaseTimeTo(startTime);
  const minBid = toWei("1100000", "gwei");
  await placeBid(1, minBid);
  await placeBid(2, minBid);

  await increaseTimeTo(endTime);
  // TEST => copy paste of endAuction.ts

  // CONTRACTS
  await setUpContracts();

  // LOGIC
  const countAuctionSaleListings = await listing.countAuctionSaleListings();
  console.log("countAuctionSaleListings", countAuctionSaleListings);

  const saleListingIDs = await listing.listAuctionSaleListings(
    0,
    countAuctionSaleListings
  );
  console.log("saleListingIDs", saleListingIDs);

  for await (const saleListingID of saleListingIDs) {
    const saleListing = await listing.saleListing(saleListingID);
    const endTime = Number(saleListing.endTime);
    const now = await getCurrentBlockTimestamp();
    console.log("endTime", endTime);
    console.log("now", now);
    if (endTime <= now) {
      console.log("inside");
      await endAuction(saleListingID);
    }
  }

  saleListing1 = await listing.saleListing(1);
  saleListing2 = await listing.saleListing(2);

  console.log("saleListing1", saleListing1);
  console.log("saleListing2", saleListing2);

  console.log("END");
}

async function listAuctionSale(
  nftAddress: any,
  nftID: number,
  price: number,
  startTime: number,
  endTime: number,
  quantity: number
) {
  try {
    tx = await listing.listAuctionSale(
      nftAddress,
      nftID,
      price,
      startTime,
      endTime,
      quantity
    );
  } catch (e) {
    console.log("failed transaction listAuctionSale : ", tx.hash);
    console.log("tx : ", tx);
    console.log(e);
    process.exit(1);
  }
  console.log("tx listAuctionSale : ", tx.hash);
}

async function placeBid(index: number, value: number) {
  try {
    tx = await auction.placeBid(index, { value: value });
  } catch (e) {
    console.log("failed transaction placeBid : ", tx.hash);
    console.log("tx : ", tx);
    console.log(e);
    process.exit(1);
  }
  console.log("tx placeBid : ", tx.hash);
}

async function setUpContracts() {
  // Registry
  const Registry = await ethers.getContractFactory("Registry");
  registry = Registry.attach(registryAddress);

  // Listing
  const Listing = await ethers.getContractFactory("Listing");
  listing = Listing.attach(await registry.getContract(args.LISTING_ID));
  console.log("Listing address : ", await listing.getAddress());
  await wait(30_000);

  // Auction
  const Auction = await ethers.getContractFactory("Auction");
  auction = Auction.attach(await registry.getContract(args.AUCTION_ID));
  console.log("Auction address : ", await auction.getAddress());
  await wait(30_000);
}

async function endAuction(saleListingID: number) {
  try {
    tx = await auction.endAuction(saleListingID);
  } catch (e) {
    console.log("failed transaction endAuction : ", tx.hash);
    console.log("tx : ", tx);
    console.log(e);
  }
  console.log("tx endAuction : ", tx.hash);
}

main().catch((error) => {
  console.error("error", error);
  process.exit(1);
});
