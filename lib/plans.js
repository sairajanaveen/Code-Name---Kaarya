import { MAX_TRANSCRIPT_LENGTH } from "./meetingInput.js";

export const PLANS = Object.freeze({
  free: Object.freeze({ id: "free", name: "Free", price: 0, meetings: 1, period: "day", retained: 5, refinements: 1, inputCharacters: MAX_TRANSCRIPT_LENGTH, seats: 1 }),
  pro: Object.freeze({ id: "pro", name: "Pro", price: 2999, meetings: 40, period: "month", retained: 500, refinements: 2, inputCharacters: MAX_TRANSCRIPT_LENGTH, seats: 1 }),
  team: Object.freeze({ id: "team", name: "Team", price: 9999, meetings: 200, period: "month", retained: 2000, refinements: 2, inputCharacters: MAX_TRANSCRIPT_LENGTH, seats: 5 })
});

export const formatINR = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
export const validUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
