module flight_delay_market::market;

use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;

const EInvalidSchedule: u64 = 0;
const EInvalidAmount: u64 = 1;
const EMarketClosed: u64 = 2;
const ENotCollateralized: u64 = 3;
const EWrongMarket: u64 = 4;
const ENotOpen: u64 = 5;
const ETooEarly: u64 = 6;
const ETooLate: u64 = 7;
const EInvalidArrival: u64 = 8;
const EInvalidPayment: u64 = 9;
const EInvalidFlightHash: u64 = 10;
const ETradingStarted: u64 = 11;
const EInvalidThreshold: u64 = 12;

const OPEN: u8 = 0;
const DELAYED: u8 = 1;
const ON_TIME: u8 = 2;
const CANCELLED: u8 = 3;
const THIRTY_MINUTES_MS: u64 = 30 * 60 * 1000;
const ONE_HOUR_MS: u64 = 60 * 60 * 1000;
const TWO_HOURS_MS: u64 = 2 * 60 * 60 * 1000;
const FOUR_HOURS_MS: u64 = 4 * 60 * 60 * 1000;
const SIX_HOURS_MS: u64 = 6 * 60 * 60 * 1000;
const PRICE_SCALE: u64 = 10_000;

/// One binary market for a flight delayed by at least its selected threshold.
public struct Market<phantom T> has key {
    id: UID,
    flight_hash: vector<u8>,
    delay_threshold_ms: u64,
    scheduled_departure_ms: u64,
    scheduled_arrival_ms: u64,
    closes_at_ms: u64,
    resolution_deadline_ms: u64,
    status: u8,
    arrival_ms: u64,
    cash: Balance<T>,
    seed_capital: u64,
    lp_supply: u64,
    yes_exposure: u64,
    no_exposure: u64,
    premiums: u64,
    outstanding_claims: u64,
}

/// The holder can report a final arrival for this market.
public struct ResolverCap has key, store { id: UID, market_id: ID }

/// LP shares are minted only before the first position is bought.
public struct LiquidityShare<phantom T> has key, store {
    id: UID,
    market_id: ID,
    amount: u64,
}

/// A winning position pays quantity. If resolution fails, it refunds premium.
public struct Position<phantom T> has key, store {
    id: UID,
    market_id: ID,
    delayed: bool,
    quantity: u64,
    premium: u64,
}

public struct MarketCreated has copy, drop {
    market_id: ID,
    flight_hash: vector<u8>,
    delay_threshold_ms: u64,
    seed_capital: u64,
}

public struct PositionBought has copy, drop {
    market_id: ID,
    position_id: ID,
    buyer: address,
    delayed: bool,
    quantity: u64,
    premium: u64,
}

public struct MarketResolved has copy, drop {
    market_id: ID,
    status: u8,
    arrival_ms: u64,
}

public struct PositionClaimed has copy, drop {
    market_id: ID,
    position_id: ID,
    claimant: address,
    amount: u64,
}

/// A seed coin of any Sui coin type funds the maximum payout liability.
public fun create<T>(
    flight_hash: vector<u8>,
    delay_threshold_ms: u64,
    scheduled_departure_ms: u64,
    scheduled_arrival_ms: u64,
    closes_at_ms: u64,
    resolution_deadline_ms: u64,
    seed: Coin<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = clock::timestamp_ms(clock);
    assert!(flight_hash.length() == 32, EInvalidFlightHash);
    assert!(valid_threshold(delay_threshold_ms), EInvalidThreshold);
    assert!(
        now < closes_at_ms &&
        closes_at_ms <= scheduled_departure_ms &&
        scheduled_departure_ms < scheduled_arrival_ms,
        EInvalidSchedule,
    );
    assert!(scheduled_arrival_ms + delay_threshold_ms < resolution_deadline_ms, EInvalidSchedule);
    let amount = coin::value(&seed);
    assert!(amount > 0, EInvalidAmount);
    let market = Market<T> {
        id: object::new(ctx),
        flight_hash,
        delay_threshold_ms,
        scheduled_departure_ms,
        scheduled_arrival_ms,
        closes_at_ms,
        resolution_deadline_ms,
        status: OPEN,
        arrival_ms: 0,
        cash: coin::into_balance(seed),
        seed_capital: amount,
        lp_supply: amount,
        yes_exposure: 0,
        no_exposure: 0,
        premiums: 0,
        outstanding_claims: 0,
    };
    let market_id = object::id(&market);
    event::emit(MarketCreated {
        market_id,
        flight_hash: market.flight_hash,
        delay_threshold_ms,
        seed_capital: amount,
    });
    transfer::public_transfer(ResolverCap { id: object::new(ctx), market_id }, ctx.sender());
    transfer::public_transfer(
        LiquidityShare<T> { id: object::new(ctx), market_id, amount },
        ctx.sender(),
    );
    transfer::share_object(market);
}

