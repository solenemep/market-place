//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface INFTRegistry {
    function isWhitelisted(address nftAddress, uint256 nftID) external view returns (bool);

    function countNFTAddresses() external view returns (uint256);

    function countNFTIDs(address nftAddress) external view returns (uint256);

    function getNFTAddresses(uint256 offset, uint256 limit) external view returns (address[] memory nftAddresses);

    function getNFTIDs(address nftAddress, uint256 offset, uint256 limit) external view returns (uint[] memory nftIDs);

    function addWhitelist(address nftAddress, uint256 nftID) external;

    function addWhitelistBatch(address[] memory nftAddresses, uint256[] memory nftIDs) external;

    function removeWhitelist(address nftAddress, uint256 nftID) external;

    function removeWhitelistBatch(address[] memory nftAddresses, uint256[] memory nftIDs) external;
}
