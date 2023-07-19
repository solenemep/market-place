const { takeSnapshot } = require('@nomicfoundation/hardhat-network-helpers');

let _snapshot;

async function snapshot() {
  _snapshot = await takeSnapshot();
}

async function restore() {
  await _snapshot.restore();
}

module.exports = {
  snapshot,
  restore,
};
