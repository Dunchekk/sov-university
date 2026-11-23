import argparse
import hashlib
import json
import os
import re
import subprocess
import tarfile
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


@contextmanager
def checked_process(command, **kwargs):
    with subprocess.Popen(command, **kwargs) as process:
        try:
            yield process
        except BaseException:
            if process.poll() is None:
                process.kill()
            raise
        if process.wait():
            raise subprocess.CalledProcessError(process.returncode, command)


def backup_database(pg, connection, age, target):
    with checked_process(
        [*pg, "psql", *connection, "-XqAtw", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
    ) as session:
        session.stdin.write(
            "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n"
            "SELECT pg_export_snapshot();\n"
            "SELECT coalesce(json_agg(f), '[]'::json) FROM "
            '(SELECT "storageKey" AS key, size, checksum FROM public."FileObject") f;\n'
        )
        session.stdin.flush()
        snapshot = session.stdout.readline().strip()
        if not snapshot:
            raise RuntimeError("PostgreSQL did not export a snapshot")
        files = json.loads(session.stdout.readline())
        with target.open("xb") as encrypted, checked_process(
            [*pg, "pg_dump", *connection, "-w", "-Fc", "--snapshot", snapshot],
            stdout=subprocess.PIPE,
        ) as dump:
            subprocess.run(age, stdin=dump.stdout, stdout=encrypted, check=True)
        # Closing the session releases the snapshot after pg_dump completes.
        session.stdin.close()
    return files


class HashingReader:
    def __init__(self, source):
        self.source = source
        self.digest = hashlib.sha256()

    def read(self, size):
        data = self.source.read(size)
        self.digest.update(data)
        return data


def backup_files(files, tar, age, target):
    expected = {file["key"]: file for file in files}
    if any(not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]*", key) for key in expected):
        raise RuntimeError("Invalid storage key in database snapshot")
    with tempfile.TemporaryFile() as names, target.open("xb") as encrypted:
        for key in expected:
            names.write(key.encode("ascii") + b"\0")
        names.seek(0)
        with checked_process(tar, stdin=names, stdout=subprocess.PIPE) as source:
            with checked_process(age, stdin=subprocess.PIPE, stdout=encrypted) as output:
                with tarfile.open(fileobj=source.stdout, mode="r|") as incoming, \
                     tarfile.open(fileobj=output.stdin, mode="w|") as archive:
                    for member in incoming:
                        file = expected.pop(member.name, None)
                        if not file or not member.isfile() or member.size != file["size"]:
                            raise RuntimeError("Storage file does not match the database snapshot")
                        with incoming.extractfile(member) as content:
                            reader = HashingReader(content)
                            archive.addfile(member, reader)
                            if reader.digest.hexdigest() != file["checksum"]:
                                raise RuntimeError("Storage file checksum does not match the database snapshot")
                if expected:
                    raise RuntimeError("Files are missing from the database snapshot's storage")
                output.stdin.close()
            while source.stdout.read(65536):
                pass


def main():
    parser = argparse.ArgumentParser(description="Create an encrypted database and storage backup")
    parser.add_argument("destination", nargs="?", type=Path)
    parser.add_argument("--standalone", action="store_true")
    args = parser.parse_args()
    recipients = os.environ.get("RYADOM_BACKUP_RECIPIENTS")
    if not recipients or not Path(recipients).is_file():
        parser.error("set RYADOM_BACKUP_RECIPIENTS to an age recipients file")
    age = ["age", "-R", recipients]
    subprocess.run(age, input=b"", stdout=subprocess.DEVNULL, check=True)

    if args.standalone:
        storage = os.environ.get("STORAGE_DIR")
        if not storage or not Path(storage).is_dir():
            parser.error("set STORAGE_DIR to the application's storage directory")
        if not (os.environ.get("PGSERVICE") or os.environ.get("PGDATABASE")):
            parser.error("set PGSERVICE or PGDATABASE for the application database")
        pg, connection = [], []
        tar = ["tar", "-C", storage]
    else:
        compose = [
            "docker", "compose", "--env-file", os.environ.get("RYADOM_ENV_FILE", ".env"),
        ]
        pg = [*compose, "exec", "-T", "db"]
        connection = ["-U", "ryadom", "-d", "ryadom"]
        tar = [
            *compose, "run", "--rm", "-T", "--no-deps", "--entrypoint", "tar", "app",
            "-C", "/app/storage",
        ]
    tar += ["-cf", "-", "--null", "-T", "-"]

    os.umask(0o077)
    default = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destination = args.destination or Path(".local/backups") / default
    if destination.exists() or destination.is_symlink():
        raise FileExistsError(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".backup-", dir=destination.parent) as temporary:
        staging = Path(temporary)
        files = backup_database(pg, connection, age, staging / "database.dump.age")
        backup_files(files, tar, age, staging / "files.tar.age")
        staging.rename(destination)
    print(f"Резервная копия: {destination}")


if __name__ == "__main__":
    main()
