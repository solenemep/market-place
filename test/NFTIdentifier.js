const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const { snapshot, restore } = require('./helpers/utils.js');

describe('NFTIdentifier', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftIdentifier, nftIdentifierAddress;

  let owner;
  let user1, user2, user3;

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

    await snapshot();
  });

  afterEach('revert', async () => {
    await restore();
  });

  describe('deployment', async () => {
    it('deploy contract successfully', async () => {
      expect(await registry.getContract(args.NFT_IDENTIFIER_ID)).to.equal(nftIdentifierAddress);
    });
    it('sets dependencies successfully', async () => {});
  });
  describe('identification', async () => {
    it('identifies nft contracts', async () => {
      expect(await nftIdentifier.isERC721(erc721HAddress)).to.equal(true);
      expect(await nftIdentifier.isERC1155(erc1155HAddress)).to.equal(true);
      expect(await nftIdentifier.isERC1155(erc721HAddress)).to.equal(false);
      expect(await nftIdentifier.isERC721(erc1155HAddress)).to.equal(false);
    });
  });
});
