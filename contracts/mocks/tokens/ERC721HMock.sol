// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../../tokens/ERC721H.sol";

contract ERC721HMock is ERC721H {
    constructor(string memory name, string memory symbol) ERC721H(name, symbol) {}

    function mintMock(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }
}
