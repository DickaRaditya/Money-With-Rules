// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Classification is a trusted off-chain process; the result is enforced on chain.
contract MerchantRegistry is Ownable2Step {
    enum MerchantType { FOOD, EDUCATION, TRANSPORT, OTHER }
    struct Merchant { uint8 categoryMask; bool suspended; }
    mapping(address => Merchant) public merchants;
    mapping(uint8 => bool) public categoryEnabled;

    error InvalidMerchant();
    error InvalidCategory();
    event MerchantUpdated(address indexed merchant, uint8 categoryMask);
    event MerchantSuspended(address indexed merchant, bool suspended);
    event MerchantRevoked(address indexed merchant);
    event CategoryUpdated(uint8 indexed category, bool enabled);

    constructor(address initialOwner) Ownable(initialOwner) {
        for (uint8 i; i < 4; ++i) categoryEnabled[i] = true;
    }

    function setMerchant(address merchant, uint8 categoryMask) external onlyOwner {
        if (merchant == address(0)) revert InvalidMerchant();
        if (categoryMask == 0 || categoryMask > 15) revert InvalidCategory();
        // Category grants do not silently undo a suspension.
        merchants[merchant].categoryMask = categoryMask;
        emit MerchantUpdated(merchant, categoryMask);
    }

    function setSuspended(address merchant, bool suspended) external onlyOwner {
        if (merchants[merchant].categoryMask == 0) revert InvalidMerchant();
        merchants[merchant].suspended = suspended;
        emit MerchantSuspended(merchant, suspended);
    }

    function revokeMerchant(address merchant) external onlyOwner {
        delete merchants[merchant];
        emit MerchantRevoked(merchant);
    }

    function setCategoryEnabled(uint8 category, bool enabled) external onlyOwner {
        if (category > 3) revert InvalidCategory();
        categoryEnabled[category] = enabled;
        emit CategoryUpdated(category, enabled);
    }

    function isVerified(address merchant) public view returns (bool) {
        Merchant memory m = merchants[merchant];
        return m.categoryMask != 0 && !m.suspended;
    }

    function isAllowed(address merchant, uint8 category) external view returns (bool) {
        return category < 4 && categoryEnabled[category] && isVerified(merchant)
            && (merchants[merchant].categoryMask & uint8(1 << category)) != 0;
    }
}
