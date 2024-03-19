// npx hardhat run scripts/endAuction.ts --network haqqTestnet

import { ethers } from "hardhat";
import { wait } from "./helpers/utils";
import { getCurrentBlockTimestamp } from "../test/helpers/utils";

const args = process.env;
let tx: any;

let registry: any;

let listing: any;
let auction: any;

let registryAddress = "0x170cA9C2F928Bb5620B84F4A43448E0D114458C3";

async function main() {
  // DEPLOYER
  const [signer] = await ethers.getSigners();
  console.log("ending auctions with the account : ", await signer.getAddress());

  // CONTRACTS
  await setUpContracts();

  // LOGIC
  const countAuctionSaleListings = await listing.countAuctionSaleListings();
  const saleListingIDs = await listing.listAuctionSaleListings(
    0,
    countAuctionSaleListings
  );
  for await (const saleListingID of saleListingIDs) {
    const saleListing = await listing.saleListing(saleListingID);
    const endTime = Number(saleListing.endTime);
    const now = await getCurrentBlockTimestamp();
    if (endTime <= now) {
      await endAuction(saleListingID);
    }
  }

  console.log("END");
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
