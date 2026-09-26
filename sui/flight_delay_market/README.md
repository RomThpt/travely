# Flight delay market contract

`market.move` defines a shared binary market for one flight and any Sui coin type. Travely uses native testnet USDC. A seed deposit becomes LP shares, position purchases contribute premiums, and each winning position pays its stated quantity less the settlement fee. A collateral check prevents total worst-case payouts from exceeding market cash. LPs can withdraw only after resolution or cancellation and cannot take cash still owed to positions.

The protocol charges 1% of the premium at purchase and 0.5% of a winning payout at settlement, rounded up to the smallest coin unit. Fees are isolated from collateral. The creator receives a `FeeCap`; fees can be withdrawn only after resolution and after every claim or refund has been settled. A cancelled market refunds both the premium and its purchase fee.

The creator selects one immutable delay threshold per market: 30 minutes, 1 hour, 2 hours, 4 hours, or 6 hours. The creator receives a transferable `ResolverCap`. Its holder reports an actual final arrival after the scheduled arrival and before the deadline. The contract compares it with the scheduled arrival plus the selected threshold. There is no automatic oracle in this package. If the deadline passes without a report, anyone can cancel and each position can reclaim its premium and purchase fee.

```sh
sui move test --path sui/flight_delay_market -e testnet
sui move build --path sui/flight_delay_market -e testnet
```

The published testnet package ID and example market are in [the web companion README](../../apps/market/README.md). The published version is a prototype and should not be used with funds of real value without a security review and an independent resolution design.

Current testnet deployment:

- package: `0x364922c3a44683eed8c1e05b5bf1b79d4c3a88ac2ad748b295740e4fb4e04da2`;
- publish transaction: `HcjCgC2kfNq8sL7goEWKfRBy88HZYg269H7JBMzeCkwF`;
- upgrade capability: `0xca7fe9d91ac915e08a542d6bee9a511af5e005da4b34ff8e8fb18e637e5309be`.
