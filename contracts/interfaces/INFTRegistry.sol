//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface INFTRegistry {
    function isWhitelisted(address nftAddress, uint256 nftID) external view returns (bool);

    function removeWhitelist(address nftAddress, uint256 nftID) external;

    function removeWhitelistBatch(address[] memory nftAddresses, uint256[] memory nftIDs) external;
}
