import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { AgreementBadge } from "./agreement-badge";
import { agreementPercent, conditionPercent } from "@/lib/agreement";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Users2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  BENEFIT,
  LABELS,
  type Param,
  type ParamKey,
  type TradeRequest,
} from "@/lib/bargain";
import { describeDeal } from "@/lib/ai.functions";
import {
  changeNegotiation,
  finalizeNegotiation,
  openNegotiation,
} from "@/lib/negotiations.functions";
import {
  humansAgreed,
  proposeCondition,
  type ConditionValues,
  type NegotiationSnapshot,
} from "@/lib/negotiation";
import { cn } from "@/lib/utils";
import { getPublicProfiles } from "@/lib/api";

type Edit = {
  key: ParamKey;
  version: number;
  values: ConditionValues;
  preview: NegotiationSnapshot | null;
};

const PARAM_COLORS: Record<ParamKey, { badge: string; border: string }> = {
  qty: {
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    border: "border-blue-500/20",
  },
  price: {
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    border: "border-emerald-500/20",
  },
  payment: {
    badge: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    border: "border-violet-500/20",
  },
  basis: {
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    border: "border-amber-500/20",
  },
  term: {
    badge: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    border: "border-rose-500/20",
  },
  warranty: {
    badge: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    border: "border-teal-500/20",
  },
  regularity: {
    badge: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    border: "border-indigo-500/20",
  },
};

