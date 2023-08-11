//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IListing {
    enum List {
        NONE,
        FIXED_SALE,
        AUCTION_SALE
    }

    struct FixedSaleListing {
        uint256 price;
        uint256 expiration;
        uint256 quantity;
    }

    function unlistFixedSale(address nftAddress, uint256 nftID) external;
}
