// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only token to exercise rollback, fees, and malicious transfer callbacks.
contract AdversarialToken is ERC20 {
    uint8 public mode; // 1 false return; 2 fee; 3 callback, propagating failure
    address public target;
    bytes public callData;
    constructor() ERC20("Test attack token", "ATTACK") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function configure(uint8 newMode, address newTarget, bytes calldata data) external {
        mode = newMode; target = newTarget; callData = data;
    }
    function transfer(address to, uint256 value) public override returns (bool) {
        if (mode == 1) return false;
        if (mode == 3) { (bool ok, bytes memory data) = target.call(callData); if (!ok) assembly { revert(add(data, 32), mload(data)) } }
        if (mode == 2) { _burn(msg.sender, 1); return super.transfer(to, value - 1); }
        return super.transfer(to, value);
    }
    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (mode == 1) return false;
        if (mode == 3) { (bool ok, bytes memory data) = target.call(callData); if (!ok) assembly { revert(add(data, 32), mload(data)) } }
        if (mode == 2) { _burn(from, 1); return super.transferFrom(from, to, value - 1); }
        return super.transferFrom(from, to, value);
    }
}
