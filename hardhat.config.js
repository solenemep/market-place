require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-verify');
require('@nomiclabs/hardhat-web3');
require('web3-eth');
require('hardhat-contract-sizer');

const args = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.19',
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    haqqTestnet: {
      url: `https://rpc.eth.testedge2.haqq.network/`,
      chainId: 54211,
      accounts: [args.PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      haqqTestnet: [args.ETHERSCAN_API_KEY],
    },
    customChains: [
      {
        network: 'haqqTestnet',
        chainId: 54211,
        urls: {
          apiURL: 'https://explorer.testedge2.haqq.network/api',
          browserURL: 'https://explorer.testedge2.haqq.network/',
        },
      },
    ],
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 1000,
    },
  },
};
