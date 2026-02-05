// ==========================================
// ClawShield Python Runtime Guard (sitecustomize)
// ==========================================

export const PY_GUARD = `# ClawShield Python Runtime Guard
import os
import sys
import json
import uuid
import socket
import shutil
import builtins
import subprocess
from collections.abc import MutableMapping

def _env_bool(key, fallback):
    value = os.getenv(key)
    if value is None:
        return fallback
    return value.lower() in ("1", "true", "yes", "on")

def _parse_list(value):
    if not value:
        return []
    return [item.strip() for item in value.replace(";", ",").split(",") if item.strip()]

AUDIT_PATH = os.getenv("CLAWSHIELD_AUDIT_PATH", os.path.expanduser("~/.clawshield/audit.jsonl"))
AUDIT_LEVEL = os.getenv("CLAWSHIELD_AUDIT_LEVEL", "blocked").lower()
SKILL_ID = os.getenv("CLAWSHIELD_SKILL_ID")
SKILL_NAME = os.getenv("CLAWSHIELD_SKILL_NAME")

BLOCK_SHELL = _env_bool("CLAWSHIELD_BLOCK_SHELL", True)
BLOCK_NETWORK = _env_bool("CLAWSHIELD_BLOCK_NETWORK", False)
BLOCK_FS_WRITE = _env_bool("CLAWSHIELD_BLOCK_FS_WRITE", False)
BLOCK_SECRETS = _env_bool("CLAWSHIELD_BLOCK_SECRETS", False)

ALLOWED_DIRS = _parse_list(os.getenv("CLAWSHIELD_ALLOWED_DIRS"))
ALLOWED_DOMAINS = _parse_list(os.getenv("CLAWSHIELD_ALLOWED_DOMAINS"))
ALLOWED_ENV = _parse_list(os.getenv("CLAWSHIELD_ALLOWED_ENV"))

def _ensure_audit_file():
    try:
        os.makedirs(os.path.dirname(AUDIT_PATH), exist_ok=True)
        if not os.path.exists(AUDIT_PATH):
            with open(AUDIT_PATH, "w", encoding="utf-8"):
                pass
    except Exception:
        pass

def _write_audit(action, result, details):
    try:
        _ensure_audit_file()
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "action": action,
            "result": result,
            "skillId": SKILL_ID,
            "skillName": SKILL_NAME,
            "details": details,
        }
        with open(AUDIT_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry) + "\\n")
    except Exception:
        pass

def _log_allowed(details):
    if AUDIT_LEVEL == "all":
        _write_audit("runtime", "success", details)

def _log_blocked(details):
    _write_audit("runtime", "blocked", details)

def _norm_path(value):
    resolved = os.path.abspath(value)
    return resolved.lower() if os.name == "nt" else resolved

def _is_path_allowed(value):
    if not value:
        return False
    resolved = _norm_path(value)
    audit_resolved = _norm_path(AUDIT_PATH)
    if resolved == audit_resolved:
        return True
    if not ALLOWED_DIRS:
        return False
    for base in ALLOWED_DIRS:
        base_resolved = _norm_path(base)
        if resolved == base_resolved or resolved.startswith(base_resolved + os.sep):
            return True
    return False

def _is_domain_allowed(host):
    if not host:
        return False
    hostname = host.split(":")[0].lower()
    if not ALLOWED_DOMAINS:
        return False
    for domain in ALLOWED_DOMAINS:
        d = domain.lower()
        if hostname == d or hostname.endswith("." + d):
            return True
    return False

# Secrets guard
if BLOCK_SECRETS:
    _default_allowed = {
        "PATH", "HOME", "USER", "SHELL", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "PYTHONPATH", "VIRTUAL_ENV",
        "NODE_ENV", "PWD"
    }
    _default_allowed.update(ALLOWED_ENV)

    class _EnvironProxy(MutableMapping):
        def __init__(self, backing):
            self._backing = backing
        def __getitem__(self, key):
            if key not in _default_allowed:
                _log_blocked({"kind": "env", "key": key})
                raise KeyError(key)
            return self._backing[key]
        def __setitem__(self, key, value):
            if key not in _default_allowed:
                _log_blocked({"kind": "env_set", "key": key})
                raise PermissionError("ClawShield blocked env set")
            self._backing[key] = value
        def __delitem__(self, key):
            if key not in _default_allowed:
                _log_blocked({"kind": "env_delete", "key": key})
                raise PermissionError("ClawShield blocked env delete")
            del self._backing[key]
        def __iter__(self):
            return iter(self._backing)
        def __len__(self):
            return len(self._backing)
        def get(self, key, default=None):
            if key not in _default_allowed:
                _log_blocked({"kind": "env", "key": key})
                return default
            return self._backing.get(key, default)

    os.environ = _EnvironProxy(os.environ)
    os.getenv = lambda key, default=None: os.environ.get(key, default)
    os.putenv = lambda key, value: (_log_blocked({"kind": "env_set", "key": key}) or None)

# Shell guard
if BLOCK_SHELL:
    def _block_shell(fn):
        def wrapper(*args, **kwargs):
            _log_blocked({"kind": "shell", "fn": fn})
            raise PermissionError("ClawShield blocked shell execution")
        return wrapper

    os.system = _block_shell("system")
    os.popen = _block_shell("popen")
    subprocess.Popen = _block_shell("Popen")
    subprocess.run = _block_shell("run")
    subprocess.call = _block_shell("call")
    subprocess.check_output = _block_shell("check_output")

# Filesystem write guard
def _guard_path_write(target, fn):
    if BLOCK_FS_WRITE and not _is_path_allowed(str(target)):
        _log_blocked({"kind": "fs_write", "fn": fn, "target": str(target)})
        raise PermissionError("ClawShield blocked filesystem write")
    _log_allowed({"kind": "fs_write", "fn": fn, "target": str(target)})

_orig_open = builtins.open
def _open_guard(file, mode="r", *args, **kwargs):
    if any(flag in mode for flag in ("w", "a", "x", "+")):
        _guard_path_write(file, "open")
    return _orig_open(file, mode, *args, **kwargs)
builtins.open = _open_guard

_orig_os_open = os.open
def _os_open_guard(file, flags, *args, **kwargs):
    if flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND):
        _guard_path_write(file, "os.open")
    return _orig_os_open(file, flags, *args, **kwargs)
os.open = _os_open_guard

def _wrap_os_write(fn_name):
    original = getattr(os, fn_name, None)
    if not callable(original):
        return
    def wrapper(path_value, *args, **kwargs):
        _guard_path_write(path_value, fn_name)
        return original(path_value, *args, **kwargs)
    setattr(os, fn_name, wrapper)

for _fn in ["remove", "unlink", "rmdir", "mkdir", "makedirs", "rename", "replace"]:
    _wrap_os_write(_fn)

def _wrap_shutil(fn_name):
    original = getattr(shutil, fn_name, None)
    if not callable(original):
        return
    def wrapper(path_value, *args, **kwargs):
        _guard_path_write(path_value, fn_name)
        return original(path_value, *args, **kwargs)
    setattr(shutil, fn_name, wrapper)

for _fn in ["rmtree", "copy", "copy2", "copytree", "move"]:
    _wrap_shutil(_fn)

# Network guard
def _handle_network(host, fn):
    allowed = (not BLOCK_NETWORK) or _is_domain_allowed(host)
    if not allowed:
        _log_blocked({"kind": "network", "fn": fn, "host": host})
        raise PermissionError("ClawShield blocked network access")
    _log_allowed({"kind": "network", "fn": fn, "host": host})

_orig_socket_connect = socket.socket.connect
def _socket_connect(self, address):
    host = None
    if isinstance(address, tuple) and address:
        host = address[0]
    elif isinstance(address, str):
        host = address
    _handle_network(host, "socket.connect")
    return _orig_socket_connect(self, address)
socket.socket.connect = _socket_connect

_orig_create_connection = socket.create_connection
def _create_connection(address, *args, **kwargs):
    host = address[0] if isinstance(address, tuple) else address
    _handle_network(host, "socket.create_connection")
    return _orig_create_connection(address, *args, **kwargs)
socket.create_connection = _create_connection

_log_allowed({
    "kind": "guard_start",
    "blockShell": BLOCK_SHELL,
    "blockNetwork": BLOCK_NETWORK,
    "blockFsWrite": BLOCK_FS_WRITE,
    "blockSecrets": BLOCK_SECRETS,
    "allowedDirs": ALLOWED_DIRS,
    "allowedDomains": ALLOWED_DOMAINS,
})
`;
