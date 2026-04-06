# Checklista przed oddaniem kodu

> **Cel:** szybko sprawdzić projekt przed PR / merge / pokazaniem klientowi.
>
> **Oznaczenia priorytetów:**
> `[KRYTYCZNE]` — must fix przed mergem &nbsp;|&nbsp; `[WAŻNE]` — napraw w tej iteracji &nbsp;|&nbsp; `[SUGESTIA]` — nice to have
>
> **Punkty `[JEŚLI DOTYCZY]`** — weryfikuj tylko wtedy, gdy PR obejmuje ten obszar.

---

## 1. Kod i czytelność

- [ ] Funkcje i klasy mają jedną odpowiedzialność — da się je przeczytać bez scrollowania (orientacyjnie < 30 linii). `[WAŻNE]`
- [ ] Nazwy zmiennych, funkcji i klas opisują intencję, nie implementację (`get_user_orders`, nie `process_data2`). `[WAŻNE]`
- [ ] Brak zakomentowanego kodu. Jeśli zostawiono TODO — ma datę i kontekst, nie jest magiczne. `[WAŻNE]`
- [ ] Brak magic numbers i strings inline — stałe mają nazwę i żyją w jednym miejscu (`MAX_RETRIES = 3`, nie `3` rozrzucone w 5 miejscach). `[WAŻNE]`
- [ ] Brak duplikatów logiki (DRY) — ta sama operacja nie jest skopiowana w kilku miejscach. `[WAŻNE]`
- [ ] Brak god object / klasy, która robi zbyt wiele rzeczy naraz. `[WAŻNE]`
- [ ] Importy / zależności na górze pliku, nie w środku funkcji (chyba że komentarz uzasadnia leniwe ładowanie). `[WAŻNE]`
- [ ] Brak funkcji zagnieżdżonych wewnątrz innych funkcji, chyba że to < 3 linie i zamknięty scope. `[WAŻNE]`
- [ ] Kod sformatowany zgodnie z linterem / formaterem projektu (Prettier, Black, ESLint, flake8…). `[SUGESTIA]`

---

## 2. Architektura i struktura

- [ ] Moduły mają jasne granice i odpowiedzialności — brak przecieków abstrakcji między warstwami. `[WAŻNE]`
- [ ] Nowe moduły / pliki mają krótki docstring / komentarz modułu wyjaśniający cel (szczególnie skróty i nazwy nieoczywiste). `[WAŻNE]`
- [ ] Zależności między modułami są minimalne i świadome — brak ukrytego sprzężenia. `[WAŻNE]`
- [ ] Pliki jednorazowych skryptów / migracji usunięte po zakończeniu ich roli (albo świadomie zarchiwizowane). `[WAŻNE]`
- [ ] Wzorce projektowe zastosowane tam, gdzie mają sens — nie na siłę. `[SUGESTIA]`
- [ ] Adnotacje typów (Python: type hints, TS: typy) obecne w nowych i zmienionych funkcjach publicznych. `[SUGESTIA]`

---

## 3. Obsługa błędów

- [ ] Wyjątki nie są połykane w ciszy (`except: pass` lub `catch` bez logowania). `[KRYTYCZNE]`
- [ ] Brak zagnieżdżonych bloków try/catch bez uzasadnienia — jeden try, jasny zakres. `[WAŻNE]`
- [ ] Komunikaty błędów mówią co i gdzie poszło nie tak — bez wycieku danych wrażliwych. `[WAŻNE]`
- [ ] Brak crashu przy typowych złych danych: pusty string, `null`/`None`/`undefined`, nieistniejące ID. `[KRYTYCZNE]`
- [ ] Wywołania zewnętrznych serwisów (API, baza, kolejka) mają obsługę timeoutu i błędu sieciowego. `[KRYTYCZNE]`
- [ ] Zewnętrzne API z limitem zapytań (429) obsłużone retry z backoffem. `[WAŻNE]`

---

## 4. Bezpieczeństwo

