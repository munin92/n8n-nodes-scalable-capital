import { cp, mkdir } from 'node:fs/promises';
const dir = 'dist/nodes/ScalableCapital';
await mkdir(dir, { recursive: true });
await cp('nodes/ScalableCapital/scalableCapital.light.svg', `${dir}/scalableCapital.light.svg`);
await cp('nodes/ScalableCapital/scalableCapital.dark.svg', `${dir}/scalableCapital.dark.svg`);
await cp('nodes/ScalableCapital/ScalableCapital.node.json', `${dir}/ScalableCapital.node.json`);
