import { cp, mkdir } from 'node:fs/promises';
const dir = 'dist/nodes/ScalableCapital';
await mkdir(dir, { recursive: true });
await cp('nodes/ScalableCapital/scalableCapital.svg', `${dir}/scalableCapital.svg`);
