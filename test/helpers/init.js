const { ethers, upgrades } = require('hardhat');

let registry;

let contract;

const init = async () => {
  const users = await ethers.getSigners();

  await deployContracts();
  await deployImplementations();

  await addContracts();
  await addProxies();

  await deployProxies();
  await initContracts();

  await setDependencies();

  return {
    users,
    contract,
  };
};

async function deployContracts() {
  // Registry
  registry = await ethers.deployContract('Registry');
  await registry.waitForDeployment();
  console.log('Registry address:', await registry.getAddress());

  // Contract
  contract = await ethers.deployContract('Contract');
  await contract.waitForDeployment();
  console.log('Contract address:', await contract.getAddress());

  //await wait(30_000);
}

async function deployImplementations() {
  // Contract
  // contract = await ethers.deployContract('Contract');
  // await contract.waitForDeployment();
  //await wait(30_000);
}

async function addContracts() {
  // tx = await registry.addContract('TREASURY', '');
  //await tx.wait();
}

async function addProxies() {
  //tx = await registry.addProxyContract('CONTRACT', contract);
  //await tx.wait();
}

async function deployProxies() {
  // Contract
  // contract = await Contract.attach(await registry.getContract('CONTRACT'));
  //await wait(30_000);
}

async function initContracts() {
  // await contract.__Contract_init();
}

async function setDependencies() {
  // tx = await contract.setDependencies(registry.getAddress());
  // await tx.wait();
}

module.exports.init = init;
