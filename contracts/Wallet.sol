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

    mapping(uint256 => Balance) public balances;
    uint256 public plateformBalance;

    event Deposited(uint256 mintingID, address indexed sender, uint256 amount);
    event Withdrawn(uint256 mintingID, address indexed recipient, uint256 amount);

    modifier onlyAutorized() {
        require(msg.sender == address(nftRegistry), "W: wrong caller");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init();
    }

    function setDependencies(address registryAddress) external onlyOwner {
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
        daoAddress = Registry(registryAddress).getContract("DAO");
    }

    /// @notice deposit funds for particular minting request
    /// @dev user should send amount in msg.value
    /// @param mintingID ID of minting request
    function deposit(uint256 mintingID) external payable {
        require(
            balances[mintingID].wallet == address(0) || balances[mintingID].wallet == msg.sender,
            "W: not autorised"
        );

        _deposit(mintingID, msg.sender, msg.value);
    }

    function _deposit(uint256 mintingID, address sender, uint256 amount) internal {
        balances[mintingID].wallet = sender;
        balances[mintingID].locked += amount;

        emit Deposited(mintingID, sender, amount);
    }

    /// @notice withdraw funds for particular minting request
    /// @param mintingID ID of minting request
    function withdraw(uint256 mintingID) external {
        require(balances[mintingID].wallet == msg.sender, "W: not autorised");
        require(balances[mintingID].available > 0, "W: nothing to withdraw");

        _withdraw(mintingID, msg.sender);
    }

    function _withdraw(uint256 mintingID, address receiver) internal {
        uint256 amount = balances[mintingID].available;
        balances[mintingID].available = 0;
        (bool successReceiver, ) = payable(receiver).call{value: amount}("");
        require(successReceiver, "Failed to pay receiver");

        emit Withdrawn(mintingID, msg.sender, amount);
    }

    /// @dev called when approve or decline to update balances in contract
    /// @param mintingID ID of minting request
    /// @param gasFee cost of minting transaction
    /// @param unlock true if approved, false if declined
    function updateBalance(uint256 mintingID, uint256 gasFee, bool unlock) external override onlyAutorized {
        uint256 amount = balances[mintingID].locked;
        balances[mintingID].locked = 0;
        if (amount > 0) {
            if (!unlock) {
                (bool successDAO, ) = payable(daoAddress).call{value: amount}("");
                require(successDAO, "Failed to pay daoAddress");
            } else if (gasFee > 0) {
                balances[mintingID].available = amount - gasFee;
                plateformBalance += gasFee;
            }
        }
    }

    /// @notice withdraw refunds of minting transaction costs
    function withdrawPlateformBalance() external onlyOwner {
        uint256 amount = plateformBalance;
        plateformBalance = 0;
        (bool successPlateform, ) = payable(msg.sender).call{value: amount}("");
        require(successPlateform, "Failed to pay plateform");
    }
}
