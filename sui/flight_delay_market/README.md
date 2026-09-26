# Flight delay market contract

`market.move` defines a shared binary market for one flight. A SUI seed deposit becomes LP shares, position purchases contribute premiums, and each winning position pays its stated quantity. A collateral check prevents total worst-case payouts from exceeding market cash. LPs can withdraw only after resolution or cancellation and cannot take cash still owed to positions.

The creator receives a transferable `ResolverCap`. Its holder reports an actual final arrival after the scheduled arrival and before the deadline. The contract compares it with scheduled arrival plus 30 minutes. There is no automatic oracle in this package. If the deadline passes without a report, anyone can cancel and each position can reclaim its premium.

```sh
sui move test --path sui/flight_delay_market -e testnet
sui move build --path sui/flight_delay_market -e testnet
```

The published testnet package ID and example market are in [the web companion README](../../apps/market/README.md). The published version is a prototype and should not be used with funds of real value without a security review and an independent resolution design.
