# ADR 0003: Use Nominatim

## Status
Accepted

## Context
Choosing a Geocoder to allow users to search for locations.

## Decision
We will use **Nominatim** for this project.

## Benefits
- Works with Leaflet as a map tool and was easy to implement.
- Has amenities to help users search.

## Consequences
- Limited calls for an API (1 request per second) 


## Related ARD's
- [ARD 002](docs/adr/002-use-leaflet)