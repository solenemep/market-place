//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./helpers/Registry.sol";
import "./interfaces/IAuction.sol";

/// @title Auction
/// @notice This contract carries english auction selling logic
/// @notice It is connected with Listing.sol

contract Auction is IAuction, OwnableUpgradeable {
    function __Auction_init() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {}
}