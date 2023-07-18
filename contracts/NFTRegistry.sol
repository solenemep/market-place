//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./helpers/Registry.sol";
import "./interfaces/IContract.sol";
import "./interfaces/INFTRegistry.sol";

import "./interfaces/tokens/IERC721H.sol";
import "./interfaces/tokens/IERC1155H.sol";

/// @title NFTRegistry
/// @notice This contract carries all minting request and whitelist logic
/// @dev TODO Check if needed to fusion with Wallet.sol

contract NFTRegistry is INFTRegistry, OwnableUpgradeable {
    IERC721H public erc721H;
    IERC1155H public erc1155H;

    function __NFTRegistry_init() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {
        erc721H = IERC721H(Registry(registryAddress).getContract("ERC721H"));
        erc1155H = IERC1155H(Registry(registryAddress).getContract("ERC1155H"));
    }
}
