//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./helpers/Registry.sol";
import "./interfaces/IWallet.sol";

/// @title Wallet
/// @notice This contract carries all deposit and withdraw logic
/// @dev TODO Check if needed to fusion with NFTRegistry.sol

contract Wallet is IWallet, OwnableUpgradeable {
    function __Wallet_init() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {}

    receive() external payable {
        // _deposit(msg.sender, msg.value);
    }

    fallback() external {}

    function deposit() external payable {
        //  _deposit(msg.sender, msg.value);
    }

    // function withdraw() external {
    //     uint256 amount = _balances[msg.sender];
    //     _withdraw(msg.sender, amount);
    // }

    // function withdrawAmount(uint256 amount) public {
    //     _withdraw(msg.sender, amount);
    // }

    // function _deposit(address sender, uint256 amount) private {
    //     _balances[sender] += amount;
    //     emit Deposited(sender, amount);
    // }

    // function _withdraw(address recipient, uint256 amount) private {
    //     require(_balances[recipient] > 0, "SmartWallet: can not withdraw 0 ether");
    //     require(_balances[recipient] >= amount, "SmartWallet: Not enough Ether");
    //     uint256 fees = 0;
    //     if (_vipMembers[recipient] != true) {
    //         fees = _calculateFees(amount, _tax);
    //     }
    //     uint256 newAmount = amount - fees;
    //     _balances[recipient] -= amount;
    //     _profit += fees;
    //     _totalProfit += fees;
    //     payable(msg.sender).sendValue(newAmount);
    //     emit Withdrew(msg.sender, newAmount);
    // }
}