export function NegotiationCards({
  my,
  other,
}: {
  my: TradeRequest;
  other: TradeRequest;
}) {
  const buyer = my.kind === "buy" ? my : other;
  const seller = my.kind === "sell" ? my : other;
  const side = my.kind === "buy" ? "buyer" : "seller";

  const open = useServerFn(openNegotiation);
  const change = useServerFn(changeNegotiation);
  const explain = useServerFn(describeDeal);
  const finalize = useServerFn(finalizeNegotiation);

  const client = useQueryClient();
  const navigate = useNavigate();

  const profiles = useQuery({
    queryKey: ["public-profiles-chat", buyer.owner_id, seller.owner_id],
    queryFn: () => getPublicProfiles([buyer.owner_id, seller.owner_id]),
    staleTime: 60000,
  });

  const buyerProfile = profiles.data?.[buyer.owner_id];
  const sellerProfile = profiles.data?.[seller.owner_id];
  const buyerName = buyerProfile?.name || "Покупатель";
  const sellerName = sellerProfile?.name || "Продавец";
  const myName = side === "buyer" ? buyerName : sellerName;
  const partnerName = side === "buyer" ? sellerName : buyerName;

  // Индекс надёжности партнёра на основе отзывов
  const [partnerReview, setPartnerReview] = useState<{
    score: string;
    count: number;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("ai_mall_partner_reviews") || "{}",
      );
      if (stored[partnerName]) {
        setPartnerReview(stored[partnerName]);
      } else {
        setPartnerReview(null);
      }
    } catch {
      setPartnerReview(null);
    }
  }, [partnerName]);

  const queryKey = ["request-negotiation", buyer.id, seller.id];

  const [edit, setEdit] = useState<Edit | null>(null);
  const [confirmation, setConfirmation] = useState<{
    key: ParamKey;
    version: number;
    action: "accept" | "propose";
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const query = useQuery({
    queryKey,
    queryFn: () => open({ data: { buyerId: buyer.id, sellerId: seller.id } }),
    refetchInterval: 10000,
  });

  const row = query.data;
  const snapshot = row?.snapshot as unknown as
    | NegotiationSnapshot
    | undefined;

  const history = useQuery({
    queryKey: ["negotiation-history", row?.id, row?.version],
    enabled: !!row && showHistory,
    queryFn: async () => {
      if (!row) return [];

      const { data, error } = await supabase
        .from("negotiation_versions")
        .select("id,version,actor_id,action,param_key,snapshot,created_at")
        .eq("negotiation_id", row.id)
        .order("version", { ascending: false })
        .limit(100);

      if (error) {
        throw new Error("История недоступна.");
      }

      return data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!row || !confirmation) {
        throw new Error("Выберите условие.");
      }

      return change({
        data: {
          id: row.id,
          version: confirmation.version,
          action: confirmation.action,
          key: confirmation.key,
          ...(confirmation.action === "propose" && edit
            ? { values: edit.values }
            : {}),
        },
      });
    },
    onSuccess: (saved) => {
      client.setQueryData(queryKey, saved);
      setConfirmation(null);
      setEdit(null);
      toast.success("Отправлено второй стороне");
    },
    onError: (error) => {
      toast.error(error.message);
      void query.refetch();
    },
  });

  const summary = useQuery({
    queryKey: ["negotiation-summary", row?.id, row?.version],
    enabled: false,
    queryFn: async () => {
      if (!snapshot) {
        return { text: "" };
      }

      return explain({
        data: {
          agreement: agreementPercent(snapshot),
          conditions: snapshot.conditions.map((condition) => ({
            label: LABELS[condition.key],
            status: condition.term?.status ?? "pending",
            value: condition.term?.value ?? "—",
          })),
        },
      });
    },
  });

  const finalizeDeal = useMutation({
    mutationFn: async () => {
      if (!row) {
        throw new Error("Переговоры недоступны.");
      }

      return finalize({
        data: {
          id: row.id,
          version: row.version,
        },
      });
    },
    onSuccess: async ({ negotiation, contractId }) => {
      client.setQueryData(queryKey, negotiation);
      await client.invalidateQueries({ queryKey });

      if (contractId) {
        toast.success("Черновик договора создан.");
        navigate({
          to: "/dashboard",
          search: { tab: "documents" },
        });
      } else {
        toast.success(
          "Ваше финальное подтверждение сохранено. Ожидается подтверждение партнёра.",
        );
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (query.isPending) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-base text-dim">
        <Loader2 className="size-5 animate-spin" />
        Открываем переговоры…
      </div>
    );
  }

  if (query.isError || !row || !snapshot) {
    return (
      <div className="space-y-3 p-6 text-sm text-destructive">
        <p>
          {query.error
            ? (query.error as Error).message
            : "Не удалось открыть переговоры. Проверьте вход и попробуйте снова."}
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          <RefreshCw className="size-4" />
          Повторить
        </Button>
      </div>
    );
  }

  const beginEdit = (key: ParamKey) => {
    const parameter = snapshot[side][key];

    setEdit({
      key,
      version: row.version,
      values: {
        min: parameter.min,
        max: parameter.max,
        unit: parameter.unit,
        value: parameter.value,
      },
      preview: null,
    });
  };

  const simulate = () => {
    if (!edit) return;

    const preview = proposeCondition(
      snapshot,
      side,
      edit.key,
      edit.values,
    );

    setEdit({ ...edit, preview });
  };

  const allAgreed = humansAgreed(snapshot);
  const alreadyFinalized = snapshot.finalProposals?.[side] === true;

  const myCheckedAll = snapshot.conditions.every((condition) =>
    side === "buyer"
      ? condition.buyerAccepted
      : condition.sellerAccepted,
  );

  return (
    <div className="flex-1 space-y-6 p-4 text-base sm:p-6">
      {/* Сводная карточка торга и статус надёжности партнёра */}
      <section className="rounded-2xl border-2 border-brand/20 bg-gradient-to-br from-brand/5 via-background to-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-sm">
              <Sparkles className="size-5" />
            </span>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-ink">
                  Параметры сделки и статус торга
                </h2>

                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                  <Users2 className="size-3" />
                  {myName} (Вы) ↔ {partnerName}
                </span>

                {partnerReview && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                    ⭐ Надёжность {partnerName}: {partnerReview.score}/5
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-xs text-dim sm:text-sm">
                По каждому пункту проводится автономный торг агентов.
                Подтвердите условия.
              </p>
            </div>
          </div>

          <AgreementBadge percent={agreementPercent(snapshot)} />
        </div>

        {/* Карточки участников */}
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Покупатель {side === "buyer" ? "· Вы" : ""}
                </span>
                <span className="text-xs text-dim">
                  {buyerProfile?.company || ""}
                </span>
              </div>

              <div className="mt-1 text-base font-bold text-ink">
                {buyerName}
              </div>
              <div className="mt-0.5 truncate text-xs text-dim">
                Заявка: {buyer.title}
              </div>
            </div>

            {side === "seller" && (
              <div className="mt-2.5 flex items-center justify-between border-t border-blue-500/15 pt-2 text-xs">
                <span className="text-dim">Индекс надёжности:</span>
                {partnerReview ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">
                    ⭐ {partnerReview.score}/5 ({partnerReview.count}{" "}
                    {partnerReview.count === 1 ? "сделка" : "сделок"})
                  </span>
                ) : (
                  <span className="font-medium text-blue-600">
                    Новый контрагент (нет замечаний)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Продавец {side === "seller" ? "· Вы" : ""}
                </span>
                <span className="text-xs text-dim">
                  {sellerProfile?.company || ""}
                </span>
              </div>

              <div className="mt-1 text-base font-bold text-ink">
                {sellerName}
              </div>
              <div className="mt-0.5 truncate text-xs text-dim">
                Заявка: {seller.title}
              </div>
            </div>

            {side === "buyer" && (
              <div className="mt-2.5 flex items-center justify-between border-t border-emerald-500/15 pt-2 text-xs">
                <span className="text-dim">Индекс надёжности:</span>
                {partnerReview ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">
                    ⭐ {partnerReview.score}/5 ({partnerReview.count}{" "}
                    {partnerReview.count === 1 ? "сделка" : "сделок"})
                  </span>
                ) : (
                  <span className="font-medium text-emerald-600">
                    Новый контрагент (нет замечаний)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Сводная таблица параметров */}
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-foreground/[0.02] text-dim">
              <tr>
                <th className="py-2.5 pl-3 pr-2 font-medium">№</th>
                <th className="px-2 py-2.5 font-medium">Параметр</th>
                <th className="px-2 py-2.5 font-medium">Моё условие</th>
                <th className="px-2 py-2.5 font-medium">Компромисс ботов</th>
                <th className="py-2.5 pl-2 pr-3 text-right font-medium">
                  Статус
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {snapshot.conditions.map((condition, index) => {
                const isMyOk =
                  side === "buyer"
                    ? condition.buyerAccepted
                    : condition.sellerAccepted;
                const isOtherOk =
                  side === "buyer"
                    ? condition.sellerAccepted
                    : condition.buyerAccepted;
                const myParam = snapshot[side][condition.key];
                const range = ["qty", "price", "term"].includes(
                  condition.key,
                );

                let statusText = "Ожидает решения";
                let statusBadge = "border-border bg-muted text-dim";
                let statusIcon = "⏳";

                if (isMyOk && isOtherOk) {
                  statusText = "Согласовано обоими";
                  statusBadge =
                    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
                  statusIcon = "✓";
                } else if (isMyOk) {
                  statusText = "Принято вами";
                  statusBadge =
                    "border-blue-500/20 bg-blue-500/10 text-blue-600";
                  statusIcon = "✓";
                } else if (isOtherOk) {
                  statusText = "Принято партнёром";
                  statusBadge =
                    "border-purple-500/20 bg-purple-500/10 text-purple-600";
                  statusIcon = "⏳";
                }

                return (
                  <tr
                    key={condition.key}
                    className="hover:bg-foreground/[0.01]"
                  >
                    <td className="py-2.5 pl-3 pr-2 font-mono text-xs text-dim">
                      #{index + 1}
                    </td>
                    <td className="px-2 py-2.5 font-medium text-ink">
                      {LABELS[condition.key]}
                    </td>
                    <td className="px-2 py-2.5 font-medium text-ink">
                      {parameterText(myParam, range)}
                    </td>
                    <td className="px-2 py-2.5 font-semibold text-ink">
                      {condition.term?.value ?? "—"}
                    </td>
                    <td className="py-2.5 pl-2 pr-3 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                          statusBadge,
                        )}
                      >
                        <span>{statusIcon}</span>
                        <span>{statusText}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Карточки параметров */}
      <div className="space-y-4">
        {snapshot.conditions.map((condition, index) => {
          const current =
            edit?.key === condition.key ? edit : null;
          const shown =
            current?.preview?.conditions.find(
              (item) => item.key === condition.key,
            ) ?? condition;
          const parameter = snapshot[side][condition.key];
          const range = ["qty", "price", "term"].includes(
            condition.key,
          );
          const isMyOk =
            side === "buyer"
              ? condition.buyerAccepted
              : condition.sellerAccepted;
          const isOtherOk =
            side === "buyer"
              ? condition.sellerAccepted
              : condition.buyerAccepted;
          const color = PARAM_COLORS[condition.key] ?? {
            badge: "bg-muted text-foreground border-border",
            border: "border-border",
          };

          return (
            <article
              key={condition.key}
              className={cn(
                "rounded-xl border bg-card p-5 shadow-sm transition-all",
                color.border,
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-lg border text-xs font-bold",
                      color.badge,
                    )}
                  >
                    #{index + 1}
                  </span>

                  <h3 className="text-base font-bold text-ink sm:text-lg">
                    {LABELS[condition.key]}
                  </h3>
                </div>

                {shown.term && (
                  <AgreementBadge
                    percent={
                      conditionPercent(
                        current?.preview ?? snapshot,
                        shown,
                      ) ?? 0
                    }
                  />
                )}
              </div>

              <p className="mt-2 text-xs text-dim sm:text-sm">
                {BENEFIT[condition.key]}
              </p>

              {/* Диалог торга ботов */}
              <details className="group mt-3 rounded-xl border border-border/80 bg-foreground/[0.015] p-3 text-xs sm:text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-dim hover:text-ink">
                  <div className="flex items-center gap-2">
                    <Bot className="size-4 text-brand" />
                    <span className="font-semibold text-ink">
                      Ход торга ботов: {LABELS[condition.key]} (4 раунда)
                    </span>
                  </div>
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </summary>

                <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                  {generateBotDialogue(
                    condition.key,
                    snapshot.buyer[condition.key],
                    snapshot.seller[condition.key],
                    shown.term?.value,
                    range,
                    buyerName,
                    sellerName,
                  ).map((message, messageIndex) => (
                    <div
                      key={messageIndex}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg p-2.5 transition-colors",
                        message.role === "buyer"
                          ? "border border-blue-500/10 bg-blue-500/5"
                          : "border border-emerald-500/10 bg-emerald-500/5",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                          message.role === "buyer"
                            ? "bg-blue-500/20 text-blue-700"
                            : "bg-emerald-500/20 text-emerald-700",
                        )}
                      >
                        {message.step}
                      </span>

                      <div className="flex-1">
                        <div className="text-[11px] font-semibold text-dim">
                          {message.author}
                        </div>
                        <div className="mt-0.5 leading-snug text-ink">
                          {message.text}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="mt-2.5 rounded-lg border border-brand/20 bg-brand/10 p-2.5 text-xs text-ink">
                    <span className="font-bold text-brand">
                      Итог раунда:
                    </span>{" "}
                    {shown.term?.rationale ||
                      `Достигнут компромисс: ${shown.term?.value ?? "—"}`}
                  </div>
                </div>
              </details>

              {/* Условия сторон */}
              <div className="mt-3 grid gap-3 rounded-lg bg-foreground/[0.02] p-3 text-xs sm:grid-cols-2 sm:text-sm">
                <div>
                  <div className="font-semibold text-dim">
                    Покупатель ({buyerName}){" "}
                    {side === "buyer" ? "· Вы" : ""}
                  </div>
                  <div className="mt-0.5 text-base font-medium text-ink">
                    {parameterText(snapshot.buyer[condition.key], range)}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-dim">
                    Продавец ({sellerName}){" "}
                    {side === "seller" ? "· Вы" : ""}
                  </div>
                  <div className="mt-0.5 text-base font-medium text-ink">
                    {parameterText(snapshot.seller[condition.key], range)}
                  </div>
                </div>
              </div>

              {/* Компромисс ботов */}
              <div className="mt-4 rounded-xl border border-border/80 bg-foreground/[0.015] p-3.5">
                <div className="text-xs font-medium text-dim">
                  Компромисс ботов
                </div>
                <div className="mt-1 text-base font-bold text-ink sm:text-lg">
                  {shown.term?.value ?? "Условие пока не выработано"}
                </div>
                {shown.term?.rationale && (
                  <p className="mt-1 text-xs leading-relaxed text-dim sm:text-sm">
                    {shown.term.rationale}
                  </p>
                )}
              </div>

              {/* Статус согласования */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs sm:text-sm">
                  {isMyOk && isOtherOk ? (
                    <span className="font-semibold text-emerald-600">
                      ✓ Согласовано обеими сторонами
                    </span>
                  ) : isMyOk ? (
                    <span className="font-medium text-blue-600">
                      ✓ Принято вами (партнёр ещё не подтвердил)
                    </span>
                  ) : isOtherOk ? (
                    <span className="font-medium text-purple-600">
                      ⏳ Принято {partnerName} (ждёт вашего подтверждения)
                    </span>
                  ) : (
                    <span className="font-medium text-amber-600">
                      Ожидает вашего подтверждения
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isMyOk && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() =>
                        setConfirmation({
                          key: condition.key,
                          version: row.version,
                          action: "accept",
                        })
                      }
                    >
                      <Check className="size-4" />
                      Принять пункт
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      current ? setEdit(null) : beginEdit(condition.key)
                    }
                  >
                    <Pencil className="size-3.5" />
                    {current ? "Отмена" : "Изменить своё"}
                  </Button>
                </div>
              </div>

              {/* Форма изменения своего условия */}
              {current && (
                <div className="mt-4 space-y-3 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 text-xs sm:text-sm">
                  <div className="font-semibold text-ink">
                    Ваше новое условие для пересчёта торга:
                  </div>

                  {range ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-dim">От</label>
                        <Input
                          value={current.values.min ?? ""}
                          onChange={(event) =>
                            setEdit({
                              ...current,
                              values: {
                                ...current.values,
                                min: event.target.value,
                              },
                            })
                          }
                          placeholder={parameter.min || "мин"}
                        />
                      </div>

                      <div>
                        <label className="text-xs text-dim">До</label>
                        <Input
                          value={current.values.max ?? ""}
                          onChange={(event) =>
                            setEdit({
                              ...current,
                              values: {
                                ...current.values,
                                max: event.target.value,
                              },
                            })
                          }
                          placeholder={parameter.max || "макс"}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Input
                        value={current.values.value ?? ""}
                        onChange={(event) =>
                          setEdit({
                            ...current,
                            values: {
                              ...current.values,
                              value: event.target.value,
                            },
                          })
                        }
                        placeholder={parameter.value || "Значение"}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={simulate}
                    >
                      Пересчитать с ботом
                    </Button>

                    <Button
                      size="sm"
                      onClick={() =>
                        setConfirmation({
                          key: condition.key,
                          version: current.version,
                          action: "propose",
                        })
                      }
                    >
                      <Send className="size-3.5" />
                      Отправить встречное
                    </Button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* ИИ-сводка с советом по надёжности */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-brand" />
            <h3 className="text-sm font-semibold text-ink sm:text-base">
              Что решили боты сторон (ИИ-сводка)
            </h3>
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={summary.isFetching}
            onClick={() => void summary.refetch()}
          >
            {summary.isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Объяснить сделку
          </Button>
        </div>

        {partnerReview && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
            <span className="font-bold">ИИ-совет по контрагенту:</span>
            У партнёра «{partnerName}» подтверждённый рейтинг надёжности ({partnerReview.score}/5 по результатам {partnerReview.count}{" "}
            {partnerReview.count === 1 ? "сделки" : "сделок"}). Рекомендуются гибкие условия и быстрое подписание.
          </div>
        )}

        {summary.data?.text && (
          <p className="mt-3 rounded-lg border border-brand/20 bg-brand/5 p-3 text-xs leading-relaxed text-dim sm:text-sm">
            {summary.data.text}
          </p>
        )}

        <details className="group mt-3 border-t border-border/80 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-dim hover:text-ink sm:text-sm">
            <span>Показать полный лог согласования условий ботами</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-3 space-y-2 text-xs text-dim sm:text-sm">
            {snapshot.conditions.map((condition) => (
              <div
                key={condition.key}
                className="rounded-lg bg-foreground/[0.02] p-2.5"
              >
                <span className="font-semibold text-ink">
                  {LABELS[condition.key]}:
                </span>{" "}
                {condition.term?.rationale ||
                  "Условие принято автоматически на основе диапазонов заявок."}
              </div>
            ))}
          </div>
        </details>
      </section>

      {/* Финальное подтверждение сделки */}
      <section className="sticky bottom-4 z-20 rounded-2xl border-2 border-brand bg-card p-5 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-bold text-ink">
              Итоговое согласование сделки
            </div>

            <div className="text-xs text-dim sm:text-sm">
              {alreadyFinalized
                ? "Ваше финальное подтверждение сохранено. Ожидаем подтверждения партнёра."
                : myCheckedAll
                  ? allAgreed
                    ? "Обе стороны приняли все пункты. Отправьте финальное подтверждение сделки."
                    : "Вы приняли все пункты. Отправьте финальное подтверждение; партнёру нужно принять свои."
                  : "Примите каждый пункт выше, чтобы отправить финальное подтверждение."}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory((value) => !value)}
              className="text-xs"
            >
              <History className="size-3.5" />
              История ({row.version})
            </Button>

            <Button
              size="lg"
              className="bg-emerald-600 text-base font-semibold text-white shadow-md hover:bg-emerald-700"
              disabled={
                !myCheckedAll ||
                finalizeDeal.isPending ||
                alreadyFinalized
              }
              onClick={() => finalizeDeal.mutate()}
            >
              {finalizeDeal.isPending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-5" />
              )}

              {alreadyFinalized
                ? "Ожидаем партнёра"
                : myCheckedAll
                  ? "Подтвердить сделку"
                  : "Сначала примите все пункты"}
            </Button>
          </div>
        </div>
      </section>

      {/* Диалог истории версий */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>История изменений торга</DialogTitle>
            <DialogDescription>
              Все версии согласования между сторонами.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs sm:text-sm">
            {history.data?.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between font-medium">
                  <span>Версия #{item.version}</span>
                  <span className="text-dim">
                    {new Date(item.created_at).toLocaleString("ru-RU")}
                  </span>
                </div>

                <div className="mt-1 text-dim">
                  Действие: {item.action}{" "}
                  {item.param_key
                    ? `(${LABELS[item.param_key as ParamKey]})`
                    : ""}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения изменения */}
      <Dialog
        open={!!confirmation}
        onOpenChange={(isOpen) => !isOpen && setConfirmation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение условия</DialogTitle>
            <DialogDescription>
              {confirmation?.action === "accept"
                ? `Вы соглашаетесь с условием по параметру «${
                    confirmation?.key
                      ? LABELS[confirmation.key]
                      : ""
                  }». Вторая сторона увидит ваш выбор.`
                : `Отправить новое условие по параметру «${
                    confirmation?.key
                      ? LABELS[confirmation.key]
                      : ""
                  }» на согласование?`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmation(null)}
            >
              Отмена
            </Button>

            <Button
              disabled={send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Подтвердить"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parameterText(
  parameter: (ConditionValues & { ignore?: boolean }) | undefined | null,
  range: boolean,
) {
  if (!parameter) return "—";
  if (parameter.ignore) return "Неважно";
  if (!range) return parameter.value || "Не задано";

  const min = parameter.min?.trim();
  const max = parameter.max?.trim();
  const unit = parameter.unit?.trim()
    ? ` ${parameter.unit.trim()}`
    : "";

  if (min && max && min === max) {
    return `${min}${unit}`;
  }

  if (min && max) {
    return `${min}–${max}${unit}`;
  }

  return `${min || max || "—"}${unit}`;
}

function generateBotDialogue(
  key: ParamKey,
  buyerParam: Param,
  sellerParam: Param,
  termValue: string | undefined,
  range: boolean,
  buyerName: string,
  sellerName: string,
) {
  const label = LABELS[key].toLowerCase();
  const buyerText = parameterText(buyerParam, range);
  const sellerText = parameterText(sellerParam, range);
  const compromise = termValue || "согласованное значение";

  if (key === "price") {
    return [
      {
        step: "А1",
        author: `Бот покупателя (${buyerName})`,
        role: "buyer",
        text: `Начальный запрос: целевой бюджет ${buyerText}. Приоритет параметра ${buyerParam.priority}%.`,
      },
      {
        step: "Б1",
        author: `Бот продавца (${sellerName})`,
        role: "seller",
        text: `Базовый прайс-лист: ${sellerText}. Ниже себестоимости отгрузить не можем, учитывая логистику.`,
      },
      {
        step: "А2",
        author: `Бот покупателя (${buyerName})`,
        role: "buyer",
        text: "Готовы гарантировать быстрый объём и платёжную дисциплину при встречной скидке.",
      },
      {
        step: "Б2",
        author: `Бот продавца (${sellerName})`,
        role: "seller",
        text: `Учитывая условия, сходимся на компромиссе ${compromise}. Фиксируем в договоре.`,
      },
    ];
  }

  if (key === "term") {
    return [
      {
        step: "А1",
        author: `Бот покупателя (${buyerName})`,
        role: "buyer",
        text: `Требуемый срок поставки: ${buyerText}. Важно для соблюдения нашего производственного цикла.`,
      },
      {
        step: "Б1",
        author: `Бот продавца (${sellerName})`,
        role: "seller",
        text: `Стандартный цикл сборки и отгрузки составляет ${sellerText}.`,
      },
      {
        step: "А2",
        author: `Бот покупателя (${buyerName})`,
        role: "buyer",
        text: "Готовы согласовать поэтапную приёмку, если сократите предельный срок.",
      },
      {
        step: "Б2",
        author: `Бот продавца (${sellerName})`,
        role: "seller",
        text: `Оптимизируем логистику склада: итоговый срок поставки — ${compromise}.`,
      },
    ];
  }

  if (key === "qty") {
    return [
      {
        step: "А1",
        author: `Бот покупателя (${buyerName})`,
        role: "buyer",
        text: `Планируемый объём закупки: ${buyerText}.`,
      },
      {
        step: "Б1",
        author: `Бот продавца (${sellerName})`,
        role: "seller",
        text: `Минимальная рентабельная партия у поставщика: ${sellerText}.`,
      },
      {
        step: "А2",
        author: `Бот покупателя (${buyerName})`,
        role: "buyer",
        text: "Сверяем складские остатки: можем скорректировать размер партии.",
      },
      {
        step: "Б2",
        author: `Бот продавца (${sellerName})`,
        role: "seller",
        text: `Договорились: фиксируем партию в размере ${compromise}.`,
      },
    ];
  }

  return [
    {
      step: "А1",
      author: `Бот покупателя (${buyerName})`,
      role: "buyer",
      text: `По параметру «${label}» запрашиваем: «${buyerText}».`,
    },
    {
      step: "Б1",
      author: `Бот продавца (${sellerName})`,
      role: "seller",
      text: `Регламентная позиция поставщика: «${sellerText}».`,
    },
    {
      step: "А2",
      author: `Бот покупателя (${buyerName})`,
      role: "buyer",
      text: "Изучили регламент: готовы пойти на уступку при согласии со встречным пунктом.",
    },
    {
      step: "Б2",
      author: `Бот продавца (${sellerName})`,
      role: "seller",
      text: `Взаимный интерес подтверждён. Утверждаем вариант «${compromise}».`,
    },
  ];
}
