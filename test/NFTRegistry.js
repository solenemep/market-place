const { expect } = require('chai');
const { init } = require('./helpers/init.js');

describe('NFTRegistry', async () => {
  const args = process.env;

  let registry;
  let erc721H;
  let erc1155H;

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

    nftRegistry = setups.nftRegistry;
  });

  describe('deployment', async () => {
    it('deploy contract successfully', async () => {
      expect(await registry.getContract(args.NFT_REGISTRY_ID)).to.equal(await nftRegistry.getAddress());
    });
    it('sets dependencies successfully', async () => {
      expect(await nftRegistry.erc721H()).to.equal(await erc721H.getAddress());
      expect(await nftRegistry.erc1155H()).to.equal(await erc1155H.getAddress());
    });
  });
});
