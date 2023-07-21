//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
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

contract NFTRegistry is INFTRegistry, OwnableUpgradeable, AccessControlUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;
    using SafeMath for uint256;
    using Math for uint256;

    bytes32 public constant WHITELISTER_ROLE = keccak256("WHITELISTER_ROLE");

    uint256 public constant MAX_WHITELIST = 100;

    IERC721H public erc721H;
    IERC1155H public erc1155H;
    INFTIdentifier public nftIdentifier;

    EnumerableSet.AddressSet internal _nftAddresses; // smart contracts that carry whitelisted NFT
    mapping(address => EnumerableSet.UintSet) internal _nftIDs; // smart contract -> whitelisted NFT ID

    function __NFTRegistry_init() external initializer {
        __Ownable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, owner());
    }

    function setDependencies(address registryAddress) external onlyOwner {
        erc721H = IERC721H(Registry(registryAddress).getContract("ERC721H"));
        erc1155H = IERC1155H(Registry(registryAddress).getContract("ERC1155H"));
        nftIdentifier = INFTIdentifier(Registry(registryAddress).getContract("NFT_IDENTIFIER"));
    }

    function isWhitelisted(address nftAddress, uint256 nftID) public view override returns (bool) {
        if (!_nftAddresses.contains(nftAddress)) {
            return false;
        } else {
            return _nftIDs[nftAddress].contains(nftID);
        }
    }

    function countNFTAddresses() external view override returns (uint256) {
        return _nftAddresses.length();
    }

    function countNFTIDs(address nftAddress) external view override returns (uint256) {
        return _nftIDs[nftAddress].length();
    }

    /// @notice use with limit = countNFTAddresses()
    function getNFTAddresses(
        uint256 offset,
        uint256 limit
    ) external view override returns (address[] memory nftAddresses) {
        uint256 count = _nftAddresses.length();
        uint256 to = (offset.tryAdd(limit)).min(count).max(offset);

        nftAddresses = new address[](to.uncheckedSub(offset));

        for (uint256 i = offset; i < to; i++) {
            uint256 index = i.uncheckedSub(offset);
            nftAddresses[index] = _nftAddresses.at(index);
        }
    }

    /// @notice use with limit = countNFTIDs(nftAddress)
    function getNFTIDs(
        address nftAddress,
        uint256 offset,
        uint256 limit
    ) external view override returns (uint256[] memory nftIDs) {
        uint256 count = _nftIDs[nftAddress].length();
        uint256 to = (offset.tryAdd(limit)).min(count).max(offset);

        nftIDs = new uint256[](to.uncheckedSub(offset));

        for (uint256 i = offset; i < to; i++) {
            uint256 index = i.uncheckedSub(offset);
            nftIDs[index] = _nftIDs[nftAddress].at(index);
        }
    }

    function addWhitelist(address nftAddress, uint256 nftID) external override onlyRole(WHITELISTER_ROLE) {
        _addWhitelist(nftAddress, nftID);
    }

    function addWhitelistBatch(
        address[] memory nftAddresses,
        uint256[] memory nftIDs
    ) external override onlyRole(WHITELISTER_ROLE) {
        require(nftAddresses.length == nftIDs.length, "NFTRegistry : length mismatch");
        require(nftAddresses.length < MAX_WHITELIST, "NFTRegistry : too many NFTs");

        for (uint256 i = 0; i < nftAddresses.length; i++) {
            _addWhitelist(nftAddresses[i], nftIDs[i]);
        }
    }

    function _addWhitelist(address nftAddress, uint256 nftID) internal {
        if (!isWhitelisted(nftAddress, nftID)) {
            _nftAddresses.add(nftAddress);
            _nftIDs[nftAddress].add(nftID);
        }
    }

    function removeWhitelist(address nftAddress, uint256 nftID) external override onlyRole(WHITELISTER_ROLE) {
        _removeWhitelist(nftAddress, nftID);
    }

    function removeWhitelistBatch(
        address[] memory nftAddresses,
        uint256[] memory nftIDs
    ) external override onlyRole(WHITELISTER_ROLE) {
        require(nftAddresses.length == nftIDs.length, "NFTRegistry : length mismatch");
        require(nftAddresses.length < MAX_WHITELIST, "NFTRegistry : too many NFTs");

        for (uint256 i = 0; i < nftAddresses.length; i++) {
            _removeWhitelist(nftAddresses[i], nftIDs[i]);
        }
    }

    function _removeWhitelist(address nftAddress, uint256 nftID) internal {
        if (isWhitelisted(nftAddress, nftID)) {
            _nftAddresses.remove(nftAddress);
            _nftIDs[nftAddress].remove(nftID);
        }
    }
}
