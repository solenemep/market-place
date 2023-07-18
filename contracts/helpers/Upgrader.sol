// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract Upgrader is Ownable {
    constructor() {}

    function upgrade(address what, address to) external onlyOwner {
        ITransparentUpgradeableProxy(payable(what)).upgradeTo(to);
    }

    function upgradeAndCall(address what, address to, bytes calldata data) external onlyOwner {
        ITransparentUpgradeableProxy(payable(what)).upgradeToAndCall(to, data);
    }

    function getImplementation(address what) external view onlyOwner returns (address) {
        return ITransparentUpgradeableProxy(payable(what)).implementation();
    }
}
