const BigNumber = require('bignumber.js');
const { takeSnapshot } = require('@nomicfoundation/hardhat-network-helpers');
const { toWei } = web3.utils;
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants.js');

let _snapshot;

async function snapshot() {
  _snapshot = await takeSnapshot();
}

async function restore() {
  await _snapshot.restore();
}

function toBN(number) {
  return new BigNumber(number);
}

async function getCosts(tx) {
  const receipt = await web3.eth.getTransactionReceipt(tx.hash);
  const gasUsed = receipt.gasUsed;
  const gasPrice = Number(tx.gasPrice);
  const gasCost = toBN(gasUsed).times(gasPrice);
  console.log('gas used : ' + gasUsed);
  console.log('gas price : ' + gasPrice);
  console.log(
    'tx cost : ' +
      toBN(gasCost)
        .div(10 ** 18)
        .toString() +
      ' ETH'
  );
}

async function signERC721H(contract, signer) {
  const SIGNING_DOMAIN_NAME = 'ERC721H';
  const SIGNING_DOMAIN_VERSION = '1';
  const chainId = hre.network.config.chainId;

  const domain = {
    name: SIGNING_DOMAIN_NAME,
    version: SIGNING_DOMAIN_VERSION,
    verifyingContract: contract,
    chainId,
  };
  const types = {
    ERC721HData: [{ name: 'to', type: 'address' }],
  };
  const signerAddress = await signer.getAddress();
  const erc721HData = { to: signerAddress };

  const signature = await signer.signTypedData(domain, types, erc721HData);
  return {
    ...erc721HData,
    signature,
  };
}

async function signERC1155H(contract, signer, value) {
  const SIGNING_DOMAIN_NAME = 'ERC1155H';
  const SIGNING_DOMAIN_VERSION = '1';
  const chainId = hre.network.config.chainId;

  const domain = {
    name: SIGNING_DOMAIN_NAME,
    version: SIGNING_DOMAIN_VERSION,
    verifyingContract: contract,
    chainId,
  };
  const types = {
    ERC1155HData: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
  };
  const signerAddress = await signer.getAddress();
  const erc1155HData = { to: signerAddress, value: value };

  const signature = await signer.signTypedData(domain, types, erc1155HData);
  return {
    ...erc1155HData,
    signature,
  };
}

module.exports = {
  toWei,
  ZERO_ADDRESS,
  snapshot,
  restore,
  toBN,
  getCosts,
  signERC721H,
  signERC1155H,
};
