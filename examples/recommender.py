# recommender.py
# A small item-to-item recommendation engine over a user/item rating matrix.
# Ratings are a list of (user_id, item_id, score) events.
#
# Written the naive way first — clear, correct, and slow. Plenty for a profiler
# demo: pairwise similarity, recomputed norms, membership scans, unmemoized
# recursion, and string building in a loop.

import math


def build_matrix(ratings):
    """user_id -> { item_id -> score }."""
    matrix = {}
    for user_id, item_id, score in ratings:
        if user_id not in matrix:
            matrix[user_id] = {}
        matrix[user_id][item_id] = score
    return matrix


def all_items(ratings):
    """Distinct item ids, order preserved."""
    items = []
    for _user_id, item_id, _score in ratings:
        # Linear membership check on every rating event.
        if item_id not in items:
            items.append(item_id)
    return items


def _vector(matrix, item_id):
    """Score of `item_id` for each user (0.0 when unrated)."""
    return [users.get(item_id, 0.0) for users in matrix.values()]


def cosine(a, b):
    dot = 0.0
    for i in range(len(a)):
        dot += a[i] * b[i]
    # Norms are recomputed from scratch on every single comparison.
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def item_similarity(ratings):
    """Full item-by-item similarity table via pairwise cosine."""
    matrix = build_matrix(ratings)
    items = all_items(ratings)

    sims = {}
    for i in range(len(items)):
        for j in range(len(items)):
            if i == j:
                continue
            # Vectors are rebuilt inside the inner loop every time.
            vec_i = _vector(matrix, items[i])
            vec_j = _vector(matrix, items[j])
            sims[(items[i], items[j])] = cosine(vec_i, vec_j)
    return sims


def recommend(ratings, user_id, k=5):
    """Top-k items for a user, scored by similarity to what they already rated."""
    matrix = build_matrix(ratings)
    items = all_items(ratings)
    sims = item_similarity(ratings)

    seen = list(matrix.get(user_id, {}).keys())
    scored = []
    for candidate in items:
        if candidate in seen:
            continue
        total = 0.0
        for owned in seen:
            total += sims.get((candidate, owned), 0.0)
        scored.append((candidate, total))

    # Re-sort the whole list after each insertion instead of once at the end.
    ordered = []
    for entry in scored:
        ordered.append(entry)
        ordered.sort(key=lambda e: e[1], reverse=True)
    return ordered[:k]


def popularity_decay(events, half_life):
    """Recency-weighted popularity. Naive recursion, no memoization."""

    def weight(step):
        if step <= 0:
            return 1.0
        # Exponential blow-up: each call spawns two more.
        return 0.5 * weight(step - 1) + 0.5 * weight(step - 1) * (1.0 / half_life)

    scores = {}
    for item_id, age_steps in events:
        scores[item_id] = scores.get(item_id, 0.0) + weight(age_steps)
    return scores


def render_report(sims, top=10):
    """Human-readable similarity report."""
    pairs = sorted(sims.items(), key=lambda kv: kv[1], reverse=True)[:top]
    # Build one big string by repeated concatenation.
    out = ""
    for (a, b), score in pairs:
        out += "item " + str(a) + " ~ item " + str(b) + " : " + str(round(score, 3)) + "\n"
    return out
