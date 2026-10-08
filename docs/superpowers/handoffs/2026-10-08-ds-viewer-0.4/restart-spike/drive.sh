#!/bin/bash
# Driver: run restart-spike.mjs inside a real pty (script(1)), then stop it with SIGNAL sent to TARGET.
# Usage: drive.sh <label> <port> <signal> <target: pid|group> [--fixed]
set -u
D=/Users/woohopark/.hermes/profiles/app-design/cache/scratch/ds-viewer-04-restart-spike
WS=/Users/woohopark/HermesProject/Worktrees/design-system-viewer-0.4/kit-host/.ds-viewer
LABEL=$1 PORT=$2 SIG=$3 TARGET=$4 EXTRA=${5:-}
OUT=$D/$LABEL.log
rm -f $OUT
unset CI
(tail -f /dev/null | script -q $OUT node $D/restart-spike.mjs 0 $PORT $WS $EXTRA >/dev/null 2>&1) &
SCRIPT_PID=$!
for i in $(seq 1 240); do grep -q RESTARTED_OK $OUT 2>/dev/null && break; sleep 1; done
grep -q RESTARTED_OK $OUT && echo "[$LABEL] restarted OK" || echo "[$LABEL] NO RESTART within 240s"
GEN0=$(pgrep -f "^node $D/restart-spike.mjs 0 $PORT" | head -1)
echo "[$LABEL] gen0=$GEN0 listeners on $PORT:"; lsof -nP -iTCP:$PORT -sTCP:LISTEN | tail -n +2
echo "[$LABEL] tree before stop:"; ps -o pid,ppid,pgid,stat,command -ax | grep -E "node .*restart-spike|expo start|@expo/cli" | grep -v -E "grep|bash -c|script -q" | cut -c1-140
if [ "$TARGET" = group ]; then kill -$SIG -- -$(ps -o pgid= -p $GEN0 | tr -d ' '); else kill -$SIG $GEN0; fi
sleep 6
echo "[$LABEL] after $SIG to $TARGET:"; ps -o pid,ppid,pgid,stat,command -ax | grep -E "node .*restart-spike|expo start|@expo/cli" | grep -v -E "grep|bash -c|script -q" | cut -c1-140 || echo "  (no processes left)"
lsof -nP -iTCP:$PORT -sTCP:LISTEN | tail -n +2 || true
echo "[$LABEL] spike log:"; grep -a "\[spike" $OUT
# cleanup anything left
pkill -f "restart-spike.mjs . $PORT" ; pkill -f "expo start --web --host localhost --port $PORT"; kill $SCRIPT_PID 2>/dev/null; sleep 1
pkill -f "tail -f /dev/null"; if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null; then echo "[$LABEL] WARNING port still bound"; else echo "[$LABEL] cleanup ok"; fi
