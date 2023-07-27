const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const { toWei, ZERO_ADDRESS, snapshot, restore, toBN } = require('./helpers/utils.js');

describe('Wallet', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftRegistry, nftRegistryAddress;
  let wallet, walletAddress;

  let daoAddress;

  let owner;
  let user1, user2, user3;
  let moderator;

  const MODERATOR_ROLE = web3.utils.soliditySha3('MODERATOR_ROLE');

  const moderationAmount = toWei('100000', 'mwei');
  const gasFee = toWei('100', 'mwei');

  before('setup', async () => {
    const setups = await init();

    owner = setups.users[0];
    user1 = setups.users[1];
    user2 = setups.users[2];
    user3 = setups.users[3];
    moderator = setups.users[5];

    registry = setups.registry;
    registryAddress = await registry.getAddress();

    erc721H = setups.erc721H;
    erc721HAddress = await erc721H.getAddress();

    erc1155H = setups.erc1155H;
    erc1155HAddress = await erc1155H.getAddress();

    nftRegistry = setups.nftRegistry;
    nftRegistryAddress = await nftRegistry.getAddress();

    wallet = setups.wallet;
    walletAddress = await wallet.getAddress();

    daoAddress = setups.daoAddress;

    await nftRegistry.grantRole(MODERATOR_ROLE, moderator.address);

    await snapshot();
  });

  afterEach('revert', async () => {
    await restore();
  });

  describe('deployment', async () => {
    it('deploy contract successfully', async () => {
      expect(await registry.getContract(args.WALLET_ID)).to.equal(walletAddress);
    });
    it('sets dependencies successfully', async () => {
      expect(await wallet.nftRegistry()).to.equal(nftRegistryAddress);
      expect(await wallet.daoAddress()).to.equal(daoAddress);
    });
  });
  describe('deposit', async () => {
    it('deposit successfully', async () => {
      expect((await wallet.balances(1)).wallet).to.equal(ZERO_ADDRESS);
      expect((await wallet.balances(1)).locked).to.equal(0);
      expect((await wallet.balances(1)).available).to.equal(0);

      const tx = await wallet.connect(user1).deposit(1, { value: moderationAmount });

      await expect(tx).to.changeEtherBalances([user1.address, walletAddress], [-moderationAmount, +moderationAmount]);

      expect((await wallet.balances(1)).wallet).to.equal(user1.address);
      expect((await wallet.balances(1)).locked).to.equal(moderationAmount);
      expect((await wallet.balances(1)).available).to.equal(0);
    });
    it('deposit successfully twice', async () => {
      await wallet.connect(user1).deposit(1, { value: moderationAmount });

      expect((await wallet.balances(1)).wallet).to.equal(user1.address);
      expect((await wallet.balances(1)).locked).to.equal(moderationAmount);
      expect((await wallet.balances(1)).available).to.equal(0);

      const tx = await wallet.connect(user1).deposit(1, { value: moderationAmount });

      await expect(tx).to.changeEtherBalances([user1.address, walletAddress], [-moderationAmount, +moderationAmount]);

      expect((await wallet.balances(1)).wallet).to.equal(user1.address);
      expect((await wallet.balances(1)).locked.toString()).to.equal(toBN(moderationAmount).times(2).toString());
      expect((await wallet.balances(1)).available).to.equal(0);
    });
    it('reverts if not autorised', async () => {
      const reason = 'Wallet : not autorised';

      await wallet.connect(user1).deposit(1, { value: moderationAmount });

      expect((await wallet.balances(1)).wallet).to.equal(user1.address);
      expect((await wallet.balances(1)).locked).to.equal(moderationAmount);
      expect((await wallet.balances(1)).available).to.equal(0);

      await expect(wallet.connect(user2).deposit(1, { value: moderationAmount })).to.be.revertedWith(reason);
    });
  });
  describe('withdraw', async () => {
    it('withdraw successfully', async () => {
      await wallet.connect(user1).deposit(1, { value: moderationAmount });
      await nftRegistry.connect(moderator).approveMinting(erc1155HAddress, 1, 1, gasFee);

      expect((await wallet.balances(1)).wallet).to.equal(user1.address);
      expect((await wallet.balances(1)).locked).to.equal(0);
      expect((await wallet.balances(1)).available.toString()).to.equal(toBN(moderationAmount).minus(gasFee).toString());
      expect(await wallet.marketPlaceBalance()).to.equal(gasFee);

      const tx = await wallet.connect(user1).withdraw(1);

      await expect(tx).to.changeEtherBalances(
        [walletAddress, user1.address],
        [-toBN(moderationAmount).minus(gasFee), +toBN(moderationAmount).minus(gasFee)]
      );

      expect((await wallet.balances(1)).wallet).to.equal(user1.address);
      expect((await wallet.balances(1)).locked).to.equal(0);
      expect((await wallet.balances(1)).available).to.equal(0);
      expect(await wallet.marketPlaceBalance()).to.equal(gasFee);
    });
    it('reverts if not autorised', async () => {
      const reason = 'Wallet : not autorised';

      await wallet.connect(user1).deposit(1, { value: moderationAmount });
      await nftRegistry.connect(moderator).approveMinting(erc1155HAddress, 1, 1, gasFee);

      await expect(wallet.connect(user2).withdraw(1)).to.be.revertedWith(reason);
    });
    it('reverts if never deposited', async () => {
      const reason = 'Wallet : not autorised';

      await expect(wallet.connect(user1).withdraw(1)).to.be.revertedWith(reason);
    });
    it('reverts if already withdrawn (approval)', async () => {
      const reason = 'Wallet : nothing to withdraw';

      await wallet.connect(user1).deposit(1, { value: moderationAmount });
      await nftRegistry.connect(moderator).approveMinting(erc1155HAddress, 1, 1, gasFee);
      await wallet.connect(user1).withdraw(1);

      await expect(wallet.connect(user1).withdraw(1)).to.be.revertedWith(reason);
    });
    it('reverts if already withdrawn (decline)', async () => {
      const reason = 'Wallet : nothing to withdraw';

      await wallet.connect(user1).deposit(1, { value: moderationAmount });
      const tx = await nftRegistry.connect(moderator).declineMinting(1);

      await expect(tx).to.changeEtherBalances([walletAddress, daoAddress], [-moderationAmount, +moderationAmount]);

      expect((await wallet.balances(1)).wallet).to.equal(user1.address);
      expect((await wallet.balances(1)).locked).to.equal(0);
      expect((await wallet.balances(1)).available).to.equal(0);
      expect(await wallet.marketPlaceBalance()).to.equal(0);

      await expect(wallet.connect(user1).withdraw(1)).to.be.revertedWith(reason);
    });
  });
  describe('withdrawMarketPlaceBalance', async () => {
    it('withdraw successfully', async () => {
      await wallet.connect(user1).deposit(1, { value: moderationAmount });
      await nftRegistry.connect(moderator).approveMinting(erc1155HAddress, 1, 1, gasFee);

      expect(await wallet.marketPlaceBalance()).to.equal(gasFee);

      const tx = await wallet.withdrawMarketPlaceBalance();

      await expect(tx).to.changeEtherBalances([walletAddress, owner.address], [-gasFee, +gasFee]);

      expect(await wallet.marketPlaceBalance()).to.equal(0);
    });
  });
});
