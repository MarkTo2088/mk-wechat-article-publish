// scripts/probe.mjs — CLI 入口
import { runProbe, formatProbeReport } from './lib/probe.mjs';

const startDir = process.env.MK_WECHAT_START_DIR || process.cwd();
const report = await runProbe({ startDir });
console.log(formatProbeReport(report));
process.exit(report.ok ? 0 : 1);
