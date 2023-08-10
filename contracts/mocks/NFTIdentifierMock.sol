// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../libraries/NFTIdentifier.sol";

contract NFTIdentifierMock {
    using NFTIdentifier for address;

    function isERC721(address nftAddress) external view returns (bool) {
        return NFTIdentifier.isERC721(nftAddress);
    }

    function isERC1155(address nftAddress) external view returns (bool) {
        return NFTIdentifier.isERC1155(nftAddress);
    }
}
