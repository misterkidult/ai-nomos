"""Shared Upstash REST helpers. Reads .env; no dependencies."""
import json
import os
import pathlib
import urllib.error
import urllib.request

_ROOT = pathlib.Path(__file__).resolve().parent.parent


def env(name: str) -> str:
    if name in os.environ:
        return os.environ[name]
    f = _ROOT / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                if k == name:
                    return v.strip().strip('"').strip("'")
    raise SystemExit(f"missing {name} (set it in .env or the environment)")


URL, TOKEN = env("KV_REST_API_URL"), env("KV_REST_API_TOKEN")


def _post(path: str, body) -> dict:
    req = urllib.request.Request(
        f"{URL}{path}",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Upstash {e.code}: {e.read().decode()[:300]}")


def cmd(*args) -> dict:
    """One Redis command, e.g. cmd("SET", "k", "v")."""
    return _post("/", [str(a) for a in args])


def pipeline(cmds: list[list]) -> list:
    """Many commands in one round trip. Upstash caps the request at 10 MB."""
    return _post("/pipeline", [[str(a) for a in c] for c in cmds])
