import { ConnectButton, useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_MARKET_ID,
  PACKAGE_ID,
  SUI_TYPE,
  addLiquidityTx,
  buyTx,
  cancelTx,
  claimTx,
  createMarketTx,
  flightHash,
  hex,
  mist,
  parseMarket,
  parsePosition,
  parseShare,
  positionMarketId,
  quote,
  resolveTx,
  sui,
  withdrawTx,
  type FlightInput,
  type MarketState,
  type OwnedPosition,
  type OwnedShare,
} from './market';

const params = new URLSearchParams(location.search);

function initialFlight(): FlightInput {
  if (!params.has('operator') && INITIAL_MARKET_ID === '0x97239901832c279a3f93b89c86d49fdc12609e794d48d1b44916d29038a5705a') {
    return {
      operator: 'DEMO', number: 'DM042', serviceDate: '2026-09-26', origin: 'HND', destination: 'KIX',
      scheduledDeparture: '2026-09-26T18:00:00+09:00', scheduledArrival: '2026-09-26T19:10:00+09:00',
    };
  }
  return {
    operator: params.get('operator') ?? '',
    number: params.get('number') ?? '',
    serviceDate: params.get('date') ?? '',
    origin: params.get('origin') ?? '',
    destination: params.get('destination') ?? '',
    scheduledDeparture: params.get('departure') ?? '',
    scheduledArrival: params.get('arrival') ?? '',
  };
}

const formatTime = (value: bigint) => new Date(Number(value)).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;

