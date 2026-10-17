#!/usr/bin/env python3
"""Tiny stdlib server for the agent-trace viewer.

Serves the static frontend from ../web and a small JSON API over the
trace directory. No third-party dependencies required.

By default the server detaches into a background daemon so the launching
shell is freed immediately (the previous blocking serve_forever held the
command line until killed). Use --foreground to keep it blocking (debug),
--stop to terminate a running daemon, --idle-timeout to auto-shutdown after
inactivity (0 disables).
"""
import sys
import os
import json
import argparse
import urllib.parse
import time
import threading
import signal
import atexit
import tempfile
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
# Frontend lives at <skill>/web, i.e. one level ABOVE this server/ directory.
WEB = os.path.join(os.path.dirname(ROOT), "web")
TRACE_DIR = "agent_traces"
PID_FILE = os.path.join(tempfile.gettempdir(), "agent-trace-view.pid")

last_activity = time.time()


def matches(node, term):
    if not term:
        return True
    if term in json.dumps(node, ensure_ascii=False).lower():
        return True
    return any(matches(c, term) for c in node.get("children", []))


def filter_trace(data, query):
    q = urllib.parse.parse_qs(query)
    depth = int(q.get("depth", [data.get("depth", 99)])[0])
    kinds = {k for k in q.get("kinds", [""])[0].split(",") if k}
    term = q.get("q", [""])[0].strip().lower()

    def walk(nodes, d):
        out = []
        for n in nodes:
            if kinds and n.get("kind") not in kinds:
                continue
            if term and not matches(n, term):
                continue
            nc = dict(n)
            nc["children"] = walk(n.get("children", []), d - 1) if d > 0 else []
            out.append(nc)
        return out

    out = dict(data)
    out["flow"] = walk(data.get("flow", []), depth)
    return out


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    def do_GET(self):
        global last_activity
        last_activity = time.time()
        p = urllib.parse.urlparse(self.path)
        if p.path.startswith("/api/"):
            self.api(p)
            return
        super().do_GET()

    def api(self, p):
        if p.path == "/api/traces":
            try:
                files = [f for f in os.listdir(TRACE_DIR) if f.endswith(".json")]
            except OSError:
                files = []
            self._json(200, {"traces": sorted(files)})
            return
        if p.path.startswith("/api/traces/"):
            name = urllib.parse.unquote(p.path[len("/api/traces/"):])
            fp = os.path.join(TRACE_DIR, name)
            if not os.path.isfile(fp):
                self._json(404, {"error": "not found"})
                return
            try:
                with open(fp, encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                self._json(500, {"error": str(e)})
                return
            self._json(200, filter_trace(data, p.query))
            return
        self._json(404, {"error": "unknown api"})

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def read_pid():
    try:
        with open(PID_FILE) as f:
            return int(f.read().strip())
    except (OSError, ValueError):
        return None


def write_pid(pid):
    with open(PID_FILE, "w") as f:
        f.write(str(pid))


def remove_pid():
    try:
        os.remove(PID_FILE)
    except OSError:
        pass


def stop_daemon():
    pid = read_pid()
    if pid is None:
        print("no running agent-trace-view daemon found")
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        print("daemon (pid %s) already gone" % pid)
    remove_pid()
    print("stopped daemon (pid %s)" % pid)


def daemonize():
    """Detach from the controlling terminal via double-fork; parent exits."""
    if os.fork() > 0:
        os._exit(0)
    os.setsid()
    if os.fork() > 0:
        os._exit(0)
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    sys.stdout.flush()
    sys.stderr.flush()
    devnull = os.open(os.devnull, os.O_RDWR)
    os.dup2(devnull, sys.stdin.fileno())
    os.dup2(devnull, sys.stdout.fileno())
    os.dup2(devnull, sys.stderr.fileno())


def watchdog(httpd, idle_timeout):
    while True:
        time.sleep(10)
        if time.time() - last_activity > idle_timeout:
            httpd.shutdown()
            break


def main():
    global TRACE_DIR
    ap = argparse.ArgumentParser()
    ap.add_argument("--trace-dir", default="agent_traces")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--foreground", action="store_true",
                    help="run blocking in the foreground (do not detach)")
    ap.add_argument("--stop", action="store_true",
                    help="stop a running background daemon and exit")
    ap.add_argument("--idle-timeout", type=int, default=600,
                    help="seconds of inactivity before auto-shutdown; 0 disables")
    args = ap.parse_args()

    if args.stop:
        stop_daemon()
        return

    TRACE_DIR = args.trace_dir
    url = f"http://{args.host}:{args.port}"

    if not args.foreground:
        print(f"agent-trace-view starting in background at {url}")
        daemonize()
        write_pid(os.getpid())
        atexit.register(remove_pid)

    httpd = HTTPServer((args.host, args.port), Handler)
    if args.idle_timeout > 0:
        threading.Thread(target=watchdog, args=(httpd, args.idle_timeout),
                         daemon=True).start()
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
