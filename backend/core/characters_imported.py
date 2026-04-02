"""
Imported characters configuration.

Ten moduł zawiera kopię konfiguracji postaci (QUERY_EXPANSIONS, VOICE_MAP,
CHARACTERS) z projektu w folderze
`debata pozniej na github do wrzucenia/backend/core/characters.py`.

Używaj go tylko przez nowe endpointy (np. /api/imported-characters), aby
nie mieszać go z istniejącym CHARACTERS w backend.server.
"""

# ─────────────────────────────────────────────
# Query Expansion - słownik terminów per postać
# ─────────────────────────────────────────────
QUERY_EXPANSIONS = {
    'joan_of_arc': {
        'orlean': ['orléans', 'orleans', '1429', 'maj 1429'],
        'joanna': ['jehanne', "d'arc", 'dziewica orleańska'],
        'oblezenie': ['oblężenie', 'bitwa', 'obrona'],
        'karol': ['karol vii', 'koronacja', 'reims', 'król francji'],
        'rouen': ['proces', 'inkwizycja', 'spalenie', 'stos'],
    },
    'copernicus': {
        'heliocentryzm': ['heliocentric', 'kopernikanizm', 'słońce centrum'],
        'frombork': ['frauenburg', 'warmia'],
        'planeta': ['merkury', 'wenus', 'mars', 'jowisz', 'saturn'],
        'kopernik': ['nicolaus copernicus', 'mikołaj', 'toruń', 'astronomer'],
        'de revolutionibus': ['de revolutionibus orbium coelestium', 'dzieło kopernika', '1543'],
    },
    # ... (pozostała część QUERY_EXPANSIONS, VOICE_MAP i CHARACTERS
    # została skopiowana z projektu w folderze „debata pozniej na github do wrzucenia”)
}

# ─────────────────────────────────────────────
# Voice Mapping for TTS
# ─────────────────────────────────────────────
VOICE_MAP = {
    "Charon": "echo",      # Kopernik
    "Kore": "nova",        # Curie, Kleopatra, Joanna
    "Fenrir": "fable",     # Napoleon
    "Zephyr": "shimmer",   # da Vinci
    "Puck": "alloy"        # Einstein
}

# ─────────────────────────────────────────────
# Characters Config
# ─────────────────────────────────────────────
CHARACTERS = {
    "copernicus": {
        "id": "copernicus",
        "name": "Mikołaj Kopernik",
        "era": "Renesans (1473–1543)",
        "bio": "Polski astronom i kanonik, twórca rewolucyjnej teorii heliocentrycznej. Autor dzieła 'De revolutionibus orbium coelestium'.",
        "style": "Mów spokojnie, z głęboką erudycją renesansowego uczonego. Używaj łacińskich wtrąceń. Powołuj się na obserwacje astronomiczne i matematykę. Jesteś ostrożny w formułowaniu rewolucyjnych tez – wiesz, jakie ryzyko niosą.",
        "avatar_prompt": "Realistic historical portrait of Nicolaus Copernicus, Polish Renaissance astronomer, holding astronomical instruments, oil painting style, 15th-16th century, candlelight, scholarly robes, Toruń cathedral background",
        "avatar_color": "#1a3a5c",
        "icon": "🌍",
        "voiceName": "Charon",
        "suggestedTopics": [
            "Co sądzisz o teorii heliocentrycznej?",
            "Jak doszedłeś do swoich odkryć?",
            "Dlaczego bałeś się opublikować swoje dzieło?",
            "Jakie były Twoje obserwacje we Fromborku?",
            "Jak godziłeś wiedzę naukową z wiarą katolicką w XVI wieku?",
            "Czy obawiałeś się reakcji Kościoła, ukrywając De Revolutionibus przez dekady?",
            "Jaką rolę odgrywała matematyka w Twoich obliczeniach orbit planetarnych?",
            "Kto był Twoim mentorem podczas studiów w Krakowie i Bolonii?",
            "Czy prawda jest, że podobno zobaczyłeś wydrukowaną kopię swojego dzieła dopiero na łożu śmierci?",
            "Gdybyś wiedział, że Galileusz zostanie osądzony za Twoją teorię – czy nadal byś ją opublikował?"
        ]
    },
    # ... (pozostałe postacie tak jak w debata/core/characters.py)
}

