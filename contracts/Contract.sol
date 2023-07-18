//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Registry.sol";

import "./interfaces/IContract.sol";

/// @title Contract

contract Contract is IContract, OwnableUpgradeable {
    function __Contract_init() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {
        // keter = IERC20(Registry(registryAddress).getContract("KETER"));
    }
}
