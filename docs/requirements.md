# Scrum Poker – Specyfikacja wymagań

## Zakres
Aplikacja webowa do estymacji w stylu Planning Poker. Użytkownicy tworzą lub dołączają do pokoi, wybierają karty z ciągu Fibonacciego i odsłaniają głosy jednocześnie. Dokument opisuje wymagania produktowe i zachowania systemu bez wskazywania technologii czy implementacji.

## Słownik pojęć
- Pokój: przestrzeń spotkania identyfikowana przez UUID.
- Uczestnik: osoba połączona z pokojem, widoczna na liście obecności.
- Głos: wybór jednej karty z dostępnego zestawu.
- Stan pokoju: „ukryte” (głosy zakryte) lub „odkryte” (głosy widoczne).

## Wymagania funkcjonalne
- Wejście przez WWW: aplikacja dostępna w przeglądarce pod publicznym URL.
- Strona główna:
  - Przyciski: „Utwórz pokój” oraz „Dołącz do pokoju”.
  - Dołączenie wymaga podania UUID pokoju.
- Identyfikacja użytkownika:
  - Po kliknięciu „Utwórz” lub „Dołącz” użytkownik podaje imię (wymagane, min. 1 znak, dowolny UTF-8; wyświetlane pozostałym).
- Widok pokoju:
  - Lista uczestników z aktualizacją w czasie rzeczywistym (dołączanie/opuszczanie).
  - Wybór karty: każdy uczestnik może wybrać jedną kartę z zestawu [?, 0, 1, 2, 3, 5, 8, 13].
  - Sygnalizacja oddania głosu: przy uczestniku, który zagłosował, pojawia się ikonka/znacznik informujący, że głos został oddany; wartość karty pozostaje ukryta do momentu odsłonięcia.
  - Publikacja w czasie rzeczywistym: informacje o oddaniu, zmianie lub usunięciu głosu są propagowane do wszystkich uczestników pokoju.
  - Odsłanianie głosów: dowolny uczestnik może użyć akcji „pokaż” (z potwierdzeniem „czy na pewno?”), co zmienia stan pokoju na „odkryte” i ujawnia wartości wszystkich oddanych głosów jednocześnie.
  - Czyszczenie głosów: dowolny uczestnik może użyć akcji „wyczyść” (z potwierdzeniem „czy na pewno?”), co usuwa oddane głosy wszystkich uczestników, nie usuwając samych uczestników z pokoju, i ustawia stan pokoju na „ukryte”.

## Reguły biznesowe i zachowanie
- Zestaw kart: dokładnie [?, 0, 1, 2, 3, 5, 8, 13]; brak innych wartości.
- Jeden głos na uczestnika: w danym momencie uczestnik ma co najwyżej jedną wybraną kartę; zmiana wyboru nadpisuje poprzedni.
- Widoczność głosów:
  - W stanie „ukryte” widoczny jest tylko fakt oddania głosu (ikonka), nie jego wartość.
  - W stanie „odkryte” wartości wszystkich bieżących głosów są widoczne dla wszystkich.
- Zmiany po odsłonięciu: po akcji „pokaż” uczestnicy mogą nadal zmieniać swoje głosy; system nie utrzymuje historii zmian.
- Akcje globalne:
  - „pokaż” ujawnia wszystkie aktualne głosy jednocześnie.
  - „wyczyść” usuwa głosy wszystkich uczestników i przywraca stan „ukryte”.
  - Obie akcje wymagają potwierdzenia przez użytkownika wykonującego akcję.
- Obecność i synchronizacja:
  - Dołączanie i opuszczanie pokoju jest widoczne dla wszystkich w czasie rzeczywistym.
  - Nowy uczestnik po wejściu otrzymuje bieżący stan pokoju (lista uczestników, stan „ukryte/odkryte”, aktualne głosy jeśli „odkryte”, lub tylko informacje o tym, kto zagłosował jeśli „ukryte”).

## Wymagania niefunkcjonalne
- Stateless po stronie serwera:
  - Serwer nie przechowuje trwałego stanu pokoi, uczestników ani głosów.
  - Stan pokoju jest odtwarzany dynamicznie na podstawie informacji przekazywanych przez aktywnych uczestników (np. po dołączeniu nowego klienta) i/lub mechanizmu komunikacji w czasie rzeczywistym.
  - Brak trwałej pamięci: restart serwera lub rozłączenie ostatniego uczestnika implikuje brak istniejącego stanu dla danego pokoju, dopóki nie pojawią się nowi/ponownie dołączeni uczestnicy.
  - Brak rejestru pokoi: serwer nie odróżnia „istniejącego” i „nieistniejącego” pokoju; dołączenie z dowolnym UUID jest akceptowane i skutkuje „istnieniem” pokoju tak długo, jak są w nim aktywni uczestnicy.
- Czas rzeczywisty: aktualizacje (dołączanie, opuszczanie, oddanie głosu, odsłonięcie, czyszczenie) są dystrybuowane do wszystkich połączonych uczestników danego pokoju bez ręcznego odświeżania strony.
- Identyfikacja pokoju: pokoje są identyfikowane za pomocą UUID przekazywanego przez użytkownika przy dołączaniu lub nadawanego przy tworzeniu.
- Brak założonej autoryzacji: dostęp do pokoju opiera się na znajomości UUID; każdy posiadający UUID może dołączyć.

## Przepływy użytkownika (happy path)
- Utworzenie pokoju:
  1) Użytkownik klika „Utwórz pokój”.
  2) Podaje imię i potwierdza wejście.
  3) Otrzymuje widok pustego pokoju w stanie „ukryte” i UUID pokoju (możliwy do skopiowania i udostępnienia).
- Dołączenie do pokoju:
  1) Użytkownik klika „Dołącz do pokoju”.
  2) Podaje UUID pokoju i swoje imię.
  3) Dołącza do pokoju i widzi listę uczestników oraz aktualny stan głosowania.
- Głosowanie i odsłonięcie:
  1) Uczestnicy wybierają karty; przy ich nazwiskach pojawiają się ikonki „oddano głos”.
  2) Gdy zespół jest gotów, dowolny uczestnik wybiera „pokaż” i potwierdza.
  3) Wszystkie wartości głosów stają się widoczne jednocześnie.
- Czyszczenie:
  1) Dowolny uczestnik wybiera „wyczyść” i potwierdza.
  2) Wszystkie głosy są usuwane; stan wraca do „ukryte”.

## Stany i zdarzenia
- Stany pokoju: „ukryte”, „odkryte”.
- Zdarzenia lokalne: wybór/zmiana/wyczyszczenie własnego głosu.
- Zdarzenia globalne: dołączenie/opuszczenie uczestnika, „pokaż”, „wyczyść”.
- Propagacja: wszystkie zdarzenia są rozgłaszane w obrębie pokoju w czasie rzeczywistym.

## Uwagi i ograniczenia
- Duplikaty imion są dopuszczalne (w obrębie pokoju imiona służą wyłącznie do wyświetlania).
- Brak historii: system nie udostępnia archiwum poprzednich rund ani zapisów głosów po wyczyszczeniu.
- Zachowanie przy braku uczestników: jeśli w pokoju nie ma żadnych aktywnych uczestników, nie istnieje żaden utrzymywany stan tego pokoju po stronie serwera (w zgodzie z „stateless”).
