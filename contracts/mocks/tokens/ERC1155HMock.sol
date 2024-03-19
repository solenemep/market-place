// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../../tokens/ERC1155H.sol";

contract ERC1155HMock is ERC1155H {
    constructor(string memory uri, address _systemAddress) ERC1155H(uri, _systemAddress) {}

    function mintMock(address to, uint256 id, uint256 value, uint256 royaltyPercent, bytes memory data) external {
        _mint(to, id, value, data);
        _setRoyalties(id, msg.sender, royaltyPercent);
        totalSupply[id] = value;
    }
}
