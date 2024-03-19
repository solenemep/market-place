const { expect } = require('chai');
const { init } = require('./helpers/init.js');
const {
  snapshot,
  restore,
  signERC721H,
  signERC1155H,
  getCosts,
  WHITELISTER_ROLE,
  EMPTY_HASH,
} = require('./helpers/utils.js');

describe('Minting', async () => {
  const args = process.env;

  let registry, registryAddress;
  let erc721H, erc721HAddress;
  let erc1155H, erc1155HAddress;
  let nftRegistry, nftRegistryAddress;

  let owner;
  let user1, user2, user3, whitelister;

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

    await nftRegistry.grantRole(WHITELISTER_ROLE, whitelister.address);

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
      const data = await signERC721H(erc721HAddress, user1, user1, tokenURI, royaltyPercent);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(user1.address);

      expect(await erc721H.balanceOf(user1.address)).to.equal(0);

      const erc721HData = {
        to: data.to,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      await erc721H.connect(owner).mint(erc721HData);

      expect(await erc721H.balanceOf(user1.address)).to.equal(1);
      expect(await erc721H.ownerOf(0)).to.equal(user1.address);
    });
    it('reverts mint with incorrect signature - wrong to', async () => {
      const reason = 'ERC721H: wrong signature';

      const data = await signERC721H(erc721HAddress, user1, user1, tokenURI, royaltyPercent);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc721HData = {
        to: user2.address,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      await expect(erc721H.connect(owner).mint(erc721HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect signature - wrong tokenURI', async () => {
      const reason = 'ERC721H: wrong signature';

      const data = await signERC721H(erc721HAddress, user1, user1, tokenURI, royaltyPercent);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc721HData = {
        to: data.to,
        tokenURI: '',
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      await expect(erc721H.connect(owner).mint(erc721HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect signature - wrong royaltyPercent', async () => {
      const reason = 'ERC721H: wrong signature';

      const data = await signERC721H(erc721HAddress, user1, user1, tokenURI, royaltyPercent);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc721HData = { to: data.to, tokenURI: tokenURI, royaltyPercent: 5, signature: data.signature };
      await expect(erc721H.connect(owner).mint(erc721HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect royaltyPercent', async () => {
      const reason = 'ERC721H: Wrong royalty';

      const data = await signERC721H(erc721HAddress, user1, user1, tokenURI, 23);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc721HData = {
        to: data.to,
        tokenURI: tokenURI,
        royaltyPercent: 23,
        signature: data.signature,
      };
      await expect(erc721H.connect(owner).mint(erc721HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect caller', async () => {
      const reason = 'ERC721H: wrong caller';

      const data = await signERC721H(erc721HAddress, user1, user1, tokenURI, 23);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc721HData = {
        to: data.to,
        tokenURI: tokenURI,
        royaltyPercent: 23,
        signature: data.signature,
      };
      await expect(erc721H.connect(user1).mint(erc721HData)).to.be.revertedWith(reason);
    });
    it('removes from whitelist at burning', async () => {
      const data = await signERC721H(erc721HAddress, user1, user1, tokenURI, royaltyPercent);

      const recover = await erc721H.recover(data);
      expect(recover).to.equal(user1.address);

      expect(await erc721H.balanceOf(user1.address)).to.equal(0);

      const erc721HData = {
        to: data.to,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      await erc721H.connect(owner).mint(erc721HData);

      expect(await nftRegistry.isWhitelisted(erc721HAddress, 0)).to.equal(false);
      await nftRegistry.connect(whitelister).addWhitelist(erc721HAddress, 0, EMPTY_HASH);
      expect(await nftRegistry.isWhitelisted(erc721HAddress, 0)).to.equal(true);

      expect(await erc721H.balanceOf(user1.address)).to.equal(1);
      expect(await erc721H.ownerOf(0)).to.equal(user1.address);

      await erc721H.connect(user1).burn(0);
      expect(await nftRegistry.isWhitelisted(erc721HAddress, 0)).to.equal(false);
    });
    it('changes systemAddress with correct caller', async () => {
      expect(await erc721H.systemAddress()).to.equal(owner.address);
      await erc721H.connect(owner).setSystemAddress(user1.address);
      expect(await erc721H.systemAddress()).to.equal(user1.address);
    });
    it('reverts setSystemAddress when called from incorrect address', async () => {
      const reason = 'ERC721H: wrong caller';
      expect(await erc721H.systemAddress()).to.equal(owner.address);
      await expect(erc721H.connect(user1).setSystemAddress(user2.address)).to.be.revertedWith(reason);
    });
  });
  describe('ERC1155H minting', async () => {
    const tokenURI = 'tokenURI';

    it('mint with correct signature', async () => {
      const data = await signERC1155H(erc1155HAddress, user1, user1, 1, tokenURI, royaltyPercent);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(user1.address);

      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(0);

      const erc1155HData = {
        to: data.to,
        value: data.value,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      await erc1155H.connect(owner).mint(erc1155HData);

      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(1);
    });
    it('reverts mint with incorrect signature - wrong to', async () => {
      const reason = 'ERC1155H: wrong signature';

      const data = await signERC1155H(erc1155HAddress, user1, user1, 1, tokenURI, royaltyPercent);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc1155HData = {
        to: user2.address,
        value: 1,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      await expect(erc1155H.connect(owner).mint(erc1155HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect signature - wrong value', async () => {
      const reason = 'ERC1155H: wrong signature';

      const data = await signERC1155H(erc1155HAddress, user1, user1, 1, tokenURI, royaltyPercent);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc1155HData = {
        to: data.to,
        value: 2,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      await expect(erc1155H.connect(owner).mint(erc1155HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect signature - wrong tokenURI', async () => {
      const reason = 'ERC1155H: wrong signature';

      const data = await signERC1155H(erc1155HAddress, user1, user1, 1, tokenURI, royaltyPercent);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc1155HData = {
        to: data.to,
        value: 1,
        tokenURI: '',
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      await expect(erc1155H.connect(owner).mint(erc1155HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect signature - wrong royaltyPercent', async () => {
      const reason = 'ERC1155H: wrong signature';

      const data = await signERC1155H(erc1155HAddress, user1, user1, 1, tokenURI, royaltyPercent);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc1155HData = { to: data.to, value: 1, tokenURI: tokenURI, royaltyPercent: 5, signature: data.signature };
      await expect(erc1155H.connect(owner).mint(erc1155HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect royaltyPercent', async () => {
      const reason = 'ERC1155H: Wrong royalty';

      const data = await signERC1155H(erc1155HAddress, user1, user1, 1, tokenURI, 23);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc1155HData = {
        to: data.to,
        value: 1,
        tokenURI: tokenURI,
        royaltyPercent: 23,
        signature: data.signature,
      };
      await expect(erc1155H.connect(owner).mint(erc1155HData)).to.be.revertedWith(reason);
    });
    it('reverts mint with incorrect caller', async () => {
      const reason = 'ERC1155H: wrong caller';

      const data = await signERC1155H(erc1155HAddress, user1, user1, 1, tokenURI, 23);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(user1.address);

      const erc1155HData = {
        to: data.to,
        value: 1,
        tokenURI: tokenURI,
        royaltyPercent: 23,
        signature: data.signature,
      };
      await expect(erc1155H.connect(user1).mint(erc1155HData)).to.be.revertedWith(reason);
    });
    it('increases totalSupply at minting', async () => {
      const data1 = await signERC1155H(erc1155HAddress, user1, user1, 19, tokenURI, royaltyPercent);
      const data2 = await signERC1155H(erc1155HAddress, user1, user1, 5, tokenURI, royaltyPercent);

      const recover1 = await erc1155H.recover(data1);
      expect(recover1).to.equal(user1.address);

      const recover2 = await erc1155H.recover(data2);
      expect(recover2).to.equal(user1.address);

      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(0);
      expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(0);
      expect(await erc1155H.totalSupply(0)).to.equal(0);
      expect(await erc1155H.totalSupply(1)).to.equal(0);

      const erc1155HData1 = {
        to: data1.to,
        value: data1.value,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data1.signature,
      };

      const erc1155HData2 = {
        to: data2.to,
        value: data2.value,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data2.signature,
      };

      await erc1155H.connect(owner).mint(erc1155HData1);
      await erc1155H.connect(owner).mint(erc1155HData2);

      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(19);
      expect(await erc1155H.balanceOf(user1.address, 1)).to.equal(5);
      expect(await erc1155H.totalSupply(0)).to.equal(19);
      expect(await erc1155H.totalSupply(1)).to.equal(5);
    });
    it('decreases totalSupply at burning', async () => {
      const data = await signERC1155H(erc1155HAddress, user1, user1, 19, tokenURI, royaltyPercent);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(user1.address);

      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(0);
      expect(await erc1155H.totalSupply(0)).to.equal(0);

      const erc1155HData = {
        to: data.to,
        value: data.value,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };

      await erc1155H.connect(owner).mint(erc1155HData);

      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(19);
      expect(await erc1155H.totalSupply(0)).to.equal(19);

      await erc1155H.connect(user1).burn(user1.address, 0, 5);

      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(14);
      expect(await erc1155H.totalSupply(0)).to.equal(14);

      await erc1155H.connect(user1).safeTransferFrom(user1.address, user2.address, 0, 5, '0x0000');
      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(9);
      expect(await erc1155H.balanceOf(user2.address, 0)).to.equal(5);

      await erc1155H.connect(user2).burn(user2.address, 0, 4);
      expect(await erc1155H.balanceOf(user2.address, 0)).to.equal(1);
      expect(await erc1155H.totalSupply(0)).to.equal(10);
    });
    it('removes from whitelist at complete burning', async () => {
      const data = await signERC1155H(erc1155HAddress, user1, user1, 19, tokenURI, royaltyPercent);

      const recover = await erc1155H.recover(data);
      expect(recover).to.equal(user1.address);

      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(0);
      expect(await erc1155H.totalSupply(0)).to.equal(0);

      const erc1155HData = {
        to: data.to,
        value: data.value,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };

      await erc1155H.connect(owner).mint(erc1155HData);

      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(false);
      await nftRegistry.connect(whitelister).addWhitelist(erc1155HAddress, 0, EMPTY_HASH);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(true);

      expect(await erc1155H.balanceOf(user1.address, 0)).to.equal(19);
      expect(await erc1155H.totalSupply(0)).to.equal(19);

      await erc1155H.connect(user1).burn(user1.address, 0, 5);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(true);

      await erc1155H.connect(user1).burn(user1.address, 0, 14);
      expect(await nftRegistry.isWhitelisted(erc1155HAddress, 0)).to.equal(false);
    });
    it('changes systemAddress with correct caller', async () => {
      expect(await erc1155H.systemAddress()).to.equal(owner.address);
      await erc1155H.connect(owner).setSystemAddress(user1.address);
      expect(await erc1155H.systemAddress()).to.equal(user1.address);
    });
    it('reverts setSystemAddress when called from incorrect address', async () => {
      const reason = 'ERC1155H: wrong caller';
      expect(await erc1155H.systemAddress()).to.equal(owner.address);
      await expect(erc1155H.connect(user1).setSystemAddress(user2.address)).to.be.revertedWith(reason);
    });
  });
  describe.skip('gas cost', async () => {
    const tokenURI = 'tokenURI';
    it('ERC721H minting', async () => {
      const data = await signERC721H(erc721HAddress, signer, tokenURI, royaltyPercent);

      const erc721HData = {
        to: data.to,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      tx = await erc721H.connect(owner).mint(erc721HData);

      await getCosts(tx);
    });
    it('ERC1155H minting', async () => {
      const data = await signERC1155H(erc1155HAddress, signer, 1, tokenURI, royaltyPercent);

      const erc1155HData = {
        to: data.to,
        value: data.value,
        tokenURI: tokenURI,
        royaltyPercent: royaltyPercent,
        signature: data.signature,
      };
      tx = await erc1155H.connect(owner).mint(erc1155HData);

      await getCosts(tx);
    });
  });
});
