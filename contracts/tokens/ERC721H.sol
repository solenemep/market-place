// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";

import "../interfaces/tokens/IERC721H.sol";

contract ERC721H is IERC721H, ERC721Burnable, Ownable {
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}
}
