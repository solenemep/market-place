//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./helpers/Registry.sol";
import "./interfaces/IListing.sol";
import "./interfaces/IAuction.sol";

/// @title Listing
/// @notice This contract carries all listing and buying at fixed price logic
/// @notice It is connected with Auction.sol

contract Listing is IListing, OwnableUpgradeable {
    IAuction public auction;

    function __Listing_init() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {
        auction = IAuction(Registry(registryAddress).getContract("AUCTION"));
    }
}
