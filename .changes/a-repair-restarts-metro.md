A repair now restarts Metro, because rewriting the files was not enough. 0.6.11 claimed "Metro picks the files back up without a restart; the catalog keeps serving" — that held in a staged test and was wrong in the wild. Observed four times since: the files came back, and Metro went on answering every request with

    Unable to resolve "expo" from "entry.tsx"

because it had already cached a module map that no longer matched the directory. The catalog stayed blank until someone restarted the server by hand, which is exactly the interruption the repair exists to prevent.

The server now restarts Metro as part of the repair and says so:

    Restarting Metro so the catalog picks the files back up — the page reloads itself in a few seconds.

The server itself stays up, the port does not change, and the page reloads itself. The restart is bounded by the same five-repair cap, so a continuous deleter cannot turn it into a restart loop.

Verified by deleting all eight generated files from a serving catalog: the files came back, Metro restarted on the same port, and the catalog rendered 50 pages with zero console errors — with no manual restart.

The cause of the deletion is still unidentified (#41). A sixth theory died this round: a render check running beside a live server was the obvious suspect, but fingerprinting the live workspace across one proved every file byte-identical, with no repair triggered.
