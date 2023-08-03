// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "../helpers/Registry.sol";
import "../interfaces/tokens/IERC721H.sol";

import "../interfaces/INFTRegistry.sol";

contract ERC721H is IERC721H, ERC721, Ownable, EIP712 {
    using Counters for Counters.Counter;

    string private constant _SIGNING_DOMAIN_NAME = "ERC721H";
    string private constant _SIGNING_DOMAIN_VERSION = "1";

    bytes32 private constant _ERC721HDATA_TYPEHASH = keccak256("ERC721HData(address to)");

    INFTRegistry public nftRegistry;

    Counters.Counter private _tokenIds;

    struct ERC721HData {
        address to;
        bytes signature;
    }

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) EIP712(_SIGNING_DOMAIN_NAME, _SIGNING_DOMAIN_VERSION) {}

    function setDependencies(address registryAddress) external onlyOwner {
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
    }

    function recover(ERC721HData calldata erc721HData) public view returns (address) {
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(_ERC721HDATA_TYPEHASH, erc721HData.to)));
        address signer = ECDSA.recover(digest, erc721HData.signature);
        return signer;
    }

    function mint(ERC721HData calldata erc721HData) external onlyOwner returns (uint256 tokenId) {
        address signer = recover(erc721HData);
        require(signer == erc721HData.to, "ERC721H : wrong signature");

        tokenId = _tokenIds.current();
        _safeMint(signer, tokenId);

        _tokenIds.increment();
    }

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param tokenId Identifier number of a token.
     */
    error ERC721InsufficientApproval(address operator, uint256 tokenId);

    /**
     * @dev Burns `tokenId`. See {ERC721-_burn}.
     *
     * Requirements:
     *
     * - The caller must own `tokenId` or be an approved operator.
     */
    function burn(uint256 tokenId) public {
        if (!_isApprovedOrOwner(_msgSender(), tokenId)) {
            revert ERC721InsufficientApproval(_msgSender(), tokenId);
        }
        _burn(tokenId);

        nftRegistry.removeWhitelist(address(this), tokenId);
    }
}
