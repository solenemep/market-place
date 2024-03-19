//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IERCH {
    struct Royalties {
        address nftCreator;
        uint256 royaltyPercent;
    }

    function royalties(uint256 tokenId) external view returns (address nftCreator, uint256 royaltyPercent);

    /**
     * @dev Returns if the `operator` is allowed to manage all of the assets of `owner`.
     *
     * See {setApprovalForAll}
     */
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}
