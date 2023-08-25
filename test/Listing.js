const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const {
  snapshot,
  restore,
  getCurrentBlockTimestamp,
  toWei,
  toBN,
  ZERO_ADDRESS,
  increaseTime,
} = require('./helpers/utils.js');

describe('Listing', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftRegistry, nftRegistryAddress;
  let listing, listingAddress;
  let auction, auctionAddress;

  let daoAddress;

  let owner;
  let user1, user2, user3;
  let whitelister;

  const WHITELISTER_ROLE = web3.utils.soliditySha3('WHITELISTER_ROLE');

  const List = { NONE: 0, FIXED_SALE: 1, AUCTION_SALE: 2 };

  const price = toWei('1000000', 'gwei');
  const validTime = 10 * 24 * 60 * 60;

  before('setup', async () => {
    const setups = await init();

    owner = setups.users[0];
    user1 = setups.users[1];
    user2 = setups.users[2];
    user3 = setups.users[3];
    whitelister = setups.users[4];

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

    daoAddress = setups.daoAddress;

    await nftRegistry.grantRole(WHITELISTER_ROLE, whitelister.address);

    await snapshot();
  });

  afterEach('revert', async () => {
    await restore();
  });

  describe('deployment', async () => {
    it('deploy contract successfully', async () => {
      expect(await registry.getContract(args.LISTING_ID)).to.equal(listingAddress);
    });
    it('sets dependencies successfully', async () => {
      expect(await listing.nftRegistry()).to.equal(nftRegistryAddress);
      expect(await listing.auction()).to.equal(auctionAddress);
      expect(await listing.daoAddress()).to.equal(daoAddress);
    });
  });
  describe('listFixedSale', async () => {
    describe('ERC721', async () => {
      let index;
      let quantity;
      let expiration;

      let saleListing;
      let erc721SaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();

        await erc721H.connect(owner).mintMock(user1.address, 1);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1);
        await erc721H.connect(user1).setApprovalForAll(listingAddress, true);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.NONE);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.owner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('list sucessfully', async () => {
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc721HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(1);
      });
      it('reverts list if price is zero', async () => {
        const reason = 'Listing : price must higher than 0.001 ISML';

        await expect(
          listing.connect(user1).listFixedSale(erc721HAddress, 1, 0, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'Listing : not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        await expect(
          listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not the owner', async () => {
        const reason = 'Listing : not the owner';

        await expect(
          listing.connect(user2).listFixedSale(erc721HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed', async () => {
        const reason = 'Listing : already listed';

        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);
        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        await expect(
          listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('emit ListedFixedSale event', async () => {
        await expect(listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity))
          .to.emit(listing, 'ListedFixedSale')
          .withArgs(erc721HAddress, 1, user1.address, price, expiration, quantity);
      });
    });
    describe('ERC1155', async () => {
      let index;
      let quantity;
      let expiration;

      let saleListing;
      let erc1155SaleListingOwners;
      let erc1155SaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 8;
        expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        await erc1155H.connect(user1).setApprovalForAll(listingAddress, true);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.NONE);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.owner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(0);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(0);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(0);
      });
      it('list sucessfully', async () => {
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(1);
        expect(erc1155SaleListingOwners[0]).to.equal(user1.address);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(index);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index);
      });
      it('list twice same user - diff price', async () => {
        quantity = 4;
        const index1 = 1;
        const price1 = toWei('20');
        const index2 = 2;
        const price2 = toWei('10');

        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price1, expiration, quantity);
        expect(await listing.isFixedSaleListed(index1)).to.equal(true);

        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price2, expiration, quantity);
        expect(await listing.isFixedSaleListed(index2)).to.equal(true);

        saleListing = await listing.saleListing(index1);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price1);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        saleListing = await listing.saleListing(index2);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price2);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(1);
        expect(erc1155SaleListingOwners[0]).to.equal(user1.address);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity * 2);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(2);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index1);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[1]).to.equal(index2);
      });
      it('list twice diff user - same price', async () => {
        await erc1155H.connect(owner).mintMock(user2.address, 1, quantity, web3.utils.asciiToHex(''));
        await erc1155H.connect(user2).setApprovalForAll(listingAddress, true);

        const index1 = 1;
        const index2 = 2;

        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);
        expect(await listing.isFixedSaleListed(index1)).to.equal(true);

        await listing.connect(user2).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);
        expect(await listing.isFixedSaleListed(index2)).to.equal(true);

        saleListing = await listing.saleListing(index1);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        saleListing = await listing.saleListing(index2);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user2.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(2);
        expect(erc1155SaleListingOwners[0]).to.equal(user1.address);
        expect(erc1155SaleListingOwners[1]).to.equal(user2.address);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(1);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index1);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user2.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(1);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index2);
      });
      it('reverts list if price is zero', async () => {
        const reason = 'Listing : price must higher than 0.001 ISML';

        await expect(
          listing.connect(user1).listFixedSale(erc1155HAddress, 1, 0, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'Listing : not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        await expect(
          listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not the owner', async () => {
        const reason = 'Listing : not the owner or quantity already listed';

        await expect(
          listing.connect(user2).listFixedSale(erc1155HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed', async () => {
        const reason = 'Listing : not the owner or quantity already listed';

        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);
        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        await expect(
          listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('emit ListedFixedSale event', async () => {
        await expect(listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity))
          .to.emit(listing, 'ListedFixedSale')
          .withArgs(erc1155HAddress, 1, user1.address, price, expiration, quantity);
      });
    });
  });
  describe('unlistFixedSale', async () => {
    describe('ERC721', async () => {
      let index;
      let quantity;
      let expiration;

      let saleListing;
      let erc721SaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();

        await erc721H.connect(owner).mintMock(user1.address, 1);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1);
        await erc721H.connect(user1).setApprovalForAll(listingAddress, true);
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc721HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(1);
      });
      it('unlist sucessfully', async () => {
        await listing.connect(user1).unlistFixedSale(index, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.NONE);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.owner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('unlist when removeWhitelist', async () => {
        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);
      });
      it('unlist when purchased', async () => {
        await listing.connect(user3).buyFixedSale(index, quantity, { value: price });

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.NONE);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.owner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('reverts list if not listed in fixed sale', async () => {
        const reason = 'Listing : not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index, quantity);

        await expect(listing.connect(user1).unlistFixedSale(index, quantity)).to.be.revertedWith(reason);
      });
      it('reverts list if not the owner', async () => {
        const reason = 'Listing : not the owner';

        await expect(listing.connect(user2).unlistFixedSale(index, quantity)).to.be.revertedWith(reason);
      });
      it('emit UnlistedFixedSale event', async () => {
        await expect(listing.connect(user1).unlistFixedSale(index, quantity))
          .to.emit(listing, 'UnlistedFixedSale')
          .withArgs(erc721HAddress, 1, user1.address, quantity);
      });
    });
    describe('ERC1155', async () => {
      let index;
      let quantity;
      let expiration;

      let saleListing;
      let erc1155SaleListingOwners;
      let erc1155SaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 8;
        expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        await erc1155H.connect(user1).setApprovalForAll(listingAddress, true);
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(1);
        expect(erc1155SaleListingOwners[0]).to.equal(user1.address);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(index);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index);
      });
      it('unlist sucessfully - entirelly', async () => {
        await listing.connect(user1).unlistFixedSale(index, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.NONE);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.owner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(0);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(0);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(0);
      });
      it('unlist sucessfully - partially', async () => {
        await listing.connect(user1).unlistFixedSale(index, quantity / 2);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity / 2);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(1);
        expect(erc1155SaleListingOwners[0]).to.equal(user1.address);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity / 2);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(index);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index);
      });
      it('unlist when removeWhitelist', async () => {
        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);
      });
      it('unlist when purchased - entirelly', async () => {
        await listing.connect(user3).buyFixedSale(index, quantity, { value: toBN(price).times(quantity).toString() });

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.NONE);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.owner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(0);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(0);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(0);
      });
      it('unlist when purchased - partially', async () => {
        await listing.connect(user3).buyFixedSale(index, quantity / 2, {
          value: toBN(price)
            .times(quantity / 2)
            .toString(),
        });

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.FIXED_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity / 2);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(1);
        expect(erc1155SaleListingOwners[0]).to.equal(user1.address);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity / 2);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(index);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index);
      });
      it('reverts list if not listed in fixed sale', async () => {
        const reason = 'Listing : not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index, quantity);

        await expect(listing.connect(user1).unlistFixedSale(index, quantity)).to.be.revertedWith(reason);
      });
      it('reverts list if not the owner', async () => {
        const reason = 'Listing : not the owner';

        await expect(listing.connect(user2).unlistFixedSale(index, quantity)).to.be.revertedWith(reason);
        await expect(listing.connect(whitelister).unlistFixedSale(index, quantity)).to.be.revertedWith(reason);
      });
      it('reverts list if not quantity not listed', async () => {
        const reason = 'Listing : quantity not listed';

        await expect(listing.connect(user1).unlistFixedSale(index, quantity * 2)).to.be.revertedWith(reason);
        await expect(listing.connect(user1).unlistFixedSale(index, quantity + 1)).to.be.revertedWith(reason);
      });
      it('emit UnlistedFixedSale event', async () => {
        await expect(listing.connect(user1).unlistFixedSale(index, quantity))
          .to.emit(listing, 'UnlistedFixedSale')
          .withArgs(erc1155HAddress, 1, user1.address, quantity);
      });
    });
  });
  describe('buyFixedSale', async () => {
    describe('ERC721', async () => {
      let index;
      let quantity;
      let expiration;
      let value;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        value = toWei('1100000', 'gwei');

        await erc721H.connect(owner).mintMock(user1.address, 1);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1);
        await erc721H.connect(user1).setApprovalForAll(listingAddress, true);
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        await listing.connect(owner).setCommissionPercentage(10);
      });
      it('buy at fixed sale successfully', async () => {
        const tx = await listing.connect(user3).buyFixedSale(index, quantity, { value: value });

        await expect(tx).to.changeEtherBalance(user3.address, -value);
        await expect(tx).to.changeEtherBalance(user1.address, +price);
        await expect(tx).to.changeEtherBalance(daoAddress, toWei('100000', 'gwei'));

        await expect(tx).to.changeTokenBalances(erc721H, [user1, user3], [-quantity, quantity]);
        expect(await erc721H.ownerOf(1)).to.equal(user3.address);
        expect(await erc721H.balanceOf(user1.address)).to.equal(0);
        expect(await erc721H.balanceOf(user3.address)).to.equal(quantity);
      });
      it('reverts list if not listed in fixed sale', async () => {
        const reason = 'Listing : not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index, quantity);

        await expect(listing.connect(user3).buyFixedSale(index, quantity, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts if not whitelisted', async () => {
        const reason = 'Listing : not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        await expect(listing.connect(user3).buyFixedSale(index, quantity, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts if date expired', async () => {
        const reason = 'Listing : listing expired';

        await increaseTime(validTime);

        await expect(listing.connect(user3).buyFixedSale(index, quantity, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts if msg.value not enough', async () => {
        const reason = 'Listing : not enought ISLM';

        await expect(listing.connect(user3).buyFixedSale(index, quantity, { value: 0 })).to.be.revertedWith(reason);
        await expect(listing.connect(user3).buyFixedSale(index, quantity, { value: price })).to.be.revertedWith(reason);
      });
      it('emit BoughtFixedSale event', async () => {
        await expect(listing.connect(user3).buyFixedSale(index, quantity, { value: value }))
          .to.emit(listing, 'BoughtFixedSale')
          .withArgs(erc721HAddress, 1, user3.address, quantity);
      });
    });
    describe('ERC1155', async () => {
      let index;
      let quantity;
      let expiration;
      let value;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 8;
        expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        value = toWei('1100000', 'gwei');

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        await erc1155H.connect(user1).setApprovalForAll(listingAddress, true);
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        await listing.connect(owner).setCommissionPercentage(10);
      });
      it('buy at fixed sale successfully - entirelly', async () => {
        const tx = await listing
          .connect(user3)
          .buyFixedSale(index, quantity, { value: toBN(value).times(quantity).toString() });

        await expect(tx).to.changeEtherBalance(user3.address, -toBN(value).times(quantity).toString());
        await expect(tx).to.changeEtherBalance(user1.address, +toBN(price).times(quantity).toString());
        await expect(tx).to.changeEtherBalance(daoAddress, toBN(toWei('100000', 'gwei')).times(quantity).toString());

        expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(0);
        expect(await erc1155H.balanceOf(user3.address, 1)).to.equal(quantity);
      });
      it('buy at fixed sale successfully - partially', async () => {
        const tx = await listing.connect(user3).buyFixedSale(index, quantity / 2, {
          value: toBN(value)
            .times(quantity / 2)
            .toString(),
        });

        await expect(tx).to.changeEtherBalance(
          user3.address,
          -toBN(value)
            .times(quantity / 2)
            .toString()
        );
        await expect(tx).to.changeEtherBalance(
          user1.address,
          +toBN(price)
            .times(quantity / 2)
            .toString()
        );
        await expect(tx).to.changeEtherBalance(
          daoAddress,
          toBN(toWei('100000', 'gwei'))
            .times(quantity / 2)
            .toString()
        );

        expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(quantity / 2);
        expect(await erc1155H.balanceOf(user3.address, 1)).to.equal(quantity / 2);
      });
      it('reverts list if not listed in fixed sale', async () => {
        const reason = 'Listing : not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index, quantity);

        await expect(listing.connect(user3).buyFixedSale(index, quantity, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts if not whitelisted', async () => {
        const reason = 'Listing : not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        await expect(
          listing.connect(user3).buyFixedSale(index, quantity, { value: toBN(value).times(quantity).toString() })
        ).to.be.revertedWith(reason);
      });
      it('reverts if date expired', async () => {
        const reason = 'Listing : listing expired';

        await increaseTime(validTime);

        await expect(
          listing.connect(user3).buyFixedSale(index, quantity, { value: toBN(value).times(quantity).toString() })
        ).to.be.revertedWith(reason);
      });
      it('reverts if quantity not listed', async () => {
        const reason = 'Listing : quantity not listed';

        await expect(
          listing.connect(user3).buyFixedSale(index, quantity * 2, {
            value: toBN(value)
              .times(quantity * 2)
              .toString(),
          })
        ).to.be.revertedWith(reason);
        await expect(
          listing.connect(user3).buyFixedSale(index, quantity + 1, {
            value: toBN(value)
              .times(quantity + 1)
              .toString(),
          })
        ).to.be.revertedWith(reason);
      });
      it('reverts if msg.value not enough', async () => {
        const reason = 'Listing : not enought ISLM';

        await expect(listing.connect(user3).buyFixedSale(index, quantity, { value: 0 })).to.be.revertedWith(reason);
        await expect(
          listing.connect(user3).buyFixedSale(index, quantity, { value: toBN(price).times(quantity).toString() })
        ).to.be.revertedWith(reason);
        await expect(listing.connect(user3).buyFixedSale(index, quantity, { value: value })).to.be.revertedWith(reason);
      });
      it('emit BoughtFixedSale event', async () => {
        await expect(
          listing.connect(user3).buyFixedSale(index, quantity, { value: toBN(value).times(quantity).toString() })
        )
          .to.emit(listing, 'BoughtFixedSale')
          .withArgs(erc1155HAddress, 1, user3.address, quantity);
      });
    });
  });
  describe.only('listAuctionSale', async () => {
    describe('ERC721', async () => {
      let index;
      let quantity;
      let startTime, endTime;

      let saleListing;
      let erc721SaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        startTime = await getCurrentBlockTimestamp();
        endTime = toBN(startTime).plus(validTime).toString();

        await erc721H.connect(owner).mintMock(user1.address, 1);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1);
        await erc721H.connect(user1).setApprovalForAll(listingAddress, true);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.NONE);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.owner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('list sucessfully', async () => {
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);

        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.AUCTION_SALE);
        expect(saleListing.nftAddress).to.equal(erc721HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(1);
      });
      it('reverts list if price is zero', async () => {
        const reason = 'Listing : price must higher than 0.001 ISML';

        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, 0, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if wrong ending time', async () => {
        const reason = 'Listing : auction wrong endind time';

        const now = await getCurrentBlockTimestamp();

        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, endTime, startTime, quantity)
        ).to.be.revertedWith(reason);
        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, now, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'Listing : not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not the owner', async () => {
        const reason = 'Listing : not the owner';

        await expect(
          listing.connect(user2).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed', async () => {
        const reason = 'Listing : already listed';

        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('emit ListedAuctionSale event', async () => {
        await expect(listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity))
          .to.emit(listing, 'ListedAuctionSale')
          .withArgs(erc721HAddress, 1, user1.address, price, startTime, endTime, quantity);
      });
    });
    describe('ERC1155', async () => {
      let index;
      let quantity;
      let startTime, endTime;

      let saleListing;
      let erc1155SaleListingOwners;
      let erc1155SaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 8;
        startTime = await getCurrentBlockTimestamp();
        endTime = toBN(startTime).plus(validTime).toString();

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        await erc1155H.connect(user1).setApprovalForAll(listingAddress, true);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.NONE);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.owner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(0);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(0);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(0);
      });
      it('list sucessfully', async () => {
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);

        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.list).to.equal(List.AUCTION_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(1);
        expect(erc1155SaleListingOwners[0]).to.equal(user1.address);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(index);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index);
      });
      it('list twice same user - diff price', async () => {
        quantity = 4;
        const index1 = 1;
        const price1 = toWei('20');
        const index2 = 2;
        const price2 = toWei('10');

        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price1, startTime, endTime, quantity);
        expect(await listing.isAuctionSaleListed(index1)).to.equal(true);

        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price2, startTime, endTime, quantity);
        expect(await listing.isAuctionSaleListed(index2)).to.equal(true);

        saleListing = await listing.saleListing(index1);
        expect(saleListing.list).to.equal(List.AUCTION_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price1);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        saleListing = await listing.saleListing(index2);
        expect(saleListing.list).to.equal(List.AUCTION_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price2);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(1);
        expect(erc1155SaleListingOwners[0]).to.equal(user1.address);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity * 2);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(2);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index1);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[1]).to.equal(index2);
      });
      it('list twice diff user - same price', async () => {
        await erc1155H.connect(owner).mintMock(user2.address, 1, quantity, web3.utils.asciiToHex(''));
        await erc1155H.connect(user2).setApprovalForAll(listingAddress, true);

        const index1 = 1;
        const index2 = 2;

        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        expect(await listing.isAuctionSaleListed(index1)).to.equal(true);

        await listing.connect(user2).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        expect(await listing.isAuctionSaleListed(index2)).to.equal(true);

        saleListing = await listing.saleListing(index1);
        expect(saleListing.list).to.equal(List.AUCTION_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        saleListing = await listing.saleListing(index2);
        expect(saleListing.list).to.equal(List.AUCTION_SALE);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.owner).to.equal(user2.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        erc1155SaleListingOwners = await listing.erc1155SaleListingOwners(erc1155HAddress, 1);
        expect(erc1155SaleListingOwners.length).to.equal(2);
        expect(erc1155SaleListingOwners[0]).to.equal(user1.address);
        expect(erc1155SaleListingOwners[1]).to.equal(user2.address);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(1);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index1);

        erc1155SaleListingID = await listing.erc1155SaleListingID(erc1155HAddress, 1, user2.address);
        expect(erc1155SaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155SaleListingID.erc1155SaleListingIDs.length).to.equal(1);
        expect(erc1155SaleListingID.erc1155SaleListingIDs[0]).to.equal(index2);
      });
      it('reverts list if price is zero', async () => {
        const reason = 'Listing : price must higher than 0.001 ISML';

        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, 0, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if wrong ending time', async () => {
        const reason = 'Listing : auction wrong endind time';

        const now = await getCurrentBlockTimestamp();

        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, endTime, startTime, quantity)
        ).to.be.revertedWith(reason);
        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, now, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'Listing : not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not the owner', async () => {
        const reason = 'Listing : not the owner or quantity already listed';

        await expect(
          listing.connect(user2).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed', async () => {
        const reason = 'Listing : not the owner or quantity already listed';

        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('emit ListedAuctionSale event', async () => {
        await expect(listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity))
          .to.emit(listing, 'ListedAuctionSale')
          .withArgs(erc1155HAddress, 1, user1.address, price, startTime, endTime, quantity);
      });
    });
  });
});
