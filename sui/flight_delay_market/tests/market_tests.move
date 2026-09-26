#[test_only]
module flight_delay_market::market_tests;

use flight_delay_market::market::{Self, FeeCap, LiquidityShare, Market, Position, ResolverCap};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self, Scenario};

const LP: address = @0xA;
const TRAVELER: address = @0xB;
const DEPARTURE_MS: u64 = 10_000;
const ARRIVAL_MS: u64 = 20_000;
const CLOSE_MS: u64 = 9_000;
const DEADLINE_MS: u64 = 30_000_000;
const THIRTY_MINUTES_MS: u64 = 1_800_000;

fun setup_with_threshold(scenario: &mut Scenario, threshold_ms: u64) {
    test_scenario::create_system_objects(scenario);
    let mut clock = scenario.take_shared<Clock>();
    clock.set_for_testing(1_000);
    let mut flight_hash = vector[];
    let mut i = 0;
    while (i < 32) {
        flight_hash.push_back(7);
        i = i + 1u64;
    };
    market::create<SUI>(
        flight_hash,
        threshold_ms,
        DEPARTURE_MS,
        ARRIVAL_MS,
        CLOSE_MS,
        DEADLINE_MS,
        coin::mint_for_testing<SUI>(1_000, scenario.ctx()),
        &clock,
        scenario.ctx(),
    );
    test_scenario::return_shared(clock);
}

fun setup(scenario: &mut Scenario) {
    setup_with_threshold(scenario, THIRTY_MINUTES_MS);
}

fun buy_yes(scenario: &mut Scenario) {
    let mut market = scenario.take_shared<Market<SUI>>();
    let clock = scenario.take_shared<Clock>();
    assert!(market::quote(&market, true, 200) == 100);
    assert!(market::purchase_fee(&market, true, 200) == 1);
    assert!(market::total_cost(&market, true, 200) == 101);
    market::buy(
        &mut market,
        true,
        200,
        coin::mint_for_testing<SUI>(101, scenario.ctx()),
        &clock,
        scenario.ctx(),
    );
    test_scenario::return_shared(market);
    test_scenario::return_shared(clock);
}

#[test]
fun delayed_flight_pays_yes_and_reserves_claims_from_lp_withdrawal() {
    let mut scenario = test_scenario::begin(LP);
    setup(&mut scenario);
    scenario.next_tx(TRAVELER);
    buy_yes(&mut scenario);

    scenario.next_tx(LP);
    let mut market = scenario.take_shared<Market<SUI>>();
    let cap = scenario.take_from_sender<ResolverCap>();
    let mut clock = scenario.take_shared<Clock>();
    clock.set_for_testing(2_000_000);
    market::resolve_arrival(&mut market, &cap, 1_820_000, &clock);
    assert!(market::status(&market) == 1);
    assert!(market::delay_threshold_ms(&market) == THIRTY_MINUTES_MS);
    assert!(market::outstanding_claims(&market) == 200);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_shared(clock);
    test_scenario::return_shared(market);

    scenario.next_tx(LP);
    let mut market = scenario.take_shared<Market<SUI>>();
    let share = scenario.take_from_sender<LiquidityShare<SUI>>();
    market::withdraw_liquidity(&mut market, share, scenario.ctx());
    assert!(market::cash(&market) == 200);
    test_scenario::return_shared(market);
    scenario.next_tx(LP);
    let recovered = scenario.take_from_sender<Coin<SUI>>();
    assert!(coin::burn_for_testing(recovered) == 900);

    scenario.next_tx(TRAVELER);
    let mut market = scenario.take_shared<Market<SUI>>();
    let position = scenario.take_from_sender<Position<SUI>>();
    market::claim(&mut market, position, scenario.ctx());
    assert!(market::cash(&market) == 0);
    assert!(market::protocol_fees(&market) == 2);
    test_scenario::return_shared(market);
    scenario.next_tx(TRAVELER);
    let payout = scenario.take_from_sender<Coin<SUI>>();
    assert!(coin::burn_for_testing(payout) == 199);

    scenario.next_tx(LP);
    let mut market = scenario.take_shared<Market<SUI>>();
    let fee_cap = scenario.take_from_sender<FeeCap>();
    market::withdraw_fees(&mut market, &fee_cap, scenario.ctx());
    assert!(market::protocol_fees(&market) == 0);
    test_scenario::return_to_sender(&scenario, fee_cap);
    test_scenario::return_shared(market);
    scenario.next_tx(LP);
    let fees = scenario.take_from_sender<Coin<SUI>>();
    assert!(coin::burn_for_testing(fees) == 2);
    scenario.end();
}

