// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerchantRegistry} from "./MerchantRegistry.sol";

/// @notice Non-upgradeable escrow. No administrator can withdraw user funds.
contract MoneyWithRulesVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum PaymentStatus {
        OK, UNKNOWN_BUDGET, WRONG_BENEFICIARY, PAUSED, NOT_STARTED, EXPIRED,
        INVALID_AMOUNT, UNVERIFIED_MERCHANT, WRONG_CATEGORY, NOT_WHITELISTED,
        INSUFFICIENT_BALANCE, TRANSACTION_LIMIT, DAILY_LIMIT, INVALID_MERCHANT
    }
    struct Rules {
        uint8 category;
        uint64 startsAt;
        uint64 endsAt;
        uint256 maxPerPayment;
        uint256 dailyLimit; // Zero means no daily limit; day boundaries are UTC.
    }
    struct Budget {
        address parent;
        address beneficiary;
        string name;
        Rules rules;
        uint256 balance;
        uint256 totalFunded;
        uint256 totalSpent;
        uint256 totalWithdrawn;
        uint256 movedIn;
        uint256 movedOut;
        bool paused;
        bool whitelistEnabled;
    }

    IERC20 public immutable token;
    MerchantRegistry public immutable registry;
    uint256 public nextBudgetId = 1;
    uint256 public nextPaymentId = 1;
    uint256 public totalEscrow;
    uint256 public constant MAX_INITIAL_WHITELIST = 32;
    mapping(uint256 => Budget) private _budgets;
    mapping(uint256 => mapping(address => bool)) public merchantWhitelist;
    mapping(uint256 => mapping(uint256 => uint256)) public dailySpent;
    mapping(address => uint256[]) private _parentBudgets;
    mapping(address => uint256[]) private _beneficiaryBudgets;

    error InvalidConfiguration();
    error NotParent();
    error UnknownBudget();
    error InvalidAmount();
    error UnsupportedToken();
    error BudgetMustBePausedOrExpired();
    error InvalidReallocation();
    error PaymentRejected(PaymentStatus reason);

    event BudgetCreated(uint256 indexed budgetId, address indexed parent, address indexed beneficiary, string name, uint256 amount);
    event BudgetFunded(uint256 indexed budgetId, uint256 amount);
    event RulesUpdated(uint256 indexed budgetId, Rules rules);
    event BudgetPaused(uint256 indexed budgetId, bool paused);
    event WhitelistModeUpdated(uint256 indexed budgetId, bool enabled);
    event MerchantWhitelistUpdated(uint256 indexed budgetId, address indexed merchant, bool allowed);
    event ParentWithdrawal(uint256 indexed budgetId, address indexed parent, uint256 amount);
    event FundsReallocated(uint256 indexed fromBudgetId, uint256 indexed toBudgetId, uint256 amount);
    event PaymentCompleted(uint256 indexed budgetId, address indexed recipient, address indexed merchant, uint256 amount, uint256 paymentId);

    constructor(address tokenAddress, address registryAddress) {
        if (tokenAddress.code.length == 0 || registryAddress.code.length == 0) revert InvalidConfiguration();
        token = IERC20(tokenAddress);
        registry = MerchantRegistry(registryAddress);
    }

    modifier onlyParent(uint256 id) {
        if (_budgets[id].parent == address(0)) revert UnknownBudget();
        if (_budgets[id].parent != msg.sender) revert NotParent();
        _;
    }

    function getBudget(uint256 id) external view returns (Budget memory) { return _budgets[id]; }
    function budgetCount(address account, bool asParent) external view returns (uint256) {
        return asParent ? _parentBudgets[account].length : _beneficiaryBudgets[account].length;
    }
    function budgetIds(address account, bool asParent, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        if (limit > 100) revert InvalidConfiguration();
        uint256[] storage source = asParent ? _parentBudgets[account] : _beneficiaryBudgets[account];
        uint256 count = offset >= source.length ? 0 : source.length - offset;
        if (count > limit) count = limit;
        ids = new uint256[](count);
        for (uint256 i; i < count; ++i) ids[i] = source[offset + i];
    }

    function createBudget(address beneficiary, string calldata name, Rules calldata rules, uint256 amount,
        bool whitelistEnabled, address[] calldata merchants) external nonReentrant returns (uint256 id) {
        if (beneficiary == address(0) || beneficiary == address(this) || beneficiary == msg.sender
            || bytes(name).length == 0 || bytes(name).length > 80 || merchants.length > MAX_INITIAL_WHITELIST)
            revert InvalidConfiguration();
        _validateRules(rules);
        if (amount == 0) revert InvalidAmount();
        id = nextBudgetId++;
        Budget storage b = _budgets[id];
        b.parent = msg.sender;
        b.beneficiary = beneficiary;
        b.name = name;
        b.rules = rules;
        b.whitelistEnabled = whitelistEnabled;
        b.balance = amount;
        b.totalFunded = amount;
        totalEscrow += amount;
        _parentBudgets[msg.sender].push(id);
        _beneficiaryBudgets[beneficiary].push(id);
        for (uint256 i; i < merchants.length; ++i) {
            if (merchants[i] == address(0)) revert InvalidConfiguration();
            merchantWhitelist[id][merchants[i]] = true;
            emit MerchantWhitelistUpdated(id, merchants[i], true);
        }
        emit BudgetCreated(id, msg.sender, beneficiary, name, amount);
        emit RulesUpdated(id, rules);
        emit WhitelistModeUpdated(id, whitelistEnabled);
        _receive(msg.sender, amount);
    }

    function addFunds(uint256 id, uint256 amount) external nonReentrant onlyParent(id) {
        if (amount == 0) revert InvalidAmount();
        Budget storage b = _budgets[id];
        b.balance += amount;
        b.totalFunded += amount;
        totalEscrow += amount;
        emit BudgetFunded(id, amount);
        _receive(msg.sender, amount);
    }

    function updateRules(uint256 id, Rules calldata rules) external onlyParent(id) {
        _validateRules(rules);
        _budgets[id].rules = rules;
        // dailySpent is deliberately preserved through rule changes and pause cycles.
        emit RulesUpdated(id, rules);
    }
    function setPaused(uint256 id, bool paused) external onlyParent(id) {
        _budgets[id].paused = paused;
        emit BudgetPaused(id, paused);
    }
    function setWhitelistEnabled(uint256 id, bool enabled) external onlyParent(id) {
        _budgets[id].whitelistEnabled = enabled;
        emit WhitelistModeUpdated(id, enabled);
    }
    function setMerchantAllowed(uint256 id, address merchant, bool allowed) external onlyParent(id) {
        if (merchant == address(0)) revert InvalidConfiguration();
        merchantWhitelist[id][merchant] = allowed;
        emit MerchantWhitelistUpdated(id, merchant, allowed);
    }

    /// @notice Parent may reclaim only paused or expired allocations, always to their own wallet.
    function withdrawUnused(uint256 id, uint256 amount) external nonReentrant onlyParent(id) {
        Budget storage b = _budgets[id];
        if (!b.paused && block.timestamp <= b.rules.endsAt) revert BudgetMustBePausedOrExpired();
        if (amount == 0 || amount > b.balance) revert InvalidAmount();
        b.balance -= amount;
        b.totalWithdrawn += amount;
        totalEscrow -= amount;
        emit ParentWithdrawal(id, msg.sender, amount);
        _send(msg.sender, amount);
    }

    function reallocate(uint256 fromId, uint256 toId, uint256 amount) external nonReentrant onlyParent(fromId) onlyParent(toId) {
        Budget storage a = _budgets[fromId];
        Budget storage b = _budgets[toId];
        if (fromId == toId || a.beneficiary != b.beneficiary || !a.paused || b.paused || block.timestamp > b.rules.endsAt)
            revert InvalidReallocation();
        if (amount == 0 || amount > a.balance) revert InvalidAmount();
        a.balance -= amount;
        a.movedOut += amount;
        b.balance += amount;
        b.movedIn += amount;
        emit FundsReallocated(fromId, toId, amount);
    }

    /// @notice Informational only; pay() repeats all checks against execution-time state.
    function checkPayment(uint256 id, address payer, address merchant, uint256 amount) public view returns (PaymentStatus) {
        Budget storage b = _budgets[id];
        if (b.parent == address(0)) return PaymentStatus.UNKNOWN_BUDGET;
        if (payer != b.beneficiary) return PaymentStatus.WRONG_BENEFICIARY;
        if (b.paused) return PaymentStatus.PAUSED;
        if (block.timestamp < b.rules.startsAt) return PaymentStatus.NOT_STARTED;
        if (block.timestamp > b.rules.endsAt) return PaymentStatus.EXPIRED;
        if (amount == 0) return PaymentStatus.INVALID_AMOUNT;
        if (merchant == address(this) || merchant == b.beneficiary || merchant == b.parent || merchant == address(0)) return PaymentStatus.INVALID_MERCHANT;
        if (!registry.isVerified(merchant)) return PaymentStatus.UNVERIFIED_MERCHANT;
        if (!registry.isAllowed(merchant, b.rules.category)) return PaymentStatus.WRONG_CATEGORY;
        if (b.whitelistEnabled && !merchantWhitelist[id][merchant]) return PaymentStatus.NOT_WHITELISTED;
        if (amount > b.balance) return PaymentStatus.INSUFFICIENT_BALANCE;
        if (amount > b.rules.maxPerPayment) return PaymentStatus.TRANSACTION_LIMIT;
        uint256 spent = dailySpent[id][block.timestamp / 1 days];
        if (b.rules.dailyLimit != 0 && (spent >= b.rules.dailyLimit || amount > b.rules.dailyLimit - spent)) return PaymentStatus.DAILY_LIMIT;
        return PaymentStatus.OK;
    }

    function pay(uint256 id, address merchant, uint256 amount) external nonReentrant returns (uint256 paymentId) {
        PaymentStatus status = checkPayment(id, msg.sender, merchant, amount);
        if (status != PaymentStatus.OK) revert PaymentRejected(status);
        Budget storage b = _budgets[id];
        b.balance -= amount;
        b.totalSpent += amount;
        totalEscrow -= amount;
        dailySpent[id][block.timestamp / 1 days] += amount;
        paymentId = nextPaymentId++;
        emit PaymentCompleted(id, msg.sender, merchant, amount, paymentId);
        _send(merchant, amount);
    }

    function _validateRules(Rules calldata rules) private view {
        if (rules.category > 3 || rules.startsAt >= rules.endsAt || rules.endsAt <= block.timestamp || rules.maxPerPayment == 0)
            revert InvalidConfiguration();
    }
    function _receive(address from, uint256 amount) private {
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        if (token.balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedToken();
    }
    function _send(address to, uint256 amount) private {
        uint256 beforeBalance = token.balanceOf(to);
        token.safeTransfer(to, amount);
        if (token.balanceOf(to) != beforeBalance + amount) revert UnsupportedToken();
    }
}
