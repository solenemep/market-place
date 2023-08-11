//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./helpers/Registry.sol";
import "./interfaces/IListing.sol";

import "./interfaces/INFTRegistry.sol";
import "./interfaces/IAuction.sol";

import "./libraries/NFTIdentifier.sol";

/// @author @solenemep
/// @title Listing
/// @notice This contract carries all listing and buying at fixed price logic
/// @notice It is connected with Auction.sol

contract Listing is IListing, OwnableUpgradeable {
    using NFTIdentifier for address;

    INFTRegistry public nftRegistry;
    IAuction public auction;

    mapping(address => mapping(uint256 => FixedSaleListing)) internal _fixedSaleListing;
    mapping(address => mapping(uint256 => uint256)) internal _auctionSaleListing; // id ?

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
        auction = IAuction(Registry(registryAddress).getContract("AUCTION"));
    }

    function isListed(address nftAddress, uint256 nftID) external view returns (List list) {
        if (block.timestamp <= _fixedSaleListing[nftAddress][nftID].expiration) {
            // TODO if condition quantity and approval ?
            list = List.FIXED_SALE;
        } else if (_auctionSaleListing[nftAddress][nftID] > 0) {
            // TODO else if condition quantity and approval ?
            list = List.AUCTION_SALE;
        }
    }

    // =====================
    // ||   FIXED PRICE   ||
    // =====================

    /// @notice list a NFT on fixed price sale
    /// @dev user should approve Listing contract to dispose of his NFT
    /// @param nftAddress contract address of NFT to list
    /// @param nftID ID of NFT to list
    /// @param price selling price of NFT to list
    /// @param expiration expiration block of listing
    // TODO quantity in param ?
    function listFixedSale(address nftAddress, uint256 nftID, uint256 price, uint256 expiration) external {
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "Listing : not whitelisted");
        if (NFTIdentifier.isERC721(nftAddress)) {
            require(IERC721(nftAddress).isApprovedForAll(msg.sender, address(this)), "Listing : not approved");
            _listFixedSale(nftAddress, nftID, price, expiration, 1);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(IERC1155(nftAddress).isApprovedForAll(msg.sender, address(this)), "Listing : not approved");
            uint256 quantity = IERC1155(nftAddress).balanceOf(msg.sender, nftID);
            _listFixedSale(nftAddress, nftID, price, expiration, quantity);
        }
    }

    function _listFixedSale(
        address nftAddress,
        uint256 nftID,
        uint256 price,
        uint256 expiration,
        uint256 quantity
    ) internal {
        _fixedSaleListing[nftAddress][nftID].price = price;
        _fixedSaleListing[nftAddress][nftID].expiration = expiration;
        _fixedSaleListing[nftAddress][nftID].quantity = quantity;
    }

    /// @notice unlist a NFT from fixed price sale
    /// @param nftAddress contract address of NFT to unlist
    /// @param nftID ID of NFT to unlist
    function unlistFixedSale(address nftAddress, uint256 nftID) external override {
        require(
            msg.sender == address(nftRegistry) ||
                (NFTIdentifier.isERC721(nftAddress) && msg.sender == IERC721(nftAddress).ownerOf(nftID)) ||
                (NFTIdentifier.isERC1155(nftAddress) &&
                    IERC1155(nftAddress).balanceOf(msg.sender, nftID) == _fixedSaleListing[nftAddress][nftID].quantity),
            "Listing : not allowed"
        );
        delete _fixedSaleListing[nftAddress][nftID];
    }

    function buyFixedSale(address nftAddress, uint256 nftID, uint256 quantity) external {}

    // =================
    // ||   AUCTION   ||
    // =================

    /// @notice list a NFT on english auction sale
    /// @notice user should approve Listing contract to dispose of his NFT
    /// @param nftAddress contract address of NFT to list
    /// @param nftID ID of NFT to list
    function listAuctionSale(address nftAddress, uint256 nftID) external {
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "Listing : not whitelisted");
    }

    /// @notice unlist a NFT from english auction sale
    /// @param nftAddress contract address of NFT to unlist
    /// @param nftID ID of NFT to unlist
    function unlistAuctionSale(address nftAddress, uint256 nftID) external override {}
}
