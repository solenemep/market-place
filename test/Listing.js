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

  const LIST = { NONE: 0, FIXED_SALE: 1, AUCTION_SALE: 2 };

  const price = toWei('1000', 'mwei');
  const validTime = 10 * 24 * 60 * 60;
  const quantity = 10;

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

      let fixedSaleListing;
      let erc721FixedSaleListingID;
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

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.nftID).to.equal(0);
        expect(fixedSaleListing.owner).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        erc721FixedSaleListingID = await listing.erc721FixedSaleListingID(erc721HAddress, 1);
        expect(erc721FixedSaleListingID).to.equal(0);
      });
      it('list sucessfully', async () => {
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(erc721HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user1.address);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);

        erc721FixedSaleListingID = await listing.erc721FixedSaleListingID(erc721HAddress, 1);
        expect(erc721FixedSaleListingID).to.equal(1);
      });
      it('reverts list if price is zero', async () => {
        const reason = 'Listing : price must higher than zero';

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
          .withArgs(erc721HAddress, 1, user1.address, price, expiration, 1);
      });
    });
    describe('ERC1155', async () => {
      let index;
      let quantity;
      let expiration;

      let fixedSaleListing;
      let erc1155FixedSaleListingOwners;
      let erc1155FixedSaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 10;
        expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        await erc1155H.connect(user1).setApprovalForAll(listingAddress, true);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.nftID).to.equal(0);
        expect(fixedSaleListing.owner).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        erc1155FixedSaleListingOwners = await listing.erc1155FixedSaleListingOwners(erc1155HAddress, 1);
        expect(erc1155FixedSaleListingOwners.length).to.equal(0);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(0);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(0);
      });
      it('list sucessfully', async () => {
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(erc1155HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user1.address);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);

        erc1155FixedSaleListingOwners = await listing.erc1155FixedSaleListingOwners(erc1155HAddress, 1);
        expect(erc1155FixedSaleListingOwners.length).to.equal(1);
        expect(erc1155FixedSaleListingOwners[0]).to.equal(user1.address);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(index);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs[0]).to.equal(index);
      });
      it('list twice same user - diff price', async () => {
        quantity = 5;
        const index1 = 1;
        const price1 = toWei('20');
        const index2 = 2;
        const price2 = toWei('10');

        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price1, expiration, quantity);
        expect(await listing.isFixedSaleListed(index1)).to.equal(true);

        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price2, expiration, quantity);
        expect(await listing.isFixedSaleListed(index2)).to.equal(true);

        fixedSaleListing = await listing.fixedSaleListing(index1);
        expect(fixedSaleListing.nftAddress).to.equal(erc1155HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user1.address);
        expect(fixedSaleListing.price).to.equal(price1);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);

        fixedSaleListing = await listing.fixedSaleListing(index2);
        expect(fixedSaleListing.nftAddress).to.equal(erc1155HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user1.address);
        expect(fixedSaleListing.price).to.equal(price2);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);

        erc1155FixedSaleListingOwners = await listing.erc1155FixedSaleListingOwners(erc1155HAddress, 1);
        expect(erc1155FixedSaleListingOwners.length).to.equal(1);
        expect(erc1155FixedSaleListingOwners[0]).to.equal(user1.address);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(quantity * 2);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(2);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs[0]).to.equal(index1);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs[1]).to.equal(index2);
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

        fixedSaleListing = await listing.fixedSaleListing(index1);
        expect(fixedSaleListing.nftAddress).to.equal(erc1155HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user1.address);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);

        fixedSaleListing = await listing.fixedSaleListing(index2);
        expect(fixedSaleListing.nftAddress).to.equal(erc1155HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user2.address);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);

        erc1155FixedSaleListingOwners = await listing.erc1155FixedSaleListingOwners(erc1155HAddress, 1);
        expect(erc1155FixedSaleListingOwners.length).to.equal(2);
        expect(erc1155FixedSaleListingOwners[0]).to.equal(user1.address);
        expect(erc1155FixedSaleListingOwners[1]).to.equal(user2.address);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(1);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs[0]).to.equal(index1);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user2.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(1);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs[0]).to.equal(index2);
      });
      it('reverts list if price is zero', async () => {
        const reason = 'Listing : price must higher than zero';

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

      let fixedSaleListing;
      let erc721FixedSaleListingID;
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

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(erc721HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user1.address);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);

        erc721FixedSaleListingID = await listing.erc721FixedSaleListingID(erc721HAddress, 1);
        expect(erc721FixedSaleListingID).to.equal(1);
      });
      it('unlist sucessfully', async () => {
        await listing.connect(user1).unlistFixedSale(index, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.nftID).to.equal(0);
        expect(fixedSaleListing.owner).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        erc721FixedSaleListingID = await listing.erc721FixedSaleListingID(erc721HAddress, 1);
        expect(erc721FixedSaleListingID).to.equal(0);
      });
      it('unlist when removeWhitelist', async () => {
        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);
      });
      it('unlist when purchased', async () => {
        await listing.connect(user3).buyFixedSale(index, quantity, { value: price });

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.nftID).to.equal(0);
        expect(fixedSaleListing.owner).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        erc721FixedSaleListingID = await listing.erc721FixedSaleListingID(erc721HAddress, 1);
        expect(erc721FixedSaleListingID).to.equal(0);
      });
      it('reverts list if not listed', async () => {
        const reason = 'Listing : not listed';

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

      let fixedSaleListing;
      let erc1155FixedSaleListingOwners;
      let erc1155FixedSaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 10;
        expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        await erc1155H.connect(user1).setApprovalForAll(listingAddress, true);
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(erc1155HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user1.address);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);

        erc1155FixedSaleListingOwners = await listing.erc1155FixedSaleListingOwners(erc1155HAddress, 1);
        expect(erc1155FixedSaleListingOwners.length).to.equal(1);
        expect(erc1155FixedSaleListingOwners[0]).to.equal(user1.address);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(quantity);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(index);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs[0]).to.equal(index);
      });
      it('unlist sucessfully - entirelly', async () => {
        await listing.connect(user1).unlistFixedSale(index, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.nftID).to.equal(0);
        expect(fixedSaleListing.owner).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        erc1155FixedSaleListingOwners = await listing.erc1155FixedSaleListingOwners(erc1155HAddress, 1);
        expect(erc1155FixedSaleListingOwners.length).to.equal(0);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(0);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(0);
      });
      it('unlist sucessfully - partially', async () => {
        await listing.connect(user1).unlistFixedSale(index, quantity / 2);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(erc1155HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user1.address);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity / 2);

        erc1155FixedSaleListingOwners = await listing.erc1155FixedSaleListingOwners(erc1155HAddress, 1);
        expect(erc1155FixedSaleListingOwners.length).to.equal(1);
        expect(erc1155FixedSaleListingOwners[0]).to.equal(user1.address);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(quantity / 2);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(index);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs[0]).to.equal(index);
      });
      it('unlist when removeWhitelist', async () => {
        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);
      });
      it('unlist when purchased - entirelly', async () => {
        await listing.connect(user3).buyFixedSale(index, quantity, { value: toBN(price).times(quantity).toString() });

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.nftID).to.equal(0);
        expect(fixedSaleListing.owner).to.equal(ZERO_ADDRESS);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        erc1155FixedSaleListingOwners = await listing.erc1155FixedSaleListingOwners(erc1155HAddress, 1);
        expect(erc1155FixedSaleListingOwners.length).to.equal(0);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(0);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(0);
      });
      it('unlist when purchased - partially', async () => {
        await listing.connect(user3).buyFixedSale(index, quantity / 2, {
          value: toBN(price)
            .times(quantity / 2)
            .toString(),
        });

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        fixedSaleListing = await listing.fixedSaleListing(index);
        expect(fixedSaleListing.nftAddress).to.equal(erc1155HAddress);
        expect(fixedSaleListing.nftID).to.equal(1);
        expect(fixedSaleListing.owner).to.equal(user1.address);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity / 2);

        erc1155FixedSaleListingOwners = await listing.erc1155FixedSaleListingOwners(erc1155HAddress, 1);
        expect(erc1155FixedSaleListingOwners.length).to.equal(1);
        expect(erc1155FixedSaleListingOwners[0]).to.equal(user1.address);

        erc1155FixedSaleListingID = await listing.erc1155FixedSaleListingID(erc1155HAddress, 1, user1.address);
        expect(erc1155FixedSaleListingID.totalQuantity).to.equal(quantity / 2);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs.length).to.equal(index);
        expect(erc1155FixedSaleListingID.erc1155FixedSaleListingIDs[0]).to.equal(index);
      });
      it('reverts list if not listed', async () => {
        const reason = 'Listing : not listed';

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
  describe('listFixedSale', async () => {
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
        value = toWei('1100', 'mwei');

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
        await expect(tx).to.changeEtherBalance(daoAddress, toWei('100', 'mwei'));

        await expect(tx).to.changeTokenBalances(erc721H, [user1, user3], [-quantity, quantity]);
        expect(await erc721H.ownerOf(1)).to.equal(user3.address);
        expect(await erc721H.balanceOf(user1.address)).to.equal(0);
        expect(await erc721H.balanceOf(user3.address)).to.equal(quantity);
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
        quantity = 10;
        expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        value = toWei('1100', 'mwei');

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
        await expect(tx).to.changeEtherBalance(daoAddress, toBN(toWei('100', 'mwei')).times(quantity).toString());

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
          toBN(toWei('100', 'mwei'))
            .times(quantity / 2)
            .toString()
        );

        expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(quantity / 2);
        expect(await erc1155H.balanceOf(user3.address, 1)).to.equal(quantity / 2);
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
});
