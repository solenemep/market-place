// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "../helpers/Registry.sol";
import "../interfaces/tokens/IERC721H.sol";

import "../interfaces/INFTRegistry.sol";

/// @author @solenemep

contract ERC721H is IERC721H, ERC721URIStorage, Ownable, EIP712 {
    using Counters for Counters.Counter;

    string private constant _SIGNING_DOMAIN_NAME = "ERC721H";
    string private constant _SIGNING_DOMAIN_VERSION = "1";

    bytes32 private constant _ERC721HDATA_TYPEHASH =
        keccak256("ERC721HData(address to,string tokenURI,uint256 royaltyPercent)");

    uint256 public constant ROYALTY_LIMIT = 10;

    INFTRegistry public nftRegistry;

    address public systemAddress;

    Counters.Counter private _tokenIds;

    mapping(uint256 => Royalties) public override royalties; // tokenId -> Royalties

    event TokenDeployed(address nftAddress);

    constructor(
        string memory name,
        string memory symbol,
        address _systemAddress
    ) ERC721(name, symbol) EIP712(_SIGNING_DOMAIN_NAME, _SIGNING_DOMAIN_VERSION) {
        systemAddress = _systemAddress;

        emit TokenDeployed(address(this));
    }

    function setDependencies(address registryAddress) external {
        require(msg.sender == owner() || msg.sender == systemAddress, 'ERC721H: wrong caller');
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
    }

    function recover(ERC721HData calldata erc721HData) public view returns (address) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _ERC721HDATA_TYPEHASH,
                    erc721HData.to,
                    keccak256(bytes(erc721HData.tokenURI)),
                    erc721HData.royaltyPercent
                )
            )
        );
        address signer = ECDSA.recover(digest, erc721HData.signature);
        return signer;
    }

    function mint(ERC721HData calldata erc721HData) external returns (uint256 tokenId) {
        address signer = recover(erc721HData);
        require(msg.sender == systemAddress, "ERC721H: wrong caller");
        require(signer == erc721HData.to, "ERC721H: wrong signature");
        require(
            0 <= erc721HData.royaltyPercent && erc721HData.royaltyPercent <= ROYALTY_LIMIT,
            "ERC721H: Wrong royalty"
        );

        tokenId = _tokenIds.current();
        _safeMint(erc721HData.to, tokenId);
        _setTokenURI(tokenId, erc721HData.tokenURI);
        _setRoyalties(tokenId, signer, erc721HData.royaltyPercent);

        _tokenIds.increment();
    }

    function setSystemAddress(address target) external {
        require(msg.sender == systemAddress, "ERC721H: wrong caller");
        systemAddress = target;
    }

    function _setRoyalties(uint256 tokenId, address signer, uint256 royaltyPercent) internal {
        royalties[tokenId] = Royalties({nftCreator: signer, royaltyPercent: royaltyPercent});
    }

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their nftOwner.
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
