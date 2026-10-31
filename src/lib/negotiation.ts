import { z } from "zod";
import { agreementPercent } from "./agreement";
import { bargainParameter, KEYS, withDefaults, type LogLine, type Param, type ParamKey, type Params, type Side, type Term } from "./bargain";

export type Condition = { key: ParamKey; term: Term | null; log: LogLine[]; buyerAccepted: boolean; sellerAccepted: boolean };
export type NegotiationSnapshot = { buyer: Params; seller: Params; conditions: Condition[]; finalProposals?: { buyer: boolean; seller: boolean }; percent?: number; scoringVersion?: number };

export function scored(snapshot: NegotiationSnapshot): NegotiationSnapshot {
  return { ...snapshot, percent: agreementPercent(snapshot), scoringVersion: 1 };
}

export const paramKeySchema = z.enum(["qty", "price", "term", "payment", "basis", "warranty", "regularity"]);
export const conditionValuesSchema = z.object({
  min: z.string().max(40), max: z.string().max(40), unit: z.string().max(40), value: z.string().max(500),
}).strict();
export type ConditionValues = z.infer<typeof conditionValuesSchema>;

export function initialNegotiation(b: Params, s: Params): NegotiationSnapshot {
  const buyer = withDefaults(b), seller = withDefaults(s);
  const order = [...KEYS].sort((a, c) => buyer[c].priority + seller[c].priority - buyer[a].priority - seller[a].priority);
  return scored({ buyer, seller, conditions: order.map((key) => ({ key, ...bargainParameter(key, buyer[key], seller[key]), buyerAccepted: false, sellerAccepted: false })) });
}

export function validateValues(key: ParamKey, values: ConditionValues) {
  conditionValuesSchema.parse(values);
  if (["qty", "price", "term"].includes(key)) {
    if (!values.min.trim() && !values.max.trim()) throw new Error("Укажите значение или диапазон.");
    const lo = Number(values.min || values.max), hi = Number(values.max || values.min);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0 || hi < lo) throw new Error("Нужен корректный диапазон: от не больше до, без отрицательных значений.");
  } else if (!values.value.trim()) throw new Error("Укажите своё условие.");
}

export function proposeCondition(snapshot: NegotiationSnapshot, side: Side, key: ParamKey, values: ConditionValues): NegotiationSnapshot {
  validateValues(key, values);
  const param: Param = { ...snapshot[side][key], ...values };
  if (param.ignore) throw new Error("Параметр помечен как неважный. Сначала измените это в заявке.");
  const next = { ...snapshot, [side]: { ...snapshot[side], [key]: param } };
  return scored({ ...next, finalProposals: { buyer: false, seller: false }, conditions: snapshot.conditions.map((c) => c.key === key ? { key, ...bargainParameter(key, next.buyer[key], next.seller[key]), buyerAccepted: false, sellerAccepted: false } : c) });
}

export function acceptCondition(snapshot: NegotiationSnapshot, side: Side, key: ParamKey): NegotiationSnapshot {
  const c = snapshot.conditions.find((item) => item.key === key);
  if (!c?.term) throw new Error("Нет условия для подтверждения.");
  return scored({ ...snapshot, conditions: snapshot.conditions.map((item) => item.key === key ? { ...item, [side === "buyer" ? "buyerAccepted" : "sellerAccepted"]: true } : item) });
}

export function humansAgreed(snapshot: NegotiationSnapshot) {
  const active = snapshot.conditions.filter((c) => c.term);
  return active.length > 0 && active.every((c) => c.buyerAccepted && c.sellerAccepted);
}

export function participantReady(snapshot: NegotiationSnapshot, side: Side) {
  const active = snapshot.conditions.filter((c) => c.term);
  return active.length > 0 && active.every((c) => side === "buyer" ? c.buyerAccepted : c.sellerAccepted);
}

export function proposeAllConditions(snapshot: NegotiationSnapshot, side: Side): NegotiationSnapshot {
  if (!participantReady(snapshot, side)) throw new Error("Сначала подтвердите каждый пункт.");
  return { ...snapshot, finalProposals: { buyer: snapshot.finalProposals?.buyer ?? false, seller: snapshot.finalProposals?.seller ?? false, [side]: true } };
}

export function contractReady(snapshot: NegotiationSnapshot) {
  return humansAgreed(snapshot) && snapshot.finalProposals?.buyer === true && snapshot.finalProposals?.seller === true;
}