import { useMemo, useState, useEffect, useRef, type FormEvent, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Character, SuggestedTopic } from '@types';
import {
  TIME_TRAVEL_LOCATION_MAX,
  TIME_TRAVEL_YEAR_MAX,
  TIME_TRAVEL_YEAR_MIN,
} from '../constants/timeTravel';
import { useTimeTravelChat, type TimeTravelPersistedChat } from '../hooks/useTimeTravelChat';
import {
  fetchTimeTravelMeta,
  filterCharacterIdsForTimeTravel,
  hasVisitedScene,
  markSceneVisited,
  suggestTimeTravelPlaces,
  trackTimeTravelEvent,
  eraBucketForYear,
} from '@utils';
import { getEraTheme } from '../utils/timeTravelEraTheme';
import { TT_EPOCH_PRESETS_EUROPE } from '../utils/timeTravelEpochPresets';
import { getInitialTTLandingVariant } from '../utils/timeTravelLanding';
import {
  clearJourneyBeats,
  loadJourneyBeats,
  recordJourneyBeat,
  type JourneyBeat,
} from '../utils/timeTravelSessionHistory';
import { CharacterAvatar, MessageBubble, TypingIndicator } from '@components';
import { TimeTravelAmbient } from './TimeTravelAmbient';
import { TimeTravelEraTimeline } from './TimeTravelEraTimeline';
import { TimeTravelRegionMap } from './TimeTravelRegionMap';
import { preloadTimeTravelAmbientOnce } from '../utils/timeTravelAmbientPreload';

const TT_SESSION_KEY = 'historychat_tt_session_v1';
const TT_ANALYTICS_SESSION_FLAG = 'historychat_tt_analytics_session_reported_v1';
const TT_SCENES_VERSION_KEY = 'historychat_tt_scenes_catalog_v1';
const TT_MISSION_ANALYTICS_SHOWN_KEY = 'historychat_tt_mission_strip_analytics_v1';
const TT_SKIP_INTRO_SESSION_KEY = 'historychat_tt_skip_intro_v1';
/** Min. liczba scen w katalogu z pokryciem ≥ MIN_SCENE_COVERAGE, by pokazać losowanie (katalog docelowo ≥30 scen). */
const MIN_SCENES_FOR_RANDOM = 15;
/** Minimalna liczba postaci z meta pasujących do pary rok+miejsce — zgodnie z kryterium redakcyjnym katalogu (≥3). */
const MIN_SCENE_COVERAGE = 3;
const PLACE_CHIPS_FALLBACK = ['Frombork', 'Warszawa', 'Paryż', 'Londyn', 'Rzym', 'Wiedeń', 'Kraków', 'Nowy Jork'];

type Step = 'search' | 'results' | 'chat';

type PerspectiveKey = 'ruler' | 'citizen' | 'artist' | 'soldier';

type SceneEntry = {
  id: string;
  year: number;
  place: string;
  label: string;
  coverage_count?: number;
};

type CalibrationUi =
  | null
  | { phase: 'calibrating' }
  | { phase: 'revealing'; scene: SceneEntry };

type ScenesCatalogFile = { version: number; scenes: SceneEntry[] };

type MissionEntry = { id: string; label: string; hint: string };

type TTSessionPayload = {
  step: Step;
  searchYear: string;
  searchLocation: string;
  perspectiveFilter: PerspectiveKey | null;
  chat: TimeTravelPersistedChat | null;
};

type TimeTravelSectionProps = {
  characters: Character[];
  onBackToClassic: () => void;
  playAudio: (url: string) => void;
  stopAudio: () => void;
};

function parseYear(s: string): number | null {
  const y = parseInt(s, 10);
  return Number.isNaN(y) ? null : y;
}

function travelDiaryLine(
  index: number,
  year: string,
  location: string,
  eraLabel: string,
  role: 'user' | 'assistant',
): string {
  const n = index + 1;
  const slot = role === 'user' ? 'Notatka podróżnika' : 'Wpis z rozmowy';
  return `${slot} ${n} · ${location}, ${year} · ${eraLabel}`;
}

