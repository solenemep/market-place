//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface INFTRegistry {
    function isWhitelisted(address contractAddress) external view returns (bool);

    function countAllWhitelisted() external view returns (uint256);

    function getAllWhitelisted(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory whitelistedContracts);

    function addWhitelist(address contractAddress) external;

    function removeWhitelist(address contractAddress) external;
}