public fun add_liquidity<T>(market: &mut Market<T>, deposit: Coin<T>, clock: &Clock, ctx: &mut TxContext) {
    assert!(market.status == OPEN, ENotOpen);
    assert!(clock::timestamp_ms(clock) < market.closes_at_ms, EMarketClosed);
    assert!(market.yes_exposure == 0 && market.no_exposure == 0, ETradingStarted);
    let amount = coin::value(&deposit);
    assert!(amount > 0, EInvalidAmount);
    market.seed_capital = market.seed_capital + amount;
    market.lp_supply = market.lp_supply + amount;
    balance::join(&mut market.cash, coin::into_balance(deposit));
    transfer::public_transfer(
        LiquidityShare<T> { id: object::new(ctx), market_id: object::id(market), amount },
        ctx.sender(),
    );
}

/// Prices shift from 50 percent as YES and NO payout liabilities diverge.
public fun quote<T>(market: &Market<T>, delayed: bool, quantity: u64): u64 {
    assert!(quantity > 0, EInvalidAmount);
    let price = price_bps(market, delayed);
    let numerator = (quantity as u128) * (price as u128) + ((PRICE_SCALE - 1) as u128);
    (numerator / (PRICE_SCALE as u128)) as u64
}

public fun buy<T>(
    market: &mut Market<T>,
    delayed: bool,
    quantity: u64,
    payment: Coin<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(market.status == OPEN, ENotOpen);
    assert!(clock::timestamp_ms(clock) < market.closes_at_ms, EMarketClosed);
    let premium = quote(market, delayed, quantity);
    assert!(coin::value(&payment) == premium, EInvalidPayment);
    let next_yes = market.yes_exposure + if (delayed) quantity else 0;
    let next_no = market.no_exposure + if (delayed) 0 else quantity;
    let worst_case = if (next_yes > next_no) next_yes else next_no;
    assert!(balance::value(&market.cash) + premium >= worst_case, ENotCollateralized);
    balance::join(&mut market.cash, coin::into_balance(payment));
    market.yes_exposure = next_yes;
    market.no_exposure = next_no;
    market.premiums = market.premiums + premium;
    let position = Position<T> {
        id: object::new(ctx),
        market_id: object::id(market),
        delayed,
        quantity,
        premium,
    };
    event::emit(PositionBought {
        market_id: object::id(market),
        position_id: object::id(&position),
        buyer: ctx.sender(),
        delayed,
        quantity,
        premium,
    });
    transfer::public_transfer(position, ctx.sender());
}

/// An independent data service holds the cap and reports the final arrival.
/// The contract itself computes whether the published threshold was met.
public fun resolve_arrival<T>(
    market: &mut Market<T>,
    cap: &ResolverCap,
    arrival_ms: u64,
    clock: &Clock,
) {
    assert!(market.status == OPEN, ENotOpen);
    assert!(cap.market_id == object::id(market), EWrongMarket);
    let now = clock::timestamp_ms(clock);
    assert!(now >= market.scheduled_arrival_ms, ETooEarly);
    assert!(now <= market.resolution_deadline_ms, ETooLate);
    assert!(arrival_ms > 0 && arrival_ms <= now, EInvalidArrival);
    market.arrival_ms = arrival_ms;
    market.status = if (arrival_ms >= market.scheduled_arrival_ms + market.delay_threshold_ms) DELAYED else ON_TIME;
    market.outstanding_claims = if (market.status == DELAYED) market.yes_exposure else market.no_exposure;
    event::emit(MarketResolved { market_id: object::id(market), status: market.status, arrival_ms });
}

