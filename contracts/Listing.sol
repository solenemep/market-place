//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

import "./libraries/UncheckedMath.sol";

import "./helpers/Registry.sol";
import "./interfaces/IListing.sol";

import "./interfaces/tokens/IERCH.sol";
import "./interfaces/INFTRegistry.sol";
import "./interfaces/IAuction.sol";

import "./libraries/NFTIdentifier.sol";

/// @author @solenemep
/// @title Listing
/// @notice This contract carries all listing and buying at fixed price logic
/// @notice It is connected with Auction.sol

contract Listing is IListing, OwnableUpgradeable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using NFTIdentifier for address;
    using UncheckedMath for uint256;
    using Math for uint256;

    uint256 public constant MIN_PRICE = 10 ** 15;

    INFTRegistry public nftRegistry;
    IAuction public auction;

    address public erc721HAddress;
    address public erc1155HAddress;

    address public commissionAddress;

    uint256 public fixedComPercent;

    uint256 private _saleListingID;
    mapping(uint256 => SaleListing) public override saleListing; // saleListingID -> SaleListing

    EnumerableSet.UintSet internal _fixedSaleListings; // saleListingIDs
    EnumerableSet.UintSet internal _auctionSaleListings; // saleListingIDs

    // erc721
    mapping(address => mapping(uint256 => uint256)) internal _erc721SaleListingID; // nftAddress -> nftID -> saleListingID
    // erc1155
    mapping(address => mapping(uint256 => EnumerableSet.AddressSet)) internal _erc1155SaleListingOwners; // nftAddress -> nftID -> owners
    mapping(address => mapping(uint256 => mapping(address => ERC1155SaleID))) internal _erc1155SaleListingID; // nftAddress -> nftID -> nftOwner -> ERC1155SaleID

    event ListedFixedSale(
        address indexed nftAddress,
        uint256 indexed nftID,
        address indexed nftOwner,
        uint256 price,
        uint256 expiration,
        uint256 quantity,
        uint256 saleListingID
    );
    event UnlistedFixedSale(
        address indexed nftAddress,
        uint256 indexed nftID,
        address indexed nftOwner,
        uint256 quantity,
        uint256 saleListingID
    );
    event BoughtFixedSale(
        address indexed nftAddress,
        uint256 indexed nftID,
        address indexed buyer,
        uint256 quantity,
        uint256 saleListingID
    );

    event ListedAuctionSale(
        address indexed nftAddress,
        uint256 indexed nftID,
        address indexed nftOwner,
        uint256 minPrice,
        uint256 startTime,
        uint256 endTime,
        uint256 quantity,
        uint256 saleListingID
    );
    event UnlistedAuctionSale(
        address indexed nftAddress,
        uint256 indexed nftID,
        address indexed nftOwner,
        uint256 quantity,
        uint256 saleListingID
    );

    modifier onlyAuthorized() {
        require(msg.sender == address(auction), "L: wrong caller");
        _;
    }

    modifier existingFixedSaleListing(uint256 saleListingID) {
        require(_fixedSaleListings.contains(saleListingID), "L: not listed in fixed sale");
        _;
    }

    modifier existingAuctionSaleListing(uint256 saleListingID) {
        require(_auctionSaleListings.contains(saleListingID), "L: not listed in auction sale");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init();

        _saleListingID = 1;
    }

    function setDependencies(address registryAddress) external onlyOwner {
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
        auction = IAuction(Registry(registryAddress).getContract("AUCTION"));
        commissionAddress = Registry(registryAddress).getContract("COMMISSION");

        erc721HAddress = Registry(registryAddress).getContract("ERC721H");
        erc1155HAddress = Registry(registryAddress).getContract("ERC1155H");
    }

    function setFixedComPercent(uint256 newFixedComPercent) external onlyOwner {
        fixedComPercent = newFixedComPercent;
    }

    function _list(
        List list,
        bool isERC721,
        address nftAddress,
        uint256 nftID,
        address nftOwner,
        uint256 price,
        uint256 startTime,
        uint256 endTime,
        uint256 quantity
    ) internal {
        SaleListing memory listing = SaleListing(nftAddress, nftID, nftOwner, price, startTime, endTime, quantity);
        saleListing[_saleListingID] = listing;

        if (isERC721) {
            _erc721SaleListingID[nftAddress][nftID] = _saleListingID;
        } else {
            _erc1155SaleListingOwners[nftAddress][nftID].add(nftOwner);
            _erc1155SaleListingID[nftAddress][nftID][nftOwner].totalQuantity =
                _erc1155SaleListingID[nftAddress][nftID][nftOwner].totalQuantity +
                quantity;
            _erc1155SaleListingID[nftAddress][nftID][nftOwner].erc1155SaleListingIDs.add(_saleListingID);
        }

        if (list == List.FIXED_SALE) {
            _fixedSaleListings.add(_saleListingID);
        } else if (list == List.AUCTION_SALE) {
            _auctionSaleListings.add(_saleListingID);
        }

        _saleListingID++;
    }

    function unlist(
        bool isERC721,
        uint256 saleListingID,
        address nftAddress,
        uint256 nftID,
        address nftOwner
    ) external override onlyAuthorized {
        _unlist(List.AUCTION_SALE, isERC721, saleListingID, nftAddress, nftID, nftOwner);
    }

    function _unlist(
        List list,
        bool isERC721,
        uint256 saleListingID,
        address nftAddress,
        uint256 nftID,
        address nftOwner
    ) internal {
        SaleListing memory _saleListing = saleListing[saleListingID];

        if (isERC721) {
            _erc721SaleListingID[nftAddress][nftID] = 0;
        } else {
            _erc1155SaleListingID[nftAddress][nftID][nftOwner].totalQuantity = _erc1155SaleListingID[nftAddress][nftID][
                nftOwner
            ].totalQuantity.uncheckedSub(_saleListing.quantity);
            if (_erc1155SaleListingID[nftAddress][nftID][nftOwner].totalQuantity == 0) {
                _erc1155SaleListingOwners[nftAddress][nftID].remove(nftOwner);
            }
            _erc1155SaleListingID[nftAddress][nftID][nftOwner].erc1155SaleListingIDs.remove(saleListingID);
        }

        if (list == List.FIXED_SALE) {
            _fixedSaleListings.remove(saleListingID);
        } else if (list == List.AUCTION_SALE) {
            _auctionSaleListings.remove(saleListingID);
        }

        delete saleListing[saleListingID];
    }

    function countfixedSaleListings() external view returns (uint256) {
        return _fixedSaleListings.length();
    }

    function countAuctionSaleListings() external view returns (uint256) {
        return _auctionSaleListings.length();
    }

    /// @notice use with countFixedSaleListings()
    function listFixedSaleListings(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory saleListingIDs) {
        return _list(offset, limit, _fixedSaleListings);
    }

    /// @notice use with countAuctionSaleListings()
    function listAuctionSaleListings(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory saleListingIDs) {
        return _list(offset, limit, _auctionSaleListings);
    }

    function _list(
        uint256 offset,
        uint256 limit,
        EnumerableSet.UintSet storage set
    ) internal view returns (uint256[] memory saleListingIDs) {
        uint256 to = (offset + limit).min(set.length()).max(offset);

        saleListingIDs = new uint256[](to.uncheckedSub(offset));

        for (uint256 i = offset; i < to; i++) {
            saleListingIDs[i.uncheckedSub(offset)] = set.at(i);
        }
    }

    // =====================
    // ||   FIXED PRICE   ||
    // =====================

    function isFixedSaleListed(uint256 saleListingID) external view returns (bool isListed) {
        SaleListing memory _saleListing = saleListing[saleListingID];

        address nftAddress = _saleListing.nftAddress;

        bool isFixedSaleListingExpired = _saleListing.endTime != 0 && block.timestamp >= _saleListing.endTime;

        if (NFTIdentifier.isERC721(nftAddress) || NFTIdentifier.isERC1155(nftAddress)) {
            if (
                _fixedSaleListings.contains(saleListingID) &&
                nftRegistry.isWhitelisted(nftAddress, _saleListing.nftID) &&
                !isFixedSaleListingExpired &&
                IERCH(nftAddress).isApprovedForAll(_saleListing.nftOwner, address(this))
            ) {
                isListed = true;
            }
        }
    }

    /// @notice list a NFT on sale
    /// @param nftAddress contract address of NFT to list
    /// @param nftID ID of NFT to list
    /// @param price selling price of NFT to list
    /// @param expiration expiration block of listing
    /// @param quantity quantity to list in case of ERC1155
    function listFixedSale(
        address nftAddress,
        uint256 nftID,
        uint256 price,
        uint256 expiration,
        uint256 quantity
    ) external {
        require(price >= MIN_PRICE, "L: price too low");
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "L: not whitelisted");

        uint256 saleListingID = _saleListingID;
        if (NFTIdentifier.isERC721(nftAddress)) {
            require(msg.sender == IERC721(nftAddress).ownerOf(nftID), "L: not the nftOwner");
            require(_erc721SaleListingID[nftAddress][nftID] == 0, "L: already listed");

            _list(List.FIXED_SALE, true, nftAddress, nftID, msg.sender, price, 0, expiration, 1);

            emit ListedFixedSale(nftAddress, nftID, msg.sender, price, expiration, 1, saleListingID);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(
                quantity <=
                IERC1155(nftAddress).balanceOf(msg.sender, nftID) -
                _erc1155SaleListingID[nftAddress][nftID][msg.sender].totalQuantity,
                "L: not the nftOwner or quantity already listed"
            );

            _list(List.FIXED_SALE, false, nftAddress, nftID, msg.sender, price, 0, expiration, quantity);

            emit ListedFixedSale(nftAddress, nftID, msg.sender, price, expiration, quantity, saleListingID);
        } else {
            revert("L: not a NFT address");
        }
    }

    /// @notice unlist a NFT from fixed price sale
    /// @param saleListingID ID of fixed sale to unlist
    function unlistFixedSale(uint256 saleListingID) external existingFixedSaleListing(saleListingID) {
        SaleListing memory _saleListing = saleListing[saleListingID];

        address nftAddress = _saleListing.nftAddress;
        uint256 nftID = _saleListing.nftID;
        address nftOwner = _saleListing.nftOwner;
        uint256 quantity = _saleListing.quantity;

        require(msg.sender == nftOwner || msg.sender == owner(), "L: not the nftOwner or contract owner");

        if (NFTIdentifier.isERC721(nftAddress)) {
            _unlist(List.FIXED_SALE, true, saleListingID, nftAddress, nftID, nftOwner);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            _unlist(List.FIXED_SALE, false, saleListingID, nftAddress, nftID, nftOwner);
        } else {
            revert("L: not a NFT address");
        }

        emit UnlistedFixedSale(nftAddress, nftID, nftOwner, quantity, saleListingID);
    }

    /// @notice this function allow user to buy at fixed sale a NFT
    /// @notice conditions for buying to not revert are the following :
    /// @notice 1. NFT is listed by nftOwner on fixed sale
    /// @notice 2. NFT is whitelisted by plateform
    /// @notice 3. NFT is approved by nftOwner to plateform
    /// @param saleListingID ID of fixed sale to purchase
    function buyFixedSale(uint256 saleListingID) external payable existingFixedSaleListing(saleListingID) nonReentrant {
        SaleListing memory _saleListing = saleListing[saleListingID];

        address nftAddress = _saleListing.nftAddress;
        uint256 nftID = _saleListing.nftID;
        address nftOwner = _saleListing.nftOwner;
        uint256 price = _saleListing.price;
        uint256 quantity = _saleListing.quantity;

        bool isFixedSaleListingExpired = _saleListing.endTime != 0 && block.timestamp >= _saleListing.endTime;

        require(nftRegistry.isWhitelisted(nftAddress, nftID), "L: not whitelisted");
        require(!isFixedSaleListingExpired, "L: listing expired");

        uint256 commission = (price * fixedComPercent).uncheckedDiv(100);
        require(price + commission <= msg.value, "L: not enought ISLM");

        if (NFTIdentifier.isERC721(nftAddress)) {
            _unlist(List.FIXED_SALE, true, saleListingID, nftAddress, nftID, nftOwner);

            IERC721(nftAddress).safeTransferFrom(nftOwner, msg.sender, nftID, "");
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            _unlist(List.FIXED_SALE, false, saleListingID, nftAddress, nftID, nftOwner);

            IERC1155(nftAddress).safeTransferFrom(nftOwner, msg.sender, nftID, quantity, "");
        } else {
            revert("L: not a NFT address");
        }

        distributeRoyalties(nftAddress, nftOwner, nftID, price);

        (bool successCom,) = payable(commissionAddress).call{value: commission}("");
        require(successCom, "Failed to pay commissionAddress");

        emit BoughtFixedSale(nftAddress, nftID, msg.sender, quantity, saleListingID);
    }

    function distributeRoyalties(address nftAddress, address nftOwner, uint256 nftID, uint256 price) internal {
        address nftCreator;
        uint256 royalityPercent;
        if (nftAddress == erc721HAddress || nftAddress == erc1155HAddress) {
            (nftCreator, royalityPercent) = IERCH(nftAddress).royalties(nftID);
        } else {
            (nftCreator, royalityPercent) = IERC2981(nftAddress).royaltyInfo(nftID, 100);
        }

        uint256 royalties = (price * royalityPercent).uncheckedDiv(100);
        if (nftCreator != address(0) && royalties > 0) {
            (bool successRoy, ) = payable(nftCreator).call{value: royalties}("");
            require(successRoy, "Failed to pay nftCreator");
        }
        (bool successOwner, ) = payable(nftOwner).call{value: price - royalties}("");
        require(successOwner, "Failed to pay nftOwner");
    }

    // =================
    // ||   AUCTION   ||
    // =================

    function isAuctionSaleListed(uint256 saleListingID) external view returns (bool isListed) {
        SaleListing memory _saleListing = saleListing[saleListingID];

        address nftAddress = _saleListing.nftAddress;
        uint256 nftID = _saleListing.nftID;

        if (NFTIdentifier.isERC721(nftAddress)) {
            if (
                _isAuctionSaleListed(saleListingID, nftAddress, nftID, _saleListing.startTime, _saleListing.endTime) &&
                (IERC721(nftAddress).isApprovedForAll(_saleListing.nftOwner, address(auction)) ||
                    IERC721(nftAddress).ownerOf(nftID) == address(auction))
            ) {
                isListed = true;
            }
        }
        if (NFTIdentifier.isERC1155(nftAddress)) {
            if (
                _isAuctionSaleListed(saleListingID, nftAddress, nftID, _saleListing.startTime, _saleListing.endTime) &&
                (IERC1155(nftAddress).isApprovedForAll(_saleListing.nftOwner, address(auction)) ||
                    IERC1155(nftAddress).balanceOf(address(auction), nftID) == _saleListing.quantity)
            ) {
                isListed = true;
            }
        }
    }

    function _isAuctionSaleListed(
        uint256 saleListingID,
        address nftAddress,
        uint256 nftID,
        uint256 startTime,
        uint256 endTime
    ) internal view returns (bool) {
        return
            _auctionSaleListings.contains(saleListingID) &&
            nftRegistry.isWhitelisted(nftAddress, nftID) &&
            startTime <= block.timestamp &&
            block.timestamp < endTime;
    }

    function isOnAuctionSale(uint256 saleListingID) external view override returns (bool) {
        return _auctionSaleListings.contains(saleListingID);
    }

    /// @notice list a NFT on english auction sale
    /// @param nftAddress contract address of NFT to list
    /// @param nftID ID of NFT to list
    /// @param minPrice starting bid price of NFT to list
    /// @param startTime auction start time
    /// @param endTime auction end time
    /// @param quantity quantity to list in case of ERC1155
    function listAuctionSale(
        address nftAddress,
        uint256 nftID,
        uint256 minPrice,
        uint256 startTime,
        uint256 endTime,
        uint256 quantity
    ) external {
        require(minPrice >= MIN_PRICE, "L: price too low");
        require(block.timestamp <= startTime && startTime < endTime, "L: auction wrong time");
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "L: not whitelisted");

        uint256 saleListingID = _saleListingID;
        if (NFTIdentifier.isERC721(nftAddress)) {
            require(msg.sender == IERC721(nftAddress).ownerOf(nftID), "L: not the nftOwner");
            require(_erc721SaleListingID[nftAddress][nftID] == 0, "L: already listed");

            auction.createAuction(_saleListingID, minPrice);
            _list(List.AUCTION_SALE, true, nftAddress, nftID, msg.sender, minPrice, startTime, endTime, 1);

            emit ListedAuctionSale(nftAddress, nftID, msg.sender, minPrice, startTime, endTime, 1, saleListingID);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(
                quantity <=
                    IERC1155(nftAddress).balanceOf(msg.sender, nftID) -
                        _erc1155SaleListingID[nftAddress][nftID][msg.sender].totalQuantity,
                "L: not the nftOwner or quantity already listed"
            );

            auction.createAuction(_saleListingID, minPrice);
            _list(List.AUCTION_SALE, false, nftAddress, nftID, msg.sender, minPrice, startTime, endTime, quantity);

            emit ListedAuctionSale(nftAddress, nftID, msg.sender, minPrice, startTime, endTime, quantity, saleListingID);
        } else {
            revert("L: not a NFT address");
        }
    }

    /// @notice unlist a NFT from english auction sale from nftOwner
    /// @notice there should be no bids
    /// @param saleListingID ID of auction sale to unlist
    function unlistAuctionSale(uint256 saleListingID) external existingAuctionSaleListing(saleListingID) {
        SaleListing memory _saleListing = saleListing[saleListingID];

        require(!auction.hasBids(saleListingID), "L: listing has bids");

        address nftAddress = _saleListing.nftAddress;
        uint256 nftID = _saleListing.nftID;
        address nftOwner = _saleListing.nftOwner;
        uint256 quantity = _saleListing.quantity;

        require(msg.sender == nftOwner || msg.sender == owner(), "L: not the nftOwner or contract owner");

        if (NFTIdentifier.isERC721(nftAddress)) {
            _unlist(List.AUCTION_SALE, true, saleListingID, nftAddress, nftID, nftOwner);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            _unlist(List.AUCTION_SALE, false, saleListingID, nftAddress, nftID, nftOwner);
        } else {
            revert("L: not a NFT address");
        }

        emit UnlistedAuctionSale(nftAddress, nftID, nftOwner, quantity, saleListingID);
    }
}
