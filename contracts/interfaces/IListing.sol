//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IListing {
    enum List {
        FIXED_SALE,
        AUCTION_SALE
    }

    struct SaleListing {
        address nftAddress;
        uint256 nftID;
        address nftOwner;
        uint256 price;
        uint256 startTime;
        uint256 endTime;
        uint256 quantity;
    }

    struct ERC1155SaleID {
        uint256 totalQuantity;
        EnumerableSet.UintSet erc1155SaleListingIDs;
    }

    function saleListing(
        uint256 saleListingID
    )
        external
        view
        returns (
            address nftAddress,
            uint256 nftID,
            address nftOwner,
            uint256 price,
            uint256 startTime,
            uint256 endTime,
            uint256 quantity
        );

    function unlist(bool isERC721, uint256 saleListingID, address nftAddress, uint256 nftID, address nftOwner) external;

    function isOnAuctionSale(uint256 saleListingID) external view returns (bool);
}
