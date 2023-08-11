const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const { snapshot, restore, toWei, toBN } = require('./helpers/utils');

describe('NFTRegistry', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftIdentifier, nftIdentifierAddress;
  let nftRegistry, nftRegistryAddress;
  let wallet, walletAddress;

  let daoAddress;

  let owner;
  let user1, user2, user3;
  let whitelister;

  const WHITELISTER_ROLE = web3.utils.soliditySha3('WHITELISTER_ROLE');

  const moderationAmount = toWei('100000', 'mwei');
  const gasFee = toWei('100', 'mwei');

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

    wallet = setups.wallet;
    walletAddress = await wallet.getAddress();

    daoAddress = setups.daoAddress;

    await nftRegistry.grantRole(WHITELISTER_ROLE, whitelister.address);

    await snapshot();
  });

  afterEach('revert', async () => {
    await restore();
  });

  describe('deployment', async () => {
    it('deploy contract successfully', async () => {
      expect(await registry.getContract(args.NFT_REGISTRY_ID)).to.equal(nftRegistryAddress);
    });
    it('sets dependencies successfully', async () => {
      expect(await nftRegistry.erc721H()).to.equal(erc721HAddress);
      expect(await nftRegistry.erc1155H()).to.equal(erc1155HAddress);
      expect(await nftRegistry.wallet()).to.equal(walletAddress);
    });
  });
  describe('whitelist', async () => {
    describe('addWhitelist', async () => {
      it('addWhitelist if not whitelisted', async () => {
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);
      });
      it('do nothing if whitelisted', async () => {
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);
      });
      it('addWhitelistBatch successfully', async () => {
        expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(false);
        expect(await nftRegistry.isWhitelisted(erc721HAddress, 2)).to.equal(false);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 2)).to.equal(false);

        await nftRegistry
          .connect(whitelister)
          .addWhitelistBatch([erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress], [1, 2, 1, 2]);

        expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(true);
        expect(await nftRegistry.isWhitelisted(erc721HAddress, 2)).to.equal(true);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 2)).to.equal(true);
      });
      it('reverts addWhitelistBatch - length mismatch', async () => {
        const reason = 'NFTRegistry : length mismatch';

        await expect(
          nftRegistry
            .connect(whitelister)
            .addWhitelistBatch([erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress], [1, 2, 2])
        ).to.be.revertedWith(reason);

        await expect(
          nftRegistry
            .connect(whitelister)
            .addWhitelistBatch([erc721HAddress, erc721HAddress, erc1155HAddress], [1, 2, 1, 2])
        ).to.be.revertedWith(reason);
      });
      it('reverts addWhitelistBatch - too many', async () => {
        const reason = 'NFTRegistry : too many NFTs';

        const nftAddresses = Array(101).fill(erc721HAddress);
        const nftIDs = Array(101).fill(1);

        await expect(nftRegistry.connect(whitelister).addWhitelistBatch(nftAddresses, nftIDs)).to.be.revertedWith(
          reason
        );
      });
    });
    describe('removeWhitelist', async () => {
      it('removeWhitelist if whitelisted', async () => {
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);
        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
      });
      it('do nothing if not whitelisted', async () => {
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
        await nftRegistry.connect(whitelister).removeWhitelist(erc1155HAddress, 1);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
      });
      it('removeWhitelist when burn', async () => {
        await erc721H.connect(owner).mintMock(owner.address, 1);
        await erc1155H.connect(owner).mintMock(owner.address, 1, 1, web3.utils.asciiToHex(''));

        await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 1);
        await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 1);
        expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(true);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);

        await erc721H.connect(owner).burn(1);
        await erc1155H.connect(owner).burn(owner.address, 1, 1);

        expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(false);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
      });
      it('removeWhitelistBatch successfully', async () => {
        await nftRegistry
          .connect(whitelister)
          .addWhitelistBatch([erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress], [1, 2, 1, 2]);

        expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(true);
        expect(await nftRegistry.isWhitelisted(erc721HAddress, 2)).to.equal(true);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 2)).to.equal(true);

        await nftRegistry
          .connect(whitelister)
          .removeWhitelistBatch([erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress], [1, 2, 1, 2]);

        expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(false);
        expect(await nftRegistry.isWhitelisted(erc721HAddress, 2)).to.equal(false);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 2)).to.equal(false);
      });
      it('removeWhitelist when burnBatch', async () => {
        await erc1155H.connect(owner).mintMock(owner.address, 1, 1, web3.utils.asciiToHex(''));

        await nftRegistry.connect(whitelister).addWhitelistBatch([erc1155HAddress], [1]);
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);

        await erc1155H.connect(owner).burnBatch(owner.address, [1], [1]);

        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
      });
      it('reverts removeWhitelistBatch - length mismatch', async () => {
        const reason = 'NFTRegistry : length mismatch';

        await expect(
          nftRegistry
            .connect(whitelister)
            .removeWhitelistBatch([erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress], [1, 2, 2])
        ).to.be.revertedWith(reason);

        await expect(
          nftRegistry
            .connect(whitelister)
            .removeWhitelistBatch([erc721HAddress, erc721HAddress, erc1155HAddress], [1, 2, 1, 2])
        ).to.be.revertedWith(reason);
      });
      it('reverts removeWhitelistBatch - too many', async () => {
        const reason = 'NFTRegistry : too many NFTs';

        const nftAddresses = Array(101).fill(erc721HAddress);
        const nftIDs = Array(101).fill(1);

        await expect(nftRegistry.connect(whitelister).removeWhitelistBatch(nftAddresses, nftIDs)).to.be.revertedWith(
          reason
        );
      });
    });
  });
  describe('moderation', async () => {
    describe('approveRequest', async () => {
      it('approveRequest successfully', async () => {
        await wallet.connect(user1).deposit(1, { value: moderationAmount });

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(moderationAmount);
        expect((await wallet.balances(1)).available).to.equal(0);
        expect(await wallet.plateformBalance()).to.equal(0);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);

        const tx = await nftRegistry.connect(owner).approveRequest(erc1155HAddress, 1, 1, gasFee);

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(owner.address, 0);
        await expect(tx).to.changeEtherBalance(walletAddress, 0);
        await expect(tx).to.changeEtherBalance(nftRegistryAddress, 0);
        await expect(tx).to.changeEtherBalance(daoAddress, 0);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available.toString()).to.equal(
          toBN(moderationAmount).minus(gasFee).toString()
        );
        expect(await wallet.plateformBalance()).to.equal(gasFee);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);
      });
      it('do nothing if approveRequest twice', async () => {
        await wallet.connect(user1).deposit(1, { value: moderationAmount });
        await nftRegistry.connect(owner).approveRequest(erc1155HAddress, 1, 1, gasFee);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available.toString()).to.equal(
          toBN(moderationAmount).minus(gasFee).toString()
        );
        expect(await wallet.plateformBalance()).to.equal(gasFee);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);

        const tx = await nftRegistry.connect(owner).approveRequest(erc1155HAddress, 1, 1, gasFee);

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(owner.address, 0);
        await expect(tx).to.changeEtherBalance(walletAddress, 0);
        await expect(tx).to.changeEtherBalance(nftRegistryAddress, 0);
        await expect(tx).to.changeEtherBalance(daoAddress, 0);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available.toString()).to.equal(
          toBN(moderationAmount).minus(gasFee).toString()
        );
        expect(await wallet.plateformBalance()).to.equal(gasFee);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);
      });
    });
    describe('declineRequest', async () => {
      it('declineRequest successfully', async () => {
        await wallet.connect(user1).deposit(1, { value: moderationAmount });

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(moderationAmount);
        expect((await wallet.balances(1)).available).to.equal(0);
        expect(await wallet.plateformBalance()).to.equal(0);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);

        const tx = await nftRegistry.connect(owner).declineRequest(1);

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(owner.address, 0);
        await expect(tx).to.changeEtherBalance(walletAddress, -moderationAmount);
        await expect(tx).to.changeEtherBalance(nftRegistryAddress, 0);
        await expect(tx).to.changeEtherBalance(daoAddress, +moderationAmount);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available).to.equal(0);
        expect(await wallet.plateformBalance()).to.equal(0);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
      });
      it('do nothing if declineRequest twice', async () => {
        await wallet.connect(user1).deposit(1, { value: moderationAmount });
        await nftRegistry.connect(owner).declineRequest(1);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available).to.equal(0);
        expect(await wallet.plateformBalance()).to.equal(0);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);

        const tx = await nftRegistry.connect(owner).declineRequest(1);

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(owner.address, 0);
        await expect(tx).to.changeEtherBalance(walletAddress, 0);
        await expect(tx).to.changeEtherBalance(nftRegistryAddress, 0);
        await expect(tx).to.changeEtherBalance(daoAddress, 0);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available).to.equal(0);
        expect(await wallet.plateformBalance()).to.equal(0);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
      });
    });
    describe('revokeRequest', async () => {
      it('revokeRequest successfully', async () => {
        await wallet.connect(user1).deposit(1, { value: moderationAmount });
        await nftRegistry.connect(owner).approveRequest(erc1155HAddress, 1, 1, gasFee);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available.toString()).to.equal(
          toBN(moderationAmount).minus(gasFee).toString()
        );
        expect(await wallet.plateformBalance()).to.equal(gasFee);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);

        const tx = await nftRegistry.connect(owner).revokeRequest(erc1155HAddress, 1);

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(owner.address, 0);
        await expect(tx).to.changeEtherBalance(walletAddress, 0);
        await expect(tx).to.changeEtherBalance(nftRegistryAddress, 0);
        await expect(tx).to.changeEtherBalance(daoAddress, 0);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available.toString()).to.equal(
          toBN(moderationAmount).minus(gasFee).toString()
        );
        expect(await wallet.plateformBalance()).to.equal(gasFee);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
      });
      it('do nothing if revokeRequest twice', async () => {
        await wallet.connect(user1).deposit(1, { value: moderationAmount });
        await nftRegistry.connect(owner).approveRequest(erc1155HAddress, 1, 1, gasFee);
        await nftRegistry.connect(owner).revokeRequest(erc1155HAddress, 1);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available.toString()).to.equal(
          toBN(moderationAmount).minus(gasFee).toString()
        );
        expect(await wallet.plateformBalance()).to.equal(gasFee);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);

        const tx = await nftRegistry.connect(owner).revokeRequest(erc1155HAddress, 1);

        await expect(tx).to.changeEtherBalance(user1.address, 0);
        await expect(tx).to.changeEtherBalance(owner.address, 0);
        await expect(tx).to.changeEtherBalance(walletAddress, 0);
        await expect(tx).to.changeEtherBalance(nftRegistryAddress, 0);
        await expect(tx).to.changeEtherBalance(daoAddress, 0);

        // balances
        expect((await wallet.balances(1)).wallet).to.equal(user1.address);
        expect((await wallet.balances(1)).locked).to.equal(0);
        expect((await wallet.balances(1)).available.toString()).to.equal(
          toBN(moderationAmount).minus(gasFee).toString()
        );
        expect(await wallet.plateformBalance()).to.equal(gasFee);

        // whitelist
        expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
      });
    });
  });
});
