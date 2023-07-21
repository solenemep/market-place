const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const { snapshot, restore, getCosts } = require('./helpers/utils');

describe('NFTRegistry', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftIdentifier, nftIdentifierAddress;
  let nftRegistry, nftRegistryAddress;

  let owner;
  let user1, user2, user3;

  const WHITELISTER_ROLE = web3.utils.soliditySha3('WHITELISTER_ROLE');

  before('setup', async () => {
    const setups = await init();

    owner = setups.users[0];
    user1 = setups.users[1];
    user2 = setups.users[2];
    user3 = setups.users[3];

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

    await nftRegistry.grantRole(WHITELISTER_ROLE, owner.address);

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
    });
    it('identifies nft contracts', async () => {
      expect(await nftIdentifier.isERC721(erc721HAddress)).to.equal(true);
      expect(await nftIdentifier.isERC1155(erc1155HAddress)).to.equal(true);
      expect(await nftIdentifier.isERC1155(erc721HAddress)).to.equal(false);
      expect(await nftIdentifier.isERC721(erc1155HAddress)).to.equal(false);
    });
  });
  describe('addWhitelist', async () => {
    it('addWhitelist if not whitelisted', async () => {
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(false);
      await nftRegistry.addWhitelist(erc1155HAddress, 0);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(true);
    });
    it('do nothing if whitelisted', async () => {
      await nftRegistry.addWhitelist(erc1155HAddress, 0);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(true);
      await nftRegistry.addWhitelist(erc1155HAddress, 0);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(true);
    });
    it('reverts addWhitelistBatch - length mismatch', async () => {
      const reason = 'NFTRegistry : length mismatch';

      await expect(
        nftRegistry.addWhitelistBatch([erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress], [0, 1, 1])
      ).to.be.revertedWith(reason);
    });
    it('reverts addWhitelistBatch - too many', async () => {
      const reason = 'NFTRegistry : too many NFTs';

      const nftAddresses = Array(101).fill(erc721HAddress);
      const nftIDs = Array(101).fill(0);

      await expect(nftRegistry.addWhitelistBatch(nftAddresses, nftIDs)).to.be.revertedWith(reason);
    });
    it('addWhitelistBatch successfully', async () => {
      expect(await nftRegistry.isWhitelisted(erc721HAddress, 0)).to.equal(false);
      expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(false);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(false);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);

      await nftRegistry.addWhitelistBatch(
        [erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress],
        [0, 1, 0, 1]
      );

      expect(await nftRegistry.isWhitelisted(erc721HAddress, 0)).to.equal(true);
      expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(true);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(true);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);
    });
  });
  describe('removeWhitelist', async () => {
    it('removeWhitelist if whitelisted', async () => {
      await nftRegistry.addWhitelist(erc1155HAddress, 0);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(true);
      await nftRegistry.removeWhitelist(erc1155HAddress, 0);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(false);
    });
    it('do nothing if not whitelisted', async () => {
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(false);
      await nftRegistry.removeWhitelist(erc1155HAddress, 0);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(false);
    });
    it('reverts removeWhitelistBatch - length mismatch', async () => {
      const reason = 'NFTRegistry : length mismatch';

      await expect(
        nftRegistry.removeWhitelistBatch([erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress], [0, 1, 1])
      ).to.be.revertedWith(reason);
    });
    it('reverts removeWhitelistBatch - too many', async () => {
      const reason = 'NFTRegistry : too many NFTs';

      const nftAddresses = Array(101).fill(erc721HAddress);
      const nftIDs = Array(101).fill(0);

      await expect(nftRegistry.removeWhitelistBatch(nftAddresses, nftIDs)).to.be.revertedWith(reason);
    });
    it('removeWhitelistBatch successfully', async () => {
      await nftRegistry.addWhitelistBatch(
        [erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress],
        [0, 1, 0, 1]
      );

      expect(await nftRegistry.isWhitelisted(erc721HAddress, 0)).to.equal(true);
      expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(true);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(true);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(true);

      await nftRegistry.removeWhitelistBatch(
        [erc721HAddress, erc721HAddress, erc1155HAddress, erc1155HAddress],
        [0, 1, 0, 1]
      );

      expect(await nftRegistry.isWhitelisted(erc721HAddress, 0)).to.equal(false);
      expect(await nftRegistry.isWhitelisted(erc721HAddress, 1)).to.equal(false);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(false);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 1)).to.equal(false);
    });
  });
});
