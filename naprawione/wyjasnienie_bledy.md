# Status uwag z `bledy.txt`

Poniżej znajduje się aktualny status uwag zapisanych w `bledy.txt`.

## Naprawione

- `backend/core/characters_imported.py`
  - Plik został usunięty.
  - Problem duplikowania konfiguracji już nie występuje.
  - Uwaga o docstringu przestała mieć znaczenie, bo plik już nie istnieje.

- `backend/core/prompting.py`
  - Powtórzony warunek `if fragments` został uproszczony do jednego miejsca.
  - Logika budowania `fragments_text` i `rule_when_sources` została scalona.

- `backend/core/rag_engine.py`
  - Funkcje wewnętrzne `pack_results` i `pool_for_stem` zostały wyniesione do metod klasy.
  - `import faiss`, `import torch` i `import numpy as np` zostały uporządkowane.
  - Zagnieżdżone `try` przy ładowaniu embeddera zostało uproszczone.

## Zostawione celowo

- `src/types.ts`
  - Pole `voiceName` nadal istnieje, ale jest utrzymywane świadomie dla kompatybilności wstecznej.
  - Backend nadal używa go do wyliczania `voice_id`, więc nie jest to martwe pole.

## Nadal istnieją, ale nie wyglądają dziś na błąd

- `docs/REFAKTORYZACJA_PLAN_v2.md`
  - Plik nadal istnieje.
  - Wygląda na aktywny dokument planistyczny, a nie na zbędny artefakt.

- `scripts/regen_characters_module.py`
  - Skrypt nadal istnieje.
  - Z opisu i dokumentacji wynika, że nadal służy do generowania `backend/core/characters_debata_migrated.py`.

## Częściowo zaadresowane

- `scripts/fill_missing_kb_from_wikipedia.py`
  - Nie dodano wszystkich postaci do mapy `special`.
  - Dopisano jednak wyjaśnienie, że aliasy i fallbacki są celowo niepełne, a reszta przypadków ma działać przez heurystyki ogólne.

## Podsumowanie

Najważniejsze techniczne problemy z `bledy.txt` zostały naprawione:

- usunięto dublujący moduł konfiguracji,
- uproszczono `prompting.py`,
- uporządkowano `rag_engine.py`.

Pozostałe punkty dotyczą głównie świadomej kompatybilności lub decyzji projektowych, a nie oczywistych błędów.
