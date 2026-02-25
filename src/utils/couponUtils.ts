export const BRANCH_CODES = ["GDXC", "GDXR", "NWXC", "GNXC", "SWXC"] as const;
export type BranchCode = (typeof BRANCH_CODES)[number];

export const BRANCH_PASSWORDS: Record<BranchCode, string> = {
  GDXC: "48291",
  GDXR: "73058",
  NWXC: "15947",
  GNXC: "86420",
  SWXC: "31769",
};

export function generateCouponCode8() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function normalizeCouponCode(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getLocalLockKey(couponCode: string, branch: string) {
  return `coupon_lock:${couponCode}:${branch}`;
}

export function isLocallyLocked(couponCode: string, branch: string) {
  const key = getLocalLockKey(couponCode, branch);
  const raw = localStorage.getItem(key);
  if (!raw) return { locked: false, remainingSec: 0 };

  const until = Number(raw);
  if (!Number.isFinite(until)) return { locked: false, remainingSec: 0 };

  const now = Date.now();
  if (now >= until) {
    localStorage.removeItem(key);
    return { locked: false, remainingSec: 0 };
  }
  return { locked: true, remainingSec: Math.ceil((until - now) / 1000) };
}

export function setLocalLock10Min(couponCode: string, branch: string) {
  const key = getLocalLockKey(couponCode, branch);
  const until = Date.now() + 10 * 60 * 1000;
  localStorage.setItem(key, String(until));
}
