# Design reference

Travely borrows the interaction language of Flighty (iOS flight tracker, Apple Design Award)
and the visual language of the supplied Flighty references: a night flight board, a charcoal
sheet, rounded white type and an electric blue action colour.
This note distils what makes the reference feel the way it does, so screens stay coherent.

References: [Flighty](https://flighty.com/) and
[Apple's Behind the Design interview](https://developer.apple.com/news/?id=970ncww4).
The trip-card pass keeps map-led navigation and puts route codes, local times and status on
separate visual levels. The add flow uses a large rounded modal header, dark inset fields and
bright date chips. Header controls keep at least 44-point touch targets.

## Identity

Four decisions, and the reason for each.

**Night sky, not a generic dark mode.** The background is a black star field and the app
content sits on a soft charcoal sheet with a rounded upper edge. This keeps the map, status
colours and white type visually close to the references without making every surface pure
black.

**One signature colour, deliberately electric.** Blue `#0A9CF5` carries routes, primary
actions, links and the active tab. Green means on time, red means delay and amber means a
warning. These colours are kept in tokens so the same meaning survives every screen.

**Passport materials.** The passport uses the supplied deep blue-violet card direction, with
bright statistics, a light aircraft/stat panel and the same share affordance as the reference.
Stamps keep their deterministic ink, dashed border and hand-pressed tilt.

## What we avoid

The tells that make an interface look generated rather than drawn. `theme/contrast.test.ts`
asserts the first three.

- Flat black cards on every screen. Charcoal sheets and slightly lighter controls keep the
  hierarchy visible.
- Status colours used without their semantic meaning.
- More than one accent colour competing with the electric blue route/action colour.
- Heavy shadows on ordinary cards. Shadows are reserved for sheets and map overlays.
- A radius per component. Five radii, each with a role.
- Tracked caps on every section header, which flattens a page because each header shouts as
  loud as the last.
- One typeface for both prose and data.
- Marketing words. Copy is airport-board concrete: a route, a status, a time.

## Palette

Values live in `apps/mobile/theme/palette.ts`, which stays free of `react-native` so
`theme/contrast.test.ts` can assert every pairing below against WCAG: 4.5:1 for text on its
ground, 3:1 for a dye drawn as a mark.

| Role | Value | Notes |
|---|---|---|
| Page ground | `#000000` | star field and map surround |
| Surface | `#18181C` | charcoal sheets and cards |
| Inset fill | `#28282D` | rows, chips, inputs and focused controls |
| Hairline | `#3A3A40` | the line that separates boarding-board rows |
| Strong rule | `#515159` | the outline of circular and capsule controls |
| Text | `#F5F5F7` / `#A1A1AA` / `#77777F` | primary, secondary, tertiary |
| Signature blue | dye `#0A9CF5`, surface `#17364D` | routes, primary actions, active tab, links |
| Route ahead | `#56616B` | the remaining route is drained |
| On time | dye `#18C77A`, ink `#18C77A`, surface `#173A2D` | |
| Delayed, gate, tight connection | dye `#FF9F0A`, ink `#FFB340`, surface `#3A2D18` | |
| Cancelled, severe delay | dye `#FF453A`, ink `#FF6B63`, surface `#421F22` | |
| En route | the petrol pair | |
| Passport | cover `#19005E`, land `#28398A`, foil `#F5F5F7`, MRZ strip `#DDEBFA` | |
| Operator lettermarks | eight muted dyes in `components/ui/operatorColor.ts` | slate, plum, verdigris, terracotta, graphite, olive, moss, garnet |

Two of these are one step off the value they were designed at, because the design value did
not clear WCAG: tertiary text was `#8A8D94`, which is 2.997:1 on the paper ground, and the
passport foil was tuned for contrast on the burgundy cover.

Each status carries two values on purpose. The **dye** is drawn as a shape: a dot, a
progress fill, a map stroke. The **ink** is the same status set as text. They are not
interchangeable: a dye is mixed to clear 3:1, which is enough for a mark and short of what a
13 pt word needs, so `toneColor` returns ink and `toneSignal` returns the dye.

Tertiary text clears 3:1 and no grey light enough to read as a third tier clears 4.5:1, so
it is reserved for text that repeats or decorates: a struck-through scheduled time, a unit
suffix, a caveat. Any 11 pt label that is the only carrier of its information goes on
`textSecondary`.

`readableInk(dye)` returns whichever of white and near-black reads better on a filled dye,
which is how the gate ends up with dark type on amber.

## Typography

Two typefaces, and the split is the point. **The system font carries the interface**: titles,
body, section headers, the words a person reads as a sentence. **IBM Plex Mono carries the
data**, which is how a departure board and a boarding pass have always been set: times,
airport and station codes, gates, countdowns, the speed and altitude pill, the timetable
columns, the change-log timestamps, the machine-readable band, the stamp type and the
passport stats. Every mono style is tabular, so columns of numbers line up.

Six sizes and no others (11, 13, 15, 17, 22, 34), with the display title allowed to grow to
42 pt for the large “My Flights” and “Passport” headers. Mono at 22 and 34 takes `letterSpacing:
-0.5`. Section headers are sentence-case semibold 15; the tracked 11 pt caps are kept for the
tiny labels that name a number ("Until gate arrival", the passport stats, a timetable
column). The mono faces load in `app/_layout.tsx` and nothing is drawn until they are in;
React Native cannot synthesise a weight for a custom family, so a mono style names its face
and never sets `fontWeight`.

## Shapes and elevation

One elevation system: a charcoal surface is separated by a drawn 1 px rule in the hairline
colour, never by a drop shadow. The shadow survives only where something floats, which is
the sheet edge, the map capsules and the vehicle marker.

Five radii, each a role rather than a size: **document 12** for the passport card, the stamps
and the country chips; **control 16** for buttons, inputs, chips and inset blocks; **card
22**; **sheet 32** on the top corners; **pill** for status and gate only, so the shape keeps
meaning "this is a state".

Icons are SF Symbols at `semibold`, sized 16 / 20 / 24 and nothing else: modes `airplane`,
`tram.fill`, `ferry.fill`, `bus.fill`; directions `arrow.up.right` and `arrow.down.right`
inside a filled circle; tabs `airplane.departure`, `book.closed.fill`,
`person.crop.circle.fill`; actions `square.and.arrow.up`, `plus`, `xmark`; weather from the fixed map in
`features/weather/conditions.ts`. Android falls back to Ionicons or MaterialCommunityIcons
through `components/ui/Symbol.tsx`, which lists every symbol the app uses.

## App icon

`apps/mobile/assets/icon.svg` is the source; the PNGs beside it are rasterised from it with
`rsvg-convert -w 1024 -h 1024 icon.svg -o icon.png` (and `-w 48 -h 48` for the favicon).
`icon-foreground.svg`, `icon-background.svg` and `icon-monochrome.svg` cover Android's
adaptive slots, the first and last at 66% inside the safe zone. A petrol great-circle arc on
paper rising into a gold stamp ring: a journey and the proof it happened, and the only two
marks that still read at 60 px.

## Signature details, in priority order

1. Huge coloured actual/estimated time with the scheduled time struck through next to it.
2. Small filled circle with an arrow before each code: up-right on departure, down-right on
   arrival; the colour encodes that segment's status.
3. Gate shown as an amber capsule: amber wash, amber ink, a 1 px amber rule, the gate code
   set in mono with the arrow, terminal below. Not a filled block.
4. Map on top, list or detail in a bottom sheet. The trips sheet has three stops: a 176 px
   peek that clears the floating tab bar and leaves the globe free to turn, then 55% and
   92%, with a light haptic at each and the last stop remembered between launches.
5. Great-circle route: flown part thick and blue, remaining part thin and drained, vehicle
   icon sliding on the line, speed and altitude in a capsule when live data exists.
6. Live strip: codes and times on both sides of the vehicle, progress bar, big mono countdown
   and a tiny caps label.
7. Delay explanations as short human sentences, never a code.
8. Detailed timetable card: scheduled versus actual or estimated per step in mono columns,
   green when on time, red when late.
9. "Good to know" card with icon rows (operator, time zone change, arrival weather,
   short connection).
10. Passport as a blue-violet passport card: world silhouette with bright traces, country chips,
    stats grid, MRZ band on a light strip, year tabs.
11. Notifications in airport-board style: route, status, time.
12. Boarding-pass trip cards: large route codes with city names underneath, paired departure
    and arrival times, then a separate tinted status strip. Live legs include progress.
    Operator identity, service number, date and demo label sit above the route. Cards use
    the brighter surface over the paper sheet; connections stay inside their leg's card.
13. Connection tightness as one word in a pill (Tight, Normal, Relaxed).
14. Finished legs leave the list and live in the passport.
15. Operator identity on every row: the airline logo (pics.avs.io by IATA code, or the
    provider's logo when the proxy sends one), otherwise a
    rounded-square lettermark whose colour is derived from the operator code, so the same
    carrier keeps the same tile everywhere.

## Deliberately not reproduced

Historical on-time statistics ("Arrival forecast") and inbound aircraft tracking
("Where's my plane") need data we do not have; they are left out rather than faked.
Live Activities need a widget extension and a paid Apple developer account.
