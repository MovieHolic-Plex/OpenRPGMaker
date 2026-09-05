import {describe,expect,it} from 'vitest';
import {createInterpreter} from '@/player/interpreter';
import {DEFAULT_MESSAGE_WINDOW_SETTINGS} from '@/project/session';
import {session} from './runtimeEventPageFixtures';

describe('persisted M2 display text settings',()=>{
 it('applies authored settings to the following dialogue instead of resetting them',()=>{
  const s=session();
  const settings={format:'transparent',position:'top',preventObscuringPlayer:false,allowEventMovementDuringWait:true};
  const i=createInterpreter([
   {kind:'m2Command',commandId:'m2-002-display-text-settings',fields:settings},
   {kind:'text',body:'probe'},
  ],s);
  expect(i.start()).toMatchObject({kind:'text',settings});
 });
 it('uses safe defaults when legacy fields are absent or invalid',()=>{
  const s=session();
  const i=createInterpreter([
   {kind:'m2Command',commandId:'m2-002-display-text-settings',fields:{format:'invalid',position:'invalid'}},
   {kind:'text',body:'probe'},
  ],s);
  expect(i.start()).toMatchObject({kind:'text',settings:DEFAULT_MESSAGE_WINDOW_SETTINGS});
 });
});
