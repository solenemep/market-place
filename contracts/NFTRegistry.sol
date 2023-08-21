//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./libraries/SafeMath.sol";

import "./helpers/Registry.sol";
import "./interfaces/INFTRegistry.sol";

import "./interfaces/tokens/IERC721H.sol";
import "./interfaces/tokens/IERC1155H.sol";
import "./interfaces/IWallet.sol";

/// @author @solenemep
/// @title NFTRegistry
/// @notice This contract carries all minting request and whitelist logic

contract NFTRegistry is INFTRegistry, OwnableUpgradeable, AccessControlUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;
    using SafeMath for uint256;
    using Math for uint256;

    bytes32 public constant WHITELISTER_ROLE = keccak256("WHITELISTER_ROLE");

    uint256 public constant MAX_WHITELIST = 100;

    IERC721H public erc721H;
    IERC1155H public erc1155H;
    IWallet public wallet;

    EnumerableSet.AddressSet internal _nftAddresses; // smart contracts that carry whitelisted NFT
    mapping(address => EnumerableSet.UintSet) internal _nftIDs; // smart contract -> whitelisted NFT ID

    modifier onlyAutorized() {
        require(
            msg.sender == address(erc721H) || msg.sender == address(erc1155H) || hasRole(WHITELISTER_ROLE, msg.sender),
            "NFTRegistry : wrong caller"
        );
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, owner());
    }

    function setDependencies(address registryAddress) external onlyOwner {
        erc721H = IERC721H(Registry(registryAddress).getContract("ERC721H"));
        erc1155H = IERC1155H(Registry(registryAddress).getContract("ERC1155H"));
        wallet = IWallet(Registry(registryAddress).getContract(("WALLET")));
    }

    // ======================
    // ||   WHITELISTING   ||
    // ======================

    function isWhitelisted(address nftAddress, uint256 nftID) public view override returns (bool whitelisted) {
        if (_nftAddresses.contains(nftAddress)) {
            whitelisted = _nftIDs[nftAddress].contains(nftID);
        }
    }

    function countNFTAddresses() external view returns (uint256 count) {
        count = _nftAddresses.length();
    }

    function countNFTIDs(address nftAddress) external view returns (uint256 count) {
        count = _nftIDs[nftAddress].length();
    }

    /// @notice use with limit = countNFTAddresses()
    function getNFTAddresses(uint256 offset, uint256 limit) external view returns (address[] memory nftAddresses) {
        uint256 count = _nftAddresses.length();
        uint256 to = (offset.tryAdd(limit)).min(count).max(offset);

        nftAddresses = new address[](to.uncheckedSub(offset));

        for (uint256 i = offset; i < to; i++) {
            uint256 index = i.uncheckedSub(offset);
            nftAddresses[index] = _nftAddresses.at(i);
        }
    }

    /// @notice use with limit = countNFTIDs(nftAddress)
    function getNFTIDs(
        address nftAddress,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory nftIDs) {
        uint256 count = _nftIDs[nftAddress].length();
        uint256 to = (offset.tryAdd(limit)).min(count).max(offset);

        nftIDs = new uint256[](to.uncheckedSub(offset));

        for (uint256 i = offset; i < to; i++) {
            uint256 index = i.uncheckedSub(offset);
            nftIDs[index] = _nftIDs[nftAddress].at(index);
        }
    }

    /// @notice whitelist a NFT
    /// @param nftAddress contract address of NFT to whitelist
    /// @param nftID ID of NFT to whitelist
    function addWhitelist(address nftAddress, uint256 nftID) external onlyAutorized {
        _addWhitelist(nftAddress, nftID);
    }

    /// @notice whitelist a batch of NFT
    /// @param nftAddresses contract address array of NFT to whitelist
    /// @param nftIDs ID array of NFT to whitelist
    function addWhitelistBatch(address[] memory nftAddresses, uint256[] memory nftIDs) external onlyAutorized {
        require(nftAddresses.length == nftIDs.length, "NFTRegistry : length mismatch");
        require(nftAddresses.length < MAX_WHITELIST, "NFTRegistry : too many NFTs");

        for (uint256 i = 0; i < nftAddresses.length; i++) {
            _addWhitelist(nftAddresses[i], nftIDs[i]);
        }
    }

    function _addWhitelist(address nftAddress, uint256 nftID) internal {
        _nftAddresses.add(nftAddress);
        _nftIDs[nftAddress].add(nftID);
    }

    /// @notice unwhitelist a NFT
    /// @param nftAddress contract address of NFT to unwhitelist
    /// @param nftID ID of NFT to unwhitelist
    function removeWhitelist(address nftAddress, uint256 nftID) external override onlyAutorized {
        _removeWhitelist(nftAddress, nftID);
    }

    /// @notice unwhitelist a batch of NFT
    /// @param nftAddresses contract address array of NFT to unwhitelist
    /// @param nftIDs ID array of NFT to unwhitelist
    function removeWhitelistBatch(
        address[] memory nftAddresses,
        uint256[] memory nftIDs
    ) external override onlyAutorized {
        require(nftAddresses.length == nftIDs.length, "NFTRegistry : length mismatch");
        require(nftAddresses.length < MAX_WHITELIST, "NFTRegistry : too many NFTs");

        for (uint256 i = 0; i < nftAddresses.length; i++) {
            _removeWhitelist(nftAddresses[i], nftIDs[i]);
        }
    }

    function _removeWhitelist(address nftAddress, uint256 nftID) internal {
        _nftAddresses.remove(nftAddress);
        _nftIDs[nftAddress].remove(nftID);
    }

    // ====================
    // ||   MODERATION   ||
    // ====================

    /// @notice approve a minting request
    /// @dev token has been minted and gas fee calculated
    /// @param nftAddress contract address of NFT to whitelist
    /// @param nftID ID NFT to whitelist
    /// @param mintingID ID of minting request
    /// @param gasFee cost of minting transaction
    function approveRequest(address nftAddress, uint256 nftID, uint256 mintingID, uint256 gasFee) external onlyOwner {
        _addWhitelist(nftAddress, nftID);
        wallet.updateBalance(mintingID, gasFee, true);
    }

    /// @notice hard decline a minting request
    /// @param mintingID ID of minting request
    function declineRequest(uint256 mintingID) external onlyOwner {
        wallet.updateBalance(mintingID, 0, false);
    }

    /// @notice revoke a minting request
    /// @param nftAddress contract address of NFT to unwhitelist
    /// @param nftID ID NFT to unwhitelist
    function revokeRequest(address nftAddress, uint256 nftID) external onlyOwner {
        _removeWhitelist(nftAddress, nftID);
    }
}