- [ ] Brak hardcodowanych kluczy API, haseł, tokenów — tylko zmienne środowiskowe. `[KRYTYCZNE]`
- [ ] Walidacja wszystkich zewnętrznych danych wejściowych (query params, body, nagłówki). `[KRYTYCZNE]`
- [ ] Nowy endpoint wymaga uwierzytelnienia — brak tokenu zwraca 401, nie dane. `[KRYTYCZNE]` `[JEŚLI DOTYCZY]`
- [ ] Nowy endpoint weryfikuje własność zasobu — użytkownik A nie może dostać danych użytkownika B przez cudze ID. `[KRYTYCZNE]` `[JEŚLI DOTYCZY]`
- [ ] Brak podatności SQL injection / XSS / CSRF w adekwatnych kontekstach. `[KRYTYCZNE]`
- [ ] Używane biblioteki / paczki są aktualne — brak znanych CVE w dodanych zależnościach. `[WAŻNE]`

---

## 5. Wydajność i zasoby

- [ ] Brak oczywistego N+1 — zapytania do bazy / zewnętrznych serwisów nie są wywoływane w pętli po wynikach. `[WAŻNE]`
- [ ] Połączenia, pliki i zasoby są zamykane / używają context managera (`with` / `using`). `[WAŻNE]`
- [ ] Blokujące wywołania I/O nie są używane w async kontekście bez `await` lub `run_in_executor`. `[KRYTYCZNE]`
- [ ] Duże dane nie są ładowane do pamięci w całości bez uzasadnienia. `[WAŻNE]`
- [ ] Optymalizacja wydajności oparta na pomiarach, nie intuicji — brak przedwczesnej optymalizacji kosztem czytelności. `[SUGESTIA]`

---

## 6. Testy

- [ ] Nowa logika ma przynajmniej jeden test — nawet prosty happy path. `[KRYTYCZNE]`
- [ ] Testy pokrywają przynajmniej jeden przypadek negatywny (zły input, brak zasobu, błąd zewnętrzny). `[WAŻNE]`
- [ ] Wywołania zewnętrznych serwisów (API, baza danych, kolejka) są mockowane w testach. `[WAŻNE]`
- [ ] Testy nie polegają na kolejności wykonania ani globalnym stanie. `[WAŻNE]`
- [ ] Mocki / patche są czyszczone po teście — nie wyciekają do kolejnych testów. `[WAŻNE]`
- [ ] Przynajmniej jeden test sprawdza zachowanie przy niedostępnym serwisie zewnętrznym (timeout / wyjątek). `[WAŻNE]`
- [ ] Nazwy testów opisują przypadek użycia (`test_returns_404_when_user_not_found`, nie `test_func1`). `[SUGESTIA]`

---

## 7. Typy i kontrakty API

- [ ] Build / kompilacja TypeScript / mypy przechodzi bez błędów w zmienionych plikach. `[KRYTYCZNE]`
- [ ] Przed usunięciem pola — grep po całym projekcie, żeby nie złamać ukrytego miejsca. `[WAŻNE]`
- [ ] Zmiana kontraktu API (endpoint, nazwa pola, typ odpowiedzi) jest świadoma — front i back zaktualizowane razem lub zachowana kompatybilność wsteczna. `[KRYTYCZNE]`
- [ ] Pola oznaczone jako legacy — usunięte po migracji lub opisane jako aktualny kontrakt (bez mylących komentarzy). `[WAŻNE]`
- [ ] Breaking changes opisane w CHANGELOG przed mergem, link w opisie PR. `[WAŻNE]` `[JEŚLI DOTYCZY]`

---

## 8. Środowisko i zależności

- [ ] Brak kluczy / haseł w repozytorium — tylko `.env.example` z opisem zmiennych. `[KRYTYCZNE]`
- [ ] `.env` jest w `.gitignore`. `[KRYTYCZNE]`
- [ ] Wszystkie wymagane zmienne środowiskowe opisane w `.env.example` lub README. `[WAŻNE]`
- [ ] Nowa zależność dodana do `requirements.txt` / `package.json` — nie tylko zainstalowana lokalnie. `[WAŻNE]`
- [ ] Zmiana schematu bazy danych ma napisaną, przetestowaną i odwracalną migrację. `[KRYTYCZNE]` `[JEŚLI DOTYCZY]`

---

## 9. Dane i prywatność

