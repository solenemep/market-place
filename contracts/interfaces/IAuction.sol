//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IAuction {
    struct HighestBid {
        address highestBidder;
        uint256 highestBidAmount;
    }

    function hasBids(uint256 saleListingID) external view returns (bool);

    function createAuction(uint256 saleListingID, uint256 minPrice) external;
}
