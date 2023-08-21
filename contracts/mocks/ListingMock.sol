// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../Listing.sol";

contract ListingMock is Listing {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    function erc721FixedSaleListingID(address nftAddress, uint256 nftID) external view returns (uint256) {
        return _erc721FixedSaleListingID[nftAddress][nftID];
    }

    function erc1155FixedSaleListingOwners(
        address nftAddress,
        uint256 nftID
    ) external view returns (address[] memory array) {
        uint256 length = _erc1155FixedSaleListingOwners[nftAddress][nftID].length();
        array = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            array[i] = _erc1155FixedSaleListingOwners[nftAddress][nftID].at(i);
        }
        return array;
    }

    function erc1155FixedSaleListingID(
        address nftAddress,
        uint256 nftID,
        address owner
    ) external view returns (uint256 totalQuantity, uint256[] memory erc1155FixedSaleListingIDs) {
        totalQuantity = _erc1155FixedSaleListingID[nftAddress][nftID][owner].totalQuantity;

        uint256 length = _erc1155FixedSaleListingID[nftAddress][nftID][owner].erc1155FixedSaleListingIDs.length();
        erc1155FixedSaleListingIDs = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            erc1155FixedSaleListingIDs[i] = _erc1155FixedSaleListingID[nftAddress][nftID][owner]
                .erc1155FixedSaleListingIDs
                .at(i);
        }
    }
}
