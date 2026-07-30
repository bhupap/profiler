# log-insights.py
# Rollups over a list of parsed access-log events. Each event is a dict:
#   { "ts": int (epoch seconds), "user": str, "path": str, "level": str, "ms": int }
#
# Straightforward and slow on purpose: membership scans over lists, top-k by
# re-sorting, quadratic sessionization, and a report built by string +=.


def unique_users(events):
    users = []
    for e in events:
        # Linear membership check on every event.
        if e["user"] not in users:
            users.append(e["user"])
    return users


def count_by_path(events):
    """path -> hit count, returned as a list sorted by count desc."""
    counts = {}
    for e in events:
        counts[e["path"]] = counts.get(e["path"], 0) + 1

    rows = []
    for path, n in counts.items():
        rows.append((path, n))
        # Re-sort the whole list after each append instead of once at the end.
        rows.sort(key=lambda r: r[1], reverse=True)
    return rows


def slowest_paths(events, top=5):
    """Average latency per path, slowest first."""
    paths = []
    for e in events:
        if e["path"] not in paths:
            paths.append(e["path"])

    scored = []
    for path in paths:
        # Re-scan the whole event list for every distinct path.
        matching = [e["ms"] for e in events if e["path"] == path]
        avg = sum(matching) / len(matching) if matching else 0
        scored.append((path, avg))
    return sorted(scored, key=lambda r: r[1], reverse=True)[:top]


def sessionize(events, gap_seconds=1800):
    """Group each user's events into sessions separated by an idle gap.

    Rescans the full event list once per user, and sorts inside the loop.
    """
    sessions = []
    for user in unique_users(events):
        theirs = [e for e in events if e["user"] == user]
        theirs.sort(key=lambda e: e["ts"])
        current = []
        last_ts = None
        for e in theirs:
            if last_ts is not None and e["ts"] - last_ts > gap_seconds:
                sessions.append({"user": user, "events": current})
                current = []
            current.append(e)
            last_ts = e["ts"]
        if current:
            sessions.append({"user": user, "events": current})
    return sessions


def error_bursts(events, window=60):
    """Timestamps where >=3 errors happened within `window` seconds.

    For every error we re-scan every other error to count neighbours.
    """
    errors = [e for e in events if e["level"] == "ERROR"]
    bursts = []
    for a in errors:
        near = 0
        for b in errors:
            if abs(a["ts"] - b["ts"]) <= window:
                near += 1
        if near >= 3:
            bursts.append(a["ts"])
    return bursts


def render_report(events):
    report = ""
    for path, n in count_by_path(events):
        report += path + " : " + str(n) + " hits\n"
    return report
