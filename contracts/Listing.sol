//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./helpers/Registry.sol";
import "./interfaces/IListing.sol";

import "./interfaces/INFTIdentifier.sol";
import "./interfaces/INFTRegistry.sol";
import "./interfaces/IAuction.sol";

/// @title Listing
/// @notice This contract carries all listing and buying at fixed price logic
/// @notice It is connected with Auction.sol

contract Listing is IListing, OwnableUpgradeable {
    INFTIdentifier public nftIdentifier;
    INFTRegistry public nftRegistry;
    IAuction public auction;

    mapping(address => mapping(uint256 => FixedSaleListing)) internal _fixedSaleListing;
    mapping(address => mapping(uint256 => uint256)) internal _auctionSaleListing; // id ?

    function __Listing_init() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {
        nftIdentifier = INFTIdentifier(Registry(registryAddress).getContract("NFT_IDENTIFIER"));
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

    /// @notice user should approve Listing contract to dispose of his NFT
    // TODO quantity in param ?
    function listFixedSale(address nftAddress, uint256 nftID, uint256 price, uint256 expiration) external {
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "Listing : not whitelisted");
        if (nftIdentifier.isERC721(nftAddress)) {
            require(IERC721(nftAddress).isApprovedForAll(msg.sender, address(this)), "Listing : not approved");
            _listFixedSale(nftAddress, nftID, price, expiration, 1);
        } else if (nftIdentifier.isERC1155(nftAddress)) {
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

    function unlistFixedSale(address nftAddress, uint256 nftID) external override {
        require(
            msg.sender == address(nftRegistry) ||
                (nftIdentifier.isERC721(nftAddress) && msg.sender == IERC721(nftAddress).ownerOf(nftID)) ||
                (nftIdentifier.isERC1155(nftAddress) &&
                    IERC1155(nftAddress).balanceOf(msg.sender, nftID) == _fixedSaleListing[nftAddress][nftID].quantity),
            "Listing : not allowed"
        );
        delete _fixedSaleListing[nftAddress][nftID];
    }

    function buyFixedSale(address nftAddress, uint256 nftID, uint256 quantity) external {}

    // =================
    // ||   AUCTION   ||
    // =================

    function listAuctionSale(address nftAddress, uint256 nftID) external {
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "Listing : not whitelisted");
    }
}