#[test]
fun on_time_flight_pays_no_position() {
    let mut scenario = test_scenario::begin(LP);
    setup(&mut scenario);
    scenario.next_tx(TRAVELER);
    let mut market = scenario.take_shared<Market<SUI>>();
    let clock = scenario.take_shared<Clock>();
    market::buy(
        &mut market,
        false,
        200,
        coin::mint_for_testing<SUI>(101, scenario.ctx()),
        &clock,
        scenario.ctx(),
    );
    test_scenario::return_shared(market);
    test_scenario::return_shared(clock);

    scenario.next_tx(LP);
    let mut market = scenario.take_shared<Market<SUI>>();
    let cap = scenario.take_from_sender<ResolverCap>();
    let mut clock = scenario.take_shared<Clock>();
    clock.set_for_testing(30_000);
    market::resolve_arrival(&mut market, &cap, 21_000, &clock);
    assert!(market::status(&market) == 2);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_shared(clock);
    test_scenario::return_shared(market);

    scenario.next_tx(TRAVELER);
    let mut market = scenario.take_shared<Market<SUI>>();
    let position = scenario.take_from_sender<Position<SUI>>();
    market::claim(&mut market, position, scenario.ctx());
    assert!(market::cash(&market) == 900);
    test_scenario::return_shared(market);
    scenario.next_tx(TRAVELER);
    let payout = scenario.take_from_sender<Coin<SUI>>();
    assert!(coin::burn_for_testing(payout) == 199);
    scenario.end();
}

#[test]
fun missing_verdict_refunds_premium_and_preserves_seed() {
    let mut scenario = test_scenario::begin(LP);
    setup(&mut scenario);
    scenario.next_tx(TRAVELER);
    buy_yes(&mut scenario);

    scenario.next_tx(LP);
    let mut market = scenario.take_shared<Market<SUI>>();
    let mut clock = scenario.take_shared<Clock>();
    clock.set_for_testing(DEADLINE_MS + 1);
    market::cancel_unresolved(&mut market, &clock);
    assert!(market::status(&market) == 3);
    assert!(market::outstanding_claims(&market) == 100);
    test_scenario::return_shared(clock);
    test_scenario::return_shared(market);

    scenario.next_tx(LP);
    let mut market = scenario.take_shared<Market<SUI>>();
    let share = scenario.take_from_sender<LiquidityShare<SUI>>();
    market::withdraw_liquidity(&mut market, share, scenario.ctx());
    assert!(market::cash(&market) == 100);
    test_scenario::return_shared(market);
    scenario.next_tx(LP);
    let recovered = scenario.take_from_sender<Coin<SUI>>();
    assert!(coin::burn_for_testing(recovered) == 1_000);

    scenario.next_tx(TRAVELER);
    let mut market = scenario.take_shared<Market<SUI>>();
    let position = scenario.take_from_sender<Position<SUI>>();
    market::claim(&mut market, position, scenario.ctx());
    assert!(market::cash(&market) == 0);
    assert!(market::protocol_fees(&market) == 0);
    test_scenario::return_shared(market);
    scenario.next_tx(TRAVELER);
    let refund = scenario.take_from_sender<Coin<SUI>>();
    assert!(coin::burn_for_testing(refund) == 101);
    scenario.end();
}

#[test, expected_failure(abort_code = 3, location = flight_delay_market::market)]
fun undercollateralized_purchase_aborts() {
    let mut scenario = test_scenario::begin(LP);
    setup(&mut scenario);
    scenario.next_tx(TRAVELER);
    let mut market = scenario.take_shared<Market<SUI>>();
    let clock = scenario.take_shared<Clock>();
    market::buy(
        &mut market,
        true,
        2_500,
        coin::mint_for_testing<SUI>(1_263, scenario.ctx()),
        &clock,
        scenario.ctx(),
    );
    test_scenario::return_shared(market);
    test_scenario::return_shared(clock);
    scenario.end();
}

#[test]
fun selected_threshold_controls_resolution() {
    let mut scenario = test_scenario::begin(LP);
    setup_with_threshold(&mut scenario, 2 * 60 * 60 * 1000);

    scenario.next_tx(LP);
    let mut market = scenario.take_shared<Market<SUI>>();
    let cap = scenario.take_from_sender<ResolverCap>();
    let mut clock = scenario.take_shared<Clock>();
    clock.set_for_testing(8_000_000);
    market::resolve_arrival(&mut market, &cap, ARRIVAL_MS + 60 * 60 * 1000, &clock);
    assert!(market::status(&market) == 2);
    assert!(market::delay_threshold_ms(&market) == 2 * 60 * 60 * 1000);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_shared(clock);
    test_scenario::return_shared(market);
    scenario.end();
}

#[test, expected_failure(abort_code = 12, location = flight_delay_market::market)]
fun unsupported_threshold_aborts() {
    let mut scenario = test_scenario::begin(LP);
    setup_with_threshold(&mut scenario, 15 * 60 * 1000);
    scenario.end();
}
