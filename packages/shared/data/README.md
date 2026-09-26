# Bundled data

## `operators.json`

The operator index the Add screen searches and every screen resolves a logo from. Two
halves, generated together by `../scripts/build-operators.ts`:

- **Airlines** come from the OpenFlights `airlines.dat` dump
  (<https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat>),
  filtered to carriers flagged active that carry both a two-character IATA designator and
  a three-letter ICAO code, then deduplicated to one carrier per designator.
- **Rail, ferry and bus operators** are curated by hand in the build script: no free public
  dataset lists them with the commercial brands a ticket actually prints ("TGV", "ICE").

Regenerate with:

```
bun run packages/shared/scripts/build-operators.ts            # downloads the dump
bun run packages/shared/scripts/build-operators.ts ./airlines.dat  # or reads a local copy
```

The file is bundled into the mobile app, so it is stored as tuples rather than objects and
the build prints its size; keep it well under 100 KB.

### Licence

OpenFlights data is published under the **Open Database License (ODbL) v1.0**
(<https://opendatacommons.org/licenses/odbl/1-0/>), with the individual contents under the
Database Contents License. Attribution: OpenFlights.org. The dump is a community effort and
carries no warranty; it is used here for name lookup only, never as a source of truth for a
leg.

The curated rail, ferry and bus entries are our own and carry no third-party licence.
Operator names are used nominatively; no logo or trademark artwork is redistributed with
this repository (see `airlineLogoUrl` in `../src/operators.ts` for how airline logos are
fetched at runtime instead).
