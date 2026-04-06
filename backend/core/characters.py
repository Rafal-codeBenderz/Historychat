"""
Public domain module for character configuration (CHARACTERS, VOICE_MAP, QUERY_EXPANSIONS).

The canonical data is generated into `characters_debata_migrated.py` by
`scripts/regen_characters_module.py`. Import from this module in application code
so the rest of the codebase does not depend on the generated filename.
"""

from backend.core.characters_debata_migrated import CHARACTERS, QUERY_EXPANSIONS, VOICE_MAP

__all__ = ["CHARACTERS", "QUERY_EXPANSIONS", "VOICE_MAP"]
