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

    INFTRegistry public nftRegistry;
    IAuction public auction;

    address public daoAddress;

    uint256 public commissionPercentage;

    // FIXED SALE
    uint256 private _fixedSaleListingID;
    mapping(uint256 => FixedSaleListing) public fixedSaleListing; // fixedSaleListingID -> FixedSaleListing
    // erc721
    mapping(address => mapping(uint256 => uint256)) internal _erc721FixedSaleListingID; // nftAddress -> nftID -> fixedSaleListingID
    // erc1155
    mapping(address => mapping(uint256 => EnumerableSet.AddressSet)) internal _erc1155FixedSaleListingOwners; // nftAddress -> nftID -> owners
    mapping(address => mapping(uint256 => mapping(address => ERC1155FixedSaleID))) internal _erc1155FixedSaleListingID; // nftAddress -> nftID -> owner -> ERC1155FixedSaleID

    // AUCTION

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
    event ListedAuctionSale();
    event UnlistedAuctionSale();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init();

        _fixedSaleListingID = 1;
    }

    function setDependencies(address registryAddress) external onlyOwner {
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
        auction = IAuction(Registry(registryAddress).getContract("AUCTION"));
        daoAddress = Registry(registryAddress).getContract("DAO");
    }

    // =====================
    // ||   FIXED PRICE   ||
    // =====================

    function isFixedSaleListed(uint256 fixedSaleListingID) external view returns (bool isListed) {
        address nftAddress = fixedSaleListing[fixedSaleListingID].nftAddress;
        uint256 nftID = fixedSaleListing[fixedSaleListingID].nftID;
        address owner = fixedSaleListing[fixedSaleListingID].owner;

        if (NFTIdentifier.isERC721(nftAddress)) {
            if (
                nftRegistry.isWhitelisted(nftAddress, nftID) &&
                !_isFixedSaleListingExpired(fixedSaleListingID) &&
                IERC721(nftAddress).isApprovedForAll(owner, address(this))
            ) {
                isListed = true;
            }
        }
        if (NFTIdentifier.isERC1155(nftAddress)) {
            if (
                nftRegistry.isWhitelisted(nftAddress, nftID) &&
                !_isFixedSaleListingExpired(fixedSaleListingID) &&
                IERC1155(nftAddress).isApprovedForAll(owner, address(this))
            ) {
                isListed = true;
            }
        }
    }

    function _isFixedSaleListingExpired(
        uint256 fixedSaleListingID
    ) internal view returns (bool isFixedSaleListingExpired) {
        isFixedSaleListingExpired =
            fixedSaleListing[fixedSaleListingID].expiration != 0 &&
            block.timestamp >= fixedSaleListing[fixedSaleListingID].expiration;
    }

    /// @notice list a NFT on fixed price sale
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
        require(price > 0, "Listing : price must higher than zero");
        require(nftRegistry.isWhitelisted(nftAddress, nftID), "Listing : not whitelisted");

        if (NFTIdentifier.isERC721(nftAddress)) {
            require(msg.sender == IERC721(nftAddress).ownerOf(nftID), "Listing : not the owner");
            require(_erc721FixedSaleListingID[nftAddress][nftID] == 0, "Listing : already listed");

            _listFixedSale(true, nftAddress, nftID, msg.sender, price, expiration, 1);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(
                quantity <=
                    IERC1155(nftAddress).balanceOf(msg.sender, nftID).sub(
                        _erc1155FixedSaleListingID[nftAddress][nftID][msg.sender].totalQuantity
                    ),
                "Listing : not the owner or quantity already listed"
            );
            _listFixedSale(false, nftAddress, nftID, msg.sender, price, expiration, quantity);
        }
    }

    function _listFixedSale(
        bool isERC721,
        address nftAddress,
        uint256 nftID,
        address owner,
        uint256 price,
        uint256 expiration,
        uint256 quantity
    ) internal {
        fixedSaleListing[_fixedSaleListingID].nftAddress = nftAddress;
        fixedSaleListing[_fixedSaleListingID].nftID = nftID;
        fixedSaleListing[_fixedSaleListingID].owner = owner;
        fixedSaleListing[_fixedSaleListingID].price = price;
        fixedSaleListing[_fixedSaleListingID].expiration = expiration;
        fixedSaleListing[_fixedSaleListingID].quantity = quantity;

        if (isERC721) {
            _erc721FixedSaleListingID[nftAddress][nftID] = _fixedSaleListingID;
        } else {
            _erc1155FixedSaleListingOwners[nftAddress][nftID].add(owner);
            _erc1155FixedSaleListingID[nftAddress][nftID][owner].totalQuantity = _erc1155FixedSaleListingID[nftAddress][
                nftID
            ][owner].totalQuantity.add(quantity);
            _erc1155FixedSaleListingID[nftAddress][nftID][owner].erc1155FixedSaleListingIDs.add(_fixedSaleListingID);
        }

        _fixedSaleListingID = _fixedSaleListingID.add(1);

        emit ListedFixedSale(nftAddress, nftID, owner, price, expiration, quantity);
    }

    /// @notice unlist a NFT from fixed price sale
    /// @param fixedSaleListingID ID of fixed sale to unlist
    /// @param quantity quantity to unlist in case of ERC1155
    function unlistFixedSale(uint256 fixedSaleListingID, uint256 quantity) external {
        address nftAddress = fixedSaleListing[fixedSaleListingID].nftAddress;
        require(nftAddress != address(0), "Listing : not listed");
        address owner = fixedSaleListing[fixedSaleListingID].owner;

        if (NFTIdentifier.isERC721(nftAddress)) {
            require(msg.sender == owner, "Listing : not the owner");
            _unlistFixedSale(
                true,
                fixedSaleListingID,
                nftAddress,
                fixedSaleListing[fixedSaleListingID].nftID,
                owner,
                1
            );
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(msg.sender == owner, "Listing : not the owner");
            require(quantity <= fixedSaleListing[fixedSaleListingID].quantity, "Listing : quantity not listed");
            _unlistFixedSale(
                false,
                fixedSaleListingID,
                nftAddress,
                fixedSaleListing[fixedSaleListingID].nftID,
                owner,
                quantity
            );
        }
    }

    function _unlistFixedSale(
        bool isERC721,
        uint256 fixedSaleListingID,
        address nftAddress,
        uint256 nftID,
        address owner,
        uint256 quantity
    ) internal {
        if (isERC721) {
            _erc721FixedSaleListingID[nftAddress][nftID] = 0;
            delete fixedSaleListing[fixedSaleListingID];
        } else {
            uint256 newQuantity = fixedSaleListing[fixedSaleListingID].quantity.uncheckedSub(quantity);
            _erc1155FixedSaleListingID[nftAddress][nftID][owner].totalQuantity = _erc1155FixedSaleListingID[nftAddress][
                nftID
            ][owner].totalQuantity.uncheckedSub(quantity);

            if (newQuantity == 0) {
                delete fixedSaleListing[fixedSaleListingID];

                if (_erc1155FixedSaleListingID[nftAddress][nftID][owner].totalQuantity == 0) {
                    _erc1155FixedSaleListingOwners[nftAddress][nftID].remove(owner);
                    _erc1155FixedSaleListingID[nftAddress][nftID][owner].erc1155FixedSaleListingIDs.remove(
                        fixedSaleListingID
                    );
                }
            } else {
                fixedSaleListing[fixedSaleListingID].quantity = newQuantity;
            }
        }

        emit UnlistedFixedSale(nftAddress, nftID, owner, quantity);
    }

    /// @notice this function allow user to buy at fixed sale a NFT
    /// @notice conditions for buying to not revert are the following :
    /// @notice 1. NFT is listed by owner
    /// @notice 2. NFT is whitelisted by plateform
    /// @notice 3. NFT is approved by owner to plateform
    /// @param fixedSaleListingID ID of fixed sale to purchase
    /// @param quantity quantity to purchase in case of ERC1155
    // TODO LISTING group the conditions to one view function to know if NFT can be bought, for lists view
    function buyFixedSale(uint256 fixedSaleListingID, uint256 quantity) external payable {
        address nftAddress = fixedSaleListing[fixedSaleListingID].nftAddress;
        uint256 nftID = fixedSaleListing[fixedSaleListingID].nftID;
        address owner = fixedSaleListing[fixedSaleListingID].owner;
        uint256 price = fixedSaleListing[fixedSaleListingID].price;
        uint256 commission = price.mul(commissionPercentage).uncheckedDiv(100);

        require(nftRegistry.isWhitelisted(nftAddress, nftID), "Listing : not whitelisted");
        require(!_isFixedSaleListingExpired(fixedSaleListingID), "Listing : listing expired");

        if (NFTIdentifier.isERC721(nftAddress)) {
            require(msg.value == price.add(commission), "Listing : not enought ISLM");

            _unlistFixedSale(true, fixedSaleListingID, nftAddress, nftID, owner, 1);

            IERC721(nftAddress).safeTransferFrom(owner, msg.sender, nftID, "");
            payable(owner).transfer(price);
            payable(daoAddress).transfer(commission);
        } else if (NFTIdentifier.isERC1155(nftAddress)) {
            require(quantity <= fixedSaleListing[nftID].quantity, "Listing : quantity not listed");
            require(msg.value == (price.add(commission)).mul(quantity), "Listing : not enought ISLM");

            _unlistFixedSale(false, fixedSaleListingID, nftAddress, nftID, owner, quantity);

            IERC1155(nftAddress).safeTransferFrom(owner, msg.sender, nftID, quantity, "");
            payable(owner).transfer(price.mul(quantity));
            payable(daoAddress).transfer(commission.mul(quantity));
        }

        emit BoughtFixedSale(nftAddress, nftID, msg.sender, quantity);
    }

    function setCommissionPercentage(uint256 newCommissionPercentage) external onlyOwner {
        commissionPercentage = newCommissionPercentage;
    }

    // =================
    // ||   AUCTION   ||
    // =================

    /// @notice list a NFT on english auction sale
    function listAuctionSale() external {}

    /// @notice unlist a NFT from english auction sale
    function unlistAuctionSale(address nftAddress, uint256 nftID) external {}
}
