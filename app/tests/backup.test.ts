import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('backup stops on failed dump and verifies a separate copy before success',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'pos-backup-test-'));
  const run=promisify(execFile);
  const bash=process.platform==='win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
  try {
    const bin=path.join(root,'bin'),backup=path.join(root,'backups'),mirror=path.join(root,'mirror');
    await mkdir(bin);await mkdir(mirror);
    await writeFile(path.join(bin,'docker'),`#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *pg_dump*) [[ "\${FAIL_DUMP:-0}" != 1 ]] || exit 7; printf 'verified-test-archive';;
  *pg_restore*) [[ "$(cat)" == verified-test-archive ]];;
  *) exit 0;;
esac
`,{mode:0o755});
    // Pass paths as positional arguments, never interpolate shell code.
    const command='export PATH="$(cd "$1" && pwd):$PATH"; export BACKUP_DIR="$2" BACKUP_MIRROR_DIR="$3" POS_DOCKER_CONTEXT=mock; bash "$4"';
    const args=['-c',command,'backup-test',bin.replaceAll('\\','/'),backup.replaceAll('\\','/'),mirror.replaceAll('\\','/'),path.resolve('../scripts/backup-db-verified.sh').replaceAll('\\','/')];
    await assert.rejects(run(bash,args,{env:{...process.env,FAIL_DUMP:'1'}}));
    assert.deepEqual(await readdir(backup),[]);
    const result=await run(bash,args,{env:{...process.env,FAIL_DUMP:'0'}});
    assert.ok(result.stdout.trim().endsWith('.dump'));
    const files=(await readdir(backup)).filter(f=>f.endsWith('.dump'));
    assert.equal(files.length,1);
    assert.equal(await readFile(path.join(backup,files[0]),'utf8'),await readFile(path.join(mirror,files[0]),'utf8'));
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep));
    await rm(root,{recursive:true,force:true});
  }
});
