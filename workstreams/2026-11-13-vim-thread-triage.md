---
status: done
title: Vim keys to enter, resolve and leave comment threads
summary: Triage comment history fast from the keyboard: jump into a thread, resolve it with one key, move on with Vim motions.
---

# Vim keys for thread triage

Requester: Nicklas (via the mokki agent, 13 Nov).

While reviewing history, the user misses Vim bindings for working through
comments: jump into a thread, resolve it (suggested `r`), and leave it with
Vim motions (left/right, `h`/`l`), so that many threads can be cleared quickly.

Wanted:

- From the comment history list or a focused thread: `Enter` or `l` opens the
  thread, `h` leaves it, `j`/`k` move to the next/previous thread.
- `r` resolves or reopens the focused thread without opening a text field.
- Works across the history of all pages (with the attention-beacon jump if
  present), and appears in `:help` and in `keymap.json`.

Open: whether `r` toggles or only resolves; whether resolving auto-advances to
the next thread.
