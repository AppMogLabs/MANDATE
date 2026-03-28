# Flagged for Review

Items the handoff document said to flag rather than decide.

## 1. Hex-tile Map Rendering Library

Current: Placeholder SVG hex grid (~50 tiles). Not production-ready.

| Option | Pros | Cons |
|--------|------|------|
| **Pixi.js** | GPU-accelerated, 1000s of tiles, mature ecosystem, sprite batching | Heavy bundle (~200KB), learning curve, imperative API doesn't fit React model cleanly |
| **Raw Canvas** | Zero dependencies, full control, decent perf for <500 tiles | Manual hit detection, no built-in interactivity, lots of boilerplate |
| **SVG (current)** | Native DOM events, easy tooltips, React-friendly | Poor performance above 200-300 tiles, DOM bloat |
| **react-hexgrid** | Purpose-built, React-native, declarative | Small community, limited features, may not scale to production needs |
| **WebGL (Three.js / custom)** | Best performance ceiling, shader effects | Massive overkill for 2D hex grid, highest complexity |

**Recommendation:** Pixi.js for production (with `@pixi/react` for React integration). SVG is fine for the Step 2 prototype with 50 tiles but won't scale.

## 2. WebSocket Strategy for Real-time Feeds

Step 3 concern. Options:
- **Native WebSocket** with reconnection wrapper — simplest, least overhead
- **Socket.io** — auto-reconnect, rooms, fallbacks — probably overkill for MegaETH where native WS is reliable
- **TanStack Query + WS subscription** — integrates with React state, deduplication, cache invalidation

**Recommendation:** Native WebSocket with a thin custom hook (`useWebSocket`) that handles reconnection and message parsing. MegaETH's 10ms blocks mean the stream is continuous — Socket.io's polling fallback adds no value.

## 3. State Management Library

Currently using React `useState` + custom hooks. For Step 3 integration, evaluate:

| Library | Pros | Cons |
|---------|------|------|
| **Zustand** | Minimal API, no providers, good DevTools, works outside React, tiny bundle (1KB) | No built-in async/query patterns |
| **Jotai** | Atomic model, fine-grained reactivity, great for independent data streams | More boilerplate for complex state, less intuitive for imperative updates |
| **TanStack Query** | Server state specialist, caching, refetching, WebSocket integration | Not a general state manager — complements Zustand/Jotai, doesn't replace |

**Recommendation:** Zustand for client state (active view, sidebar state, user preferences) + TanStack Query for server/chain state (resource balances, order book, feed). This is the most common pattern in modern React apps and matches MANDATE's split between client UI state and chain-derived data.

## 4. Chart Library

Current: Placeholder Sparkline (custom SVG). For the full Order Book price history chart:

| Option | Pros | Cons |
|--------|------|------|
| **Lightweight Charts (TradingView)** | Purpose-built for financial data, candlestick/OHLC native, real-time updates, small bundle | Limited customisation, specific to financial charts |
| **Custom Canvas** | Full control over aesthetic, matches design system exactly | Significant development effort |

**Recommendation:** Lightweight Charts for the order book price history. Custom SVG Sparklines (already implemented) for inline data. The TradingView library is designed for exactly this use case and supports real-time WebSocket feeds natively.
