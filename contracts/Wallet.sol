//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./helpers/Registry.sol";
import "./interfaces/IWallet.sol";

import "./interfaces/INFTRegistry.sol";

/// @author @solenemep
/// @title Wallet
/// @notice This contract carries all deposit and withdraw logic

contract Wallet is IWallet, OwnableUpgradeable {
    using Address for address payable;

    INFTRegistry public nftRegistry;

    address public daoAddress;

    mapping(uint256 => Balance) public balances; // minting request id -> locked / unlocked funds
    uint256 public plateformBalance;

    event Deposited(uint256 mintingID, address indexed sender, uint256 amount);
    event Withdrawn(uint256 mintingID, address indexed recipient, uint256 amount);

    modifier onlyAutorized() {
        require(msg.sender == address(nftRegistry), "Wallet : wrong caller");
        _;
    }

    function __Wallet_init() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
        daoAddress = Registry(registryAddress).getContract("DAO");
    }

    function deposit(uint256 mintingID) external payable {
        require(
            balances[mintingID].wallet == address(0) || balances[mintingID].wallet == msg.sender,
            "Wallet : not autorised"
        );

        _deposit(mintingID, msg.sender, msg.value);
    }

    function _deposit(uint256 mintingID, address sender, uint256 amount) internal {
        balances[mintingID].wallet = sender;
        balances[mintingID].locked += amount;

        emit Deposited(mintingID, sender, amount);
    }

    function withdraw(uint256 mintingID) external {
        require(balances[mintingID].wallet == msg.sender, "Wallet : not autorised");
        require(balances[mintingID].available > 0, "Wallet : nothing to withdraw");

        _withdraw(mintingID, msg.sender);
    }

    function _withdraw(uint256 mintingID, address receiver) internal {
        uint256 amount = balances[mintingID].available;
        balances[mintingID].available = 0;
        payable(receiver).sendValue(amount);

        emit Withdrawn(mintingID, msg.sender, amount);
    }

    function updateBalance(uint256 mintingID, uint256 gasFee, bool unlock) external override onlyAutorized {
        uint256 amount = balances[mintingID].locked;
        balances[mintingID].locked = 0;
        if (amount > 0) {
            if (unlock) {
                balances[mintingID].available = amount - gasFee;
                plateformBalance += gasFee;
            } else {
                payable(daoAddress).sendValue(amount);
            }
        }
    }

    function withdrawPlateformBalance() external onlyOwner {
        uint256 amount = plateformBalance;
        plateformBalance = 0;
        payable(msg.sender).sendValue(amount);
    }
}
