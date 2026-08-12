# SentinelWatch Web

Next.js web app for **SentinelWatch** — global crisis monitoring, no login required.

## Features

- **Instant access** — no login, no category selection; crisis events load automatically on open
- **Dark Leaflet map** — CartoDB dark tiles, real crisis markers coloured by severity
- **AI Command Terminal** — `goto <place>`, `weather`, `find`, `time`, `events`, `cams`, `radio`, `clear`
- **Live crisis events** — aggregated from USGS earthquakes, NASA EONET, GDACS, Wikidata conflicts, Open-Meteo
- **Live webcams** — OpenStreetMap + YouTube Live via Piped API, with HLS/image playback
- **Live radio** — Radio Browser community directory, audio player in browser
- **SkyTrace aircraft finder** — search live callsigns/ICAO24, follow breadcrumb trails, and see crisis proximity
- **Earth-watch layers** — aircraft, combat zones, storms, fires, quake rings, space weather, and radar
- **Safety intelligence** — region, conflict, and storm reports with risk scores and source trust
- **Personal watchlist** — saved places, alerts, and profile controls
- **Download page** — `/download` links the Android APK

## Run

```bash
cd web-app
npm install
npm run dev      # → http://localhost:3100
```

## Build

```bash
npm run build
npm start
```

## Structure

```
src/
  app/
    page.tsx                  # Main page (no login)
    download/page.tsx         # Mobile download page
    globals.css               # Dark theme + Leaflet overrides
    layout.tsx
    api/
      events/route.ts         # USGS + EONET + GDACS + Wikidata + weather
      feeds/route.ts          # Webcams (OSM + YouTube) + radio (Radio Browser)
      geocode/route.ts        # Open-Meteo geocoding
      reverse/route.ts        # Nominatim reverse geocoding
      weather/route.ts        # Open-Meteo forecast
      news/route.ts           # Google News RSS
  components/
    map/CrisisMap.tsx         # Leaflet dark map with crisis markers
    map/MapLoader.tsx         # Dynamic (no SSR) wrapper
    terminal/CommandTerminal.tsx  # AI terminal
    feeds/LocalFeeds.tsx      # Cameras panel, radio panel, camera viewer, radio player
    hud/TopBar.tsx            # Top nav bar with search
    hud/Sidebar.tsx           # Animated sidebar (events / feeds / terminal)
    hud/EventsPanel.tsx       # Crisis events list
  lib/data.ts                 # Types, constants, city list
  store/sw-store.ts           # Zustand global state
```

## Core APIs are free and keyless

| API | Used for |
|---|---|
| USGS | Earthquakes |
| NASA EONET | Wildfires, storms, volcanoes, floods |
| GDACS | Disaster alerts |
| Wikidata SPARQL | Active armed conflicts |
| Open-Meteo | Geocoding + weather |
| Nominatim | Reverse geocoding |
| Overpass API (OSM) | Nearby webcams |
| Piped (YouTube) | Live YouTube webcam search |
| Radio Browser | Local radio stations |
| OpenSky Network | Live aircraft telemetry |
