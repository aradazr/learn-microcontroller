#!/bin/sh
# Starts the site on this computer and opens it in the browser
cd "$(dirname "$0")"
(sleep 1 && open "http://localhost:8090/fa/") &
python3 -m http.server 8090 -d site
