# ADR 0002: Use Leaflet

## Status
Accepted

## Context
Needed to choose an API with an interactive map with pinning as a feature

## Decision
We will use **Leaflet** for this project.

## Benefits
- Interactive map globally.
- Pinning feature that can be saved as datapoints to use later.

## Consequences
- Necessity of a geocoder for search queries if users aren't familar with longitude and latitude

## Related ARD's
- [ARD 003](docs/adr/003-use-nominatim)