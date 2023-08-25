// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../Listing.sol";

contract ListingMock is Listing {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    function erc721SaleListingID(address nftAddress, uint256 nftID) external view returns (uint256) {
        return _erc721SaleListingID[nftAddress][nftID];
    }

    function erc1155SaleListingOwners(
        address nftAddress,
        uint256 nftID
    ) external view returns (address[] memory array) {
        uint256 length = _erc1155SaleListingOwners[nftAddress][nftID].length();
        array = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            array[i] = _erc1155SaleListingOwners[nftAddress][nftID].at(i);
        }
        return array;
    }

    function erc1155SaleListingID(
        address nftAddress,
        uint256 nftID,
        address owner
    ) external view returns (uint256 totalQuantity, uint256[] memory erc1155SaleListingIDs) {
        totalQuantity = _erc1155SaleListingID[nftAddress][nftID][owner].totalQuantity;

        uint256 length = _erc1155SaleListingID[nftAddress][nftID][owner].erc1155SaleListingIDs.length();
        erc1155SaleListingIDs = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            erc1155SaleListingIDs[i] = _erc1155SaleListingID[nftAddress][nftID][owner].erc1155SaleListingIDs.at(i);
        }
    }
}
