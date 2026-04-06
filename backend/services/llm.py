import logging
import os

from backend.services.retry_utils import retry_transient

logger = logging.getLogger(__name__)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default

# Nie zwracamy szczegółów wyjątku z API do UI — pełny traceback w logu.
_LLM_FAILURE_USER_MESSAGE = (
    "Przepraszam, nie mogę w tej chwili wygenerować odpowiedzi. Spróbuj ponownie za chwilę."
)


def _is_openai_transient(err: Exception) -> bool:
    # Best-effort without pinning to a specific openai version API surface.
    name = type(err).__name__
    if name in {"RateLimitError", "APITimeoutError", "APIConnectionError", "InternalServerError"}:
        return True
    msg = str(err).lower()
    return any(s in msg for s in ["rate limit", "429", "timeout", "temporarily", "overloaded", "connection"])


def _is_gemini_transient(err: Exception) -> bool:
    msg = str(err).lower()
    return any(s in msg for s in ["rate limit", "429", "timeout", "temporarily", "overloaded", "connection"])


def call_openai(system_message: str, user_message: str) -> str:
    try:
        import openai
    except ImportError:
        logger.error("Brak pakietu openai — zainstaluj zależności backendu.", exc_info=True)
        return _LLM_FAILURE_USER_MESSAGE

    try:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return "Błąd: Brak klucza API OPENAI_API_KEY w zmiennych środowiskowych."

        timeout_s = _env_float("OPENAI_HTTP_TIMEOUT", 60.0)

        def _do_call() -> str:
            client = openai.OpenAI(api_key=api_key, timeout=timeout_s)
            model = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message},
                ],
            )
            content = response.choices[0].message.content
            return (content or "").strip()

        attempts = int(os.environ.get("LLM_RETRY_ATTEMPTS", "3") or "3")
        return retry_transient(_do_call, attempts=max(1, attempts), should_retry=_is_openai_transient)
    except Exception:
        # SDK / sieć / nieoczekiwane błędy po wyczerpaniu retry — bez szczegółów w odpowiedzi do UI.
        logger.error("Błąd OpenAI API po wyczerpaniu prób", exc_info=True)
        return _LLM_FAILURE_USER_MESSAGE


def call_gemini(system_message: str, user_message: str) -> str:
    try:
        import google.generativeai as genai
    except ImportError:
        logger.error("Brak pakietu google-generativeai — zainstaluj zależności backendu.", exc_info=True)
        return _LLM_FAILURE_USER_MESSAGE

    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return "Błąd: Brak klucza API GEMINI_API_KEY w zmiennych środowiskowych."

        timeout_s = _env_float("GEMINI_HTTP_TIMEOUT", 60.0)

        def _do_call() -> str:
            genai.configure(api_key=api_key)
            try:
                model = genai.GenerativeModel("gemini-2.0-flash", system_instruction=system_message)
                prompt = user_message
            except TypeError:
                model = genai.GenerativeModel("gemini-2.0-flash")
                prompt = f"{system_message}\n\n{user_message}"
            response = model.generate_content(
                prompt,
                request_options={"timeout": timeout_s},
            )
            return response.text

        attempts = int(os.environ.get("LLM_RETRY_ATTEMPTS", "3") or "3")
        return retry_transient(_do_call, attempts=max(1, attempts), should_retry=_is_gemini_transient)
    except Exception:
        # SDK / sieć / nieoczekiwane błędy po wyczerpaniu retry — bez szczegółów w odpowiedzi do UI.
        logger.error("Błąd Gemini API po wyczerpaniu prób", exc_info=True)
        return _LLM_FAILURE_USER_MESSAGE


def call_llm(system_message: str, user_message: str) -> str:
    if os.environ.get("OPENAI_API_KEY"):
        return call_openai(system_message, user_message)
    if os.environ.get("GEMINI_API_KEY"):
        return call_gemini(system_message, user_message)
    return (
        "Błąd: Brak klucza API. Dodaj do pliku .env w katalogu projektu "
        "OPENAI_API_KEY=... lub GEMINI_API_KEY=... i uruchom backend ponownie."
    )

