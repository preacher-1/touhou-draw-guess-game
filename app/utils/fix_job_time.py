import asyncio
import time
from contextlib import asynccontextmanager


@asynccontextmanager
async def fix_job_time(t: float):
    start_time = time.monotonic()

    yield

    elapsed = time.monotonic() - start_time
    wait_time = max(0, t - elapsed)
    await asyncio.sleep(wait_time)
