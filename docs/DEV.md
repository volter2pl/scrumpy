# DEV – Architektura i konfiguracja (Supabase Realtime)

Ten dokument opisuje ustalenia i kroki wdrożeniowe dla backendu „stateless” opartego o Supabase Realtime. Nie opisujemy frontendu.

## Cel i założenia
- Aplikacja działa jako statyczny front (np. GitHub Pages) + Supabase Realtime (WebSocket) do synchronizacji pokoju.
- Brak własnego backendu i bazy danych; zero trwałego stanu po stronie serwera.
- Pokoje są efemeryczne (istnieją, gdy są aktywni uczestnicy). Dostęp publiczny dla znających UUID pokoju.
- Prostota jest priorytetem (brak PIN-ów, brak historii rund).

## Wymagane dane konfiguracyjne
- `SUPABASE_URL`: adres projektu z panelu Supabase (np. `https://xxxx.supabase.co`).
- `SUPABASE_ANON_KEY`: publiczny klucz „anon” (bezpieczny do użycia w kliencie).

Konfiguracja frontu odbywa się przez `config.js` (patrz `config.js.example`). Na GitHub Pages wartości są wstrzykiwane podczas deployu z sekretów repozytorium (workflow Actions generuje `dist/config.js`). Lokalnie tworzysz własny niewersjonowany `config.js` na podstawie `config.js.example`.

## Model kanałów Realtime
- Nazwa kanału pokoju: `room:<uuid>` (uuid dostarczony przez użytkownika).
- Protokół: Supabase Realtime (Phoenix Channels) z dwoma mechanizmami:
  - Presence: lista uczestników i ich minimalne metadane.
  - Broadcast: zdarzenia rozsyłane do wszystkich w pokoju.

### Presence
- Klucz presence: `sessionId` (UUID v4 generowany lokalnie per zakładka/przeglądarka).
- Payload presence (metadane uczestnika):
  - `userId: string` — równy `sessionId` (stabilny identyfikator sesji).
  - `name: string` — imię wyświetlane, 1–40 znaków UTF‑8.
  - `hasVoted: boolean` — czy uczestnik oddał głos w bieżącej rundzie.

Zmiany statusu (wejście/wyjście/aktualizacja) są widoczne w czasie rzeczywistym dla wszystkich.

### Broadcast – kontrakt zdarzeń
- `reveal` — odsłania wartości głosów (globalnie):
  - Payload: `{ by: userId }` (opcjonalnie; informacyjne).
  - Efekt: klienci przechodzą w stan „revealed” i publikują własny głos poprzez `user_vote`.
- `clear` — czyści głosy (globalnie):
  - Payload: `{ by: userId }` (opcjonalnie).
  - Efekt: klienci resetują lokalne głosy i ustawiają `hasVoted=false` w presence; stan „hidden”.
- `user_vote` — publikacja wartości głosu użytkownika:
  - Payload: `{ userId: string, value: ?|0|1|2|3|5|8|13 }`.
  - Wysyłane po `reveal` oraz przy każdej późniejszej zmianie karty w stanie „revealed”.
  - Przed `reveal` wartości głosu nie są wysyłane (tylko flaga `hasVoted` w presence).

Uwagi:
- Idempotencja: wielokrotne `reveal` lub `clear` nie powinny zmieniać stanu poza pierwszym razem (klienci ignorują duplikaty).
- Brak historii: kolejne `user_vote` nadpisują poprzednią wartość w UI; nic nie jest zapisywane trwale.
- Duplikaty imion: dozwolone. Uczestnik identyfikowany jest przez `userId` (alias: `name`).

## Maszyna stanów (po stronie klienta – koncepcyjnie)
- `hidden`: głosy są zakryte; presence pokazuje tylko `hasVoted` (ikonka).
- `revealed`: po `reveal` klienci ujawniają i wyświetlają wartości (`user_vote`). Zmiany po `reveal` są dozwolone.
- `clear` przywraca `hidden` i resetuje `hasVoted=false`.

Ta sekcja wyłącznie opisuje kontrakt wymiany zdarzeń. Implementacja UI/klienta nie jest tu opisywana.

## Walidacja i ograniczenia
- Imię: 1–40 znaków, dowolny UTF‑8; zalecane przycięcie spacji i normalizacja (NFC).
- Głos: dozwolone tylko wartości z zestawu `[?,0,1,2,3,5,8,13]`.
- Throttling po kliencie: zalecenie ograniczenia tempa wysyłki broadcastów (np. ≤ 5 zdarzeń/sek/sesję) – redukcja spamu i kosztów.

## Bezpieczeństwo i prywatność
- Brak serwera własnego i brak bazy: cała synchronizacja odbywa się kanałami Realtime; dane są efemeryczne.
- Klucz `anon` jest przeznaczony do klienta; nie daje dostępu do danych bez RLS (nieużywane tutaj).
- Izolacja dostępu opiera się na nieprzewidywalnych UUID pokojów. Brak PIN‑ów i autoryzacji (świadoma decyzja projektowa).

## Limity i praktyki (free plan)
- Ten projekt generuje mały ruch (kilka–kilkanaście osób/pokój). Free plan zwykle wystarczy.
- Minimalizuj liczbę broadcastów: używaj presence do `hasVoted`, broadcast tylko dla `reveal`, `clear` i `user_vote` po `reveal`.
- Jeden kanał na pokój: `room:<uuid>`.

## Konfiguracja projektu Supabase (kroki)
1) Utwórz projekt na `app.supabase.com` i wybierz region blisko użytkowników.
2) Skopiuj z Settings:
   - `Project URL` → `SUPABASE_URL`.
   - `anon public` API key → `SUPABASE_ANON_KEY`.
3) Realtime:
   - Nie konfigurujemy zmian w bazie (CDC) — nie są potrzebne.
   - Broadcast i Presence działają bez dodatkowej konfiguracji bazy.
4) CORS/Origins:
   - Realtime (WebSocket) nie wymaga specjalnego whitelistingu originów.
   - Jeśli w przyszłości użyjesz innych usług (Auth, Functions, Storage), skonfiguruj dozwolone domeny odpowiednio do hostingu frontu.
5) Lokalnie: utwórz `config.js` na bazie `config.js.example`. W produkcji (Pages) wartości dostarczają sekrety repozytorium, workflow generuje `dist/config.js` automatycznie.

## Testy manualne (wystarczające na start)
- Test presence: otwórz dwa okna przeglądarki, dołącz do tego samego `room:<uuid>` — sprawdź listę uczestników w obu oknach.
- Test głosu (hidden): wybierz karty w obu oknach — pojawia się wyłącznie status „oddano głos”.
- Test `reveal`: klik „pokaż” w jednym oknie — oba okna widzą wartości głosów.
- Test zmiany po `reveal`: zmień kartę — oba okna aktualizują wartość.
- Test `clear`: klik „wyczyść” — oba okna tracą głosy i widzą `hasVoted=false`.
- Test re‑join: odśwież jedno okno — stare presence znika po timeoucie, pojawia się nowa sesja.

## Eksploatacja
- Monitoruj w panelu Usage metryki Realtime (połączenia, wiadomości, kanały).
- W razie wzrostu ruchu rozważ proste limity po kliencie (debounce/throttle) i ewentualny upgrade planu.

## Notatki projektowe
- „Stateless” oznacza: brak zapisu stanu w serwerze/bazie; całe zachowanie opiera się o aktywne połączenia. Restart serwera Supabase nie gwarantuje utrzymania jakiegokolwiek stanu pokoju.
- Re-join/duplikaty imion są dozwolone – `userId` (sessionId) rozróżnia uczestników.
