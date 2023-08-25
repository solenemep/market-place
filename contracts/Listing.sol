//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./libraries/SafeMath.sol";

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
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using NFTIdentifier for address;
    using SafeMath for uint256;

    uint256 public constant MIN_PRICE = 10 ** 15;

    INFTRegistry public nftRegistry;
    IAuction public auction;

    address public daoAddress;

    uint256 public commissionPercentage;

    uint256 private _saleListingID;
    mapping(uint256 => SaleListing) public saleListing; // saleListingID -> SaleListing
    // erc721
    mapping(address => mapping(uint256 => uint256)) internal _erc721SaleListingID; // nftAddress -> nftID -> saleListingID
    // erc1155
    mapping(address => mapping(uint256 => EnumerableSet.AddressSet)) internal _erc1155SaleListingOwners; // nftAddress -> nftID -> owners
    mapping(address => mapping(uint256 => mapping(address => ERC1155SaleID))) internal _erc1155SaleListingID; // nftAddress -> nftID -> owner -> ERC1155SaleID

    event ListedFixedSale(
        address indexed nftAddress,
        uint256 indexed nftID,
        address indexed owner,
        uint256 price,
        uint256 expiration,
        uint256 quantity
    );
    event UnlistedFixedSale(address indexed nftAddress, uint256 indexed nftID, address indexed owner, uint256 quantity);
    event BoughtFixedSale(address indexed nftAddress, uint256 indexed nftID, address indexed buyer, uint256 quantity);

    event ListedAuctionSale(
        address indexed nftAddress,
        uint256 indexed nftID,
        address indexed owner,
        uint256 minPrice,
        uint256 startTime,
        uint256 endTime,
        uint256 quantity
    );
    event UnlistedAuctionSale(
        address indexed nftAddress,
        uint256 indexed nftID,
        address indexed owner,
        uint256 quantity
    );

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
        daoAddress = Registry(registryAddress).getContract("DAO");
    }

    function setCommissionPercentage(uint256 newCommissionPercentage) external onlyOwner {
        commissionPercentage = newCommissionPercentage;
    }

    function _list(
        List list,
        bool isERC721,
        address nftAddress,
        uint256 nftID,
        address owner,
        uint256 price,
        uint256 startTime,
        uint256 endTime,
        uint256 quantity
    ) internal {
        saleListing[_saleListingID].list = list;
        saleListing[_saleListingID].nftAddress = nftAddress;
        saleListing[_saleListingID].nftID = nftID;
        saleListing[_saleListingID].owner = owner;
        saleListing[_saleListingID].price = price;
        saleListing[_saleListingID].startTime = startTime;
        saleListing[_saleListingID].endTime = endTime;
        saleListing[_saleListingID].quantity = quantity;

        if (isERC721) {
            _erc721SaleListingID[nftAddress][nftID] = _saleListingID;
        } else {
            _erc1155SaleListingOwners[nftAddress][nftID].add(owner);
            _erc1155SaleListingID[nftAddress][nftID][owner].totalQuantity = _erc1155SaleListingID[nftAddress][nftID][
                owner
            ].totalQuantity.add(quantity);
            _erc1155SaleListingID[nftAddress][nftID][owner].erc1155SaleListingIDs.add(_saleListingID);
        }

        _saleListingID = _saleListingID.add(1);
    }

    function _unlist(
        bool isERC721,
        uint256 saleListingID,
        address nftAddress,
        uint256 nftID,
        address owner,
        uint256 quantity
    ) internal {
        if (isERC721) {
            _erc721SaleListingID[nftAddress][nftID] = 0;
            delete saleListing[saleListingID];
        } else {
            uint256 newQuantity = saleListing[saleListingID].quantity.uncheckedSub(quantity);
            _erc1155SaleListingID[nftAddress][nftID][owner].totalQuantity = _erc1155SaleListingID[nftAddress][nftID][
                owner
            ].totalQuantity.uncheckedSub(quantity);

            if (newQuantity == 0) {
                delete saleListing[saleListingID];

                if (_erc1155SaleListingID[nftAddress][nftID][owner].totalQuantity == 0) {
                    _erc1155SaleListingOwners[nftAddress][nftID].remove(owner);
                    _erc1155SaleListingID[nftAddress][nftID][owner].erc1155SaleListingIDs.remove(saleListingID);
                }
            } else {
                saleListing[saleListingID].quantity = newQuantity;
            }
        }
    }

    // =====================
    // ||   FIXED PRICE   ||
    // =====================

    function isFixedSaleListed(uint256 saleListingID) external view returns (bool isListed) {
        address nftAddress = saleListing[saleListingID].nftAddress;
        uint256 nftID = saleListing[saleListingID].nftID;
        address owner = saleListing[saleListingID].owner;

        if (NFTIdentifier.isERC721(nftAddress)) {
            if (
                saleListing[saleListingID].list == List.FIXED_SALE &&
                nftRegistry.isWhitelisted(nftAddress, nftID) &&
                !_isFixedSaleListingExpired(saleListingID) &&
                IERC721(nftAddress).isApprovedForAll(owner, address(this))
            ) {
                isListed = true;
            }
        }
        if (NFTIdentifier.isERC1155(nftAddress)) {
            if (
                saleListing[saleListingID].list == List.FIXED_SALE &&
                nftRegistry.isWhitelisted(nftAddress, nftID) &&
                !_isFixedSaleListingExpired(saleListingID) &&
                IERC1155(nftAddress).isApprovedForAll(owner, address(this))
            ) {
                isListed = true;
            }
        }
    }

    function _isFixedSaleListingExpired(uint256 saleListingID) internal view returns (bool isFixedSaleListingExpired) {
        isFixedSaleListingExpired =
            saleListing[saleListingID].endTime != 0 &&
            block.timestamp >= saleListing[saleListingID].endTime;
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
        require(price >= MIN_PRICE, "Listing : price must higher than 0.001 ISML");
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "Listing : not whitelisted");

        if (NFTIdentifier.isERC721(nftAddress)) {
            require(msg.sender == IERC721(nftAddress).ownerOf(nftID), "Listing : not the owner");
            require(_erc721SaleListingID[nftAddress][nftID] == 0, "Listing : already listed");

            _list(List.FIXED_SALE, true, nftAddress, nftID, msg.sender, price, 0, expiration, 1);

            emit ListedFixedSale(nftAddress, nftID, msg.sender, price, expiration, 1);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(
                quantity <=
                    IERC1155(nftAddress).balanceOf(msg.sender, nftID).sub(
                        _erc1155SaleListingID[nftAddress][nftID][msg.sender].totalQuantity
                    ),
                "Listing : not the owner or quantity already listed"
            );

            _list(List.FIXED_SALE, false, nftAddress, nftID, msg.sender, price, 0, expiration, quantity);

            emit ListedFixedSale(nftAddress, nftID, msg.sender, price, expiration, quantity);
        }
    }

    /// @notice unlist a NFT from fixed price sale
    /// @param saleListingID ID of fixed sale to unlist
    /// @param quantity quantity to unlist in case of ERC1155
    function unlistFixedSale(uint256 saleListingID, uint256 quantity) external {
        require(saleListing[saleListingID].list == List.FIXED_SALE, "Listing : not listed in fixed sale");

        address nftAddress = saleListing[saleListingID].nftAddress;
        uint256 nftID = saleListing[saleListingID].nftID;
        address owner = saleListing[saleListingID].owner;

        if (NFTIdentifier.isERC721(nftAddress)) {
            require(msg.sender == owner, "Listing : not the owner");

            _unlist(true, saleListingID, nftAddress, nftID, owner, 1);

            emit UnlistedFixedSale(nftAddress, nftID, owner, quantity);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(msg.sender == owner, "Listing : not the owner");
            require(quantity <= saleListing[saleListingID].quantity, "Listing : quantity not listed");

            _unlist(false, saleListingID, nftAddress, nftID, owner, quantity);

            emit UnlistedFixedSale(nftAddress, nftID, owner, quantity);
        }
    }

    /// @notice this function allow user to buy at fixed sale a NFT
    /// @notice conditions for buying to not revert are the following :
    /// @notice 1. NFT is listed by owner on fixed sale
    /// @notice 2. NFT is whitelisted by plateform
    /// @notice 3. NFT is approved by owner to plateform
    /// @param saleListingID ID of fixed sale to purchase
    /// @param quantity quantity to purchase in case of ERC1155
    // TODO LISTING group the conditions to one view function to know if NFT can be bought, for lists view
    function buyFixedSale(uint256 saleListingID, uint256 quantity) external payable {
        require(saleListing[saleListingID].list == List.FIXED_SALE, "Listing : not listed in fixed sale");

        address nftAddress = saleListing[saleListingID].nftAddress;
        uint256 nftID = saleListing[saleListingID].nftID;
        address owner = saleListing[saleListingID].owner;
        uint256 price = saleListing[saleListingID].price;
        uint256 commission = price.mul(commissionPercentage).uncheckedDiv(100);

        require(nftRegistry.isWhitelisted(nftAddress, nftID), "Listing : not whitelisted");
        require(!_isFixedSaleListingExpired(saleListingID), "Listing : listing expired");

        if (NFTIdentifier.isERC721(nftAddress)) {
            require(msg.value == price.add(commission), "Listing : not enought ISLM");

            _unlist(true, saleListingID, nftAddress, nftID, owner, 1);

            IERC721(nftAddress).safeTransferFrom(owner, msg.sender, nftID, "");
            payable(owner).transfer(price);
            payable(daoAddress).transfer(commission);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(quantity <= saleListing[nftID].quantity, "Listing : quantity not listed");
            require(msg.value == (price.add(commission)).mul(quantity), "Listing : not enought ISLM");

            _unlist(false, saleListingID, nftAddress, nftID, owner, quantity);

            IERC1155(nftAddress).safeTransferFrom(owner, msg.sender, nftID, quantity, "");
            payable(owner).transfer(price.mul(quantity));
            payable(daoAddress).transfer(commission.mul(quantity));
        }

        emit BoughtFixedSale(nftAddress, nftID, msg.sender, quantity);
    }

    // =================
    // ||   AUCTION   ||
    // =================

    function isAuctionSaleListed(uint256 saleListingID) external view returns (bool isListed) {
        address nftAddress = saleListing[saleListingID].nftAddress;
        uint256 nftID = saleListing[saleListingID].nftID;
        address owner = saleListing[saleListingID].owner;

        if (NFTIdentifier.isERC721(nftAddress)) {
            if (
                saleListing[saleListingID].list == List.AUCTION_SALE &&
                nftRegistry.isWhitelisted(nftAddress, nftID) &&
                !_isAuctionSaleListingExpired(saleListingID) &&
                IERC721(nftAddress).isApprovedForAll(owner, address(this))
            ) {
                isListed = true;
            }
        }
        if (NFTIdentifier.isERC1155(nftAddress)) {
            if (
                saleListing[saleListingID].list == List.AUCTION_SALE &&
                nftRegistry.isWhitelisted(nftAddress, nftID) &&
                !_isAuctionSaleListingExpired(saleListingID) &&
                IERC1155(nftAddress).isApprovedForAll(owner, address(this))
            ) {
                isListed = true;
            }
        }
    }

    function _isAuctionSaleListingExpired(
        uint256 saleListingID
    ) internal view returns (bool isAuctionSaleListingExpired) {
        isAuctionSaleListingExpired = block.timestamp >= saleListing[saleListingID].endTime;
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
        require(minPrice >= MIN_PRICE, "Listing : price must higher than 0.001 ISML");
        require(startTime < endTime && block.timestamp < endTime, "Listing : auction wrong endind time");
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "Listing : not whitelisted");

        if (NFTIdentifier.isERC721(nftAddress)) {
            require(msg.sender == IERC721(nftAddress).ownerOf(nftID), "Listing : not the owner");
            require(_erc721SaleListingID[nftAddress][nftID] == 0, "Listing : already listed");

            _list(List.AUCTION_SALE, true, nftAddress, nftID, msg.sender, minPrice, startTime, endTime, 1);
            auction.createAuction();

            emit ListedAuctionSale(nftAddress, nftID, msg.sender, minPrice, startTime, endTime, 1);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(
                quantity <=
                    IERC1155(nftAddress).balanceOf(msg.sender, nftID).sub(
                        _erc1155SaleListingID[nftAddress][nftID][msg.sender].totalQuantity
                    ),
                "Listing : not the owner or quantity already listed"
            );

            _list(List.AUCTION_SALE, false, nftAddress, nftID, msg.sender, minPrice, startTime, endTime, quantity);
            auction.createAuction();

            emit ListedAuctionSale(nftAddress, nftID, msg.sender, minPrice, startTime, endTime, quantity);
        }
    }

    /// @notice unlist a NFT from english auction sale
    /// @param saleListingID ID of auction sale to unlist
    /// @param quantity quantity to unlist in case of ERC1155
    function unlistAuctionSale(uint256 saleListingID, uint256 quantity) external override {
        require(saleListing[saleListingID].list == List.AUCTION_SALE, "Listing : not listed in auction sale");
    }
}
