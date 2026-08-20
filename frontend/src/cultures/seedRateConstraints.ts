import type { SeedRateUnit, SeedRateUnitConstraints } from '../api/types';

const GENERIC_SEED_RATE_INPUT_PROPS = {
  min: 0.001,
  step: 0.001,
  inputMode: 'decimal' as const,
};

export const getSeedRateValueInputProps = (
  unit: SeedRateUnit | null | undefined,
  constraints?: Partial<SeedRateUnitConstraints> | null,
) => {
  const constraint = unit ? constraints?.[unit] : undefined;
  if (!constraint) {
    return GENERIC_SEED_RATE_INPUT_PROPS;
  }

  return {
    min: constraint.minimum,
    step: constraint.step,
    inputMode: constraint.value_type === 'integer' ? 'numeric' as const : 'decimal' as const,
  };
};

export const seedRateValueViolatesConstraint = (
  value: unknown,
  unit: SeedRateUnit | null | undefined,
  constraints?: Partial<SeedRateUnitConstraints> | null,
): boolean => {
  const constraint = unit ? constraints?.[unit] : undefined;
  if (!constraint || constraint.value_type !== 'integer') {
    return false;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }
  return !Number.isInteger(value);
};
