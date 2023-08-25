//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IListing {
    enum List {
        NONE,
        FIXED_SALE,
        AUCTION_SALE
    }

    struct SaleListing {
        List list;
        address nftAddress;
        uint256 nftID;
        address owner;
        uint256 price;
        uint256 startTime;
        uint256 endTime;
        uint256 quantity;
    }

    struct ERC1155SaleID {
        uint256 totalQuantity;
        EnumerableSet.UintSet erc1155SaleListingIDs;
    }

    function unlistAuctionSale(uint256 saleListingID, uint256 quantity) external;
}
