# Scrumpy – Planning Poker (statyczny front + Supabase Realtime)

Scrumpy to lekka aplikacja do estymacji w stylu Planning Poker. Działa w pełni w przeglądarce (statyczna strona), a synchronizacja w czasie rzeczywistym odbywa się przez Supabase Realtime. Serwer jest stateless – brak bazy i własnego backendu.

# [LIVE DEMO](https://volter2pl.github.io/scrumpy/)

## Funkcje
- Tworzenie pokoju i dołączanie po UUID (link z hashem).
- Lista uczestników na żywo (presence), sygnalizacja oddanych głosów.
- Talia: [?, 0, 1, 2, 3, 5, 8, 13].
- Odsłanianie „Pokaż” i reset „Wyczyść” (z potwierdzeniem).
- Zmiana głosu także po odsłonięciu (brak historii).
- Konfetti przy pełnej zgodności po odsłonięciu.
- Overlay „Łączenie…” blokujący UI bez połączenia.

## Szybki start (lokalnie)
1) Skopiuj `config.js.example` do `config.js` i uzupełnij wartości Supabase.
2) Uruchom serwer statyczny, np.: `python -m http.server` i otwórz stronę.

## Deploy na GitHub Pages (bez commitowania config.js)
Ustaw sekrety repo: `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Workflow `.github/workflows/pages.yml` wygeneruje `dist/config.js` i opublikuje stronę przez GitHub Actions. Włącz Pages: Settings → Pages → Source: GitHub Actions.

## Architektura
- Front: `index.html`, `styles.css`, `index.js` (hash routing, brak builda).
- Realtime: kanał `room:<uuid>`, presence + broadcast (`reveal`, `clear`, `user_vote`).
- Stateless: stan pokoju wynika z aktywnych klientów.

## Dokumentacja
- Wymagania: `docs/requirements.md`
- Backend/Realtime: `docs/DEV.md`
- Front (UX/flow): `docs/FRONTEND.md`

## Licencja
Apache-2.0 — patrz `LICENSE`.
