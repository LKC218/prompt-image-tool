import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python"))

from auto_update import is_remote_newer, parse_version_tuple, read_local_app_version


def test_parse_version_tuple():
    assert parse_version_tuple("2.5.2") == (2, 5, 2)
    assert parse_version_tuple("v2.10.0") == (2, 10, 0)
    assert parse_version_tuple("") == (0,)


def test_is_remote_newer():
    assert is_remote_newer("2.6.0", "2.5.2") is True
    assert is_remote_newer("2.5.2", "2.5.2") is False
    assert is_remote_newer("2.4.9", "2.5.2") is False
    assert is_remote_newer("10.0.0", "9.9.9") is True


def test_read_local_app_version_from_src_index():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    frontend = os.path.join(root, "src")
    version = read_local_app_version(frontend)
    assert version and version[0].isdigit()
