import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
export function databasePath() {
  const path=process.env.LEARNING_DB || join(process.env.LOCALAPPDATA || homedir(),'KhatwaLearning','learning.sqlite');
  mkdirSync(dirname(path),{recursive:true});
  return path;
}
