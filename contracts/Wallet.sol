//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./helpers/Registry.sol";
import "./interfaces/IWallet.sol";

/// @title Wallet
/// @notice This contract carries all deposit and withdraw logic
/// @dev TODO Check if needed to fusion with NFTRegistry.sol

contract Wallet is IWallet, OwnableUpgradeable {
    function __Wallet_init() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {}
}
