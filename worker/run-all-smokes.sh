#!/bin/bash
# Run each smoke on its OWN fresh DB (they each bootstrap a distinct owner).
set -u
cd "/Users/kenbaker/Downloads/scratch-church/Church-Website/worker"
PORT=8811
{
for SMOKE in smoke-gaps.mjs smoke-extended.mjs smoke-newsletters.mjs; do
  pkill -9 -f wrangler 2>/dev/null; pkill -9 -f workerd 2>/dev/null; sleep 2
  rm -rf .wrangler
  npx wrangler d1 execute lakeview-fellowship --local --file schema.sql >/dev/null 2>&1
  npx wrangler dev --local --port $PORT >/tmp/lv_final.log 2>&1 &
  WPID=$!
  UP=0
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:$PORT/_health 2>/dev/null || echo 000)
    if [ "$code" = "200" ]; then UP=1; break; fi
    sleep 2
  done
  echo "############ $SMOKE (health=$code up=$UP) ############"
  if [ "$UP" = "1" ]; then
    export SMOKE_BASE=http://127.0.0.1:$PORT
    node "$SMOKE"; echo "EXIT=$?"
  else
    echo "SERVER_DOWN"; tail -20 /tmp/lv_final.log
  fi
  kill $WPID 2>/dev/null
  echo
done
} > /tmp/lv_allsmokes.txt 2>&1
exit 0
