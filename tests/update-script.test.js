import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { plzToState } from '../scripts/plz-bundesland.mjs';

test('PLZ → Bundesland', () => {
  assert.equal(plzToState('80331'), 'BY');
  assert.equal(plzToState('10115'), 'BE');
  assert.equal(plzToState('14467'), 'BB');
  assert.equal(plzToState('27568'), 'HB');
  assert.equal(plzToState('01067'), 'SN');
  assert.equal(plzToState('66111'), 'SL');
  assert.equal(plzToState('xx'), null);
});

test('Update-Skript: zeitgewichtete Tagesmittel → Monatsmittel je Land', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tk-'));
  try {
    await mkdir(join(dir, 'stations/2024/01'), { recursive: true });
    await mkdir(join(dir, 'prices/2024/01'), { recursive: true });
    await writeFile(join(dir, 'stations/2024/01/2024-01-02-stations.csv'),
      'uuid,name,brand,street,house_number,post_code,city,latitude,longitude\nA,X,X,S,1,80331,München,0,0\nB,Y,Y,S,1,10115,Berlin,0,0\n');
    // Tag 1: A Diesel 1,70 ab 0 Uhr, 1,80 ab 12 Uhr → Mittel 1,75; B Diesel 1,60
    await writeFile(join(dir, 'prices/2024/01/2024-01-01-prices.csv'),
      'date,station_uuid,diesel,e5,e10,dieselchange,e5change,e10change\n' +
      '2024-01-01 00:00:00+01,A,1.70,1.80,1.75,1,1,1\n2024-01-01 12:00:00+01,A,1.80,1.80,1.75,1,0,0\n2024-01-01 00:00:00+01,B,1.60,1.70,1.65,1,1,1\n');
    // Tag 2: keine Meldung von A → Vortagespreis 1,80 gilt ganztägig
    await writeFile(join(dir, 'prices/2024/01/2024-01-02-prices.csv'),
      'date,station_uuid,diesel,e5,e10,dieselchange,e5change,e10change\n2024-01-02 06:00:00+01,B,1.60,1.70,1.65,0,0,0\n');
    const out = join(dir, 'out.js');
    execFileSync(process.execPath, ['scripts/update-fuelprices.mjs', '--data', dir, '--out', out], { stdio: 'pipe' });
    const { FUEL_DATA } = await import(out);
    assert.equal(FUEL_DATA.start, '2024-01');
    assert.equal(FUEL_DATA.meta.approximate, false);
    assert.equal(FUEL_DATA.states.BY.diesel[0], 1.775); // (1,75 + 1,80) / 2
    assert.equal(FUEL_DATA.states.BE.diesel[0], 1.6);
    assert.equal(FUEL_DATA.states.BY.e10[0], 1.75);
    assert.equal(FUEL_DATA.states.HH.diesel[0], null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
