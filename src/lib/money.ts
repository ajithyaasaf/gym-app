/**
 * Money utilities:
 * All monetary amounts in the database are stored as integer paise (1 INR = 100 paise).
 * All calculations are done in integer arithmetic to avoid floating point inaccuracies.
 */

export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === "string") {
    const cleaned = rupees.replace(/,/g, "").trim();
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    if (isNaN(parsed)) {
      throw new Error(`Invalid rupee amount: ${rupees}`);
    }
    return Math.round(parsed * 100);
  }
  if (isNaN(rupees)) {
    throw new Error(`Invalid rupee amount: ${rupees}`);
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

export function formatINR(
  paise: number,
  options?: { showSymbol?: boolean; showDecimals?: boolean }
): string {
  const showSymbol = options?.showSymbol ?? true;
  const showDecimals = options?.showDecimals ?? false;
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = absPaise / 100;

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);

  const prefix = isNegative ? "-" : "";
  const symbol = showSymbol ? "₹" : "";
  return `${prefix}${symbol}${formatted}`;
}

/**
 * Calculates discount amount in paise.
 * Fixed: amount in paise, clamped to baseAmountPaise.
 * Percentage: percentage (0-100), calculated as round((baseAmountPaise * percentage) / 100).
 */
export function calculateDiscountPaise(
  baseAmountPaise: number,
  discountType: "FIXED" | "PERCENTAGE",
  discountValue: number
): number {
  if (baseAmountPaise <= 0 || discountValue <= 0) return 0;

  if (discountType === "FIXED") {
    const fixedPaise = Math.round(discountValue);
    return Math.min(fixedPaise, baseAmountPaise);
  } else {
    // Percentage between 0 and 100
    const clampedPct = Math.min(Math.max(discountValue, 0), 100);
    const calculated = Math.round((baseAmountPaise * clampedPct) / 100);
    return Math.min(calculated, baseAmountPaise);
  }
}

/**
 * Calculates tax in paise based on basis points (e.g., 1800 = 18.00%).
 */
export function calculateTaxPaise(
  taxableAmountPaise: number,
  taxBasisPoints: number
): number {
  if (taxableAmountPaise <= 0 || taxBasisPoints <= 0) return 0;
  return Math.round((taxableAmountPaise * taxBasisPoints) / 10000);
}

/**
 * Allocates a payment amount in paise across a list of pending charges (oldest first).
 * Returns array of allocations with chargeId and allocatedPaise, plus remaining unallocated amount.
 */
export interface ChargeForAllocation {
  id: string;
  balancePaise: number;
}

export interface AllocationResult {
  allocations: Array<{ chargeId: string; allocatedPaise: number }>;
  totalAllocatedPaise: number;
  remainingPaymentPaise: number;
}

export function allocatePayment(
  paymentPaise: number,
  charges: ChargeForAllocation[]
): AllocationResult {
  if (paymentPaise <= 0) {
    return { allocations: [], totalAllocatedPaise: 0, remainingPaymentPaise: 0 };
  }

  let remaining = paymentPaise;
  let totalAllocated = 0;
  const allocations: Array<{ chargeId: string; allocatedPaise: number }> = [];

  for (const charge of charges) {
    if (remaining <= 0) break;
    if (charge.balancePaise <= 0) continue;

    const toAllocate = Math.min(remaining, charge.balancePaise);
    allocations.push({
      chargeId: charge.id,
      allocatedPaise: toAllocate,
    });
    remaining -= toAllocate;
    totalAllocated += toAllocate;
  }

  return {
    allocations,
    totalAllocatedPaise: totalAllocated,
    remainingPaymentPaise: remaining,
  };
}

