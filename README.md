# Vehicle Connect

Vehicle Connect is a JavaScript MERN marketplace for chauffeur-driven commercial passenger vehicles, initially focused on Kolkata, India.

## Requirements

- Node.js 20+
- MongoDB 6+

## Development

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and a private `JWT_SECRET`.
2. Run `npm install`.
3. Run `npm run dev`.

The Vite application is served at `http://localhost:5173`; the Express API is at `http://localhost:4000/api`. The server refuses to start without MongoDB and a JWT secret. `PUBLIC_BOOKING_ENABLED` defaults to false so the marketplace cannot accept bookings before local compliance has been reviewed.

## Location tracking

Driver tracking requires an authenticated driver to explicitly grant browser geolocation permission and switch tracking on. Locations are accepted only for an active driver/vehicle assignment, validated and stored with a 2dsphere index, then sent to the driver's fleet room and confirmed booking room. Fleet subscriptions are owner-scoped; passenger subscriptions require their own confirmed booking. Passenger location access stops when the trip ends.

Location retention is controlled with `LOCATION_RETENTION_DAYS`. The map uses OpenStreetMap tiles and a browser-side Web Mercator view; review the tile provider's usage policy before production deployment. Precise location is not available to the public. Configure a routing provider separately to enable turn-by-turn route and ETA enrichment.

## Security and production

- Set HTTPS, secure upload storage, rate limits, email delivery, and production secrets before deployment.
- Configure compliance requirements and obtain legal approval before setting `PUBLIC_BOOKING_ENABLED=true`.
- Payments are not marked successful by the client. A production Razorpay integration requires server-side order creation, signature verification, and verified webhook credentials.
- This repository is a working product foundation; production launch also requires operational compliance, provider credentials, and deployment-specific hardening.
