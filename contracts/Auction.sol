//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

import "./libraries/UncheckedMath.sol";

import "./helpers/Registry.sol";
import "./interfaces/IAuction.sol";

import "./interfaces/tokens/IERCH.sol";
import "./interfaces/INFTRegistry.sol";
import "./interfaces/IListing.sol";

import "./libraries/NFTIdentifier.sol";

/// @author @solenemep
/// @title Auction
/// @notice This contract carries english auction selling logic
/// @notice It is connected with Listing.sol

contract Auction is IAuction, OwnableUpgradeable, ReentrancyGuard {
    using Address for address payable;
    using UncheckedMath for uint256;

    INFTRegistry public nftRegistry;
    IListing public listing;

    address public erc721HAddress;
    address public erc1155HAddress;

    address public commissionAddress;

    uint256 public auctionComPercent;

    mapping(uint256 => HighestBid) public highestBid;

    event BidPlaced(uint256 indexed saleListingID, address indexed bidder, uint256 indexed bidAmount);
    event AuctionEnded(uint256 indexed saleListingID, address highestBidder, uint256 highestBidAmount);

    modifier onlyAuthorized() {
        require(msg.sender == address(listing), "A: wrong caller");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
        listing = IListing(Registry(registryAddress).getContract("LISTING"));
        commissionAddress = Registry(registryAddress).getContract("COMMISSION");

        erc721HAddress = Registry(registryAddress).getContract("ERC721H");
        erc1155HAddress = Registry(registryAddress).getContract("ERC1155H");
    }

    function setAuctionComPercent(uint256 newAuctionComPercent) external onlyOwner {
        auctionComPercent = newAuctionComPercent;
    }

    function hasBids(uint256 saleListingID) external view returns (bool) {
        return highestBid[saleListingID].highestBidder != address(0);
    }

    function createAuction(uint256 saleListingID, uint256 minPrice) external override onlyAuthorized {
        uint256 commission = (minPrice * auctionComPercent).uncheckedDiv(100);
        highestBid[saleListingID].highestBidAmount = minPrice + commission;
    }

    /// @notice place a bid on a listed auction
    /// @param saleListingID ID of auction sale user wants to bid on
    function placeBid(uint256 saleListingID) external payable nonReentrant {
        (address nftAddress, uint256 nftID, , , uint256 startTime, uint256 endTime, ) = listing.saleListing(
            saleListingID
        );
        require(listing.isOnAuctionSale(saleListingID), "A: not listed in auction sale");
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "A: not whitelisted");
        require(startTime <= block.timestamp, "A: auction not started");
        require(block.timestamp < endTime, "A: auction ended");

        address exHighestBidder = highestBid[saleListingID].highestBidder;
        uint256 exHighestBidAmount = highestBid[saleListingID].highestBidAmount;
        require(msg.value > exHighestBidAmount, "A: bid is too low");

        highestBid[saleListingID].highestBidder = msg.sender;
        highestBid[saleListingID].highestBidAmount = msg.value;

        if (exHighestBidder != address(0)) {
            (bool successExHighestBidder, ) = payable(exHighestBidder).call{value: exHighestBidAmount}("");
            require(successExHighestBidder, "Failed to pay exHighestBidder");
        } else {
            (, , address nftOwner, , , , uint256 quantity) = listing.saleListing(saleListingID);
            if (NFTIdentifier.isERC721(nftAddress)) {
                IERC721(nftAddress).safeTransferFrom(nftOwner, address(this), nftID, "");
            } else if (NFTIdentifier.isERC1155(nftAddress)) {
                IERC1155(nftAddress).safeTransferFrom(nftOwner, address(this), nftID, quantity, "");
            } else {
                revert("A: not a NFT address");
            }
        }

        emit BidPlaced(saleListingID, msg.sender, msg.value);
    }

    function endAuction(uint256 saleListingID) external onlyOwner {
        (address nftAddress, uint256 nftID, address nftOwner, , , , uint256 quantity) = listing.saleListing(
            saleListingID
        );
        require(listing.isOnAuctionSale(saleListingID), "A: not listed in auction sale");

        address highestBidder = highestBid[saleListingID].highestBidder;
        require(highestBidder != address(0), "A: nobody placed bid");

        uint256 highestBidAmount = highestBid[saleListingID].highestBidAmount;
        uint256 commission = (highestBidAmount * auctionComPercent).uncheckedDiv(100);

        if (NFTIdentifier.isERC721(nftAddress)) {
            listing.unlist(true, saleListingID, nftAddress, nftID, nftOwner);

            IERC721(nftAddress).safeTransferFrom(address(this), highestBidder, nftID, "");
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            listing.unlist(false, saleListingID, nftAddress, nftID, nftOwner);

            IERC1155(nftAddress).safeTransferFrom(address(this), highestBidder, nftID, quantity, "");
        } else {
            revert("A: not a NFT address");
        }

        delete highestBid[saleListingID];

        address nftCreator;
        uint256 royalityPercent;
        if (nftAddress == erc721HAddress || nftAddress == erc1155HAddress) {
            (nftCreator, royalityPercent) = IERCH(nftAddress).royalties(nftID);
        } else {
            (nftCreator, royalityPercent) = IERC2981(nftAddress).royaltyInfo(nftID, 100);
        }

        uint256 royalties = ((highestBidAmount - commission) * royalityPercent).uncheckedDiv(100);
        if (nftCreator != address(0) && royalties > 0) {
            (bool successRoy, ) = payable(nftCreator).call{value: royalties}("");
            require(successRoy, "Failed to pay nftCreator");
        }
        (bool successOwner, ) = payable(nftOwner).call{value: highestBidAmount - commission - royalties}("");
        require(successOwner, "Failed to pay nftOwner");
        (bool successCom, ) = payable(commissionAddress).call{value: commission}("");
        require(successCom, "Failed to pay commissionAddress");

        emit AuctionEnded(saleListingID, highestBidder, highestBidAmount);
    }

    function onERC721Received(address, address, uint256, bytes memory) public virtual returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes memory) public virtual returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public virtual returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
