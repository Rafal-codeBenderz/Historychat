import random
import time
from typing import Callable, Optional, TypeVar

T = TypeVar("T")


def retry_transient(
    fn: Callable[[], T],
    *,
    attempts: int = 3,
    base_sleep_s: float = 1.0,
    max_sleep_s: float = 10.0,
    should_retry: Optional[Callable[[Exception], bool]] = None,
) -> T:
    """
    Wywołuje fn z exponential backoff i jitterem.

    Celowo łapie każdy Exception z wywołania fn(): caller może zwracać dowolny typ błędu
    (OpenAI, HTTP, itd.). Gdy should_retry zwraca False, wyjątek jest natychmiast propagowany;
    gdy True lub brak filtra — po ostatniej nieudanej próbie ostatni wyjątek jest ponownie rzucony.
    """
    last_err: Exception | None = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if should_retry is not None and not should_retry(e):
                raise
            if i == attempts - 1:
                raise
            sleep = min(max_sleep_s, base_sleep_s * (2**i))
            sleep = sleep * (0.8 + random.random() * 0.4)
            time.sleep(sleep)
    raise last_err or RuntimeError("retry failed without exception")
