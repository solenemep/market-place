//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IListing {
    enum List {
        FIXED_SALE,
        AUCTION_SALE
    }

    struct FixedSaleListing {
        address nftAddress;
        uint256 nftID;
        address owner;
        uint256 price;
        uint256 expiration;
        uint256 quantity;
    }

    struct ERC1155FixedSaleID {
        uint256 totalQuantity;
        EnumerableSet.UintSet erc1155FixedSaleListingIDs;
    }
}
