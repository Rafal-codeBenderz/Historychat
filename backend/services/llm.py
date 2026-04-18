import logging
import os

logger = logging.getLogger(__name__)


def call_openai(prompt: str) -> str:
    try:
        import openai

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return "Błąd: Brak klucza API OPENAI_API_KEY w zmiennych środowiskowych."

        client = openai.OpenAI(api_key=api_key)
        model = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.choices[0].message.content
        return (content or "").strip()
    except Exception as e:
        logger.error("Błąd OpenAI API: %s", e)
        return f"Przepraszam, nie mogę w tej chwili odpowiedzieć. Błąd: {str(e)}"


def call_gemini(prompt: str) -> str:
    try:
        import google.generativeai as genai

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return "Błąd: Brak klucza API GEMINI_API_KEY w zmiennych środowiskowych."

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error("Błąd Gemini API: %s", e)
        return f"Przepraszam, nie mogę w tej chwili odpowiedzieć. Błąd: {str(e)}"


def call_llm(prompt: str) -> str:
    if os.environ.get("OPENAI_API_KEY"):
        return call_openai(prompt)
    if os.environ.get("GEMINI_API_KEY"):
        return call_gemini(prompt)
    return (
        "Błąd: Brak klucza API. Dodaj do pliku .env w katalogu projektu "
        "OPENAI_API_KEY=... lub GEMINI_API_KEY=... i uruchom backend ponownie."
    )

