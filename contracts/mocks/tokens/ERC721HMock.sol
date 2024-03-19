// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../../tokens/ERC721H.sol";

contract ERC721HMock is ERC721H {
    constructor(string memory name, string memory symbol, address _systemAddress) ERC721H(name, symbol, _systemAddress) {}

    function mintMock(address to, uint256 tokenId, uint256 royaltyPercent) external {
        _safeMint(to, tokenId);
        _setRoyalties(tokenId, msg.sender, royaltyPercent);
    }
}
