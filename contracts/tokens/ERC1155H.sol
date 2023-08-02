// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

import "../helpers/Registry.sol";
import "../interfaces/tokens/IERC1155H.sol";

import "../interfaces/INFTRegistry.sol";

contract ERC1155H is IERC1155H, ERC1155URIStorage, Ownable {
    INFTRegistry public nftRegistry;

    constructor(string memory uri) ERC1155(uri) {}

    function setDependencies(address registryAddress) external onlyOwner {
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
    }

    function mint(address to, uint256 id, uint256 value, bytes memory data) external onlyOwner {
        _mint(to, id, value, data);
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) external onlyOwner {
        _mintBatch(to, ids, values, data);
    }

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param owner Address of the current owner of a token.
     */
    error ERC1155MissingApprovalForAll(address operator, address owner);

    function burn(address account, uint256 id, uint256 value) public {
        if (account != _msgSender() && !isApprovedForAll(account, _msgSender())) {
            revert ERC1155MissingApprovalForAll(_msgSender(), account);
        }
        _burn(account, id, value);

        nftRegistry.removeWhitelist(address(this), id);
    }

    function burnBatch(address account, uint256[] memory ids, uint256[] memory values) public {
        if (account != _msgSender() && !isApprovedForAll(account, _msgSender())) {
            revert ERC1155MissingApprovalForAll(_msgSender(), account);
        }
        _burnBatch(account, ids, values);

        address[] memory nftAddresses = new address[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            nftAddresses[i] = address(this);
        }
        nftRegistry.removeWhitelistBatch(nftAddresses, ids);
    }
}
