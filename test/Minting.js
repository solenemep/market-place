const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const { snapshot, restore, signERC721H, signERC1155H } = require('./helpers/utils.js');

describe('Minting', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftRegistry, nftRegistryAddress;

  let owner;
  let user1, user2, user3;
  let signer, signerAddress;

  before('setup', async () => {
    const setups = await init();

    owner = setups.users[0];
    user1 = setups.users[1];
    user2 = setups.users[2];
    user3 = setups.users[3];

    signer = new ethers.Wallet(args.PRIVATE_KEY);
    signerAddress = await signer.getAddress();

    registry = setups.registry;
    registryAddress = await registry.getAddress();

    erc721H = setups.erc721H;
    erc721HAddress = await erc721H.getAddress();

    erc1155H = setups.erc1155H;
    erc1155HAddress = await erc1155H.getAddress();

    nftRegistry = setups.nftRegistry;
    nftRegistryAddress = await nftRegistry.getAddress();

    await snapshot();
  });

  afterEach('revert', async () => {
    await restore();
  });

  describe('deployment', async () => {
    it('deploy contract successfully', async () => {
      expect(await registry.getContract(args.ERC721H_ID)).to.equal(erc721HAddress);
      expect(await registry.getContract(args.ERC1155H_ID)).to.equal(erc1155HAddress);
    });
    it('sets dependencies successfully', async () => {
      expect(await erc721H.nftRegistry()).to.equal(nftRegistryAddress);
      expect(await erc1155H.nftRegistry()).to.equal(nftRegistryAddress);
    });
  });
  describe('ERC721H minting', async () => {
    const tokenURI = 'tokenURI';

    it('mint with correct signature', async () => {
      const data = await signERC721H(erc721HAddress, signer, tokenURI);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(signerAddress);

      expect(await erc721H.balanceOf(signerAddress)).to.equal(0);

      const erc721HData = { to: data.to, tokenURI: tokenURI, signature: data.signature };
      await erc721H.connect(owner).mint(erc721HData);

      expect(await erc721H.balanceOf(signerAddress)).to.equal(1);
      expect(await erc721H.ownerOf(0)).to.equal(signerAddress);
    });
    it('reverts mint with incorrect signature - wrong to', async () => {
      const reason = 'ERC721H : wrong signature';

      const data = await signERC721H(erc721HAddress, signer, tokenURI);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(signerAddress);

      const erc721HData = { to: user1.address, tokenURI: tokenURI, signature: data.signature };
      await expect(erc721H.connect(owner).mint(erc721HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect signature - wrong tokenURI', async () => {
      const reason = 'ERC721H : wrong signature';

      const data = await signERC721H(erc721HAddress, signer, tokenURI);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(signerAddress);

      const erc721HData = { to: signerAddress, tokenURI: '', signature: data.signature };
      await expect(erc721H.connect(owner).mint(erc721HData)).to.be.revertedWith(reason);
    });
  });
  describe('ERC1155H minting', async () => {
    const tokenURI = 'tokenURI';

    it('mint with correct signature', async () => {
      const data = await signERC1155H(erc1155HAddress, signer, 1, tokenURI);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(signerAddress);

      expect(await erc1155H.balanceOf(signerAddress, 0)).to.equal(0);

      const erc1155HData = { to: data.to, value: data.value, tokenURI: tokenURI, signature: data.signature };
      await erc1155H.connect(owner).mint(erc1155HData);

      expect(await erc1155H.balanceOf(signerAddress, 0)).to.equal(1);
    });
    it('reverts mint with incorrect signature - wrong to', async () => {
      const reason = 'ERC1155H : wrong signature';

      const data = await signERC1155H(erc1155HAddress, signer, 1, tokenURI);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(signerAddress);

      const erc1155HData = { to: user1.address, value: 1, tokenURI: tokenURI, signature: data.signature };
      await expect(erc1155H.connect(owner).mint(erc1155HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect signature - wrong value', async () => {
      const reason = 'ERC1155H : wrong signature';

      const data = await signERC1155H(erc1155HAddress, signer, 1, tokenURI);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(signerAddress);

      const erc1155HData = { to: data.to, value: 2, tokenURI: tokenURI, signature: data.signature };
      await expect(erc1155H.connect(owner).mint(erc1155HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect signature - wrong tokenURI', async () => {
      const reason = 'ERC1155H : wrong signature';

      const data = await signERC1155H(erc1155HAddress, signer, 1, tokenURI);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(signerAddress);

      const erc1155HData = { to: data.to, value: 1, tokenURI: '', signature: data.signature };
      await expect(erc1155H.connect(owner).mint(erc1155HData)).to.be.revertedWith(reason);
    });
  });
});