- [ ] Logi nie zawierają danych osobowych (PII) ani treści prywatnych użytkownika — loguj zdarzenia i błędy, nie content. `[KRYTYCZNE]`
- [ ] Dane wrażliwe nie są serializowane do plików tymczasowych ani cache'u bez świadomej decyzji. `[WAŻNE]`
- [ ] Nowe pola z danymi użytkownika mają przemyślane miejsce i czas przechowywania. `[WAŻNE]`

---

## 10. Jakość PR i diff

- [ ] Diff nie zawiera przypadkowych plików (notatki, scratch files, pliki IDE). `[WAŻNE]`
- [ ] PR obejmuje tylko zmiany związane z opisanym zadaniem — bez niezwiązanych „przy okazji poprawiłem". `[WAŻNE]`
- [ ] Diff orientacyjnie < 400 linii — przy większym rozważ podział na mniejsze PR. `[SUGESTIA]`
- [ ] CI przechodzi (build + testy zielone) — link do runu w opisie PR. `[KRYTYCZNE]`
- [ ] Opis PR / commit message: co i dlaczego (nie tylko `fix` lub `update`). `[WAŻNE]`
- [ ] Przejrzałeś własny diff jak recenzent — zanim wystawisz do review. `[WAŻNE]`

---

## 11. Smoke test

> Weryfikuj lokalnie lub na stagingu, przed mergem do `main`. Odpowiedzialny: autor PR.

- [ ] Aplikacja startuje bez błędów i ostrzeżeń na lokalnym / stagingowym środowisku. `[KRYTYCZNE]`
- [ ] Podstawowa ścieżka użytkownika działa end-to-end (np. rejestracja → logowanie → główna akcja). `[KRYTYCZNE]`
- [ ] Endpoint `/health` lub równoważny zwraca 200 z aktualną wersją. `[WAŻNE]`
- [ ] Żaden krok powyżej nie generuje `ERROR` / `Unhandled exception` w logach. `[KRYTYCZNE]`
- [ ] Przy symulowanym błędzie zewnętrznego serwisu użytkownik widzi komunikat, nie zawieszenie UI. `[WAŻNE]`
- [ ] Zapytanie z nieistniejącym lub cudzym ID zwraca 404 / 403, nie dane ani błąd 500. `[WAŻNE]` `[JEŚLI DOTYCZY]`

---

## Szybkie komendy

```bash
# TypeScript — sprawdzenie typów
npm run build

# Python — testy
pytest -q

# Python — sprawdzenie typów
mypy . --ignore-missing-imports

# Python — formatowanie i linting
black --check .
flake8 .

# Sprawdzenie czy pole jest używane przed usunięciem
grep -r "nazwa_pola" src/ backend/

# Sprawdzenie czy nie ma niezacommitowanych zależności
pip freeze | diff - requirements.txt
npm ls --depth=0
```

---

## Porady (żeby nie było wstydu na review)

- **„Po co to tu jest, skoro jest tam?"** — przed dodaniem pliku / konfiguracji zastanów się, czy nie duplikujesz źródła prawdy.
- **Skróty w nazwach** — OK, ale pierwsze linie modułu powinny wyjaśnić co się w środku dzieje.
- **Funkcja wewnątrz funkcji** — review zawsze to flaguje; wyciągnij na poziom klasy lub modułu.
- **Powtarzające się `if` na tej samej zmiennej** — scal w jedną gałąź albo pomocniczą zmienną.
- **Obsługa błędów to nie opcja** — jeśli coś może się nie udać (sieć, timeout, brak pliku), kod powinien to obsłużyć świadomie.
- **Logi a prywatność** — treść danych użytkownika w logach to potencjalny problem prawny, nie tylko techniczny.
- **Nowa biblioteka = aktualizacja pliku zależności** — zanim skomitujesz, sprawdź `pip freeze` lub `npm ls`.
- **Autoryzacja** — przy każdym nowym endpoincie: „Czy niezalogowany użytkownik może to wywołać?" i „Czy użytkownik A może dostać dane B?".
- **Async/await** — jedno synchroniczne wywołanie blokujące w `async def` może zamrozić cały serwer pod obciążeniem.
- **Migracje bazy** — przy każdej zmianie schematu: „Co się stanie ze starymi danymi?" i „Czy mogę to cofnąć?".
- **Przed oddaniem przejrzyj diff sam** — jakbyś był recenzentem. Często sam znajdziesz 3 rzeczy do poprawki zanim ktoś inny to zobaczy.
