// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../Listing.sol";

contract ListingMock is Listing {
    function getFixedSaleListing(
        address nftAddress,
        uint256 nftID
    ) external view returns (FixedSaleListing memory fixedSaleListing) {
        fixedSaleListing.price = _fixedSaleListing[nftAddress][nftID].price;
        fixedSaleListing.expiration = _fixedSaleListing[nftAddress][nftID].expiration;
        fixedSaleListing.quantity = _fixedSaleListing[nftAddress][nftID].quantity;
    }
}
