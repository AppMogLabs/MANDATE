// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IOrderBookPrice {
    function getSpotPrice(address resource) external view returns (uint256);
    function getTWAP(address resource, uint256 windowSeconds) external view returns (uint256);
}

/// @title MvpEpoch
/// @notice Minimal epoch + leaderboard contract for the MANDATE MVP.
///         Players opt in during an active epoch and commit a hash of their
///         natural-language mandate. At epoch end, `finalize()` snapshots
///         each registered player's portfolio using live OrderBook prices
///         and records the score on-chain. Token balances never move into
///         this contract — players retain custody throughout.
/// @dev    Out-of-scope for MVP: deposit tracking (so score is pre-transfer
///         movements), TWAP scoring (only spot is used), multi-epoch history.
///         See plan for follow-ups.
contract MvpEpoch is Ownable {
    uint256 public constant PRICE_SCALE = 1e18;

    IOrderBookPrice public immutable orderBook;
    IERC20 public immutable rateToken;
    address[3] public resourceTokens; // [COMPUTE, CHIPS, DATA]

    uint64 public epochStart;
    uint64 public epochEnd;
    bool public finalized;

    address[] public players;
    mapping(address => bool) public registered;
    mapping(address => bytes32) public mandateHashOf;
    mapping(address => uint256) public finalScore;

    event EpochStarted(uint64 startedAt, uint64 endsAt);
    event PlayerRegistered(address indexed player, bytes32 mandateHash);
    event MandateUpdated(address indexed player, bytes32 mandateHash);
    event EpochFinalized(uint64 at, uint256 playerCount);
    event PlayerScored(address indexed player, uint256 score);

    error EpochNotActive();
    error EpochAlreadyStarted();
    error EpochNotOver();
    error EpochAlreadyFinalized();
    error NotRegistered();

    constructor(
        address _owner,
        address _orderBook,
        address _rate,
        address _compute,
        address _chips,
        address _data
    ) Ownable(_owner) {
        orderBook = IOrderBookPrice(_orderBook);
        rateToken = IERC20(_rate);
        resourceTokens[0] = _compute;
        resourceTokens[1] = _chips;
        resourceTokens[2] = _data;
    }

    /// @notice Start a new epoch. Only callable when the previous one has been
    ///         finalized (or has never been started).
    function startEpoch(uint64 durationSeconds) external onlyOwner {
        if (epochStart != 0 && !finalized) revert EpochAlreadyStarted();
        epochStart = uint64(block.timestamp);
        epochEnd = uint64(block.timestamp) + durationSeconds;
        finalized = false;
        delete players;
        emit EpochStarted(epochStart, epochEnd);
    }

    /// @notice Opt into the current epoch and commit a hash of the mandate
    ///         text. Idempotent: re-registering just updates the mandate hash.
    function register(bytes32 mandateHash) external {
        if (!isActive()) revert EpochNotActive();
        if (!registered[msg.sender]) {
            registered[msg.sender] = true;
            players.push(msg.sender);
            emit PlayerRegistered(msg.sender, mandateHash);
        } else {
            emit MandateUpdated(msg.sender, mandateHash);
        }
        mandateHashOf[msg.sender] = mandateHash;
    }

    /// @notice Update your mandate hash during an active epoch. Cheaper than
    ///         re-registering because we skip the isRegistered check.
    function updateMandate(bytes32 mandateHash) external {
        if (!isActive()) revert EpochNotActive();
        if (!registered[msg.sender]) revert NotRegistered();
        mandateHashOf[msg.sender] = mandateHash;
        emit MandateUpdated(msg.sender, mandateHash);
    }

    /// @notice Snapshot every registered player's portfolio at current spot
    ///         prices. Callable by anyone once `block.timestamp >= epochEnd`.
    function finalize() external {
        if (block.timestamp < epochEnd) revert EpochNotOver();
        if (finalized) revert EpochAlreadyFinalized();
        finalized = true;

        uint256[3] memory prices;
        for (uint256 i = 0; i < 3; i++) {
            prices[i] = orderBook.getSpotPrice(resourceTokens[i]);
        }

        uint256 n = players.length;
        for (uint256 i = 0; i < n; i++) {
            address p = players[i];
            uint256 score = _valuePortfolio(p, prices);
            finalScore[p] = score;
            emit PlayerScored(p, score);
        }

        emit EpochFinalized(uint64(block.timestamp), n);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function isActive() public view returns (bool) {
        return epochStart != 0 && !finalized && block.timestamp < epochEnd;
    }

    function playerCount() external view returns (uint256) {
        return players.length;
    }

    /// @notice Live portfolio value of any address in RATE (18 decimals), using
    ///         current OrderBook spot prices. Used by the UI for the pre-finalize
    ///         leaderboard; the on-chain record is written by `finalize()`.
    function currentValue(address who) external view returns (uint256) {
        uint256[3] memory prices;
        for (uint256 i = 0; i < 3; i++) {
            prices[i] = orderBook.getSpotPrice(resourceTokens[i]);
        }
        return _valuePortfolio(who, prices);
    }

    function _valuePortfolio(address who, uint256[3] memory prices)
        internal
        view
        returns (uint256 value)
    {
        value = rateToken.balanceOf(who);
        for (uint256 i = 0; i < 3; i++) {
            uint256 bal = IERC20(resourceTokens[i]).balanceOf(who);
            // price is RATE per unit, 18-decimal fixed point; bal is 18-decimal
            value += (bal * prices[i]) / PRICE_SCALE;
        }
    }
}
