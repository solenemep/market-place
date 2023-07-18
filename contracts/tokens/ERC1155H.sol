// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";

contract ERC1155H is ERC1155Burnable {
    constructor(string memory uri) ERC1155(uri) {}
}
