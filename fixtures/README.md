# Demo catalogue

`demo/legs.json` contains fictional services for testing and demonstrations. The proxy serves them through `GET /v1/legs/demo` and `GET /v1/legs/demo/:number/:date`. Their departure and arrival offsets are relative to the request time, so the catalogue stays useful on later days.

The mobile app also has a local demo catalogue. Demo services are labelled in the interface and do not trigger travel alerts.
