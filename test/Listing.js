const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const {
  snapshot,
  restore,
  getCurrentBlockTimestamp,
  toWei,
  toBN,
  ZERO_ADDRESS,
  WHITELISTER_ROLE,
  EMPTY_HASH,
  increaseTime,
  increaseTimeTo,
  getCosts,
} = require('./helpers/utils.js');

describe('Listing', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftRegistry, nftRegistryAddress;
  let listing, listingAddress;
  let auction, auctionAddress;

  let commissionAddress;

  let owner;
  let user1, user2, user3;
  let whitelister;

  const price = toWei('1000000', 'gwei');
  const validTime = 10 * 24 * 60 * 60;

  const royaltyPercent = 10;

  before('setup', async () => {
    const setups = await init();

    owner = setups.users[0];
    user1 = setups.users[1];
    user2 = setups.users[2];
    user3 = setups.users[3];
    whitelister = setups.users[5];

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

    commissionAddress = setups.commissionAddress;

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
      expect(await listing.commissionAddress()).to.equal(commissionAddress);
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

        await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
        await erc721H.connect(user1).setApprovalForAll(listingAddress, true);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('list successfully', async () => {
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(erc721HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(1);
      });
      it('reverts list if price is zero', async () => {
        const reason = 'L: price too low';

        await expect(
          listing.connect(user1).listFixedSale(erc721HAddress, 1, 0, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'L: not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        await expect(
          listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not the nftOwner or contract owner', async () => {
        const reason = 'L: not the nftOwner';

        await expect(
          listing.connect(user2).listFixedSale(erc721HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed - listed in fixed sale', async () => {
        const reason = 'L: already listed';

        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);
        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        await expect(
          listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed - listed in auction sale', async () => {
        const reason = 'L: already listed';

        const startTime = toBN(await getCurrentBlockTimestamp())
          .plus(2)
          .toString();
        const endTime = toBN(startTime).plus(validTime).toString();
        await erc721H.connect(user1).setApprovalForAll(auctionAddress, true);
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        await expect(
          listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('emit ListedFixedSale event', async () => {
        await expect(listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity))
          .to.emit(listing, 'ListedFixedSale')
          .withArgs(erc721HAddress, 1, user1.address, price, expiration, quantity, index);
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

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1, EMPTY_HASH);
        await erc1155H.connect(user1).setApprovalForAll(listingAddress, true);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
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
      it('list successfully', async () => {
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
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
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price1);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        saleListing = await listing.saleListing(index2);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
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
        await erc1155H.connect(owner).mintMock(user2.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await erc1155H.connect(user2).setApprovalForAll(listingAddress, true);

        const index1 = 1;
        const index2 = 2;

        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);
        expect(await listing.isFixedSaleListed(index1)).to.equal(true);

        await listing.connect(user2).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);
        expect(await listing.isFixedSaleListed(index2)).to.equal(true);

        saleListing = await listing.saleListing(index1);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        saleListing = await listing.saleListing(index2);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user2.address);
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
        const reason = 'L: price too low';

        await expect(
          listing.connect(user1).listFixedSale(erc1155HAddress, 1, 0, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'L: not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        await expect(
          listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not the nftOwner', async () => {
        const reason = 'L: not the nftOwner or quantity already listed';

        await expect(
          listing.connect(user2).listFixedSale(erc1155HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed - listed in fixed sale', async () => {
        const reason = 'L: not the nftOwner or quantity already listed';

        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);
        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        await expect(
          listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed - listed in auction sale', async () => {
        const reason = 'L: not the nftOwner or quantity already listed';

        const startTime = toBN(await getCurrentBlockTimestamp())
          .plus(2)
          .toString();
        const endTime = toBN(startTime).plus(validTime).toString();
        await erc1155H.connect(user1).setApprovalForAll(auctionAddress, true);
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        await expect(
          listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity)
        ).to.be.revertedWith(reason);
      });
      it('emit ListedFixedSale event', async () => {
        await expect(listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity))
          .to.emit(listing, 'ListedFixedSale')
          .withArgs(erc1155HAddress, 1, user1.address, price, expiration, quantity, index);
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

        await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
        await erc721H.connect(user1).setApprovalForAll(listingAddress, true);
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(erc721HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(expiration);
        expect(saleListing.quantity).to.equal(quantity);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(1);
      });
      it('unlist successfully', async () => {
        await listing.connect(user1).unlistFixedSale(index);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('unlist successfully from contract owner', async () => {
        await listing.connect(owner).unlistFixedSale(index);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
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
        await listing.connect(user3).buyFixedSale(index, { value: price });

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('reverts unlist if not listed in fixed sale - not listed', async () => {
        const reason = 'L: not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index);

        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if not listed in fixed sale - listed in auction sale', async () => {
        const reason = 'L: not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index);
        const startTime = toBN(await getCurrentBlockTimestamp())
          .plus(2)
          .toString();
        const endTime = toBN(startTime).plus(validTime).toString();
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);

        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
        index = 2;
        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if not the nftOwner or contract owner', async () => {
        const reason = 'L: not the nftOwner or contract owner';

        await expect(listing.connect(user2).unlistFixedSale(index)).to.be.revertedWith(reason);
      });
      it('emit UnlistedFixedSale event', async () => {
        await expect(listing.connect(user1).unlistFixedSale(index))
          .to.emit(listing, 'UnlistedFixedSale')
          .withArgs(erc721HAddress, 1, user1.address, quantity, index);
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

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1, EMPTY_HASH);
        await erc1155H.connect(user1).setApprovalForAll(listingAddress, true);
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
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
      it('unlist successfully', async () => {
        await listing.connect(user1).unlistFixedSale(index);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
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
      it('unlist successfully from contract owner', async () => {
        await listing.connect(owner).unlistFixedSale(index);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
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
      it('unlist when removeWhitelist', async () => {
        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        expect(await listing.isFixedSaleListed(index)).to.equal(false);
      });
      it('unlist when purchased', async () => {
        await listing.connect(user3).buyFixedSale(index, { value: price });

        expect(await listing.isFixedSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
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
      it('reverts unlist if not listed in fixed sale - not listed', async () => {
        const reason = 'L: not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index);

        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if not listed in fixed sale - listed in auction sale', async () => {
        const reason = 'L: not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index);
        const startTime = toBN(await getCurrentBlockTimestamp())
          .plus(2)
          .toString();
        const endTime = toBN(startTime).plus(validTime).toString();
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);

        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
        index = 2;
        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if not the nftOwner or contract owner', async () => {
        const reason = 'L: not the nftOwner or contract owner';

        await expect(listing.connect(user2).unlistFixedSale(index)).to.be.revertedWith(reason);
        await expect(listing.connect(whitelister).unlistFixedSale(index)).to.be.revertedWith(reason);
      });
      it('emit UnlistedFixedSale event', async () => {
        await expect(listing.connect(user1).unlistFixedSale(index))
          .to.emit(listing, 'UnlistedFixedSale')
          .withArgs(erc1155HAddress, 1, user1.address, quantity, index);
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

        await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
        await erc721H.connect(user1).setApprovalForAll(listingAddress, true);
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        await listing.connect(owner).setFixedComPercent(10);
      });
      it('buy at fixed sale successfully', async () => {
        const tx = await listing.connect(user3).buyFixedSale(index, { value: value });

        await expect(tx).to.changeEtherBalance(user3.address, -value);
        await expect(tx).to.changeEtherBalance(owner.address, +toWei('100000', 'gwei'));
        await expect(tx).to.changeEtherBalance(user1.address, +toWei('900000', 'gwei')); // price - 10%
        await expect(tx).to.changeEtherBalance(commissionAddress, toWei('100000', 'gwei'));

        await expect(tx).to.changeTokenBalances(erc721H, [user1, user3], [-quantity, quantity]);
        expect(await erc721H.ownerOf(1)).to.equal(user3.address);
        expect(await erc721H.balanceOf(user1.address)).to.equal(0);
        expect(await erc721H.balanceOf(user3.address)).to.equal(quantity);
      });
      it('reverts buy if not listed in fixed sale - not listed', async () => {
        const reason = 'L: not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index);

        await expect(listing.connect(user3).buyFixedSale(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts buy if not listed in fixed sale - listed in auction sale', async () => {
        const reason = 'L: not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index);
        const startTime = toBN(await getCurrentBlockTimestamp())
          .plus(2)
          .toString();
        const endTime = toBN(startTime).plus(validTime).toString();
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);

        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
        index = 2;
        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
      });
      it('reverts buy if not whitelisted', async () => {
        const reason = 'L: not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        await expect(listing.connect(user3).buyFixedSale(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts buy if date expired', async () => {
        const reason = 'L: listing expired';

        await increaseTime(validTime);

        await expect(listing.connect(user3).buyFixedSale(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts buy if msg.value not enough', async () => {
        const reason = 'L: not enought ISLM';

        await expect(listing.connect(user3).buyFixedSale(index, { value: 0 })).to.be.revertedWith(reason);
        await expect(listing.connect(user3).buyFixedSale(index, { value: price })).to.be.revertedWith(reason);
      });
      it('emit BoughtFixedSale event', async () => {
        await expect(listing.connect(user3).buyFixedSale(index, { value: value }))
          .to.emit(listing, 'BoughtFixedSale')
          .withArgs(erc721HAddress, 1, user3.address, quantity, index);
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

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1, EMPTY_HASH);
        await erc1155H.connect(user1).setApprovalForAll(listingAddress, true);
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        expect(await listing.isFixedSaleListed(index)).to.equal(true);

        await listing.connect(owner).setFixedComPercent(10);
      });
      it('buy at fixed sale successfully', async () => {
        const tx = await listing.connect(user3).buyFixedSale(index, { value: value });

        await expect(tx).to.changeEtherBalance(user3.address, -value);
        await expect(tx).to.changeEtherBalance(owner.address, +toWei('100000', 'gwei'));
        await expect(tx).to.changeEtherBalance(user1.address, +toWei('900000', 'gwei')); // price - 10%
        await expect(tx).to.changeEtherBalance(commissionAddress, toWei('100000', 'gwei'));

        expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(0);
        expect(await erc1155H.balanceOf(user3.address, 1)).to.equal(quantity);
      });
      it('reverts buy if not listed in fixed sale - not listed', async () => {
        const reason = 'L: not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index);

        await expect(listing.connect(user3).buyFixedSale(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts buy if not listed in fixed sale - listed in auction sale', async () => {
        const reason = 'L: not listed in fixed sale';

        await listing.connect(user1).unlistFixedSale(index);
        const startTime = toBN(await getCurrentBlockTimestamp())
          .plus(2)
          .toString();
        const endTime = toBN(startTime).plus(validTime).toString();
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);

        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
        index = 2;
        await expect(listing.connect(user1).unlistFixedSale(index)).to.be.revertedWith(reason);
      });
      it('reverts buy if not whitelisted', async () => {
        const reason = 'L: not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        await expect(listing.connect(user3).buyFixedSale(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts buy if date expired', async () => {
        const reason = 'L: listing expired';

        await increaseTime(validTime);

        await expect(listing.connect(user3).buyFixedSale(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts buy if msg.value not enough', async () => {
        const reason = 'L: not enought ISLM';

        await expect(listing.connect(user3).buyFixedSale(index, { value: 0 })).to.be.revertedWith(reason);
        await expect(listing.connect(user3).buyFixedSale(index, { value: price })).to.be.revertedWith(reason);
      });
      it('emit BoughtFixedSale event', async () => {
        await expect(listing.connect(user3).buyFixedSale(index, { value: value }))
          .to.emit(listing, 'BoughtFixedSale')
          .withArgs(erc1155HAddress, 1, user3.address, quantity, index);
      });
    });
  });
  describe('listAuctionSale', async () => {
    describe('ERC721', async () => {
      let index;
      let quantity;
      let startTime, endTime;

      let saleListing;
      let erc721SaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();

        await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
        await erc721H.connect(user1).setApprovalForAll(auctionAddress, true);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('list successfully', async () => {
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(erc721HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(1);
      });
      it('reverts list if price is zero', async () => {
        const reason = 'L: price too low';

        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, 0, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if wrong time', async () => {
        const reason = 'L: auction wrong time';

        const now = await getCurrentBlockTimestamp();

        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, endTime, startTime, quantity)
        ).to.be.revertedWith(reason);
        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, now, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'L: not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not the nftOwner', async () => {
        const reason = 'L: not the nftOwner';

        await expect(
          listing.connect(user2).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed', async () => {
        const reason = 'L: already listed';

        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);

        await expect(
          listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('emit ListedAuctionSale event', async () => {
        await expect(listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity))
          .to.emit(listing, 'ListedAuctionSale')
          .withArgs(erc721HAddress, 1, user1.address, price, startTime, endTime, quantity, index);
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
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1, EMPTY_HASH);
        await erc1155H.connect(user1).setApprovalForAll(auctionAddress, true);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
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
      it('list successfully', async () => {
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
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
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price2, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        expect(await listing.isAuctionSaleListed(index1)).to.equal(true);
        expect(await listing.isAuctionSaleListed(index2)).to.equal(true);

        saleListing = await listing.saleListing(index1);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price1);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        saleListing = await listing.saleListing(index2);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
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
        await erc1155H.connect(owner).mintMock(user2.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await erc1155H.connect(user2).setApprovalForAll(auctionAddress, true);

        const index1 = 1;
        const index2 = 2;

        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await listing.connect(user2).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        expect(await listing.isAuctionSaleListed(index1)).to.equal(true);
        expect(await listing.isAuctionSaleListed(index2)).to.equal(true);

        saleListing = await listing.saleListing(index1);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        saleListing = await listing.saleListing(index2);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user2.address);
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
        const reason = 'L: price too low';

        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, 0, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if wrong time', async () => {
        const reason = 'L: auction wrong time';

        const now = await getCurrentBlockTimestamp();

        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, endTime, startTime, quantity)
        ).to.be.revertedWith(reason);
        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, now, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'L: not whitelisted';

        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if not the nftOwner', async () => {
        const reason = 'L: not the nftOwner or quantity already listed';

        await expect(
          listing.connect(user2).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('reverts list if already listed', async () => {
        const reason = 'L: not the nftOwner or quantity already listed';

        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);

        await expect(
          listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity)
        ).to.be.revertedWith(reason);
      });
      it('emit ListedAuctionSale event', async () => {
        await expect(listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity))
          .to.emit(listing, 'ListedAuctionSale')
          .withArgs(erc1155HAddress, 1, user1.address, price, startTime, endTime, quantity, index);
      });
    });
  });
  describe('unlistAuctionSale', async () => {
    describe('ERC721', async () => {
      let index;
      let quantity;
      let startTime, endTime;

      let saleListing;
      let erc721SaleListingID;
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();

        await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
        await erc721H.connect(user1).setApprovalForAll(auctionAddress, true);
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(erc721HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
        expect(saleListing.price).to.equal(price);
        expect(saleListing.startTime).to.equal(startTime);
        expect(saleListing.endTime).to.equal(endTime);
        expect(saleListing.quantity).to.equal(quantity);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(1);
      });
      it('unlist successfully', async () => {
        await listing.connect(user1).unlistAuctionSale(index);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('unlist when removeWhitelist', async () => {
        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);
      });
      it('unlist when purchased', async () => {
        await auction.connect(user3).placeBid(index, { value: toWei('1100000', 'gwei') });
        await auction.connect(owner).endAuction(index);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
        expect(saleListing.price).to.equal(0);
        expect(saleListing.startTime).to.equal(0);
        expect(saleListing.endTime).to.equal(0);
        expect(saleListing.quantity).to.equal(0);

        erc721SaleListingID = await listing.erc721SaleListingID(erc721HAddress, 1);
        expect(erc721SaleListingID).to.equal(0);
      });
      it('reverts unlist if not listed in auction sale - not listed', async () => {
        const reason = 'L: not listed in auction sale';

        await listing.connect(user1).unlistAuctionSale(index);

        await expect(listing.connect(user1).unlistAuctionSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if not listed in auction sale - listed in fixed sale', async () => {
        const reason = 'L: not listed in auction sale';

        await listing.connect(user1).unlistAuctionSale(index);
        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        await expect(listing.connect(user1).unlistAuctionSale(index)).to.be.revertedWith(reason);
        index = 2;
        await expect(listing.connect(user1).unlistAuctionSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if has bids', async () => {
        const reason = 'L: listing has bids';

        await auction.connect(user3).placeBid(index, { value: toWei('1100000', 'gwei') });

        await expect(listing.connect(user1).unlistAuctionSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if not the nftOwner or contract owner', async () => {
        const reason = 'L: not the nftOwner or contract owner';

        await expect(listing.connect(user2).unlistAuctionSale(index)).to.be.revertedWith(reason);
      });
      it('emit UnlistedAuctionSale event', async () => {
        await expect(listing.connect(user1).unlistAuctionSale(index))
          .to.emit(listing, 'UnlistedAuctionSale')
          .withArgs(erc721HAddress, 1, user1.address, quantity, index);
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
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1, EMPTY_HASH);
        await erc1155H.connect(user1).setApprovalForAll(auctionAddress, true);
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        expect(await listing.isAuctionSaleListed(index)).to.equal(true);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(erc1155HAddress);
        expect(saleListing.nftID).to.equal(1);
        expect(saleListing.nftOwner).to.equal(user1.address);
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
      it('unlist successfully', async () => {
        await listing.connect(user1).unlistAuctionSale(index);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
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
      it('unlist when removeWhitelist', async () => {
        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);
      });
      it('unlist when purchased', async () => {
        await auction.connect(user3).placeBid(index, { value: toWei('1100000', 'gwei') });
        await auction.connect(owner).endAuction(index);

        expect(await listing.isAuctionSaleListed(index)).to.equal(false);

        saleListing = await listing.saleListing(index);
        expect(saleListing.nftAddress).to.equal(ZERO_ADDRESS);
        expect(saleListing.nftID).to.equal(0);
        expect(saleListing.nftOwner).to.equal(ZERO_ADDRESS);
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
      it('reverts unlist if not listed in auction sale - not listed', async () => {
        const reason = 'L: not listed in auction sale';

        await listing.connect(user1).unlistAuctionSale(index);

        await expect(listing.connect(user1).unlistAuctionSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if not listed in auction sale - listed in fixed sale', async () => {
        const reason = 'L: not listed in auction sale';

        await listing.connect(user1).unlistAuctionSale(index);
        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        await expect(listing.connect(user1).unlistAuctionSale(index)).to.be.revertedWith(reason);
        index = 2;
        await expect(listing.connect(user1).unlistAuctionSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if has bids', async () => {
        const reason = 'L: listing has bids';

        await auction.connect(user3).placeBid(index, { value: toWei('1100000', 'gwei') });

        await expect(listing.connect(user1).unlistAuctionSale(index)).to.be.revertedWith(reason);
      });
      it('reverts unlist if not the nftOwner or contract owner', async () => {
        const reason = 'L: not the nftOwner or contract owner';

        await expect(listing.connect(user2).unlistAuctionSale(index)).to.be.revertedWith(reason);
        await expect(listing.connect(whitelister).unlistAuctionSale(index)).to.be.revertedWith(reason);
      });
      it('emit UnlistedAuctionSale event', async () => {
        await expect(listing.connect(user1).unlistAuctionSale(index))
          .to.emit(listing, 'UnlistedAuctionSale')
          .withArgs(erc1155HAddress, 1, user1.address, quantity, index);
      });
    });
  });
  describe.skip('gas cost', async () => {
    let index;
    let quantity;
    let expiration, startTime, endTime;
    let value;

    let tx;
    beforeEach('setup', async () => {
      index = 1;
      quantity = 1;
      expiration = toBN(await getCurrentBlockTimestamp())
        .plus(validTime)
        .toString();
      startTime = toBN(await getCurrentBlockTimestamp())
        .plus(60 * 60)
        .toString();
      endTime = toBN(startTime).plus(validTime).toString();
      value = toWei('1100000', 'gwei');

      await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
      await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
      await erc721H.connect(user1).setApprovalForAll(listingAddress, true);

      await listing.connect(owner).setFixedComPercent(10);
    });
    it('listFixedSale', async () => {
      tx = await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

      await getCosts(tx);
    });
    it('unlistFixedSale', async () => {
      await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

      tx = await listing.connect(user1).unlistFixedSale(index);

      await getCosts(tx);
    });
    it('buyFixedSale', async () => {
      await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

      tx = await listing.connect(user3).buyFixedSale(index, { value: value });

      await getCosts(tx);
    });
    it('listAuctionSale', async () => {
      tx = await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);

      await getCosts(tx);
    });
    it('unlistAuctionSale', async () => {
      await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);

      tx = await listing.connect(user1).unlistAuctionSale(index);

      await getCosts(tx);
    });
  });
});
