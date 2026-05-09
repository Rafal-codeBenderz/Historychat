/**
 * Presety epok — opcja A z POMYSLY v3: jawna etykieta eurocentryzmu.
 * Ustawiają reprezentatywny rok na suwaku (użytkownik może dalej korygować).
 */
export type EpochPreset = { id: string; label: string; year: number };

export const TT_EPOCH_PRESETS_EUROPE: EpochPreset[] = [
  { id: 'eu_ancient', label: 'Starożytność (ok. VIII w. p.n.e.–V w.)', year: -200 },
  { id: 'eu_medieval', label: 'Średniowiecze (ok. V–XV w.)', year: 1100 },
  { id: 'eu_renaissance', label: 'Renesans (ok. XIV–XVII w.)', year: 1520 },
  { id: 'eu_enlightenment', label: 'Oświecenie (ok. XVII–XVIII w.)', year: 1750 },
  { id: 'eu_19c', label: 'XIX wiek', year: 1850 },
  { id: 'eu_20c_early', label: 'XX wiek do 1945', year: 1925 },
  { id: 'eu_contemporary', label: 'Po 1945', year: 1965 },
];
