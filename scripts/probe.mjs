// scripts/probe.mjs — CLI 入口
import { runProbe, formatProbeReport } from './lib/probe.mjs';

const report = await runProbe();
console.log(formatProbeReport(report));
process.exit(report.ok ? 0 : 1);
