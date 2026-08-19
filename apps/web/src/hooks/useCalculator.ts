'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import type { Calculation } from '@calc/contracts';

import { evaluateExpression } from '@/lib/api/client';
import { ApiClientError } from '@/lib/api/errors';
import { buildSubmission } from '@/lib/calculator/expression';
import { INITIAL_STATE, calculatorReducer } from '@/lib/calculator/reducer';
import type { CalculatorState, OperatorSymbol } from '@/lib/calculator/types';

export interface UseCalculatorOptions {
  /** Called after a calculation is successfully recorded, to refresh history. */
  readonly onCalculationRecorded?: (() => void) | undefined;
}

export interface CalculatorController {
  readonly state: CalculatorState;
  readonly isBusy: boolean;
  /** Set when the API could not be reached at all, for the offline banner. */
  readonly connectionError: string | null;
  readonly pressDigit: (digit: string) => void;
  readonly pressDecimal: () => void;
  readonly pressOperator: (operator: OperatorSymbol) => void;
  readonly pressPercent: () => void;
  readonly pressToggleSign: () => void;
  readonly pressBackspace: () => void;
  readonly pressClear: () => void;
  readonly pressEquals: () => void;
  /** Puts a history entry back on the readout. */
  readonly recall: (calculation: Calculation) => void;
}

/**
 * Drives the calculator: local keypad state plus the one remote call.
 *
 * Every key is handled locally and instantly. Only `=` reaches the network,
 * which is what keeps the keypad responsive while arithmetic stays a
 * server-side concern.
 */
export function useCalculator(options: UseCalculatorOptions = {}): CalculatorController {
  const { onCalculationRecorded } = options;

  const [state, dispatch] = useReducer(calculatorReducer, INITIAL_STATE);

  // Rendered as a banner, so this has to be state rather than a ref.
  const [connectionError, setConnectionError] = useState<string | null>(null);

  /** Tracks the in-flight evaluation so it can be abandoned on unmount. */
  const inFlightRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      inFlightRef.current?.abort();
    },
    [],
  );

  const pressEquals = useCallback(async () => {
    if (state.status === 'computing') {
      return;
    }

    const submission = buildSubmission(state);
    if (submission === null) {
      return;
    }

    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    dispatch({ type: 'evaluateStarted' });

    try {
      const calculation = await evaluateExpression(submission, { signal: controller.signal });
      setConnectionError(null);
      dispatch({ type: 'evaluateSucceeded', calculation });
      onCalculationRecorded?.();
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      if (error instanceof ApiClientError) {
        setConnectionError(error.isNetworkFailure ? error.message : null);
        dispatch({ type: 'evaluateFailed', message: error.displayText });
        return;
      }

      setConnectionError(null);
      dispatch({ type: 'evaluateFailed', message: 'Error' });
    } finally {
      if (inFlightRef.current === controller) {
        inFlightRef.current = null;
      }
    }
  }, [state, onCalculationRecorded]);

  return {
    state,
    isBusy: state.status === 'computing',
    connectionError,
    pressDigit: useCallback((digit: string) => dispatch({ type: 'digit', digit }), []),
    pressDecimal: useCallback(() => dispatch({ type: 'decimal' }), []),
    pressOperator: useCallback(
      (operator: OperatorSymbol) => dispatch({ type: 'operator', operator }),
      [],
    ),
    pressPercent: useCallback(() => dispatch({ type: 'percent' }), []),
    pressToggleSign: useCallback(() => dispatch({ type: 'toggleSign' }), []),
    pressBackspace: useCallback(() => dispatch({ type: 'backspace' }), []),
    pressClear: useCallback(() => dispatch({ type: 'clear' }), []),
    pressEquals: useCallback(() => {
      void pressEquals();
    }, [pressEquals]),
    recall: useCallback(
      (calculation: Calculation) => dispatch({ type: 'recall', calculation }),
      [],
    ),
  };
}
