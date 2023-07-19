//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface INFTIdentifier {
    function isERC721(address nftAddress) external returns (bool);

    function isERC1155(address nftAddress) external returns (bool);
}