export function App() {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const linkedFlight = useMemo(initialFlight, []);
  const [flight, setFlight] = useState<FlightInput>(linkedFlight);
  const [seed, setSeed] = useState('1');
  const [marketId, setMarketId] = useState(params.get('market') ?? (params.has('operator') ? '' : INITIAL_MARKET_ID));
  const [market, setMarket] = useState<MarketState | null>(null);
  const [positions, setPositions] = useState<OwnedPosition[]>([]);
  const [shares, setShares] = useState<OwnedShare[]>([]);
  const [resolverCap, setResolverCap] = useState<string | null>(null);
  const [actualArrival, setActualArrival] = useState('');
  const [side, setSide] = useState(true);
  const [quantity, setQuantity] = useState('0.1');
  const [lpAmount, setLpAmount] = useState('0.1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [matched, setMatched] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!marketId || !PACKAGE_ID) return;
    const { object } = await client.getObject({ objectId: marketId, include: { json: true } });
    if (!object.type.startsWith(`${PACKAGE_ID}::market::Market<`)) throw new Error('Cet objet ne correspond pas au marché Travely.');
    setMarket(parseMarket(object.objectId, object.json));
    if (account) {
      const page = await client.listOwnedObjects({
        owner: account.address,
        type: `${PACKAGE_ID}::market::Position<${SUI_TYPE}>`,
        include: { json: true },
      });
      setPositions(page.objects.filter((owned) => positionMarketId(owned.json) === marketId).map((owned) => parsePosition(owned.objectId, owned.json)));
      const [sharePage, capPage] = await Promise.all([
        client.listOwnedObjects({ owner: account.address, type: `${PACKAGE_ID}::market::LiquidityShare<${SUI_TYPE}>`, include: { json: true } }),
        client.listOwnedObjects({ owner: account.address, type: `${PACKAGE_ID}::market::ResolverCap`, include: { json: true } }),
      ]);
      setShares(sharePage.objects.filter((owned) => positionMarketId(owned.json) === marketId).map((owned) => parseShare(owned.objectId, owned.json)));
      setResolverCap(capPage.objects.find((owned) => positionMarketId(owned.json) === marketId)?.objectId ?? null);
    } else {
      setPositions([]);
      setShares([]);
      setResolverCap(null);
    }
  }, [account, client, marketId]);

  useEffect(() => {
    if (!marketId || !PACKAGE_ID) return;
    void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [marketId, refresh]);

  useEffect(() => {
    if (marketId || !PACKAGE_ID || !params.has('operator')) return;
    let cancelled = false;
    void (async () => {
      const digest = await flightHash(linkedFlight);
      const encoded = btoa(Array.from(digest, (byte) => String.fromCharCode(byte)).join(''));
      const page = await client.listEvents({
        filter: { eventType: `${PACKAGE_ID}::market::MarketCreated` },
        order: 'descending',
        limit: 50,
      });
      const event = page.events.find((candidate) => (candidate.json as { flight_hash?: string } | null)?.flight_hash === encoded);
      const found = (event?.json as { market_id?: string } | undefined)?.market_id;
      if (!cancelled && found) setMarketId(found);
    })().catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { cancelled = true; };
  }, [client, linkedFlight, marketId]);

  useEffect(() => {
    if (!market || !flight.operator) { setMatched(null); return; }
    void flightHash(flight).then((digest) => setMatched(hex(digest) === market.flightHash)).catch(() => setMatched(false));
  }, [flight, market]);

  const premium = useMemo(() => {
    if (!market || market.status !== 0) return null;
    try { return quote(market, side, mist(quantity)); } catch { return null; }
  }, [market, quantity, side]);

  const execute = async (makeTx: () => ReturnType<typeof buyTx>, after?: (digest: string) => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!account) throw new Error('Connecte un portefeuille Sui sur testnet.');
      const result = await dAppKit.signAndExecuteTransaction({ transaction: makeTx() });
      if (result.FailedTransaction) throw new Error(result.FailedTransaction.status.error?.message ?? 'Transaction refusée.');
      const digest = result.Transaction.digest;
      await client.waitForTransaction({ digest, include: { events: true } });
      if (after) await after(digest);
      setNotice(`Transaction confirmée : ${short(digest)}`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!account) throw new Error('Connecte un portefeuille Sui sur testnet.');
      const digest = await flightHash(flight);
      const result = await dAppKit.signAndExecuteTransaction({ transaction: createMarketTx(flight, digest, mist(seed)) });
      if (result.FailedTransaction) throw new Error(result.FailedTransaction.status.error?.message ?? 'Création refusée.');
      const confirmed = await client.waitForTransaction({ digest: result.Transaction.digest, include: { events: true } });
      const event = confirmed.Transaction?.events?.find((item) => item.eventType === `${PACKAGE_ID}::market::MarketCreated`);
      const id = (event?.json as { market_id?: string } | undefined)?.market_id;
      if (!id) throw new Error(`Marché créé, mais son ID est introuvable. Transaction : ${result.Transaction.digest}`);
      setMarketId(id);
      const url = new URL(location.href);
      url.searchParams.set('market', id);
      history.replaceState(null, '', url);
      setNotice(`Marché créé et amorcé avec ${seed} SUI. Transaction : ${short(result.Transaction.digest)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const setField = (key: keyof FlightInput, value: string) => setFlight((current) => ({ ...current, [key]: value }));
  const canTrade = Boolean(account && market?.status === 0 && market.closesAtMs > BigInt(Date.now()) && matched === true);

  return (
    <main className="shell">
      <header className="topbar">
        <div><strong className="brand">TRAVELY</strong><span className="eyebrow"> / MARCHÉ DES RETARDS</span></div>
        <div className="wallet"><span className="network">SUI TESTNET</span><ConnectButton /></div>
      </header>

      <section className="hero">
        <div><p className="kicker">Un trajet. Deux issues. Une réserve commune.</p><h1>Un vol en retard de<br /><em>30 minutes ou plus ?</em></h1>
          <p>Le marché engage des SUI de test. Les positions OUI sont payées si l’arrivée finale dépasse le seuil. Les positions NON sont payées sinon.</p></div>
        <div className="heroMeta"><span>01 / 03</span><strong>Marché binaire</strong><span>Résolution après l’arrivée réelle</span></div>
      </section>

      {!PACKAGE_ID && <div className="alert">Configure VITE_MARKET_PACKAGE_ID après publication du contrat.</div>}
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      <div className="grid">
        <section className="panel">
          <div className="sectionTitle"><span>01</span><h2>Vol et marché</h2></div>
          <label>Identifiant du marché sur Sui<input value={marketId} onChange={(event) => setMarketId(event.target.value.trim())} placeholder="0x…" /></label>
          {market ? <>
            <div className="statusline"><span className={`badge status${market.status}`}>{['Ouvert', 'Retard confirmé', 'À l’heure', 'Annulé'][market.status]}</span><a href={`https://suiscan.xyz/testnet/object/${market.id}`} target="_blank" rel="noreferrer">Voir sur Sui</a></div>
            <div className="stats"><div><small>Clôture</small><strong>{formatTime(market.closesAtMs)}</strong></div><div><small>Arrivée prévue</small><strong>{formatTime(market.scheduledArrivalMs)}</strong></div><div><small>Liquidité</small><strong>{sui(market.cash)} SUI</strong></div><div><small>Réserve due</small><strong>{sui(market.outstandingClaims)} SUI</strong></div></div>
            {matched === true && <p className="validation">{flight.operator} {flight.number} · {flight.origin}–{flight.destination} · identité vérifiée par l’empreinte du marché.</p>}
            {matched === false && <p className="warning">Les détails du vol renseigné ne correspondent pas à ce marché. Vérifie les horaires dans le formulaire avant d’agir.</p>}
            {matched === null && <p className="warning">Renseigne le vol dans le formulaire pour vérifier son empreinte avant d’agir.</p>}
            <button className="plain" onClick={() => void refresh().catch((cause: unknown) => setError(String(cause)))}>Actualiser les données</button>
          </> : <p className="muted">Colle un ID de marché existant ou crée et amorce un nouveau marché ci-dessous.</p>}
        </section>

        <section className="panel">
          <div className="sectionTitle"><span>02</span><h2>Prendre position</h2></div>
          <div className="segmented"><button className={side ? 'selected' : ''} onClick={() => setSide(true)}>OUI · retard ≥ 30 min</button><button className={!side ? 'selected' : ''} onClick={() => setSide(false)}>NON · retard &lt; 30 min</button></div>
          <label>Paiement si gagnant, en SUI<input inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
          <div className="quote"><span>Prix actuel</span><strong>{premium === null ? '—' : `${sui(premium)} SUI`}</strong></div>
          <p className="muted">Le prix est recalculé dans le contrat. Il varie avec l’exposition du marché. Une transaction dont le prix a changé échoue sans achat.</p>
          <button className="primary" disabled={!canTrade || busy || premium === null} onClick={() => market && void execute(() => buyTx(market, side, mist(quantity)))}>Acheter une position</button>
          {market?.status === 0 && market.resolutionDeadlineMs < BigInt(Date.now()) && <button className="plain" disabled={!account || busy} onClick={() => void execute(() => cancelTx(market.id))}>Annuler le marché sans résultat</button>}
        </section>

        <section className="panel">
          <div className="sectionTitle"><span>03</span><h2>Mes positions</h2></div>
          {!account && <p className="muted">Connecte ton portefeuille pour voir les positions et réclamer les versements.</p>}
          {account && positions.length === 0 && <p className="muted">Aucune position pour ce marché sur ce portefeuille.</p>}
          {positions.map((position) => <div className="position" key={position.id}><div><strong>{position.delayed ? 'OUI' : 'NON'} · {sui(position.quantity)} SUI</strong><small>Mise {sui(position.premium)} SUI · {short(position.id)}</small></div><button disabled={busy || market?.status === 0} onClick={() => void execute(() => claimTx(marketId, position.id))}>Réclamer</button></div>)}
          <p className="muted">Après résolution : la bonne issue reçoit le montant affiché, l’autre reçoit zéro. Si aucune arrivée n’est rapportée avant l’échéance, chaque mise est remboursée.</p>
        </section>

        <section className="panel">
          <div className="sectionTitle"><span>LP</span><h2>Fournir la liquidité</h2></div>
          <p className="muted">Les fonds couvrent le versement maximal. Les parts de liquidité sont des objets Sui transférables. Un apport supplémentaire est possible seulement avant le premier achat.</p>
          <label>Apport supplémentaire, en SUI<input inputMode="decimal" value={lpAmount} onChange={(event) => setLpAmount(event.target.value)} /></label>
          <button className="secondary" disabled={!account || !market || market.status !== 0 || market.yesExposure !== 0n || market.noExposure !== 0n || matched !== true || busy} onClick={() => void execute(() => addLiquidityTx(marketId, mist(lpAmount)))}>Ajouter de la liquidité</button>
          {shares.map((share) => <div className="position" key={share.id}><div><strong>Part LP · {sui(share.amount)} SUI</strong><small>{short(share.id)}</small></div><button disabled={busy || market?.status === 0} onClick={() => void execute(() => withdrawTx(marketId, share.id))}>Retirer</button></div>)}
          <p className="muted">Le retrait est possible après la résolution ou l’annulation, en conservant les paiements encore dus.</p>
        </section>
      </div>

      {resolverCap && market?.status === 0 && <section className="panel resolver">
        <div className="sectionTitle"><span>R</span><h2>Déclarer l’arrivée finale</h2></div>
        <p className="muted">Ce portefeuille détient le ResolverCap. Déclare uniquement l’heure d’arrivée réelle d’une source vérifiée. Le contrat calcule lui-même le résultat du marché.</p>
        <label>Arrivée finale (ISO avec fuseau horaire)<input value={actualArrival} onChange={(event) => setActualArrival(event.target.value)} placeholder="2026-09-26T19:45:00+09:00" /></label>
        <button className="secondary" disabled={busy || matched !== true || BigInt(Date.now()) < market.scheduledArrivalMs} onClick={() => void execute(() => resolveTx(marketId, resolverCap, actualArrival))}>Publier l’arrivée</button>
      </section>}

      <section className="panel create">
        <div className="sectionTitle"><span>+</span><h2>Créer un marché pour un vol</h2></div>
        <p className="muted">Le vol, les aéroports et les horaires ci-dessous forment une empreinte SHA-256 inscrite dans le marché. Le marché ferme 10 minutes avant le départ et expire 24 heures après l’arrivée prévue.</p>
        <div className="formgrid">
          {(['operator', 'number', 'serviceDate', 'origin', 'destination', 'scheduledDeparture', 'scheduledArrival'] as const).map((field) =>
            <label key={field}>{({ operator: 'Compagnie', number: 'Numéro de vol', serviceDate: 'Date de service', origin: 'Départ IATA', destination: 'Arrivée IATA', scheduledDeparture: 'Départ prévu (ISO)', scheduledArrival: 'Arrivée prévue (ISO)' })[field]}<input value={flight[field]} onChange={(event) => setField(field, event.target.value)} placeholder={field === 'scheduledDeparture' || field === 'scheduledArrival' ? '2026-09-25T10:00:00+09:00' : ''} /></label>
          )}
          <label>Liquidité initiale (SUI)<input inputMode="decimal" value={seed} onChange={(event) => setSeed(event.target.value)} /></label>
        </div>
        <button className="primary" disabled={!account || busy || !PACKAGE_ID} onClick={() => void create()}>Créer et amorcer sur testnet</button>
      </section>
      <footer>Prototype testnet. Le détenteur du ResolverCap fournit l’heure d’arrivée finale ; le contrat applique le seuil de 30 minutes. Aucun rendement ni versement en monnaie réelle n’est garanti.</footer>
    </main>
  );
}
