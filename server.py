#!/usr/bin/env python3
"""
Personal Dashboard Dev Server (Flask)

Serves the compiled React Single Page Application (frontend/dist)
and PWA assets (service worker, manifest, icons) with zero backend logic.
All state, client-side encryption, and synchronization are handled
directly by the client via npoint.io.
"""

import os
from pathlib import Path
from flask import Flask, send_from_directory, Response

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "frontend" / "dist"

app = Flask(__name__, static_folder=None)

@app.after_request
def add_headers(response: Response) -> Response:
    # Disable caching for sw.js and manifest to ease development & PWA updates
    if "sw.js" in getattr(response, "call_path", "") or "manifest" in getattr(response, "call_path", ""):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path: str):
    setattr(app, "call_path", path)
    target = STATIC_DIR / path
    if path and target.is_file():
        # Static asset exists (e.g. assets/*.js, assets/*.css, vite.svg, manifest.webmanifest, sw.js)
        return send_from_directory(str(STATIC_DIR), path)
    
    # SPA Client-side route fallback -> index.html
    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return send_from_directory(str(STATIC_DIR), "index.html")

    return (
        "<h3>Personal Dashboard Dev Server</h3>"
        "<p>Frontend build not found in <code>frontend/dist</code>.</p>"
        "<p>Run <code>cd frontend && npm run build</code> to compile the client-side app.</p>",
        404,
        {"Content-Type": "text/html"}
    )

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "5000"))
    print(f"[*] Starting Personal Dashboard Flask Dev Server on http://{host}:{port}")
    print(f"[*] Serving static bundle from: {STATIC_DIR}")
    print(f"[*] Client-side sync target: npoint.io (Zero server-side database)")
    app.run(host=host, port=port, debug=False)
