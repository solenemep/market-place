// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import "./interfaces/INFTIdentifier.sol";

contract NFTIdentifier is INFTIdentifier {
    using ERC165Checker for address;
    bytes4 public constant IID_ITEST = type(INFTIdentifier).interfaceId;
    bytes4 public constant IID_IERC165 = type(IERC165).interfaceId;
    bytes4 public constant IID_IERC721 = type(IERC721).interfaceId;
    bytes4 public constant IID_IERC1155 = type(IERC1155).interfaceId;

    function isERC721(address nftAddress) external view override returns (bool) {
        return nftAddress.supportsInterface(IID_IERC721);
    }

    function isERC1155(address nftAddress) external view override returns (bool) {
        return nftAddress.supportsInterface(IID_IERC1155);
    }
}
