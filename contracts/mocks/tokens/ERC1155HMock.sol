// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../../tokens/ERC1155H.sol";

contract ERC1155HMock is ERC1155H {
    constructor(string memory uri) ERC1155H(uri) {}

    function mintMock(address to, uint256 id, uint256 value, bytes memory data) external onlyOwner {
        _mint(to, id, value, data);
    }
}