export function TimeTravelSection({
  characters,
  onBackToClassic,
  playAudio,
  stopAudio,
}: TimeTravelSectionProps) {
  const [step, setStep] = useState<Step>('search');
  const [searchYear, setSearchYear] = useState('1540');
  const [searchLocation, setSearchLocation] = useState('Frombork');
  const [perspectiveFilter, setPerspectiveFilter] = useState<PerspectiveKey | null>(null);
  const [ttMeta, setTtMeta] = useState<Awaited<ReturnType<typeof fetchTimeTravelMeta>> | null>(null);
  const [metaError, setMetaError] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);
  const [scenesCatalog, setScenesCatalog] = useState<ScenesCatalogFile | null>(null);
  const [suggestPlaces, setSuggestPlaces] = useState<string[]>([]);
  const [skipIntro, setSkipIntro] = useState(false);
  const [calibrationUi, setCalibrationUi] = useState<CalibrationUi>(null);
  const [journeyBeats, setJourneyBeats] = useState<JourneyBeat[]>(() => loadJourneyBeats());
  const [missionEntries, setMissionEntries] = useState<MissionEntry[]>([]);
  const [missionHint, setMissionHint] = useState<string | null>(null);
  const [calibratorFlash, setCalibratorFlash] = useState<number | null>(null);
  const calibrationTimersRef = useRef<{ interval?: number; timeout?: number }>({});

  const placeInputSourceRef = useRef<'suggested' | 'freetext'>('freetext');

  const [landingVariant] = useState<'compact' | 'immersive'>(getInitialTTLandingVariant);

  useEffect(() => {
    if (landingVariant !== 'immersive') return;
    try {
      if (sessionStorage.getItem(TT_SKIP_INTRO_SESSION_KEY) === '1') setSkipIntro(true);
    } catch {
      /* ignore */
    }
  }, [landingVariant]);

  const tt = useTimeTravelChat({ playAudio, characters });

  const hydratedRef = useRef(false);
  const hydrateChatRef = useRef(tt.hydrateChat);
  hydrateChatRef.current = tt.hydrateChat;
  const serializeChatRef = useRef(tt.serializeChat);
  serializeChatRef.current = tt.serializeChat;

  const yNum = parseYear(searchYear) ?? 1540;
  const eraTheme = getEraTheme(yNum);
  const eraCss = eraTheme.cssVars as CSSProperties;

  const ttChars = useMemo(
    () => characters.filter((c) => c.time_travel && typeof c.time_travel === 'object'),
    [characters],
  );
  const withPerspectiveCount = useMemo(
    () =>
      ttChars.filter(
        (c) =>
          typeof c.time_travel === 'object' &&
          c.time_travel &&
          typeof (c.time_travel as { perspective?: string }).perspective === 'string',
      ).length,
    [ttChars],
  );
  const showPerspectiveRow = ttChars.length > 0 && withPerspectiveCount / ttChars.length >= 0.5;

  const randomEligibleScenes = useMemo(() => {
    const list = scenesCatalog?.scenes ?? [];
    return list.filter((s) => (s.coverage_count ?? 0) >= MIN_SCENE_COVERAGE);
  }, [scenesCatalog]);
  const showRandomScene = randomEligibleScenes.length >= MIN_SCENES_FOR_RANDOM;

  const placeChips = useMemo(() => {
    const fromApi = suggestPlaces.slice(0, 8);
    const out: string[] = [];
    const seen = new Set<string>();
    for (const p of fromApi) {
      const k = p.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
      if (out.length >= 8) return out;
    }
    for (const c of PLACE_CHIPS_FALLBACK) {
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
      if (out.length >= 8) break;
    }
    return out;
  }, [suggestPlaces]);

  /** Tokeny lokalizacji z pełnej mapy meta — uzupełnia datalist przy wpisywaniu (Pomysły v3: autouzupełnianie z metadanych). */
  const metaPlaceSuggestions = useMemo(() => {
    if (!ttMeta) return [];
    const q = searchLocation.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of Object.values(ttMeta)) {
      for (const loc of row.locations ?? []) {
        const t = String(loc).trim();
        if (!t) continue;
        const lo = t.toLowerCase();
        if (!(lo.includes(q) || q.includes(lo))) continue;
        if (seen.has(lo)) continue;
        seen.add(lo);
        out.push(t);
        if (out.length >= 48) return out.sort((a, b) => a.localeCompare(b, 'pl'));
      }
    }
    return out.sort((a, b) => a.localeCompare(b, 'pl'));
  }, [ttMeta, searchLocation]);

  const placeDatalistOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of suggestPlaces) {
      const lo = p.trim().toLowerCase();
      if (!lo || seen.has(lo)) continue;
      seen.add(lo);
      out.push(p);
    }
    for (const p of metaPlaceSuggestions) {
      const lo = p.trim().toLowerCase();
      if (!lo || seen.has(lo)) continue;
      seen.add(lo);
      out.push(p);
    }
    return out;
  }, [suggestPlaces, metaPlaceSuggestions]);

  useEffect(() => {
    if (ttMeta === null || metaError) return;
    preloadTimeTravelAmbientOnce();
  }, [ttMeta, metaError]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(TT_ANALYTICS_SESSION_FLAG)) return;
      sessionStorage.setItem(TT_ANALYTICS_SESSION_FLAG, '1');
      trackTimeTravelEvent('tt_session_start', {
        app_shell: 'web',
        landing_variant: landingVariant,
      });
    } catch {
      /* ignore */
    }
  }, [landingVariant]);

  useEffect(() => {
    if (step !== 'chat') return;
    const y = parseYear(tt.year);
    trackTimeTravelEvent('tt_chat_entered', {
      era_bucket: y !== null ? eraBucketForYear(y) : undefined,
      app_shell: 'web',
    });
  }, [step, tt.year]);

  useEffect(() => {
    let cancelled = false;
    fetchTimeTravelMeta()
      .then((m) => {
        if (!cancelled) setTtMeta(m);
      })
      .catch(() => {
        if (!cancelled) {
          setMetaError(true);
          setTtMeta({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/scenes-catalog.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ScenesCatalogFile | null) => {
        if (cancelled || !data?.scenes) return;
        try {
          const v = String(data.version ?? 0);
          if (sessionStorage.getItem(TT_SCENES_VERSION_KEY) !== v) {
            sessionStorage.removeItem(TT_SESSION_KEY);
            sessionStorage.setItem(TT_SCENES_VERSION_KEY, v);
          }
        } catch {
          /* ignore */
        }
        setScenesCatalog(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      const t = calibrationTimersRef.current;
      if (t.interval !== undefined) window.clearInterval(t.interval);
      if (t.timeout !== undefined) window.clearTimeout(t.timeout);
    };
  }, []);

  useEffect(() => {
    const y = parseYear(searchYear);
    if (y === null || y < TIME_TRAVEL_YEAR_MIN || y > TIME_TRAVEL_YEAR_MAX) {
      setSuggestPlaces([]);
      return;
    }
    const regionToken = searchLocation.trim().slice(0, 48);
    const t = window.setTimeout(() => {
      void suggestTimeTravelPlaces(y, regionToken)
        .then((p) => setSuggestPlaces(p.slice(0, 40)))
        .catch(() => setSuggestPlaces([]));
    }, 280);
    return () => clearTimeout(t);
  }, [searchYear, searchLocation]);

  useEffect(() => {
    if (import.meta.env.VITE_TT_MISSIONS !== '1') return;
    let cancelled = false;
    fetch('/data/tt-missions.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { missions?: MissionEntry[] } | null) => {
        if (cancelled || !data?.missions || !Array.isArray(data.missions)) return;
        setMissionEntries(
          data.missions.filter(
            (m) =>
              m &&
              typeof m.id === 'string' &&
              typeof m.label === 'string' &&
              typeof m.hint === 'string',
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== 'search' || import.meta.env.VITE_TT_MISSIONS !== '1' || missionEntries.length === 0) return;
    try {
      if (sessionStorage.getItem(TT_MISSION_ANALYTICS_SHOWN_KEY)) return;
      sessionStorage.setItem(TT_MISSION_ANALYTICS_SHOWN_KEY, '1');
      trackTimeTravelEvent('tt_mission_strip_shown', { mission_slot: 'strip' });
    } catch {
      /* ignore */
    }
  }, [step, missionEntries.length]);

  useEffect(() => {
    if (!characters.length || ttMeta === null || hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem(TT_SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as TTSessionPayload;
      if (s.step === 'search' || s.step === 'results' || s.step === 'chat') setStep(s.step);
      if (typeof s.searchYear === 'string') setSearchYear(s.searchYear);
      if (typeof s.searchLocation === 'string') setSearchLocation(s.searchLocation);
      if (s.perspectiveFilter === 'ruler' || s.perspectiveFilter === 'citizen' || s.perspectiveFilter === 'artist' || s.perspectiveFilter === 'soldier' || s.perspectiveFilter === null) {
        setPerspectiveFilter(s.perspectiveFilter);
      }
      if (s.chat && typeof s.chat === 'object') {
        hydrateChatRef.current(s.chat);
        if (s.step === 'chat' && s.chat.selectedCharId) {
          const id = s.chat.selectedCharId;
          if (!characters.some((c) => c.id === id)) setStep('results');
        }
      }
    } catch {
      /* ignore */
    }
  }, [characters, ttMeta]);

  useEffect(() => {
    if (ttMeta === null || typeof sessionStorage === 'undefined') return;
    try {
      const payload: TTSessionPayload = {
        step,
        searchYear,
        searchLocation,
        perspectiveFilter,
        chat: serializeChatRef.current(),
      };
      sessionStorage.setItem(TT_SESSION_KEY, JSON.stringify(payload));
    } catch {
      /* quota */
    }
  }, [
    step,
    searchYear,
    searchLocation,
    perspectiveFilter,
    ttMeta,
    tt.messages,
    tt.selectedChar?.id,
    tt.year,
    tt.location,
    tt.sourceStem,
  ]);

  const filteredCharacters = useMemo(() => {
    if (ttMeta === null) return [];
    const y = parseInt(searchYear, 10);
    if (Number.isNaN(y) || !searchLocation.trim()) return [];
    const ids = filterCharacterIdsForTimeTravel(
      ttMeta,
      characters.map((c) => c.id),
      y,
      searchLocation.trim(),
    );
    let list = characters.filter((c) => ids.has(c.id));
    if (perspectiveFilter && showPerspectiveRow) {
      list = list.filter((c) => {
        const m = c.time_travel;
        if (!m || typeof m !== 'object') return false;
        return m.perspective === perspectiveFilter;
      });
    }
    return list;
  }, [characters, searchYear, searchLocation, ttMeta, perspectiveFilter, showPerspectiveRow]);

  useEffect(() => {
    tt.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tt.messages, tt.loading, tt.messagesEndRef]);

  const markPlaceFreeText = () => {
    placeInputSourceRef.current = 'freetext';
  };
  const markPlaceSuggested = () => {
    placeInputSourceRef.current = 'suggested';
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setYearError(null);
    const y = parseInt(searchYear, 10);
    const loc = searchLocation.trim();
    if (Number.isNaN(y) || y < TIME_TRAVEL_YEAR_MIN || y > TIME_TRAVEL_YEAR_MAX) {
      setYearError(`Rok musi być w zakresie ${TIME_TRAVEL_YEAR_MIN}–${TIME_TRAVEL_YEAR_MAX}.`);
      return;
    }
    if (!loc || loc.length > TIME_TRAVEL_LOCATION_MAX) {
      setYearError('Podaj miejsce (do 200 znaków).');
      return;
    }
    const src = placeInputSourceRef.current;
    if (src === 'suggested') {
      trackTimeTravelEvent('tt_place_suggested', { place_input_type: 'suggested', app_shell: 'web' });
    } else {
      trackTimeTravelEvent('tt_place_freetext', { place_input_type: 'freetext', app_shell: 'web' });
    }
    setStep('results');
  };

  const applySceneWithCalibration = (scene: SceneEntry) => {
    markPlaceSuggested();
    const t = calibrationTimersRef.current;
    if (t.interval !== undefined) window.clearInterval(t.interval);
    if (t.timeout !== undefined) window.clearTimeout(t.timeout);
    setCalibrationUi({ phase: 'calibrating' });
    setCalibratorFlash(null);
    const started = Date.now();
    const span = TIME_TRAVEL_YEAR_MAX - TIME_TRAVEL_YEAR_MIN + 1;
    t.interval = window.setInterval(() => {
      const elapsed = Date.now() - started;
      if (elapsed > 780) {
        window.clearInterval(t.interval);
        t.interval = undefined;
        setSearchYear(String(scene.year));
        setSearchLocation(scene.place);
        setCalibratorFlash(null);
        setCalibrationUi({ phase: 'revealing', scene });
        t.timeout = window.setTimeout(() => {
          setCalibrationUi(null);
          t.timeout = undefined;
        }, 720);
        return;
      }
      setCalibratorFlash(TIME_TRAVEL_YEAR_MIN + Math.floor(Math.random() * span));
    }, 72);
  };

  const tryYearDelta = (delta: number) => {
    const y = parseInt(searchYear, 10);
    if (Number.isNaN(y)) return;
    const next = Math.min(TIME_TRAVEL_YEAR_MAX, Math.max(TIME_TRAVEL_YEAR_MIN, y + delta));
    setSearchYear(String(next));
    markPlaceFreeText();
    setStep('search');
  };

  const openChat = (char: Character) => {
    const y = searchYear.trim();
    const loc = searchLocation.trim();
    const returning = hasVisitedScene(y, loc);
    tt.startChatWithCharacter(char, y, loc, { returningVisitor: returning });
    markSceneVisited(y, loc);
    recordJourneyBeat({ year: y, place: loc, charName: char.name });
    setJourneyBeats(loadJourneyBeats());
    setStep('chat');
  };

  const goResults = () => {
    tt.resetSession();
    setStep('results');
  };

  const goSearch = () => {
    tt.resetSession();
    setStep('search');
  };

  const pinnedTopics: SuggestedTopic[] =
    tt.selectedChar?.suggestedTopics?.filter((t) => t.sourceStem?.trim()) ?? [];

  const labelMuted = 'rgba(255,255,255,0.35)';
  const labelSoft = 'rgba(255,255,255,0.55)';
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: 'rgba(255,255,255,0.9)',
    fontSize: '15px',
    fontFamily: "'Outfit', sans-serif",
    outline: 'none',
  };

  const chatEraLabel = getEraTheme(parseInt(tt.year, 10) || 0).label;
  const resultsEraLabel = getEraTheme(parseInt(searchYear, 10) || 0).label;

  const immersiveActive = landingVariant === 'immersive' && !skipIntro && step === 'search';

  return (
    <div
      id="tt-root"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        ...eraCss,
      }}
    >
      <div
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBackToClassic}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            color: labelSoft,
            fontSize: '13px',
            fontFamily: "'Outfit', sans-serif",
            cursor: 'pointer',
          }}
        >
          Wróć do trybu klasycznego
        </button>
        <div
          style={{
            fontSize: '12px',
            color: labelMuted,
            fontFamily: eraTheme.headingFont,
            fontStyle: 'italic',
          }}
        >
          Podróż w czasie · ustawiasz współrzędne, potem spotykasz świadków epoki
        </div>
      </div>

      {metaError && (
        <div
          style={{
            padding: '10px 24px',
            fontSize: '13px',
            color: 'rgba(255,200,120,0.9)',
            background: 'rgba(80,40,0,0.25)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          Nie udało się załadować metadanych podróży — wyszukiwanie postaci jest wtedy niedostępne. Odśwież stronę,
          sprawdź czy backend działa (np. GET /api/health), albo spróbuj ponownie później.
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: immersiveActive ? '0' : '24px 32px',
          minHeight: 0,
          ...(immersiveActive
            ? {
                background: `linear-gradient(165deg, var(--tt-era-bg0, rgba(30,40,60,0.5)), var(--tt-era-bg1, rgba(10,12,18,0.9)))`,
              }
            : {}),
        }}
      >
        <AnimatePresence mode="wait">
          {step === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              style={{
                maxWidth: immersiveActive ? '100%' : '560px',
                margin: '0 auto',
                paddingTop: immersiveActive ? '48px' : '32px',
                paddingLeft: immersiveActive ? '24px' : '0',
                paddingRight: immersiveActive ? '24px' : '0',
                paddingBottom: immersiveActive ? '48px' : '0',
                minHeight: immersiveActive ? 'min(85vh, 720px)' : undefined,
                boxSizing: 'border-box',
              }}
            >
              {immersiveActive && (
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    style={{
                      fontFamily: eraTheme.headingFont,
                      fontSize: 'clamp(28px, 5vw, 40px)',
                      fontWeight: 600,
                      color: eraTheme.bodyAccent,
                      marginBottom: '12px',
                    }}
                  >
                    Podróż w czasie
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.15 }}
                    style={{
                      color: labelMuted,
                      fontSize: '15px',
                      lineHeight: 1.6,
                      maxWidth: '420px',
                      margin: '0 auto',
                    }}
                  >
                    Kalibrujesz rok i miejsce — potem otworzysz scenę z postaciami z bazy HistoriaChat.
                  </motion.p>
                  <motion.button
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.35 }}
                    onClick={() => {
                      setSkipIntro(true);
                      try {
                        sessionStorage.setItem(TT_SKIP_INTRO_SESSION_KEY, '1');
                      } catch {
                        /* ignore */
                      }
                    }}
                    style={{
                      marginTop: '18px',
                      padding: '9px 18px',
                      borderRadius: '999px',
                      border: '1px solid var(--tt-era-accent, rgba(200,170,120,0.45))',
                      background: 'rgba(0,0,0,0.2)',
                      color: labelSoft,
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    Pomiń intro — od razu do formularza
                  </motion.button>
                </div>
              )}

              {!immersiveActive && (
                <h1
                  style={{
                    fontFamily: eraTheme.headingFont,
                    fontSize: '32px',
                    fontWeight: 400,
                    color: 'rgba(255,255,255,0.88)',
                    marginBottom: '12px',
                  }}
                >
                  Ustaw współrzędne czasoprzestrzenne
                </h1>
              )}
              {!immersiveActive && (
                <p style={{ color: labelMuted, fontSize: '15px', marginBottom: '20px', lineHeight: 1.6 }}>
                  Podaj rok i miejsce — pokażemy postacie, które w uproszczonym modelu epok i regionów mogłyby tam
                  przebywać.
                </p>
              )}

              <details style={{ marginBottom: '20px', fontSize: '13px', color: labelSoft }}>
                <summary style={{ cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>Jak to działa?</summary>
                <p style={{ marginTop: '10px', lineHeight: 1.55, color: labelMuted }}>
                  Wpisz rok i nazwę miasta lub regionu. Możesz użyć historycznej lub współczesnej nazwy — jeśli brak
                  wyników, spróbuj drugiej formy. Wyniki pochodzą z metadanych bazy, nie z pełnej mapy świata.
                </p>
              </details>

              {journeyBeats.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: labelMuted, fontFamily: "'Outfit', sans-serif" }}>
                      Ostatnie sceny w tej sesji
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearJourneyBeats();
                        setJourneyBeats([]);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'transparent',
                        color: labelMuted,
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                      }}
                    >
                      Wyczyść listę
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {journeyBeats.slice(0, 6).map((b) => (
                      <button
                        key={`${b.at}-${b.year}-${b.place}`}
                        type="button"
                        onClick={() => {
                          setSearchYear(b.year);
                          setSearchLocation(b.place);
                          markPlaceSuggested();
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '999px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'rgba(0,0,0,0.2)',
                          color: labelSoft,
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontFamily: "'Outfit', sans-serif",
                        }}
                      >
                        {b.year} · {b.place}
                        {b.charName ? ` · ${b.charName}` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ttMeta === null && (
                <div
                  className="flex flex-col items-center gap-2"
                  style={{ marginBottom: '20px', color: labelSoft, fontSize: '14px', fontFamily: "'Outfit', sans-serif" }}
                >
                  <div
                    className="h-5 w-5 shrink-0 rounded-full border-2 border-white/20 border-t-amber-200/70 animate-spin"
                    aria-hidden
                  />
                  Ładowanie metadanych podróży…
                </div>
              )}

              {scenesCatalog && scenesCatalog.scenes.filter((s) => (s.coverage_count ?? 0) >= MIN_SCENE_COVERAGE).length > 0 && (
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '12px', color: labelMuted, marginBottom: '10px', fontFamily: "'Outfit', sans-serif" }}>
                    Popularne sceny (tydzień — statyczny katalog)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {scenesCatalog.scenes
                      .filter((s) => (s.coverage_count ?? 0) >= MIN_SCENE_COVERAGE)
                      .map((scene) => (
                        <button
                          key={scene.id}
                          type="button"
                          disabled={calibrationUi !== null || ttMeta === null}
                          onClick={() => applySceneWithCalibration(scene)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '12px',
                            border: '1px solid var(--tt-era-border, rgba(255,255,255,0.15))',
                            background: 'rgba(0,0,0,0.25)',
                            color: labelSoft,
                            fontSize: '13px',
                            textAlign: 'left',
                            maxWidth: '220px',
                            cursor: ttMeta === null ? 'wait' : 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          <span style={{ color: eraTheme.bodyAccent, fontWeight: 600 }}>{scene.year}</span>
                          <span style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}>{scene.label}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {showRandomScene && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="button"
                    disabled={ttMeta === null || calibrationUi !== null}
                    onClick={() => {
                      const pick = randomEligibleScenes[Math.floor(Math.random() * randomEligibleScenes.length)];
                      if (pick) applySceneWithCalibration(pick);
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)',
                      color: labelSoft,
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    Losowa scena z katalogu
                  </button>
                </div>
              )}

              <AnimatePresence mode="wait">
                {calibrationUi?.phase === 'calibrating' && (
                  <motion.div
                    key="cal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      marginBottom: '16px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px dashed var(--tt-era-accent, rgba(200,170,120,0.5))',
                      color: labelSoft,
                      fontSize: '14px',
                      fontFamily: eraTheme.headingFont,
                    }}
                  >
                    <div>Kalibrowanie współrzędnych…</div>
                    <AnimatePresence mode="wait">
                      {calibratorFlash !== null && (
                        <motion.div
                          key={calibratorFlash}
                          initial={{ opacity: 0.35, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0.2 }}
                          transition={{ duration: 0.12 }}
                          style={{
                            marginTop: '10px',
                            fontSize: '28px',
                            letterSpacing: '0.04em',
                            color: eraTheme.bodyAccent,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {calibratorFlash}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <p
                      style={{
                        marginTop: '10px',
                        fontSize: '12px',
                        color: labelMuted,
                        lineHeight: 1.5,
                        fontFamily: "'Outfit', sans-serif",
                        fontStyle: 'normal',
                      }}
                    >
                      Igła przeskakuje przez przypadkowe lata, zanim zatrzyma się na wybranej scenie.
                    </p>
                  </motion.div>
                )}
                {calibrationUi?.phase === 'revealing' && (
                  <motion.div
                    key="rev"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{
                      marginBottom: '16px',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      border: '1px solid var(--tt-era-border, rgba(200,170,120,0.35))',
                      background: 'rgba(0,0,0,0.28)',
                      color: labelSoft,
                      fontFamily: eraTheme.headingFont,
                    }}
                  >
                    <div style={{ fontSize: '12px', color: labelMuted, marginBottom: '6px', fontFamily: "'Outfit', sans-serif" }}>
                      Ujawnianie współrzędnych
                    </div>
                    <div style={{ fontSize: '24px', color: eraTheme.bodyAccent, fontVariantNumeric: 'tabular-nums' }}>
                      {calibrationUi.scene.year}
                    </div>
                    <div style={{ fontSize: '16px', marginTop: '4px' }}>{calibrationUi.scene.place}</div>
                    <div style={{ fontSize: '13px', marginTop: '8px', color: labelMuted, fontStyle: 'italic' }}>
                      {calibrationUi.scene.label}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSearch} aria-busy={ttMeta === null}>
                <label
                  htmlFor="tt-year-input"
                  style={{ display: 'block', fontSize: '12px', color: labelSoft, marginBottom: '8px' }}
                >
                  Rok
                </label>
                <input
                  id="tt-year-input"
                  type="number"
                  required
                  min={TIME_TRAVEL_YEAR_MIN}
                  max={TIME_TRAVEL_YEAR_MAX}
                  title={`Dozwolony zakres lat: ${TIME_TRAVEL_YEAR_MIN}–${TIME_TRAVEL_YEAR_MAX}`}
                  aria-invalid={!!yearError}
                  aria-describedby={yearError ? 'tt-year-err' : 'tt-year-tip'}
                  value={searchYear}
                  onChange={(e) => {
                    setSearchYear(e.target.value);
                    markPlaceFreeText();
                    setYearError(null);
                  }}
                  style={{ ...inputStyle, marginBottom: '10px' }}
                />
                <input
                  type="range"
                  min={TIME_TRAVEL_YEAR_MIN}
                  max={TIME_TRAVEL_YEAR_MAX}
                  value={Math.min(TIME_TRAVEL_YEAR_MAX, Math.max(TIME_TRAVEL_YEAR_MIN, yNum))}
                  onChange={(e) => {
                    setSearchYear(e.target.value);
                    markPlaceFreeText();
                    setYearError(null);
                  }}
                  disabled={ttMeta === null}
                  aria-label="Suwak roku"
                  style={{
                    width: '100%',
                    marginBottom: '16px',
                    minHeight: '48px',
                    accentColor: 'rgba(200,170,120,0.8)',
                  }}
                />
                <p id="tt-year-tip" style={{ fontSize: '11px', color: labelMuted, marginBottom: '16px' }}>
                  Dozwolony zakres: {TIME_TRAVEL_YEAR_MIN}–{TIME_TRAVEL_YEAR_MAX} (zgodnie z limitem serwera).
                </p>
                {yearError && (
                  <div id="tt-year-err" role="alert" style={{ color: 'rgba(255,200,140,0.95)', fontSize: '13px', marginBottom: '12px' }}>
                    {yearError}
                  </div>
                )}

                <label
                  htmlFor="tt-epoch-preset"
                  style={{ display: 'block', fontSize: '12px', color: labelSoft, marginBottom: '8px' }}
                >
                  Przybliżona epoka (tradycja europejska)
                </label>
                <p style={{ fontSize: '11px', color: labelMuted, marginBottom: '8px', lineHeight: 1.5 }}>
                  Skrót ustawia reprezentatywny rok na suwaku. Inne kultury w tych samych latach mogły przeżywać zupełnie
                  inną „epokę”.
                </p>
                <select
                  id="tt-epoch-preset"
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    setSearchYear(v);
                    markPlaceFreeText();
                    setYearError(null);
                    e.target.selectedIndex = 0;
                  }}
                  style={{
                    ...inputStyle,
                    marginBottom: '12px',
                    cursor: 'pointer',
                    appearance: 'auto',
                  }}
                >
                  <option value="">— Szybki skok: wybierz epokę —</option>
                  {TT_EPOCH_PRESETS_EUROPE.map((ep) => (
                    <option key={ep.id} value={String(ep.year)}>
                      {ep.label}
                    </option>
                  ))}
                </select>
                <TimeTravelEraTimeline />

                <label
                  htmlFor="tt-place-input"
                  style={{ display: 'block', fontSize: '12px', color: labelSoft, marginBottom: '8px' }}
                >
                  Miejsce (miasto lub region)
                </label>
                <p style={{ fontSize: '12px', color: labelMuted, marginBottom: '8px', lineHeight: 1.5 }}>
                  Możesz wpisać historyczną nazwę lub współczesną — spróbuj obu, jeśli brak wyników.
                </p>
                <TimeTravelRegionMap
                  year={yNum}
                  disabled={ttMeta === null}
                  accentColor={eraTheme.bodyAccent}
                  onPick={(place, regionZone) => {
                    markPlaceSuggested();
                    setSearchLocation(place);
                    trackTimeTravelEvent('tt_region_map_pick', {
                      region_zone: regionZone,
                      app_shell: 'web',
                      era_bucket: eraBucketForYear(yNum),
                    });
                    requestAnimationFrame(() => document.getElementById('tt-place-input')?.focus());
                  }}
                />
                <input
                  id="tt-place-input"
                  type="text"
                  required
                  list="tt-place-suggestions"
                  maxLength={TIME_TRAVEL_LOCATION_MAX}
                  value={searchLocation}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchLocation(v);
                    const t = v.trim().toLowerCase();
                    const fromServer = suggestPlaces.some((p) => p.trim().toLowerCase() === t);
                    if (fromServer) markPlaceSuggested();
                    else markPlaceFreeText();
                  }}
                  onFocus={markPlaceFreeText}
                  placeholder="np. Warszawa, Paryż…"
                  style={{ ...inputStyle, marginBottom: '8px' }}
                />
                <datalist id="tt-place-suggestions">
                  {placeDatalistOptions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                {suggestPlaces.length > 0 && (
                  <p style={{ fontSize: '11px', color: labelMuted, marginBottom: '12px', lineHeight: 1.45 }}>
                    Podpowiedzi miejsc z serwera (zależą od roku i wpisanego fragmentu regionu) — wybierz z listy albo
                    kliknij wpis poniżej.
                  </p>
                )}
                {suggestPlaces.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px', maxWidth: '520px' }}>
                    {suggestPlaces.slice(0, 12).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setSearchLocation(p);
                          markPlaceSuggested();
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.04)',
                          color: labelMuted,
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontFamily: "'Outfit', sans-serif",
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                  {placeChips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setSearchLocation(c);
                        markPlaceSuggested();
                        trackTimeTravelEvent('tt_place_chip', {
                          era_bucket: eraBucketForYear(yNum),
                          app_shell: 'web',
                        });
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '999px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.05)',
                        color: labelSoft,
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        minHeight: '40px',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {import.meta.env.VITE_TT_MISSIONS === '1' && missionEntries.length > 0 && (
                  <div
                    style={{
                      marginBottom: '20px',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: labelSoft, marginBottom: '10px', fontFamily: eraTheme.headingFont }}>
                      Pomysły na pierwszą rozmowę (opcjonalnie — waliduj z użytkownikami przed pełnym rolloutem)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: missionHint ? '10px' : 0 }}>
                      {missionEntries.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            trackTimeTravelEvent('tt_mission_pick', { mission_slot: m.id });
                            setMissionHint(m.hint);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.05)',
                            color: labelSoft,
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                            minHeight: '40px',
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {missionHint && (
                      <p
                        style={{
                          fontSize: '13px',
                          color: labelMuted,
                          lineHeight: 1.5,
                          margin: 0,
                          fontFamily: "'EB Garamond', serif",
                          fontStyle: 'italic',
                        }}
                      >
                        {missionHint}
                      </p>
                    )}
                  </div>
                )}

                {showPerspectiveRow && (
                  <div style={{ marginBottom: '20px' }} role="group" aria-labelledby="tt-perspective-heading">
                    <div id="tt-perspective-heading" style={{ fontSize: '12px', color: labelSoft, marginBottom: '10px' }}>
                      Kogo szukasz? (opcjonalnie)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setPerspectiveFilter(null)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          border: perspectiveFilter === null ? '1px solid var(--tt-era-accent, rgba(200,170,120,0.6))' : '1px solid rgba(255,255,255,0.1)',
                          background: perspectiveFilter === null ? 'rgba(200,170,120,0.15)' : 'rgba(0,0,0,0.2)',
                          color: labelSoft,
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontFamily: "'Outfit', sans-serif",
                          minHeight: '44px',
                        }}
                      >
                        Pokaż wszystkich
                      </button>
                      {(
                        [
                          ['ruler', 'Władca / polityk'],
                          ['citizen', 'Mieszczanin / rzemieślnik'],
                          ['artist', 'Artysta / myśliciel'],
                          ['soldier', 'Żołnierz / szlachta'],
                        ] as const
                      ).map(([key, lab]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPerspectiveFilter(key)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border:
                              perspectiveFilter === key
                                ? '1px solid var(--tt-era-accent, rgba(200,170,120,0.6))'
                                : '1px solid rgba(255,255,255,0.1)',
                            background: perspectiveFilter === key ? 'rgba(200,170,120,0.15)' : 'rgba(0,0,0,0.2)',
                            color: labelSoft,
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                            minHeight: '44px',
                          }}
                        >
                          {lab}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={ttMeta === null}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    background:
                      ttMeta === null
                        ? 'rgba(255,255,255,0.08)'
                        : 'linear-gradient(135deg, rgba(200,160,80,0.35), rgba(200,140,60,0.25))',
                    color: 'rgba(255,245,220,0.95)',
                    fontSize: '15px',
                    fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                    cursor: ttMeta === null ? 'wait' : 'pointer',
                  }}
                >
                  {ttMeta === null ? 'Ładowanie…' : 'Otwórz scenę'}
                </button>
              </form>
            </motion.div>
          )}

          {step === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              style={{ ...eraCss }}
            >
              <button
                type="button"
                onClick={goSearch}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(200,170,120,0.85)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginBottom: '20px',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Zmień współrzędne
              </button>
              <div
                style={{
                  marginBottom: '20px',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  border: '1px solid var(--tt-era-border, rgba(255,255,255,0.1))',
                  background: 'linear-gradient(135deg, var(--tt-era-bg0, rgba(0,0,0,0.2)), rgba(0,0,0,0.15))',
                }}
              >
                <div style={{ fontSize: '11px', color: labelMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Scena
                </div>
                <div style={{ fontFamily: eraTheme.headingFont, fontSize: '26px', color: eraTheme.bodyAccent, marginTop: '6px' }}>
                  {searchYear}
                  <span style={{ color: labelSoft, fontWeight: 400, fontSize: '18px' }}> · {searchLocation}</span>
                </div>
                <div style={{ fontSize: '13px', color: labelMuted, marginTop: '8px', fontStyle: 'italic' }}>{resultsEraLabel}</div>
              </div>
              {ttMeta === null ? (
                <p style={{ color: labelMuted, fontSize: '15px' }}>Ładowanie metadanych…</p>
              ) : filteredCharacters.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '13px', color: labelMuted, fontFamily: "'Outfit', sans-serif" }}>
                    Świadkowie epoki — kliknij, by wejść w rozmowę
                  </div>
                  {filteredCharacters.map((char) => {
                    const hint =
                      char.time_travel && typeof char.time_travel === 'object'
                        ? char.time_travel.scene_hint
                        : undefined;
                    const eraTags =
                      char.time_travel &&
                      typeof char.time_travel === 'object' &&
                      Array.isArray(char.time_travel.era_tags)
                        ? char.time_travel.era_tags.filter((t) => typeof t === 'string' && t.trim())
                        : [];
                    const metaRow = ttMeta[char.id];
                    const metaContextLine =
                      !hint && metaRow
                        ? `W metadanych podróży: lata ${metaRow.start_year}–${metaRow.end_year}${
                            metaRow.locations?.length
                              ? ` · m.in. ${metaRow.locations.slice(0, 4).join(', ')}${
                                  metaRow.locations.length > 4 ? '…' : ''
                                }`
                              : ''
                          }`
                        : null;
                    return (
                      <div
                        key={char.id}
                        style={{
                          padding: '18px 20px',
                          borderRadius: '14px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.22)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '14px',
                          alignItems: 'center',
                        }}
                      >
                        <CharacterAvatar char={char} size={48} />
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: 'rgba(255,255,255,0.9)',
                              fontFamily: "'Outfit', sans-serif",
                            }}
                          >
                            {char.name}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: labelMuted,
                              fontFamily: "'EB Garamond', serif",
                              fontStyle: 'italic',
                              marginBottom: '6px',
                            }}
                          >
                            {char.era}
                          </div>
                          {hint && (
                            <div style={{ fontSize: '13px', color: labelSoft, lineHeight: 1.5, fontStyle: 'italic' }}>
                              Dlaczego tu pasuje: {hint}
                            </div>
                          )}
                          {eraTags.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                marginTop: hint ? '10px' : '6px',
                              }}
                            >
                              {eraTags.map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: '10px',
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    padding: '3px 8px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(200,170,120,0.2)',
                                    color: 'rgba(200,175,140,0.75)',
                                    fontFamily: "'Outfit', sans-serif",
                                  }}
                                >
                                  {tag.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                          {metaRow?.suggested_places && metaRow.suggested_places.length > 0 && (
                            <div
                              style={{
                                fontSize: '12px',
                                color: labelMuted,
                                lineHeight: 1.5,
                                marginTop: hint ? '8px' : '4px',
                                fontFamily: "'Outfit', sans-serif",
                              }}
                            >
                              Z metadanych podróży — miejsca: {metaRow.suggested_places.join(' · ')}
                            </div>
                          )}
                          {!hint && metaContextLine && (
                            <div style={{ fontSize: '13px', color: labelMuted, lineHeight: 1.5 }}>
                              {metaContextLine}
                            </div>
                          )}
                          {!hint && !metaContextLine && (
                            <div style={{ fontSize: '13px', color: labelMuted, lineHeight: 1.5 }}>
                              Zakres życia i region z metadanych podróży pokrywają się z tą sceną.
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openChat(char)}
                          style={{
                            padding: '10px 18px',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'rgba(255,255,255,0.12)',
                            color: 'rgba(255,255,255,0.9)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          Rozpocznij rozmowę
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: labelMuted, fontSize: '15px', lineHeight: 1.7 }}>
                  <p style={{ marginBottom: '16px' }}>
                    Nikt z bazy nie pasuje do tej pary rok / miejsce przy obecnym filtrze.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      onClick={() => tryYearDelta(-20)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(0,0,0,0.2)',
                        color: labelSoft,
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        minHeight: '44px',
                      }}
                    >
                      Spróbuj roku −20 lat
                    </button>
                    <button
                      type="button"
                      onClick={() => tryYearDelta(20)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(0,0,0,0.2)',
                        color: labelSoft,
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        minHeight: '44px',
                      }}
                    >
                      Spróbuj roku +20 lat
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        goSearch();
                        document.getElementById('tt-place-input')?.focus();
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(0,0,0,0.2)',
                        color: labelSoft,
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        minHeight: '44px',
                      }}
                    >
                      Pokaż popularne sceny z katalogu
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 'chat' && tt.selectedChar && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 'min(70vh, 640px)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.15)',
                ...eraCss,
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                  background: 'rgba(0,0,0,0.2)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}
              >
                <button
                  type="button"
                  onClick={goResults}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'transparent',
                    color: labelSoft,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Wróć do świadków
                </button>
                <CharacterAvatar char={tt.selectedChar} size={36} />
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{tt.selectedChar.name}</div>
                  <div style={{ fontSize: '11px', color: labelMuted }}>
                    {getEraTheme(parseInt(tt.year, 10) || 0).label} · Rok {tt.year} · {tt.location}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'rgba(200,170,120,0.75)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    border: '1px solid rgba(200,170,120,0.25)',
                  }}
                >
                  dziennik podróży
                </div>
              </div>
              <p
                style={{
                  margin: 0,
                  padding: '10px 20px',
                  fontSize: '11px',
                  lineHeight: 1.45,
                  color: labelMuted,
                  background: 'rgba(0,0,0,0.2)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                To symulacja edukacyjna: odpowiedzi powstają z modelu językowego i źródeł w bazie, nie zastępują
                krytycznej lektury historii. Ewentualne słowa o „powrocie” lub rozpoznaniu Ciebie w scenie są
                mechaniką aplikacji, nie faktem historycznym.
              </p>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {tt.messages.length === 1 && pinnedTopics.length > 0 && (
                  <div style={{ marginBottom: '4px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        color: labelMuted,
                        marginBottom: '8px',
                        fontFamily: "'Outfit', sans-serif",
                      }}
                    >
                      Cytaty z kroniki — uściślij zapisy (opcjonalnie)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => tt.setSourceStem('')}
                        style={{
                          background: tt.sourceStem === '' ? 'rgba(200,170,120,0.2)' : 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '20px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          color: labelSoft,
                          fontFamily: "'Outfit', sans-serif",
                          cursor: 'pointer',
                        }}
                      >
                        Wszystkie cytaty
                      </button>
                      {pinnedTopics.map((topic, i) => (
                        <button
                          key={`${topic.sourceStem}-${i}`}
                          type="button"
                          onClick={() => tt.setSourceStem(topic.sourceStem.trim())}
                          style={{
                            background:
                              tt.sourceStem === topic.sourceStem.trim()
                                ? 'rgba(200,170,120,0.2)'
                                : 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '20px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.5)',
                            fontFamily: "'EB Garamond', serif",
                            fontStyle: 'italic',
                            cursor: 'pointer',
                          }}
                        >
                          {topic.question.length > 48 ? `${topic.question.slice(0, 48)}…` : topic.question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {tt.messages.map((msg, i) => (
                  <MessageBubble
                    key={`${msg.timestamp.getTime()}-${i}`}
                    message={msg}
                    char={tt.selectedChar!}
                    onPlayAudio={playAudio}
                    onStopAudio={stopAudio}
                    variant="travel"
                    travelSceneLine={travelDiaryLine(i, tt.year, tt.location, chatEraLabel, msg.role)}
                  />
                ))}
                {tt.loading && tt.selectedChar && <TypingIndicator char={tt.selectedChar} />}
                <div ref={tt.messagesEndRef} />
              </div>
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(0,0,0,0.15)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                {tt.sendError && (
                  <div
                    style={{
                      marginBottom: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,200,120,0.25)',
                      background: 'rgba(80,45,0,0.22)',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      color: 'rgba(255,220,180,0.95)',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                    role="alert"
                  >
                    <div style={{ marginBottom: tt.errorIsRetryable ? '10px' : 0 }}>{tt.sendError}</div>
                    {tt.errorIsRetryable && (
                      <button
                        type="button"
                        onClick={() => tt.retrySend()}
                        disabled={tt.loading || !tt.input.trim()}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,200,120,0.35)',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,235,210,0.95)',
                          fontSize: '13px',
                          fontWeight: 600,
                          fontFamily: "'Outfit', sans-serif",
                          cursor: tt.loading || !tt.input.trim() ? 'default' : 'pointer',
                          opacity: tt.loading || !tt.input.trim() ? 0.5 : 1,
                        }}
                      >
                        Spróbuj ponownie
                      </button>
                    )}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '14px',
                    padding: '10px 16px',
                    alignItems: 'flex-end',
                  }}
                >
                  <textarea
                    ref={tt.inputRef}
                    value={tt.input}
                    onChange={(e) => tt.setInput(e.target.value)}
                    onKeyDown={tt.handleKeyDown}
                    placeholder={`Zadaj pytanie ${tt.selectedChar.name.split(' ')[0]}…`}
                    disabled={tt.loading}
                    rows={1}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '15px',
                      fontFamily: "'Outfit', sans-serif",
                      lineHeight: '1.5',
                      maxHeight: '120px',
                      overflowY: 'auto',
                    }}
                    onInput={(e) => {
                      const el = e.target as HTMLTextAreaElement;
                      el.style.height = 'auto';
                      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                    }}
                  />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => void tt.sendMsg()}
                    disabled={tt.loading || !tt.input.trim()}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      border: 'none',
                      background:
                        tt.input.trim() && !tt.loading
                          ? `linear-gradient(135deg, ${tt.selectedChar.avatar_color}cc, ${tt.selectedChar.avatar_color}88)`
                          : 'rgba(255,255,255,0.1)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      flexShrink: 0,
                      transition: 'background 0.2s',
                      opacity: tt.input.trim() && !tt.loading ? 1 : 0.4,
                    }}
                  >
                    ↑
                  </motion.button>
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.2)',
                    marginTop: '8px',
                    textAlign: 'center',
                    fontFamily: "'EB Garamond', serif",
                    fontStyle: 'italic',
                  }}
                >
                  Enter aby wysłać · Shift+Enter nowa linia · Odpowiedzi korzystają z zapisów w bazie (RAG), jak cytaty w
                  dzienniku
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <TimeTravelAmbient active={step === 'search'} year={yNum} />
    </div>
  );
}
