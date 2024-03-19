// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "../helpers/Registry.sol";
import "../interfaces/tokens/IERC1155H.sol";

import "../interfaces/INFTRegistry.sol";

/// @author @solenemep

contract ERC1155H is IERC1155H, ERC1155URIStorage, Ownable, EIP712 {
    using Counters for Counters.Counter;

    string private constant _SIGNING_DOMAIN_NAME = "ERC1155H";
    string private constant _SIGNING_DOMAIN_VERSION = "1";

    bytes32 private constant _ERC1155HDATA_TYPEHASH =
    keccak256("ERC1155HData(address to,uint256 value,string tokenURI,uint256 royaltyPercent)");

    uint256 public constant ROYALTY_LIMIT = 10;

    INFTRegistry public nftRegistry;

    Counters.Counter private _tokenIds;

    address public systemAddress;

    mapping(uint256 => Royalties) public override royalties; // tokenId -> Royalties

    mapping(uint256 => uint256) public totalSupply;

    event TokenDeployed(address nftAddress);

    constructor(string memory uri, address _systemAddress) ERC1155(uri) EIP712(_SIGNING_DOMAIN_NAME, _SIGNING_DOMAIN_VERSION) {
        systemAddress = _systemAddress;

        emit TokenDeployed(address(this));
    }

    function setDependencies(address registryAddress) external {
        require(msg.sender == owner() || msg.sender == systemAddress, 'ERC1155H: wrong caller');
        nftRegistry = INFTRegistry(Registry(registryAddress).getContract("NFT_REGISTRY"));
    }

    function recover(ERC1155HData calldata erc1155HData) public view returns (address) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _ERC1155HDATA_TYPEHASH,
                    erc1155HData.to,
                    erc1155HData.value,
                    keccak256(bytes(erc1155HData.tokenURI)),
                    erc1155HData.royaltyPercent
                )
            )
        );
        address signer = ECDSA.recover(digest, erc1155HData.signature);
        return signer;
    }

    function mint(ERC1155HData calldata erc1155HData) external returns (uint256 tokenId) {
        address signer = recover(erc1155HData);
        require(msg.sender == systemAddress, "ERC1155H: wrong caller");
        require(signer == erc1155HData.to, "ERC1155H: wrong signature");
        require(
            0 <= erc1155HData.royaltyPercent && erc1155HData.royaltyPercent <= ROYALTY_LIMIT,
            "ERC1155H: Wrong royalty"
        );

        tokenId = _tokenIds.current();
        _mint(erc1155HData.to, tokenId, erc1155HData.value, "");
        _setURI(tokenId, erc1155HData.tokenURI);
        _setRoyalties(tokenId, signer, erc1155HData.royaltyPercent);
        totalSupply[tokenId] = erc1155HData.value;

        _tokenIds.increment();
    }

    function setSystemAddress(address target) external {
        require(msg.sender == systemAddress, "ERC1155H: wrong caller");
        systemAddress = target;
    }

    function _setRoyalties(uint256 tokenId, address signer, uint256 royaltyPercent) internal {
        royalties[tokenId] = Royalties({nftCreator: signer, royaltyPercent: royaltyPercent});
    }

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their nftOwner.
     * @param nftOwner Address of the current nftOwner of a token.
     */
    error ERC1155MissingApprovalForAll(address operator, address nftOwner);

    function burn(address account, uint256 tokenId, uint256 value) public {
        if (account != _msgSender() && !isApprovedForAll(account, _msgSender())) {
            revert ERC1155MissingApprovalForAll(_msgSender(), account);
        }
        _burn(account, tokenId, value);

        totalSupply[tokenId] -= value;

        if (totalSupply[tokenId] == 0) {
            nftRegistry.removeWhitelist(address(this), tokenId);
        }
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
