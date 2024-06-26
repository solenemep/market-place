//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IERC721H {
    struct ERC721HData {
        address to;
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
