// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Test credits only. No cash value, redemption rights, or stablecoin backing.
contract MockToken is ERC20, Ownable2Step {
    uint256 public constant MAX_SUPPLY = 1_000_000 ether;
    error SupplyCapExceeded();

    constructor(address initialOwner) ERC20("Demo Credits", "DCR") Ownable(initialOwner) {}

    function mint(address to, uint256 amount) external onlyOwner {
        if (amount > MAX_SUPPLY - totalSupply()) revert SupplyCapExceeded();
        _mint(to, amount);
    }
}
