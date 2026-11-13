import subprocess
import sys
from datetime import datetime, timedelta, timezone
from time import sleep

MOSCOW = timezone(timedelta(hours=3))


def next_refresh(now):
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight + timedelta(hours=12 if now.hour < 12 else 24)


def main():
    while True:
        now = datetime.now(MOSCOW)
        scheduled = next_refresh(now)
        print(f"Next catalog refresh: {scheduled.isoformat()}", flush=True)
        sleep(max(0, (scheduled - datetime.now(MOSCOW)).total_seconds()))
        result = subprocess.run([sys.executable, "-m", "catalog.import_catalog"], check=False)
        if result.returncode:
            print(f"Catalog refresh failed (exit {result.returncode})", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
