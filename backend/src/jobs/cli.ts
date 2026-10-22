import * as dotenv from 'dotenv';
dotenv.config();

import { ingestPriceHistory } from './ingestPriceHistory';

// A run with more failed coins than this is treated as a failed job.
const MAX_FAILED_FRACTION = 0.1;

function numericFlag(args: string[], name: string, fallback: number): number {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const [job, ...args] = process.argv.slice(2);

async function main(): Promise<number> {
  switch (job) {
    case 'ingest-prices': {
      // Three days covers a missed run; a backfill passes --days 365.
      const days = numericFlag(args, '--days', 3);
      const summary = await ingestPriceHistory({ days });
      const succeeded = summary.failed.length <= summary.coins * MAX_FAILED_FRACTION;
      // The log metric filter that backs the missed-run alarm matches on this line.
      console.log(JSON.stringify({ event: succeeded ? 'job_succeeded' : 'job_failed', job, days, ...summary }));
      return succeeded ? 0 : 1;
    }
    default:
      console.error(`Unknown job "${job ?? ''}". Available: ingest-prices`);
      return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(JSON.stringify({ event: 'job_failed', job, error: String(error?.stack ?? error) }));
    process.exit(1);
  });
