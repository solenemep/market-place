// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "../helpers/Registry.sol";
import "../interfaces/tokens/IERC1155H.sol";

import "../interfaces/INFTRegistry.sol";

contract ERC1155H is IERC1155H, ERC1155, Ownable, EIP712 {
    using Counters for Counters.Counter;

    string private constant _SIGNING_DOMAIN_NAME = "ERC1155H";
    string private constant _SIGNING_DOMAIN_VERSION = "1";

    bytes32 private constant _ERC1155HDATA_TYPEHASH = keccak256("ERC1155HData(address to,uint256 value)");

    INFTRegistry public nftRegistry;

    Counters.Counter private _tokenIds;

    struct ERC1155HData {
        address to;
        uint256 value;
        bytes signature;
    }

    constructor(string memory uri) ERC1155(uri) EIP712(_SIGNING_DOMAIN_NAME, _SIGNING_DOMAIN_VERSION) {}

    function setDependencies(address registryAddress) external onlyOwner {
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
    }

    function recover(ERC1155HData calldata erc1155HData) public view returns (address) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(_ERC1155HDATA_TYPEHASH, erc1155HData.to, erc1155HData.value))
        );
        address signer = ECDSA.recover(digest, erc1155HData.signature);
        return signer;
    }

    function mint(ERC1155HData calldata erc1155HData) external onlyOwner returns (uint256 tokenId) {
        address signer = recover(erc1155HData);
        require(signer == erc1155HData.to, "ERC1155H : wrong signature");

        tokenId = _tokenIds.current();
        _mint(signer, tokenId, erc1155HData.value, "");

        _tokenIds.increment();
    }

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param owner Address of the current owner of a token.
     */
    error ERC1155MissingApprovalForAll(address operator, address owner);

    function burn(address account, uint256 tokenId, uint256 value) public {
        if (account != _msgSender() && !isApprovedForAll(account, _msgSender())) {
            revert ERC1155MissingApprovalForAll(_msgSender(), account);
        }
        _burn(account, tokenId, value);

        nftRegistry.removeWhitelist(address(this), tokenId);
    }

    function burnBatch(address account, uint256[] memory tokenIds, uint256[] memory values) public {
        if (account != _msgSender() && !isApprovedForAll(account, _msgSender())) {
            revert ERC1155MissingApprovalForAll(_msgSender(), account);
        }
        _burnBatch(account, tokenIds, values);

        address[] memory nftAddresses = new address[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            nftAddresses[i] = address(this);
        }
        nftRegistry.removeWhitelistBatch(nftAddresses, tokenIds);
    }
}
