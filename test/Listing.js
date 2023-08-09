const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const {
  snapshot,
  restore,
  signERC721H,
  signERC1155H,
  getCurrentBlockTimestamp,
  toWei,
  toBN,
} = require('./helpers/utils.js');

describe('Listing', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftIdentifier, nftIdentifierAddress;
  let nftRegistry, nftRegistryAddress;
  let listing, listingAddress;
  let auction, auctionAddress;

  let owner;
  let user1, user2, user3;
  let whitelister;

  const WHITELISTER_ROLE = web3.utils.soliditySha3('WHITELISTER_ROLE');

  const LIST = { NONE: 0, FIXED_SALE: 1, AUCTION_SALE: 2 };

  const price = toWei('10');
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

    nftIdentifier = setups.nftIdentifier;
    nftIdentifierAddress = await nftIdentifier.getAddress();

    nftRegistry = setups.nftRegistry;
    nftRegistryAddress = await nftRegistry.getAddress();

    listing = setups.listing;
    listingAddress = await listing.getAddress();

    auction = setups.auction;
    auctionAddress = await auction.getAddress();

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
      expect(await listing.nftIdentifier()).to.equal(nftIdentifierAddress);
      expect(await listing.nftRegistry()).to.equal(nftRegistryAddress);
      expect(await listing.auction()).to.equal(auctionAddress);
    });
  });
  describe('listFixedSale', async () => {
    describe('ERC721', async () => {
      beforeEach('setup', async () => {
        await erc721H.connect(owner).mintMock(owner.address, 1);
      });
      it('list sucessfully', async () => {
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1);
        await erc721H.connect(owner).setApprovalForAll(listingAddress, true);

        expect(await listing.isListed(erc721HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc721HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await listing.listFixedSale(erc721HAddress, 1, price, expiration);

        expect(await listing.isListed(erc721HAddress, 1)).to.equal(LIST.FIXED_SALE);

        fixedSaleListing = await listing.getFixedSaleListing(erc721HAddress, 1);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(1);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'Listing : not whitelisted';

        await erc721H.connect(owner).setApprovalForAll(listingAddress, true);

        expect(await listing.isListed(erc721HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc721HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await expect(listing.listFixedSale(erc721HAddress, 1, price, expiration)).to.be.revertedWith(reason);
      });
      it('reverts list if not approved', async () => {
        const reason = 'Listing : not approved';

        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1);

        expect(await listing.isListed(erc721HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc721HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await expect(listing.listFixedSale(erc721HAddress, 1, price, expiration)).to.be.revertedWith(reason);
      });
    });
    describe('ERC1155', async () => {
      beforeEach('setup', async () => {
        await erc1155H.connect(owner).mintMock(owner.address, 1, quantity, web3.utils.asciiToHex(''));
      });
      it('list sucessfully', async () => {
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        await erc1155H.connect(owner).setApprovalForAll(listingAddress, true);

        expect(await listing.isListed(erc1155HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc1155HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await listing.listFixedSale(erc1155HAddress, 1, price, expiration);

        expect(await listing.isListed(erc1155HAddress, 1)).to.equal(LIST.FIXED_SALE);

        fixedSaleListing = await listing.getFixedSaleListing(erc1155HAddress, 1);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);
      });
      it('reverts list if not whitelisted', async () => {
        const reason = 'Listing : not whitelisted';

        await erc1155H.connect(owner).setApprovalForAll(listingAddress, true);

        expect(await listing.isListed(erc1155HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc1155HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await expect(listing.listFixedSale(erc1155HAddress, 1, price, expiration)).to.be.revertedWith(reason);
      });
      it('reverts list if not approved', async () => {
        const reason = 'Listing : not approved';

        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);

        expect(await listing.isListed(erc1155HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc1155HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);

        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await expect(listing.listFixedSale(erc1155HAddress, 1, price, expiration)).to.be.revertedWith(reason);
      });
    });
  });
  describe('unlistFixedSale', async () => {
    describe('ERC721', async () => {
      beforeEach('setup', async () => {
        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();

        await erc721H.connect(owner).mintMock(owner.address, 1);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1);
        await erc721H.connect(owner).setApprovalForAll(listingAddress, true);
        await listing.listFixedSale(erc721HAddress, 1, price, expiration);

        expect(await listing.isListed(erc721HAddress, 1)).to.equal(LIST.FIXED_SALE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc721HAddress, 1);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(1);
      });
      it('unlist sucessfully', async () => {
        await listing.connect(owner).unlistFixedSale(erc721HAddress, 1);

        expect(await listing.isListed(erc721HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc721HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);
      });
      it('unlist when removeWhitelist', async () => {
        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        expect(await listing.isListed(erc721HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc721HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);
      });
      it('unlist when purchased', async () => {
        // TODO
      });
      it('reverts list if not allowed', async () => {
        const reason = 'Listing : not allowed';

        await expect(listing.connect(user1).unlistFixedSale(erc721HAddress, 1)).to.be.revertedWith(reason);
        await expect(listing.connect(whitelister).unlistFixedSale(erc721HAddress, 1)).to.be.revertedWith(reason);
      });
    });
    describe('ERC1155', async () => {
      beforeEach('setup', async () => {
        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();

        await erc1155H.connect(owner).mintMock(owner.address, 1, quantity, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        await erc1155H.connect(owner).setApprovalForAll(listingAddress, true);
        await listing.listFixedSale(erc1155HAddress, 1, price, expiration);

        expect(await listing.isListed(erc1155HAddress, 1)).to.equal(LIST.FIXED_SALE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc1155HAddress, 1);
        expect(fixedSaleListing.price).to.equal(price);
        expect(fixedSaleListing.expiration).to.equal(expiration);
        expect(fixedSaleListing.quantity).to.equal(quantity);
      });
      it('unlist sucessfully', async () => {
        await listing.connect(owner).unlistFixedSale(erc1155HAddress, 1);

        expect(await listing.isListed(erc1155HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc1155HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);
      });
      it('unlist when removeWhitelist', async () => {
        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        expect(await listing.isListed(erc1155HAddress, 1)).to.equal(LIST.NONE);

        let fixedSaleListing = await listing.getFixedSaleListing(erc1155HAddress, 1);
        expect(fixedSaleListing.price).to.equal(0);
        expect(fixedSaleListing.expiration).to.equal(0);
        expect(fixedSaleListing.quantity).to.equal(0);
      });
      it('unlist when purchased', async () => {
        // TODO
      });
      it('reverts list if not allowed', async () => {
        const reason = 'Listing : not allowed';

        await expect(listing.connect(user1).unlistFixedSale(erc1155HAddress, 1)).to.be.revertedWith(reason);
        await expect(listing.connect(whitelister).unlistFixedSale(erc1155HAddress, 1)).to.be.revertedWith(reason);
      });
    });
  });
});
