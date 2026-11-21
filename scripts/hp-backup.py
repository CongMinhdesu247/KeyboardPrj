#!/usr/bin/env python3
"""Managed Supabase backup/drill, operator-only on Ubuntu. Never accepts a restore DB.

Credentials: /home/congminh/apps/KeyboardPrj/shared/backup/{pg_service.conf,pgpass,storage.json}.
No application container or existing database is mutated by restore.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.parse
import urllib.request
import uuid

ROOT = Path('/home/congminh/backups/trumpkeys/managed')
CREDS = Path('/home/congminh/apps/KeyboardPrj/shared/backup')
IMAGE = 'public.ecr.aws/supabase/postgres:17.12.0.000@sha256:8630950b489ecc70563300180287a98c192a4a48f5ae00b4febdaeea1abe85de'
SCHEMAS = ('public', 'private', 'auth', 'storage', 'supabase_migrations', 'extensions')


def run(args, *, data=None, output=None, timeout=120):
    result = subprocess.run(args, input=data, stdout=output or subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=timeout, check=False)
    if result.returncode:
        # SQL/provider diagnostics may contain PII/credentials; never print them.
        raise RuntimeError('Command failed; output suppressed. Check source/target version and privileges locally.')
    return result.stdout.decode().strip() if output is None else ''


def client(tool, *args):
    return ['docker', 'run', '--rm', '-i', '--network', 'host', '--read-only',
            '--user', f'{os.getuid()}:{os.getgid()}', '--memory', '512m', '--cpus', '0.5',
            '-v', f'{CREDS}:/run/backup:ro',
            '-e', 'PGSERVICE=trumpkeys_backup', '-e', 'PGSERVICEFILE=/run/backup/pg_service.conf',
            '-e', 'PGPASSFILE=/run/backup/pgpass',
            '-e', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=60000',
            '--entrypoint', tool, IMAGE, *args]


def query(statement, snapshot=None, container=None, database=None):
    if container:
        assert re.fullmatch(r'trumpkeys-drill-[a-f0-9]{32}', container)
        assert re.fullmatch(r'trumpkeys_restore_[a-f0-9]{32}', database)
        command = ['docker', 'exec', '-i', container, 'psql', '-XqAt', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1']
    else:
        command = client('psql', '-XqAt', '-v', 'ON_ERROR_STOP=1')
    prefix = 'begin isolation level repeatable read read only;'
    if snapshot:
        if not re.fullmatch(r'[A-Fa-f0-9]+-[A-Fa-f0-9]+-[0-9]+', snapshot):
            raise RuntimeError('Invalid exported snapshot')
        prefix += f"set transaction snapshot '{snapshot}';"
    return run(command, data=(prefix + "set local timezone='UTC';" + statement + ';commit;').encode())


def ident(value):
    return '"' + value.replace('"', '""') + '"'


def inventory(**context):
    schemas = ','.join("'" + schema + "'" for schema in SCHEMAS)
    tables = json.loads(query(f"select coalesce(json_agg(json_build_array(schemaname,tablename) order by schemaname,tablename),'[]') from pg_tables where schemaname in ({schemas})", **context))
    result = []
    for schema, table in tables:
        name = ident(schema) + '.' + ident(table)
        stats = json.loads(query(f"select json_build_object('count',count(*)::text,'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from {name} t", **context))
        result.append({'schema': schema, 'table': table, **stats})
    return result


def objects(snapshot=None):
    return json.loads(query("select coalesce(json_agg(json_build_object('id',id,'bucket',bucket_id,'name',name,'metadata',metadata,'updatedAt',updated_at,'version',version) order by id),'[]') from storage.objects", snapshot))


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def check_folder(folder):
    if folder.is_symlink():
        raise RuntimeError('Backup directory cannot be a symlink')
    folder = folder.resolve(strict=True)
    if folder.parent != ROOT.resolve() or folder.is_symlink():
        raise RuntimeError('Backup must be a direct child of the fixed private backup root')
    manifest_path = folder / 'manifest.json'
    if manifest_path.is_symlink():
        raise RuntimeError('Invalid manifest')
    manifest = json.loads(manifest_path.read_text())
    if manifest.get('format') != 'trumpkeys-hp-v1' or manifest.get('image') != IMAGE:
        raise RuntimeError('Unsupported backup format/image')
    files = manifest['files']
    if not {'database.dump', 'objects.tar.gz', 'config.tar.gz'}.issubset(files):
        raise RuntimeError('Incomplete backup')
    for name, checksum in files.items():
        if not re.fullmatch(r'[a-zA-Z0-9.-]+', name):
            raise RuntimeError('Invalid backup filename')
        path = folder / name
        if path.is_symlink() or not path.is_file() or digest(path) != checksum:
            raise RuntimeError('Checksum/path verification failed before restore')
    return folder, manifest


def backup():
    os.umask(0o077)
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    if ROOT.stat().st_mode & 0o077:
        raise RuntimeError('Backup root must have permissions 700')
    for name in ('pg_service.conf', 'pgpass', 'storage.json'):
        path = CREDS / name
        if not path.is_file() or path.is_symlink() or path.stat().st_mode & 0o077:
            raise RuntimeError('Operator credential files must exist with mode 600')
    folder = ROOT / (time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + uuid.uuid4().hex)
    folder.mkdir(mode=0o700)
    (folder / 'INCOMPLETE').touch(mode=0o600)
    # Hold one read-only MVCC snapshot for dump, inventories and Storage metadata.
    holder = subprocess.Popen(client('psql', '-XqAt', '-v', 'ON_ERROR_STOP=1'), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        holder.stdin.write(b"begin isolation level repeatable read read only;set idle_in_transaction_session_timeout='300s';select pg_export_snapshot();\n")
        holder.stdin.flush()
        snapshot = holder.stdout.readline().decode().strip()
        if not re.fullmatch(r'[A-Fa-f0-9]+-[A-Fa-f0-9]+-[0-9]+', snapshot):
            raise RuntimeError('Could not obtain read-only snapshot')
        print('Backing up DB snapshot and private Storage bytes; no live writes.')
        version = query('show server_version_num', snapshot)
        if not version.startswith('17'):
            raise RuntimeError('This client/drill is pinned for PostgreSQL 17; review/pin a matching image first')
        expected = inventory(snapshot=snapshot)
        listed = objects(snapshot)
        with (folder / 'database.dump').open('xb') as out:
            run(client('pg_dump', '--format=custom', f'--snapshot={snapshot}', '--lock-wait-timeout=10000', '--no-subscriptions', *[f'--schema={s}' for s in SCHEMAS]), output=out)
        config = json.loads((CREDS / 'storage.json').read_text())
        base = config['url'].rstrip('/')
        if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', base):
            raise RuntimeError('Storage backup only supports exact managed Supabase HTTPS origins')
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None
        opener = urllib.request.build_opener(NoRedirect())
        temporary = folder / 'objects'
        temporary.mkdir(mode=0o700)
        for item in listed:
            if not re.fullmatch(r'[a-f0-9-]{36}', item['id']):
                raise RuntimeError('Unexpected object UUID')
            # Remote names are URL encoded; local paths are generated UUIDs only.
            remote = '/'.join(urllib.parse.quote(part, safe='') for part in [item['bucket'], *item['name'].split('/')])
            request = urllib.request.Request(base + '/storage/v1/object/' + remote, headers={'apikey': config['key'], 'Authorization': 'Bearer ' + config['key']})
            path = temporary / (item['id'] + '.bin')
            with opener.open(request, timeout=30) as response, path.open('xb') as out:
                shutil.copyfileobj(response, out, length=1024 * 1024)
            if str(path.stat().st_size) != str(item['metadata']['size']):
                raise RuntimeError('Storage size changed')
            item['sha256'] = digest(path)
        comparison = [{k: v for k, v in item.items() if k != 'sha256'} for item in listed]
        if objects() != comparison:
            raise RuntimeError('Storage changed during snapshot; retry in a quiet maintenance window')
        with tarfile.open(folder / 'objects.tar.gz', 'x:gz') as archive:
            for path in temporary.iterdir():
                archive.add(path, arcname=path.name)
        # Remove only UUID files created by this invocation, no recursive deletion.
        for path in temporary.iterdir():
            path.unlink()
        temporary.rmdir()
        with tarfile.open(folder / 'config.tar.gz', 'x:gz', dereference=True) as archive:
            for name in ('.env', 'compose.yaml', 'Dockerfile', 'package.json', 'package-lock.json'):
                archive.add(Path.cwd() / name, arcname='release/' + name, recursive=False)
            for name in ('pg_service.conf', 'pgpass', 'storage.json'):
                archive.add(CREDS / name, arcname='operator/' + name, recursive=False)
        manifest = {'format': 'trumpkeys-hp-v1', 'image': IMAGE, 'serverVersion': version, 'inventory': expected, 'objects': listed,
                    'files': {name: digest(folder / name) for name in ('database.dump', 'objects.tar.gz', 'config.tar.gz')}}
        (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        (folder / 'INCOMPLETE').unlink()
        print('Backup created:', folder)
        print('No automatic retention deletion. Run drill before accepting this backup.')
    finally:
        if holder.poll() is None:
            holder.stdin.write(b'rollback;\n\\q\n')
            holder.stdin.flush()
            try:
                holder.wait(timeout=5)
            except subprocess.TimeoutExpired:
                holder.kill()


def drill(folder):
    folder, manifest = check_folder(folder)  # Always before creating the target.
    os.umask(0o077)
    token = uuid.uuid4().hex
    name = 'trumpkeys-drill-' + token
    database = 'trumpkeys_restore_' + token
    created = False
    database_created = False
    try:
        # No host ports, network, persistent mount or app credentials in the target.
        run(['docker', 'run', '-d', '--name', name, '--label', 'trumpkeys.drill=' + token,
             '--network', 'none', '--memory', '768m', '--cpus', '0.5', '--pids-limit', '128',
             '--tmpfs', '/var/lib/postgresql/data:rw,size=512m',
             '-e', 'POSTGRES_PASSWORD=' + uuid.uuid4().hex, IMAGE])
        created = True
        for _ in range(60):
            result = subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if result.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('Temporary PostgreSQL did not become ready')
        run(['docker', 'exec', name, 'createdb', '-U', 'postgres', '--template=template0', database])
        database_created = True
        run(['docker', 'exec', name, 'psql', '-Xq', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c',
             f"comment on database {ident(database)} is 'trumpkeys-drill:{token}'"])
        # No --clean, --create, role dump, target DB option or restore into postgres.
        with (folder / 'database.dump').open('rb') as source:
            result = subprocess.run(['docker', 'exec', '-i', name, 'pg_restore', '-U', 'postgres', '-d', database, '--single-transaction', '--exit-on-error'], stdin=source, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=180)
        if result.returncode:
            raise RuntimeError('Restore failed; no verified report. Review extension/owner compatibility in a separate environment.')
        if inventory(container=name, database=database) != manifest['inventory']:
            raise RuntimeError('Restored table counts/content hashes differ')
        restored = folder / ('drill-files-' + token)
        restored.mkdir(mode=0o700)
        expected = {item['id'] + '.bin': item['sha256'] for item in manifest['objects']}
        with tarfile.open(folder / 'objects.tar.gz', 'r:gz') as archive:
            members = archive.getmembers()
            if len(members) != len(expected) or {m.name for m in members} != set(expected):
                raise RuntimeError('Invalid object archive inventory')
            for member in members:
                if not member.isfile() or not re.fullmatch(r'[a-f0-9-]{36}\.bin', member.name):
                    raise RuntimeError('Unsafe object archive member')
                path = restored / member.name
                with archive.extractfile(member) as source, path.open('xb') as out:
                    shutil.copyfileobj(source, out)
                if digest(path) != expected[member.name]:
                    raise RuntimeError('Restored object checksum failed')
        report = {'database': database, 'tableContentsMatch': True, 'storageBytesMatch': True,
                  'fullAuthStorageApiUAT': False, 'temporaryContainerRemoved': False}
    finally:
        if created:
            label = run(['docker', 'inspect', '--format', '{{index .Config.Labels "trumpkeys.drill"}}', name])
            # Container name+label+DB marker must match this invocation before cleanup.
            if label != token:
                raise RuntimeError('Cleanup marker mismatch; target retained')
            if database_created:
                marker = query("select shobj_description(oid,'pg_database') from pg_database where datname=current_database()", container=name, database=database)
                if marker != 'trumpkeys-drill:' + token:
                    raise RuntimeError('Database marker mismatch; target retained')
            run(['docker', 'rm', '-f', name])
    report['temporaryContainerRemoved'] = True
    (folder / ('restore-report-' + token + '.json')).write_text(json.dumps(report, indent=2))
    print('DRILL PASSED: table content and Storage bytes match; isolated target removed.')
    print('This is a logical recovery drill, not a full new-stack Google/Auth/Storage API UAT.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['backup', 'verify', 'drill'])
    parser.add_argument('folder', nargs='?', type=Path)
    args = parser.parse_args()
    try:
        if sys.platform != 'linux':
            raise RuntimeError('Run this operator tool on Ubuntu, not Windows')
        if args.mode == 'backup':
            backup()
        elif not args.folder:
            raise RuntimeError('Select one backup directory')
        elif args.mode == 'verify':
            check_folder(args.folder)
            print('Checksums verified; nothing restored.')
        else:
            drill(args.folder)
    except Exception:
        print('FAILED: backup/drill not accepted; diagnostic values suppressed. Check prerequisites and private files locally.', file=sys.stderr)
        sys.exit(1)
