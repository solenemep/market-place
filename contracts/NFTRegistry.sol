//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./libraries/SafeMath.sol";

import "./helpers/Registry.sol";
import "./interfaces/IContract.sol";
import "./interfaces/INFTRegistry.sol";

import "./interfaces/tokens/IERC721H.sol";
import "./interfaces/tokens/IERC1155H.sol";
import "./interfaces/INFTIdentifier.sol";

/// @title NFTRegistry
/// @notice This contract carries all minting request and whitelist logic
/// @dev TODO Check if needed to fusion with Wallet.sol

contract NFTRegistry is INFTRegistry, OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;
    using Math for uint256;

    IERC721H public erc721H;
    IERC1155H public erc1155H;
    INFTIdentifier public nftIdentifier;

    EnumerableSet.AddressSet internal _allWhitelisted;

    function __NFTRegistry_init() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {
        erc721H = IERC721H(Registry(registryAddress).getContract("ERC721H"));
        erc1155H = IERC1155H(Registry(registryAddress).getContract("ERC1155H"));
        nftIdentifier = INFTIdentifier(Registry(registryAddress).getContract("NFT_IDENTIFIER"));
    }

    function isWhitelisted(address nftAddress) public view override returns (bool) {
        return _allWhitelisted.contains(nftAddress);
    }

    function countAllWhitelisted() external view override returns (uint256) {
        return _allWhitelisted.length();
    }

    function getAllWhitelisted(
        uint256 offset,
        uint256 limit
    ) external view override returns (address[] memory whitelistedNFT) {
        uint256 count = _allWhitelisted.length();
        uint256 to = (offset.tryAdd(limit)).min(count).max(offset);

        whitelistedNFT = new address[](to.uncheckedSub(offset));

        for (uint256 i = offset; i < to; i++) {
            uint256 index = i.uncheckedSub(offset);
            whitelistedNFT[index] = _allWhitelisted.at(index);
        }
    }

    function addWhitelist(address nftAddress) external override onlyOwner {
        require(!isWhitelisted(nftAddress), "NFTRegistry : already whitelisted");
        _allWhitelisted.add(nftAddress);
    }

    function removeWhitelist(address nftAddress) external override onlyOwner {
        require(isWhitelisted(nftAddress), "NFTRegistry : not whitelisted");
        _allWhitelisted.remove(nftAddress);
    }
}
