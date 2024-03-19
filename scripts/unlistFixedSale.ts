// npx hardhat run scripts/endAuction.ts --network haqqTestnet

import { ethers } from "hardhat";
import { wait } from "./helpers/utils";
import { getCurrentBlockTimestamp } from "../test/helpers/utils";

const args = process.env;
let tx: any;

let registry: any;

let listing: any;

let registryAddress = "0x170cA9C2F928Bb5620B84F4A43448E0D114458C3";

async function main() {
  // DEPLOYER
  const [signer] = await ethers.getSigners();
  console.log(
    "unlisting fixed sales with the account : ",
    await signer.getAddress()
  );

  // CONTRACTS
  await setUpContracts();

  // LOGIC
  const countfixedSaleListings = await listing.countfixedSaleListings();
  const saleListingIDs = await listing.listFixedSaleListings(
    0,
    countfixedSaleListings
  );
  for await (const saleListingID of saleListingIDs) {
    const saleListing = await listing.saleListing(saleListingID);
    const endTime = Number(saleListing.endTime);
    const now = await getCurrentBlockTimestamp();
    if (endTime != 0 && endTime <= now) {
      console.log("inside");
      await unlistFixedSale(saleListingID);
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
}

async function unlistFixedSale(saleListingID: number) {
  try {
    tx = await listing.unlistFixedSale(saleListingID);
  } catch (e) {
    console.log("failed transaction unlistFixedSale : ", tx.hash);
    console.log("tx : ", tx);
    console.log(e);
  }
  console.log("tx unlistFixedSale : ", tx.hash);
}

main().catch((error) => {
  console.error("error", error);
  process.exit(1);
});
