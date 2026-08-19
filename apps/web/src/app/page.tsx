import { CalculatorApp } from '@/components/calculator/CalculatorApp';

/**
 * The calculator is a single screen. It is rendered from a server component so
 * that only the interactive shell ships as client JavaScript.
 */
export default function HomePage() {
  return (
    <main>
      <CalculatorApp />
    </main>
  );
}
