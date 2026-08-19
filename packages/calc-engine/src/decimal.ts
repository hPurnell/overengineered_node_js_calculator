import DecimalJs from 'decimal.js';

import { COMPUTATION_PRECISION } from '@calc/contracts';

/**
 * A private Decimal constructor for the engine.
 *
 * Cloning rather than configuring the global keeps our precision settings from
 * leaking into (or being clobbered by) any other consumer of decimal.js in the
 * same process.
 */
export const Decimal = DecimalJs.clone({
  precision: COMPUTATION_PRECISION,
  rounding: DecimalJs.ROUND_HALF_UP,
});

export type Decimal = InstanceType<typeof Decimal>;