/// If no final arrival arrives, anyone can cancel and allow premium refunds.
public fun cancel_unresolved<T>(market: &mut Market<T>, clock: &Clock) {
    assert!(market.status == OPEN, ENotOpen);
    assert!(clock::timestamp_ms(clock) > market.resolution_deadline_ms, ETooEarly);
    market.status = CANCELLED;
    market.outstanding_claims = market.premiums;
    event::emit(MarketResolved { market_id: object::id(market), status: CANCELLED, arrival_ms: 0 });
}

/// Consuming the position prevents a second claim.
public fun claim<T>(market: &mut Market<T>, position: Position<T>, ctx: &mut TxContext) {
    assert!(market.status != OPEN, ENotOpen);
    assert!(position.market_id == object::id(market), EWrongMarket);
    let Position { id, market_id: _, delayed, quantity, premium } = position;
    let amount = if (market.status == CANCELLED) {
        premium
    } else if ((market.status == DELAYED && delayed) || (market.status == ON_TIME && !delayed)) {
        quantity
    } else {
        0
    };
    if (amount > 0) {
        market.outstanding_claims = market.outstanding_claims - amount;
        let payout = balance::split(&mut market.cash, amount);
        transfer::public_transfer(coin::from_balance(payout, ctx), ctx.sender());
    };
    event::emit(PositionClaimed {
        market_id: object::id(market),
        position_id: object::uid_to_inner(&id),
        claimant: ctx.sender(),
        amount,
    });
    id.delete();
}

/// LPs can withdraw only the cash above still-claimable payouts.
public fun withdraw_liquidity<T>(market: &mut Market<T>, share: LiquidityShare<T>, ctx: &mut TxContext) {
    assert!(market.status != OPEN, ENotOpen);
    assert!(share.market_id == object::id(market), EWrongMarket);
    let LiquidityShare { id, market_id: _, amount } = share;
    let available = balance::value(&market.cash) - market.outstanding_claims;
    let payout = if (amount == market.lp_supply) {
        available
    } else {
        (((available as u128) * (amount as u128)) / (market.lp_supply as u128)) as u64
    };
    market.lp_supply = market.lp_supply - amount;
    if (payout > 0) {
        let coin = balance::split(&mut market.cash, payout);
        transfer::public_transfer(coin::from_balance(coin, ctx), ctx.sender());
    };
    id.delete();
}

public fun status<T>(market: &Market<T>): u8 { market.status }
public fun cash<T>(market: &Market<T>): u64 { balance::value(&market.cash) }
public fun outstanding_claims<T>(market: &Market<T>): u64 { market.outstanding_claims }
public fun flight_hash<T>(market: &Market<T>): &vector<u8> { &market.flight_hash }
public fun delay_threshold_ms<T>(market: &Market<T>): u64 { market.delay_threshold_ms }

fun valid_threshold(threshold_ms: u64): bool {
    threshold_ms == THIRTY_MINUTES_MS ||
    threshold_ms == ONE_HOUR_MS ||
    threshold_ms == TWO_HOURS_MS ||
    threshold_ms == FOUR_HOURS_MS ||
    threshold_ms == SIX_HOURS_MS
}

fun price_bps<T>(market: &Market<T>, delayed: bool): u64 {
    let yes = market.yes_exposure;
    let no = market.no_exposure;
    let imbalance = if (yes > no) yes - no else no - yes;
    let raw = ((imbalance as u128) * 5_000) / (market.seed_capital as u128);
    let shift = if (raw > 4_000) 4_000 else raw as u64;
    let yes_price = if (yes >= no) 5_000 + shift else 5_000 - shift;
    if (delayed) yes_price else PRICE_SCALE - yes_price
}
