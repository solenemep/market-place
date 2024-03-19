const BigNumber = require('bignumber.js');
const { takeSnapshot } = require('@nomicfoundation/hardhat-network-helpers');
const { toWei } = web3.utils;
const { time } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants.js');

let _snapshot;

const WHITELISTER_ROLE = web3.utils.soliditySha3('WHITELISTER_ROLE');
const EMPTY_HASH = web3.utils.soliditySha3('');

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
  const gasPrice = toWei('0.000000007', 'gwei'); // Number(tx.gasPrice);
  const gasCost = toBN(gasUsed).times(gasPrice);
  console.log('gas used : ' + gasUsed);
  console.log(
    'gas price : ' +
      toBN(gasPrice)
        .div(10 ** 18)
        .toFixed()
        .toString() +
      ' ISLM'
  );
  console.log(
    'tx cost : ' +
      toBN(gasCost)
        .div(10 ** 18)
        .toFixed()
        .toString() +
      ' ISLM'
  );
}

async function signERC721H(contract, signer, user, tokenURI, royaltyPercent) {
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
    ERC721HData: [
      { name: 'to', type: 'address' },
      { name: 'tokenURI', type: 'string' },
      { name: 'royaltyPercent', type: 'uint256' },
    ],
  };
  const erc721HData = { to: user.address, tokenURI: tokenURI, royaltyPercent: royaltyPercent };

  const signature = await signer.signTypedData(domain, types, erc721HData);
  return {
    ...erc721HData,
    signature,
  };
}

async function signERC1155H(contract, signer, user, value, tokenURI, royaltyPercent) {
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
      { name: 'tokenURI', type: 'string' },
      { name: 'royaltyPercent', type: 'uint256' },
    ],
  };
  const erc1155HData = { to: user.address, value: value, tokenURI: tokenURI, royaltyPercent: royaltyPercent };

  const signature = await signer.signTypedData(domain, types, erc1155HData);
  return {
    ...erc1155HData,
    signature,
  };
}

async function getCurrentBlockTimestamp() {
  return (await web3.eth.getBlock('latest')).timestamp;
}

async function increaseTime(duration) {
  await time.increase(duration);
}

async function increaseTimeTo(target) {
  await time.increaseTo(target);
}

module.exports = {
  toWei,
  ZERO_ADDRESS,
  WHITELISTER_ROLE,
  EMPTY_HASH,
  snapshot,
  restore,
  toBN,
  getCosts,
  signERC721H,
  signERC1155H,
  getCurrentBlockTimestamp,
  increaseTime,
  increaseTimeTo,
};
