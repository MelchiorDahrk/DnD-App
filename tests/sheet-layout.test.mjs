import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCharacter,parseBackup,SAVE_VERSION} from '../model.js';
import {SHEET_SECTIONS,isSheetFavorite,toggleSheetSection,toggleSheetFavorite} from '../sheet-layout.js';

const backup = characters => ({version:SAVE_VERSION,characters,activeId:characters[0].id,settings:{sound:false}});

test('existing saves open with expanded sections and no favorites without migration',()=>{
  const c=makeCharacter();
  const restored=parseBackup(JSON.stringify(backup([c]))).characters[0];
  assert.equal(restored.sheetLayout,undefined);
  assert.equal(isSheetFavorite(restored,'abilities','str'),false);
  assert.deepEqual(restored,c);
});

test('section choices and stable entry favorites survive backups separately for each character',()=>{
  const first=makeCharacter(),second=makeCharacter();
  for (const section of SHEET_SECTIONS) toggleSheetSection(first,section);
  toggleSheetFavorite(first,'abilities','str');
  toggleSheetFavorite(first,'skills','skill-Animal Handling');
  toggleSheetFavorite(first,'attacks','weapon-123');
  toggleSheetSection(second,'journal');
  toggleSheetFavorite(second,'abilities','dex');
  const saved=backup([first,second]);
  assert.deepEqual(parseBackup(JSON.stringify(saved)),saved);
  assert.equal(isSheetFavorite(first,'abilities','dex'),false);
  assert.equal(isSheetFavorite(second,'abilities','str'),false);
  toggleSheetSection(first,'abilities');
  toggleSheetFavorite(first,'abilities','str');
  assert.ok(!first.sheetLayout.collapsed.includes('abilities'));
  assert.equal(isSheetFavorite(first,'abilities','str'),false);
});

test('malformed or excessive layout data is rejected while stale deleted entry IDs remain harmless',()=>{
  const invalid=[null,[],{},
    {collapsed:'skills',favorites:{}},
    {collapsed:['unknown'],favorites:{}},
    {collapsed:['skills','skills'],favorites:{}},
    {collapsed:[],favorites:null},
    {collapsed:[],favorites:[]},
    {collapsed:[],favorites:{unknown:['str']}},
    {collapsed:[],favorites:{abilities:'str'}},
    {collapsed:[],favorites:{abilities:['str','str']}},
    {collapsed:[],favorites:{abilities:[null]}},
    {collapsed:[],favorites:{abilities:['']}},
    {collapsed:[],favorites:{abilities:['x'.repeat(121)]}},
    {collapsed:[],favorites:{pack:Array.from({length:2002},(_,i)=>String(i))}}
  ];
  for (const sheetLayout of invalid) {
    assert.throws(()=>parseBackup(JSON.stringify(backup([makeCharacter({sheetLayout})]))),/invalid character sheet layout/);
  }
  const c=makeCharacter({sheetLayout:{collapsed:['attacks'],favorites:{attacks:['deleted-attack']}}});
  assert.deepEqual(parseBackup(JSON.stringify(backup([c]))).characters[0],c);
});
