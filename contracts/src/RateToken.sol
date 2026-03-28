// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title RateToken — MANDATE native utility token
/// @notice Settlement layer for all economic activity in MANDATE.
/// @dev RATE is not a gas token — MegaETH uses ETH for gas. RATE is the in-game economic unit.
///      Zero initial supply. All RATE enters circulation via EpochRewardManager faucet drip
///      and milestone bonuses. Burns on tile rent, subscriptions, and premium features.
contract RateToken is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Deploy the RATE token with zero initial supply.
    /// @param admin Address that receives DEFAULT_ADMIN_ROLE and MINTER_ROLE.
    constructor(address admin) ERC20("RATE", "RATE") ERC20Permit("RATE") {
        if (admin == address(0)) revert("RateToken: zero admin");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /// @notice Mint RATE tokens. Restricted to MINTER_ROLE.
    /// @param to Recipient address.
    /// @param amount Amount to mint (18 decimals).
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
