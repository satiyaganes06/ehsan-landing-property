#!/bin/zsh
# Install the local admin as a per-user macOS login service.
set -eu
project_root=${0:A:h:h}
admin_dir="$project_root/ehsan-property-admin"
node_path=$(command -v node || true)
if [[ -z "$node_path" && -x /opt/homebrew/bin/node ]]; then
  node_path=/opt/homebrew/bin/node
fi
if [[ ! -x "$node_path" || ! -f "$admin_dir/node_modules/next/dist/bin/next" ]]; then
  print -u2 "Install Node.js and the admin dependencies first."
  exit 1
fi
label=com.ehsan.property-admin
domain="gui/$(id -u)"
plist="$HOME/Library/LaunchAgents/$label.plist"
log_dir="$HOME/Library/Logs/EhsanProperty"
umask 077
mkdir -p "${plist:h}" "$log_dir"
/usr/bin/python3 - "$plist" "$label" "$admin_dir" "$node_path" "$log_dir" <<'PY'
import os, plistlib, sys, tempfile
from pathlib import Path
target, label, admin, node, logs = sys.argv[1:]
settings = {
    "Label": label, "WorkingDirectory": admin,
    "ProgramArguments": [node, "node_modules/next/dist/bin/next", "dev",
                         "--hostname", "127.0.0.1", "--port", "3001"],
    "EnvironmentVariables": {"PATH": str(Path(node).parent) + ":/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"},
    "RunAtLoad": True, "KeepAlive": True, "ThrottleInterval": 15,
    "StandardOutPath": logs + "/admin.log", "StandardErrorPath": logs + "/admin-error.log",
}
with tempfile.NamedTemporaryFile(dir=Path(target).parent, delete=False) as f:
    plistlib.dump(settings, f)
os.replace(f.name, target)
PY
launchctl enable "$domain/$label"
if ! launchctl print "$domain/$label" >/dev/null 2>&1; then
  launchctl bootstrap "$domain" "$plist"
fi
for attempt in {1..30}; do
  if curl --noproxy '*' --fail --silent --max-time 2 http://127.0.0.1:3001/login >/dev/null; then
    print "Property Admin is ready at http://localhost:3001/login"
    exit 0
  fi
  sleep 1
done
print -u2 "Admin did not respond. Check $log_dir/admin-error.log"
exit 1
