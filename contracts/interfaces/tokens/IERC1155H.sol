//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IERC1155H {
    struct ERC1155HData {
        address to;
        uint256 value;
        string tokenURI;
        uint256 royaltyPercent;
        bytes signature;
    }

    struct Royalties {
        address nftCreator;
        uint256 royaltyPercent;
    }

    function royalties(uint256 tokenId) external view returns (address nftCreator, uint256 royaltyPercent);
}
