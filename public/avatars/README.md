# Awatary postaci (`public/avatars`)

Backend generuje (i cache’uje) awatary DALL‑E pod ścieżką:

- `/avatars/<character_id>.jpg`

Pliki są zapisywane lokalnie jako:

- `public/avatars/<character_id>.jpg`

Jeśli obraz nie istnieje jeszcze, frontend pokaże emoji jako fallback i spróbuje ponownie przez chwilę po wyborze postaci.

## Nazwy plików

Nazwa pliku musi odpowiadać `character.id` z backendu (np. `copernicus.jpg`, `marie_curie.jpg`, `napoleon.jpg`, `da_vinci.jpg`, `cleopatra.jpg`, `einstein.jpg`, `joan_of_arc.jpg`).

