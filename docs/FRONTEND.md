# FRONTEND – Jedna statyczna strona (bez builda)

Ten dokument opisuje wygląd i zachowanie frontu jako pojedynczej strony HTML hostowanej statycznie (np. GitHub Pages). Brak bundlera, brak frameworka, brak .htaccess – wyłącznie HTML + CSS + prosty JS w przeglądarce, integracja z Supabase Realtime przez CDN.

Odwołania do kontraktu zdarzeń i kanałów znajdują się w DEV.md.

## Założenia
- Jedna strona: `index.html` + lekki `styles.css` + prosta logika `index.js` (lub inline `<script>`).
- Brak kompilacji: używamy `<script src="...">` z CDN (Supabase JS, opcjonalnie drobny polyfill).
- Konfiguracja: mały plik `config.js` ustawiający globalne wartości `window.ENV = { SUPABASE_URL, SUPABASE_ANON_KEY }` (utwórz na podstawie `config.js.example`).
- Routing: tylko hash w URL (`#/room/<uuid>`), aby uniknąć serwerowej konfiguracji i .htaccess.
- Język UI: PL (spójny z README/DEV).
- Bez bibliotek UI: na start brak zewnętrznych frameworków CSS/JS; ewentualne „upiększenie” rozważymy później bez zmiany kontraktu.

## Schemat URL i nawigacja
- Strona główna: `/` (lub `/index.html`), bez hash.
- Widok pokoju: `/#/room/<uuid>` – zmiana hash nie wymaga wsparcia serwera.
- Przejścia:
  - „Utwórz pokój”: generuj UUID v4 w kliencie → przejdź do `/#/room/<uuid>` po podaniu imienia.
  - „Dołącz do pokoju”: pole na UUID + imię → przejdź do `/#/room/<uuid>`.
  - „Wyjdź”: przejście do `/` (hash wyczyszczony), rozłączenie kanału.

## Układ strony (propozycja)
- Pasek górny (header):
  - Logo/nazwa.
  - W trybie pokoju: wyświetlany `UUID` pokoju oraz przycisk „Kopiuj link”.
- Sekcja treści (main):
  - Widok „Strona główna”:
    - Karta „Utwórz pokój”: przycisk „Utwórz pokój” → modal/formularz z imieniem.
    - Karta „Dołącz do pokoju”: pole `UUID` + pole `Imię` + przycisk „Dołącz”.
  - Widok „Pokój”:
    - Lista uczestników (jeden pod drugim) z mini‑kartą po prawej (•/∅ w hidden, liczba w revealed).
    - Zestaw kart do wyboru: [?, 0, 1, 2, 3, 5, 8, 13].
    - Akcje globalne: „Pokaż”, „Wyczyść” (z potwierdzeniem).
- Pasek stanu i overlay:
  - Badge połączenia i overlay z „Łączenie…”, który blokuje UI, gdy brak połączenia.

## Integracja z Supabase (CDN, bez builda)
- W `index.html` wstaw kolejno:
  1) `<script src="config.js"></script>` – `window.ENV = { SUPABASE_URL, SUPABASE_ANON_KEY }`.
  2) `<script src="https://unpkg.com/@supabase/supabase-js@^2/dist/umd/supabase.js"></script>`.
  3) `<script src="index.js"></script>`.
- Klient: `const client = supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY)`.
- Kanał: `client.channel('room:' + roomUuid, { config: { presence: { key: sessionId }, broadcast: { self: true }}})`.

## Lokalny config i deploy
- Lokalnie: skopiuj `config.js.example` do `config.js` (nie commituj).
- GitHub Pages: workflow Actions generuje `dist/config.js` z sekretów repo (zob. README: Deploy).
