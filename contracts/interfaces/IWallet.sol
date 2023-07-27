//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IWallet {
    struct Balance {
        address wallet;
        uint256 locked;
        uint256 available;
    }

    function updateBalance(uint256 mintingID, uint256 gasFee, bool unlock) external;
}
