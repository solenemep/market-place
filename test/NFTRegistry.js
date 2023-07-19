const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const { snapshot, restore } = require('./helpers/utils');

describe('NFTRegistry', async () => {
  const args = process.env;

  let registry;
  let erc721H;
  let erc1155H;
  let nftIdentifier;

  let nftRegistry;

  let owner;
  let user1, user2, user3;

  before('setup', async () => {
    const setups = await init();

    owner = setups.users[0];
    user1 = setups.users[1];
    user2 = setups.users[2];
    user3 = setups.users[3];

    registry = setups.registry;
    erc721H = setups.erc721H;
    erc1155H = setups.erc1155H;
    nftIdentifier = setups.nftIdentifier;

    nftRegistry = setups.nftRegistry;

    await snapshot();
  });

  afterEach('revert', async () => {
    await restore();
  });

  describe('deployment', async () => {
    it('deploy contract successfully', async () => {
      expect(await registry.getContract(args.NFT_REGISTRY_ID)).to.equal(await nftRegistry.getAddress());
    });
    it('sets dependencies successfully', async () => {
      expect(await nftRegistry.erc721H()).to.equal(await erc721H.getAddress());
      expect(await nftRegistry.erc1155H()).to.equal(await erc1155H.getAddress());
    });
    it('identifies nft contracts', async () => {
      expect(await nftIdentifier.isERC721(await erc721H.getAddress())).to.equal(true);
      expect(await nftIdentifier.isERC1155(await erc1155H.getAddress())).to.equal(true);
      expect(await nftIdentifier.isERC1155(await erc721H.getAddress())).to.equal(false);
      expect(await nftIdentifier.isERC721(await erc1155H.getAddress())).to.equal(false);
    });
  });
  describe('whitelist', async () => {
    it('addWhitelist if not whitelisted', async () => {
      expect(await nftRegistry.isWhitelisted(await erc1155H.getAddress())).to.equal(false);
      await nftRegistry.addWhitelist(await erc1155H.getAddress());
      expect(await nftRegistry.isWhitelisted(await erc1155H.getAddress())).to.equal(true);
    });
    it('reverts addWhitelist if whitelisted', async () => {
      const reason = 'NFTRegistry : already whitelisted';

      await nftRegistry.addWhitelist(await erc1155H.getAddress());
      expect(await nftRegistry.isWhitelisted(await erc1155H.getAddress())).to.equal(true);
      await expect(nftRegistry.addWhitelist(await erc1155H.getAddress())).to.be.revertedWith(reason);
      expect(await nftRegistry.isWhitelisted(await erc1155H.getAddress())).to.equal(true);
    });
    it('removeWhitelist if whitelisted', async () => {
      await nftRegistry.addWhitelist(await erc1155H.getAddress());
      expect(await nftRegistry.isWhitelisted(await erc1155H.getAddress())).to.equal(true);
      await nftRegistry.removeWhitelist(await erc1155H.getAddress());
      expect(await nftRegistry.isWhitelisted(await erc1155H.getAddress())).to.equal(false);
    });
    it('reverts removeWhitelist if not whitelisted', async () => {
      const reason = 'NFTRegistry : not whitelisted';

      expect(await nftRegistry.isWhitelisted(await erc1155H.getAddress())).to.equal(false);
      await expect(nftRegistry.removeWhitelist(await erc1155H.getAddress())).to.be.revertedWith(reason);
      expect(await nftRegistry.isWhitelisted(await erc1155H.getAddress())).to.equal(false);
    });
  });
});
