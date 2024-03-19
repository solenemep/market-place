const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const {
  snapshot,
  restore,
  getCurrentBlockTimestamp,
  toWei,
  toBN,
  ZERO_ADDRESS,
  increaseTimeTo,
  getCosts,
  WHITELISTER_ROLE,
  EMPTY_HASH,
} = require('./helpers/utils.js');

describe('Auction', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftRegistry, nftRegistryAddress;
  let listing, listingAddress;
  let auction, auctionAddress;

  let commissionAddress;

  let owner;
  let user1, user2, user3, user4;
  let whitelister;

  let index;
  let quantity;
  let startTime, endTime;

  let highestBid;
  let value;

  const price = toWei('1000000', 'gwei');
  const minBid = toWei('1100000', 'gwei');
  const validTime = 10 * 24 * 60 * 60;

  const royaltyPercent = 10;

  before('setup', async () => {
    const setups = await init();

    owner = setups.users[0];
    user1 = setups.users[1];
    user2 = setups.users[2];
    user3 = setups.users[3];
    user4 = setups.users[4];
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

    await auction.connect(owner).setAuctionComPercent(10);

    await snapshot();
  });

  afterEach('revert', async () => {
    await restore();
  });

  describe('deployment', async () => {
    it('deploy contract successfully', async () => {
      expect(await registry.getContract(args.AUCTION_ID)).to.equal(auctionAddress);
    });
    it('sets dependencies successfully', async () => {
      expect(await auction.nftRegistry()).to.equal(nftRegistryAddress);
      expect(await auction.listing()).to.equal(listingAddress);
      expect(await auction.commissionAddress()).to.equal(commissionAddress);
    });
  });
  describe('hasBids', async () => {
    describe('ERC721', async () => {
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();
        value = toWei('1150000', 'gwei');

        await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
        await erc721H.connect(user1).setApprovalForAll(auctionAddress, true);
      });
      it('has no bids : not listed / no one bid / auction not started', async () => {
        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('has no bids : listed / no one bid / auction not started', async () => {
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('has no bids : listed / no one bid / auction in progress', async () => {
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('has no bids : listed / one bid / auction ended', async () => {
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });
        await auction.connect(owner).endAuction(index);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('has no bids : unlisted / no one bid / auction in progress', async () => {
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        await listing.connect(user1).unlistAuctionSale(index);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('has bids : listed / one bid / auction in progress', async () => {
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });

        expect(await auction.hasBids(index)).to.equal(true);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(user3.address);
        expect(highestBid.highestBidAmount).to.equal(value);
      });
      it('has bids : listed / two bid / auction in progress', async () => {
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });
        await auction.connect(user4).placeBid(index, { value: toWei('1200000', 'gwei') });

        expect(await auction.hasBids(index)).to.equal(true);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(user4.address);
        expect(highestBid.highestBidAmount).to.equal(toWei('1200000', 'gwei'));
      });
    });
    describe('ERC1155', async () => {
      beforeEach('setup', async () => {
        index = 1;
        quantity = 8;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();
        value = toWei('1150000', 'gwei');

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1, EMPTY_HASH);
        await erc1155H.connect(user1).setApprovalForAll(auctionAddress, true);
      });
      it('has no bids : not listed / no one bid / auction not started', async () => {
        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('has no bids : listed / no one bid / auction not started', async () => {
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('has no bids : listed / no one bid / auction in progress', async () => {
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('has no bids : listed / one bid / auction ended', async () => {
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });
        await auction.connect(owner).endAuction(index);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('has no bids : unlisted / no one bid / auction in progress', async () => {
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        await listing.connect(user1).unlistAuctionSale(index);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('has bids : listed / one bid / auction in progress', async () => {
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });

        expect(await auction.hasBids(index)).to.equal(true);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(user3.address);
        expect(highestBid.highestBidAmount).to.equal(value);
      });
      it('has bids : listed / two bid / auction in progress', async () => {
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });
        await auction.connect(user4).placeBid(index, { value: toWei('1200000', 'gwei') });

        expect(await auction.hasBids(index)).to.equal(true);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(user4.address);
        expect(highestBid.highestBidAmount).to.equal(toWei('1200000', 'gwei'));
      });
    });
  });
  describe('createAuction', async () => {
    describe('ERC721', async () => {
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();
        value = toWei('1150000', 'gwei');

        await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
        await erc721H.connect(user1).setApprovalForAll(auctionAddress, true);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('create successfully', async () => {
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('reverts if wrong caller', async () => {
        const reason = 'A: wrong caller';

        await expect(auction.connect(user1).createAuction(index, price)).to.be.revertedWith(reason);
      });
    });
    describe('ERC1155', async () => {
      beforeEach('setup', async () => {
        index = 1;
        quantity = 8;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();
        value = toWei('1150000', 'gwei');

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1, EMPTY_HASH);
        await erc1155H.connect(user1).setApprovalForAll(auctionAddress, true);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('create successfully', async () => {
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('reverts if wrong caller', async () => {
        const reason = 'A: wrong caller';

        await expect(auction.connect(user1).createAuction(index, price)).to.be.revertedWith(reason);
      });
    });
  });
  describe('placeBid', async () => {
    describe('ERC721', async () => {
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();
        value = toWei('1150000', 'gwei');

        await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
        await erc721H.connect(user1).setApprovalForAll(auctionAddress, true);

        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('placeBid successfully once', async () => {
        await increaseTimeTo(startTime);

        const tx = await auction.connect(user3).placeBid(index, { value: value });

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(user3.address, -value);
        await expect(tx).to.changeEtherBalance(user4.address, 0);
        await expect(tx).to.changeEtherBalance(auctionAddress, +value);
        await expect(tx).to.changeEtherBalance(commissionAddress, 0);

        await expect(tx).to.changeTokenBalances(erc721H, [user1, auctionAddress], [-quantity, quantity]);
        expect(await erc721H.ownerOf(1)).to.equal(auctionAddress);
        expect(await erc721H.balanceOf(user1.address)).to.equal(0);
        expect(await erc721H.balanceOf(auctionAddress)).to.equal(quantity);

        expect(await auction.hasBids(index)).to.equal(true);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(user3.address);
        expect(highestBid.highestBidAmount).to.equal(value);
      });
      it('placeBid successfully twice', async () => {
        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });
        const tx = await auction.connect(user4).placeBid(index, { value: toWei('1200000', 'gwei') });

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(user3.address, +value);
        await expect(tx).to.changeEtherBalance(user4.address, -toWei('1200000', 'gwei'));
        await expect(tx).to.changeEtherBalance(auctionAddress, +toWei('50000', 'gwei'));
        await expect(tx).to.changeEtherBalance(commissionAddress, 0);

        await expect(tx).to.changeTokenBalances(erc721H, [user1, auctionAddress], [0, 0]);
        expect(await erc721H.ownerOf(1)).to.equal(auctionAddress);
        expect(await erc721H.balanceOf(user1.address)).to.equal(0);
        expect(await erc721H.balanceOf(auctionAddress)).to.equal(quantity);

        expect(await auction.hasBids(index)).to.equal(true);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(user4.address);
        expect(highestBid.highestBidAmount).to.equal(toWei('1200000', 'gwei'));
      });
      it('reverts placeBid if not listed in auction sale - not listed', async () => {
        const reason = 'A: not listed in auction sale';

        await increaseTimeTo(startTime);

        await listing.connect(user1).unlistAuctionSale(index);

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if not listed in auction sale - listed in fixed sale', async () => {
        const reason = 'A: not listed in auction sale';

        await increaseTimeTo(startTime);

        await listing.connect(user1).unlistAuctionSale(index);
        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
        index = 2;
        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if not whitelisted', async () => {
        const reason = 'A: not whitelisted';

        await increaseTimeTo(startTime);

        await nftRegistry.connect(whitelister).removeWhitelist(erc721HAddress, 1);

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if auction not started', async () => {
        const reason = 'A: auction not started';

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if auction ended', async () => {
        const reason = 'A: auction ended';

        await increaseTimeTo(endTime);

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts first placeBid if bid smaller than minPrice', async () => {
        const reason = 'A: bid is too low';

        await increaseTimeTo(startTime);

        await expect(auction.connect(user3).placeBid(index, { value: price })).to.be.revertedWith(reason);
        await expect(auction.connect(user3).placeBid(index, { value: minBid })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if bid smaller than previous bid', async () => {
        const reason = 'A: bid is too low';

        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });

        await expect(auction.connect(user4).placeBid(index, { value: minBid })).to.be.revertedWith(reason);
        await expect(auction.connect(user4).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('emit BidPlaced event', async () => {
        await increaseTimeTo(startTime);

        await expect(auction.connect(user3).placeBid(index, { value: value }))
          .to.emit(auction, 'BidPlaced')
          .withArgs(index, user3.address, value);
      });
    });
    describe('ERC1155', async () => {
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();
        value = toWei('1150000', 'gwei');

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1, EMPTY_HASH);
        await erc1155H.connect(user1).setApprovalForAll(auctionAddress, true);

        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(minBid);
      });
      it('placeBid successfully once', async () => {
        await increaseTimeTo(startTime);

        const tx = await auction.connect(user3).placeBid(index, { value: value });

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(user3.address, -value);
        await expect(tx).to.changeEtherBalance(user4.address, 0);
        await expect(tx).to.changeEtherBalance(auctionAddress, +value);
        await expect(tx).to.changeEtherBalance(commissionAddress, 0);

        expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(0);
        expect(await erc1155H.balanceOf(auctionAddress, 1)).to.equal(quantity);

        expect(await auction.hasBids(index)).to.equal(true);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(user3.address);
        expect(highestBid.highestBidAmount).to.equal(value);
      });
      it('placeBid successfully twice', async () => {
        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });
        const tx = await auction.connect(user4).placeBid(index, { value: toWei('1200000', 'gwei') });

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(user3.address, +value);
        await expect(tx).to.changeEtherBalance(user4.address, -toWei('1200000', 'gwei'));
        await expect(tx).to.changeEtherBalance(auctionAddress, +toWei('50000', 'gwei'));
        await expect(tx).to.changeEtherBalance(commissionAddress, 0);

        expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(0);
        expect(await erc1155H.balanceOf(auctionAddress, 1)).to.equal(quantity);

        expect(await auction.hasBids(index)).to.equal(true);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(user4.address);
        expect(highestBid.highestBidAmount).to.equal(toWei('1200000', 'gwei'));
      });
      it('reverts placeBid if not listed in auction sale - not listed', async () => {
        const reason = 'A: not listed in auction sale';

        await increaseTimeTo(startTime);

        await listing.connect(user1).unlistAuctionSale(index);

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if not listed in auction sale - listed in fixed sale', async () => {
        const reason = 'A: not listed in auction sale';

        await increaseTimeTo(startTime);

        await listing.connect(user1).unlistAuctionSale(index);
        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
        index = 2;
        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if not whitelisted', async () => {
        const reason = 'A: not whitelisted';

        await increaseTimeTo(startTime);

        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if auction not started', async () => {
        const reason = 'A: auction not started';

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if auction ended', async () => {
        const reason = 'A: auction ended';

        await increaseTimeTo(endTime);

        await expect(auction.connect(user3).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('reverts first placeBid if bid smaller than minPrice', async () => {
        const reason = 'A: bid is too low';

        await increaseTimeTo(startTime);

        await expect(auction.connect(user3).placeBid(index, { value: price })).to.be.revertedWith(reason);
        await expect(auction.connect(user3).placeBid(index, { value: minBid })).to.be.revertedWith(reason);
      });
      it('reverts placeBid if bid smaller than previous bid', async () => {
        const reason = 'A: bid is too low';

        await increaseTimeTo(startTime);

        await auction.connect(user3).placeBid(index, { value: value });

        await expect(auction.connect(user4).placeBid(index, { value: minBid })).to.be.revertedWith(reason);
        await expect(auction.connect(user4).placeBid(index, { value: value })).to.be.revertedWith(reason);
      });
      it('emit BidPlaced event', async () => {
        await increaseTimeTo(startTime);

        await expect(auction.connect(user3).placeBid(index, { value: value }))
          .to.emit(auction, 'BidPlaced')
          .withArgs(index, user3.address, value);
      });
    });
  });
  describe('endAuction', async () => {
    describe('ERC721', async () => {
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();
        value = toWei('1150000', 'gwei');

        await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
        await erc721H.connect(user1).setApprovalForAll(auctionAddress, true);
        await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);
      });
      it('endAuction successfully - one bid', async () => {
        await auction.connect(user3).placeBid(index, { value: value });

        const tx = await auction.connect(owner).endAuction(index);

        await expect(tx).to.changeEtherBalance(owner.address, +toWei('103500', 'gwei'));
        await expect(tx).to.changeEtherBalance(user1.address, +toWei('931500', 'gwei')); // 1035000 - 10%
        await expect(tx).to.changeEtherBalance(user3.address, 0);
        await expect(tx).to.changeEtherBalance(user4.address, 0);
        await expect(tx).to.changeEtherBalance(auctionAddress, -value);
        await expect(tx).to.changeEtherBalance(commissionAddress, +toWei('115000', 'gwei'));

        await expect(tx).to.changeTokenBalances(erc721H, [auctionAddress, user3.address], [-quantity, quantity]);
        expect(await erc721H.ownerOf(1)).to.equal(user3.address);
        expect(await erc721H.balanceOf(user1.address)).to.equal(0);
        expect(await erc721H.balanceOf(user3.address)).to.equal(quantity);
        expect(await erc721H.balanceOf(user4.address)).to.equal(0);
        expect(await erc721H.balanceOf(auctionAddress)).to.equal(0);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('endAuction successfully - 2 bids', async () => {
        await auction.connect(user3).placeBid(index, { value: value });
        await auction.connect(user4).placeBid(index, { value: toWei('1200000', 'gwei') });

        const tx = await auction.connect(owner).endAuction(index);

        await expect(tx).to.changeEtherBalance(owner.address, +toWei('108000', 'gwei'));
        await expect(tx).to.changeEtherBalance(user1.address, +toWei('972000', 'gwei')); // 1080000 - 10%
        await expect(tx).to.changeEtherBalance(user3.address, 0);
        await expect(tx).to.changeEtherBalance(user4.address, 0);
        await expect(tx).to.changeEtherBalance(auctionAddress, -toWei('1200000', 'gwei'));
        await expect(tx).to.changeEtherBalance(commissionAddress, +toWei('120000', 'gwei'));

        await expect(tx).to.changeTokenBalances(erc721H, [auctionAddress, user4.address], [-quantity, quantity]);
        expect(await erc721H.ownerOf(1)).to.equal(user4.address);
        expect(await erc721H.balanceOf(user1.address)).to.equal(0);
        expect(await erc721H.balanceOf(user3.address)).to.equal(0);
        expect(await erc721H.balanceOf(user4.address)).to.equal(quantity);
        expect(await erc721H.balanceOf(auctionAddress)).to.equal(0);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('reverts endAuction if not listed in auction sale - not listed', async () => {
        const reason = 'A: not listed in auction sale';

        await listing.connect(user1).unlistAuctionSale(index);

        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
      });
      it('reverts endAuction if not listed in auction sale - listed in fixed sale', async () => {
        const reason = 'A: not listed in auction sale';

        await listing.connect(user1).unlistAuctionSale(index);
        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await listing.connect(user1).listFixedSale(erc721HAddress, 1, price, expiration, quantity);

        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
        index = 2;
        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
      });
      it('reverts endAuction if not listed in auction sale - auction already ended', async () => {
        const reason = 'A: not listed in auction sale';

        await auction.connect(user3).placeBid(index, { value: value });
        await auction.connect(owner).endAuction(index);

        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
      });
      it('reverts endAuction if nobody placed bid', async () => {
        const reason = 'A: nobody placed bid';

        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
      });
      it('emit AuctionEnded event', async () => {
        await auction.connect(user3).placeBid(index, { value: value });

        await expect(auction.connect(owner).endAuction(index))
          .to.emit(auction, 'AuctionEnded')
          .withArgs(index, user3.address, value);
      });
    });
    describe('ERC1155', async () => {
      beforeEach('setup', async () => {
        index = 1;
        quantity = 1;
        startTime = toBN(await getCurrentBlockTimestamp())
          .plus(60 * 60)
          .toString();
        endTime = toBN(startTime).plus(validTime).toString();
        value = toWei('1150000', 'gwei');

        await erc1155H.connect(owner).mintMock(user1.address, 1, quantity, royaltyPercent, web3.utils.asciiToHex(''));
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1, EMPTY_HASH);
        await erc1155H.connect(user1).setApprovalForAll(auctionAddress, true);
        await listing.connect(user1).listAuctionSale(erc1155HAddress, 1, price, startTime, endTime, quantity);
        await increaseTimeTo(startTime);
      });
      it('endAuction successfully - one bid', async () => {
        await auction.connect(user3).placeBid(index, { value: value });

        const tx = await auction.connect(owner).endAuction(index);

        await expect(tx).to.changeEtherBalance(owner.address, +toWei('103500', 'gwei'));
        await expect(tx).to.changeEtherBalance(user1.address, +toWei('931500', 'gwei')); // 1035000 - 10%
        await expect(tx).to.changeEtherBalance(user3.address, 0);
        await expect(tx).to.changeEtherBalance(user4.address, 0);
        await expect(tx).to.changeEtherBalance(auctionAddress, -value);
        await expect(tx).to.changeEtherBalance(commissionAddress, +toWei('115000', 'gwei'));

        expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(0);
        expect(await erc1155H.balanceOf(user3.address, 1)).to.equal(quantity);
        expect(await erc1155H.balanceOf(user4.address, 1)).to.equal(0);
        expect(await erc1155H.balanceOf(auctionAddress, 1)).to.equal(0);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('endAuction successfully - 2 bids', async () => {
        await auction.connect(user3).placeBid(index, { value: value });
        await auction.connect(user4).placeBid(index, { value: toWei('1200000', 'gwei') });

        const tx = await auction.connect(owner).endAuction(index);

        await expect(tx).to.changeEtherBalance(owner.address, +toWei('108000', 'gwei'));
        await expect(tx).to.changeEtherBalance(user1.address, +toWei('972000', 'gwei')); // 1080000 - 10%
        await expect(tx).to.changeEtherBalance(user3.address, 0);
        await expect(tx).to.changeEtherBalance(user4.address, 0);
        await expect(tx).to.changeEtherBalance(auctionAddress, -toWei('1200000', 'gwei'));
        await expect(tx).to.changeEtherBalance(commissionAddress, +toWei('120000', 'gwei'));

        expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(0);
        expect(await erc1155H.balanceOf(user3.address, 1)).to.equal(0);
        expect(await erc1155H.balanceOf(user4.address, 1)).to.equal(quantity);
        expect(await erc1155H.balanceOf(auctionAddress, 1)).to.equal(0);

        expect(await auction.hasBids(index)).to.equal(false);

        highestBid = await auction.highestBid(index);
        expect(highestBid.highestBidder).to.equal(ZERO_ADDRESS);
        expect(highestBid.highestBidAmount).to.equal(0);
      });
      it('reverts endAuction if not listed in auction sale - not listed', async () => {
        const reason = 'A: not listed in auction sale';

        await listing.connect(user1).unlistAuctionSale(index);

        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
      });
      it('reverts endAuction if not listed in auction sale - listed in fixed sale', async () => {
        const reason = 'A: not listed in auction sale';

        await listing.connect(user1).unlistAuctionSale(index);
        const expiration = toBN(await getCurrentBlockTimestamp())
          .plus(validTime)
          .toString();
        await listing.connect(user1).listFixedSale(erc1155HAddress, 1, price, expiration, quantity);

        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
        index = 2;
        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
      });
      it('reverts endAuction if not listed in auction sale - auction already ended', async () => {
        const reason = 'A: not listed in auction sale';

        await auction.connect(user3).placeBid(index, { value: value });
        await auction.connect(owner).endAuction(index);

        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
      });
      it('reverts endAuction if nobody placed bid', async () => {
        const reason = 'A: nobody placed bid';

        await expect(auction.connect(owner).endAuction(index)).to.be.revertedWith(reason);
      });
      it('emit AuctionEnded event', async () => {
        await auction.connect(user3).placeBid(index, { value: value });

        await expect(auction.connect(owner).endAuction(index))
          .to.emit(auction, 'AuctionEnded')
          .withArgs(index, user3.address, value);
      });
    });
  });
  describe.skip('gas cost', async () => {
    let index;
    let quantity;
    let startTime, endTime;
    let value;

    let tx;
    beforeEach('setup', async () => {
      index = 1;
      quantity = 1;
      startTime = toBN(await getCurrentBlockTimestamp())
        .plus(60 * 60)
        .toString();
      endTime = toBN(startTime).plus(validTime).toString();
      value = toWei('1150000', 'gwei');

      await erc721H.connect(owner).mintMock(user1.address, 1, royaltyPercent);
      await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1, EMPTY_HASH);
      await erc721H.connect(user1).setApprovalForAll(auctionAddress, true);

      await listing.connect(user1).listAuctionSale(erc721HAddress, 1, price, startTime, endTime, quantity);
      await increaseTimeTo(startTime);
    });
    it('placeBid', async () => {
      tx = await auction.connect(user3).placeBid(index, { value: value });

      await getCosts(tx);
    });
    it('endAuction', async () => {
      await auction.connect(user3).placeBid(index, { value: value });

      tx = await auction.connect(owner).endAuction(index);

      await getCosts(tx);
    });
  });
});
