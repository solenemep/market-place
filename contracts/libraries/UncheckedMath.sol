// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

// CAUTION
// This version of UncheckedMath should only be used with Solidity 0.8 or later,
// because it relies on the compiler's built in overflow checks.

library UncheckedMath {
    function uncheckedSub(uint256 a, uint256 b) internal pure returns (uint256) {
        unchecked {
            return a - b;
        }
    }

    function uncheckedDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        unchecked {
            return a / b;
        }
    }
}
