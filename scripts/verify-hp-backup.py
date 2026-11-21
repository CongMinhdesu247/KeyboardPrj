"""Disposable synthetic restore test; no real env, source DB, API or SSH credentials."""
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tarfile
import uuid

spec = importlib.util.spec_from_file_location('hp_backup', Path(__file__).with_name('hp-backup.py'))
hp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hp)
hp.ROOT = Path('output/hp-backup-fixture').resolve()
hp.ROOT.mkdir(parents=True, exist_ok=True)
token = uuid.uuid4().hex
name = 'trumpkeys-drill-' + token
database = 'trumpkeys_restore_' + token
folder = hp.ROOT / token
folder.mkdir()
try:
    hp.run(['docker', 'run', '-d', '--name', name, '--label', 'trumpkeys.drill=' + token, '--network', 'none', '--memory', '768m', '--cpus', '0.5', '--tmpfs', '/var/lib/postgresql/data:rw,size=512m', '-e', 'POSTGRES_PASSWORD=synthetic-fixture-only', hp.IMAGE])
    import time
    for _ in range(60):
        r = subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if r.returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError('Fixture did not start')
    hp.run(['docker', 'exec', name, 'createdb', '-U', 'postgres', '--template=template0', database])
    hp.run(['docker', 'exec', '-i', name, 'psql', '-Xq', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], data=b"create schema private;create schema auth;create schema storage;create schema extensions;create schema supabase_migrations;create table private.fixture(id integer primary key,amount bigint,note text);insert into private.fixture values(1,100000,'synthetic'),(2,20000,'test');alter table private.fixture enable row level security;revoke all on private.fixture from public;create function public.fixture_count() returns bigint language sql security definer set search_path='' as $$select count(*) from private.fixture$$;revoke all on function public.fixture_count() from public;grant execute on function public.fixture_count() to authenticated;")
    expected = hp.inventory(container=name, database=database)
    with (folder / 'database.dump').open('wb') as output:
        hp.run(['docker', 'exec', name, 'pg_dump', '-U', 'postgres', '-d', database, '--format=custom'], output=output)
    item_id = uuid.uuid4().hex
    # Use the same UUID filenames produced by managed Storage backup.
    object_name = str(uuid.UUID(item_id)) + '.bin'
    payload = b'synthetic-storage-object'
    with tarfile.open(folder / 'objects.tar.gz', 'w:gz') as archive:
        info = tarfile.TarInfo(object_name)
        info.size = len(payload)
        archive.addfile(info, io.BytesIO(payload))
    with tarfile.open(folder / 'config.tar.gz', 'w:gz'):
        pass
    manifest = {'format':'trumpkeys-hp-v1','image':hp.IMAGE,'inventory':expected,'objects':[{'id':str(uuid.UUID(item_id)),'sha256':hp.hashlib.sha256(payload).hexdigest()}], 'files':{name:hp.digest(folder/name) for name in ('database.dump','objects.tar.gz','config.tar.gz')}}
    (folder/'manifest.json').write_text(json.dumps(manifest))
    hp.drill(folder)
    report = json.loads(next(folder.glob('restore-report-*.json')).read_text())
    assert report['temporaryContainerRemoved'] and report['tableContentsMatch'] and report['storageBytesMatch']
    # Corruption must fail before a target is created.
    with (folder/'database.dump').open('ab') as out:
        out.write(b'corrupt')
    try:
        hp.check_folder(folder)
    except RuntimeError:
        pass
    else:
        raise AssertionError('Corrupt backup accepted')
    print('PASS: isolated real PostgreSQL restore + object bytes, checksum rejection; no production credentials used.')
finally:
    # Only the source fixture container created above; no volumes or other projects.
    label = hp.run(['docker','inspect','--format','{{index .Config.Labels "trumpkeys.drill"}}',name])
    if label == token:
        hp.run(['docker','rm','-f',name])
