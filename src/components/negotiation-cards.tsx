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
} from "lucide-react";
import { useState } from "react";
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
import { BENEFIT, LABELS, type ParamKey, type TradeRequest } from "@/lib/bargain";
import { describeDeal } from "@/lib/ai.functions";
import { changeNegotiation, createContract, openNegotiation } from "@/lib/negotiations.functions";
import {
  humansAgreed,
  proposeCondition,
  type ConditionValues,
  type NegotiationSnapshot,
} from "@/lib/negotiation";
import { cn } from "@/lib/utils";

type Edit = {
  key: ParamKey;
  version: number;
  values: ConditionValues;
  preview: NegotiationSnapshot | null;
};

const PARAM_COLORS: Record<ParamKey, { badge: string; border: string }> = {
  qty: { badge: "bg-blue-500/10 text-blue-600 border-blue-500/20", border: "border-blue-500/20" },
  price: { badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", border: "border-emerald-500/20" },
  payment: { badge: "bg-violet-500/10 text-violet-600 border-violet-500/20", border: "border-violet-500/20" },
  basis: { badge: "bg-amber-500/10 text-amber-600 border-amber-500/20", border: "border-amber-500/20" },
  term: { badge: "bg-rose-500/10 text-rose-600 border-rose-500/20", border: "border-rose-500/20" },
  warranty: { badge: "bg-teal-500/10 text-teal-600 border-teal-500/20", border: "border-teal-500/20" },
  regularity: { badge: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20", border: "border-indigo-500/20" },
};

export function NegotiationCards({ my, other }: { my: TradeRequest; other: TradeRequest }) {
  const buyer = my.kind === "buy" ? my : other;
  const seller = my.kind === "sell" ? my : other;
  const side = my.kind === "buy" ? "buyer" : "seller";

  const open = useServerFn(openNegotiation);
  const change = useServerFn(changeNegotiation);
  const explain = useServerFn(describeDeal);
  const client = useQueryClient();
  const navigate = useNavigate();
  const contract = useServerFn(createContract);

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
  const snapshot = row?.snapshot as unknown as NegotiationSnapshot | undefined;

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
      if (error) throw new Error("История недоступна.");
      return data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!row || !confirmation) throw new Error("Выберите условие.");
      return change({
        data: {
          id: row.id,
          version: confirmation.version,
          action: confirmation.action,
          key: confirmation.key,
          ...(confirmation.action === "propose" && edit ? { values: edit.values } : {}),
        },
      });
    },
    onSuccess: (saved) => {
      client.setQueryData(queryKey, saved);
      setConfirmation(null);
      setEdit(null);
      summary.reset();
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
      if (!snapshot) return { text: "" };
      return explain({
        data: {
          agreement: agreementPercent(snapshot),
          conditions: snapshot.conditions.map((c) => ({
            label: LABELS[c.key],
            status: c.term?.status ?? "pending",
            value: c.term?.value ?? "—",
          })),
        },
      });
    },
  });

  const makeContract = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error("Переговоры недоступны.");
      return contract({ data: { id: row.id, version: row.version } });
    },
    onSuccess: (res) => {
      toast.success("Договор успешно сформирован!");
      navigate({ to: "/dashboard", search: { tab: "documents" } });
    },
    onError: (err) => toast.error(err.message),
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
    const p = snapshot[side][key];
    setEdit({
      key,
      version: row.version,
      values: { min: p.min, max: p.max, unit: p.unit, value: p.value },
      preview: null,
    });
    summary.reset();
  };

  const simulate = () => {
    if (!edit) return;
    const preview = proposeCondition(snapshot, side, edit.key, edit.values);
    setEdit({ ...edit, preview });
  };

  const allAgreed = humansAgreed(snapshot);
  const myCheckedAll = snapshot.conditions.every((c) =>
    side === "buyer" ? c.buyerAccepted : c.sellerAccepted,
  );
  const otherCheckedAll = snapshot.conditions.every((c) =>
    side === "buyer" ? c.sellerAccepted : c.buyerAccepted,
  );

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 text-base">
      {/* 1. Сводная карточка торга и ролей сторон */}
      <section className="rounded-2xl border-2 border-brand/20 bg-gradient-to-br from-brand/5 via-background to-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-sm">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink">
                Параметры сделки и статус торга
              </h2>
              <p className="text-xs text-dim sm:text-sm">
                По каждому пункту проводится автономный торг агентов. Подтвердите условия.
              </p>
            </div>
          </div>
          <AgreementBadge percent={agreementPercent(snapshot)} />
        </div>

        {/* 2. Четкие бейджи ролей участников */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Покупатель {side === "buyer" ? "· Вы" : ""}
            </div>
            <div className="mt-1 font-medium text-ink truncate">{buyer.title}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
              Продавец {side === "seller" ? "· Вы" : ""}
            </div>
            <div className="mt-1 font-medium text-ink truncate">{seller.title}</div>
          </div>
        </div>

        {/* Сводная яркая таблица всех параметров */}
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-foreground/[0.02] text-dim">
              <tr>
                <th className="py-2.5 pl-3 pr-2 font-medium">№</th>
                <th className="py-2.5 px-2 font-medium">Параметр</th>
                <th className="py-2.5 px-2 font-medium">Предложение ботов</th>
                <th className="py-2.5 pl-2 pr-3 font-medium text-right">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshot.conditions.map((c, idx) => {
                const isMyOk = side === "buyer" ? c.buyerAccepted : c.sellerAccepted;
                return (
                  <tr key={c.key} className="hover:bg-foreground/[0.01]">
                    <td className="py-2.5 pl-3 pr-2 font-mono text-xs text-dim">#{idx + 1}</td>
                    <td className="py-2.5 px-2 font-medium text-ink">{LABELS[c.key]}</td>
                    <td className="py-2.5 px-2 text-ink font-semibold">{c.term?.value ?? "—"}</td>
                    <td className="py-2.5 pl-2 pr-3 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          isMyOk
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600",
                        )}
                      >
                        {isMyOk ? <Check className="size-3" /> : "⏳"}
                        {isMyOk ? "Принято вами" : "Ожидает"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Список параметров с подробностями */}
      <div className="space-y-4">
        {snapshot.conditions.map((c, index) => {
          const current = edit?.key === c.key ? edit : null;
          const shown = current?.preview?.conditions.find((item) => item.key === c.key) ?? c;
          const p = snapshot[side][c.key];
          const range = ["qty", "price", "term"].includes(c.key);
          const myAccepted = side === "buyer" ? c.buyerAccepted : c.sellerAccepted;
          const color = (PARAM_COLORS as Record<string, { badge: string; border: string }>)[c.key] ?? {
            badge: "bg-muted text-foreground border-border",
            border: "border-border",
          };

          return (
            <article
              key={c.key}
              className={cn(
                "rounded-xl border bg-card p-5 shadow-sm transition-all",
                color.border,
              )}
            >
              {/* Шапка карточки с номером и цветом */}
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
                  <h3 className="text-base sm:text-lg font-bold text-ink">{LABELS[c.key]}</h3>
                </div>
                {shown.term && (
                  <AgreementBadge
                    percent={conditionPercent(current?.preview ?? snapshot, shown) ?? 0}
                  />
                )}
              </div>

              <p className="mt-2 text-xs sm:text-sm text-dim">{BENEFIT[c.key]}</p>

              {/* Стороны сделки */}
              <div className="mt-3 grid gap-3 rounded-lg bg-foreground/[0.02] p-3 text-xs sm:text-sm sm:grid-cols-2">
                <div>
                  <div className="font-semibold text-dim">
                    Покупатель {side === "buyer" ? "(вы)" : ""}
                  </div>
                  <div className="mt-0.5 text-base font-medium text-ink">
                    {parameterText(snapshot.buyer[c.key], range)}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-dim">
                    Продавец {side === "seller" ? "(вы)" : ""}
                  </div>
                  <div className="mt-0.5 text-base font-medium text-ink">
                    {parameterText(snapshot.seller[c.key], range)}
                  </div>
                </div>
              </div>

              {/* Итог согласования ботов */}
              <div className="mt-4 rounded-xl border border-border/80 bg-foreground/[0.015] p-3.5">
                <div className="text-xs font-medium text-dim">Предложение ботов</div>
                <div className="mt-1 text-base sm:text-lg font-bold text-ink">
                  {shown.term?.value ?? "Условие пока не выработано"}
                </div>
                {shown.term?.rationale && (
                  <p className="mt-1 text-xs sm:text-sm text-dim leading-relaxed">
                    {shown.term.rationale}
                  </p>
                )}
              </div>

              {/* Действия участника по этому пункту */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs sm:text-sm text-dim">
                  Статус:{" "}
                  {myAccepted ? (
                    <span className="font-semibold text-emerald-600">✓ Вы приняли пункт</span>
                  ) : (
                    <span className="font-medium text-amber-600">Ожидает вашего подтверждения</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!myAccepted && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() =>
                        setConfirmation({ key: c.key, version: row.version, action: "accept" })
                      }
                    >
                      <Check className="size-4" />
                      Принять пункт
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => (current ? setEdit(null) : beginEdit(c.key))}
                  >
                    <Pencil className="size-3.5" />
                    {current ? "Отмена" : "Изменить свое"}
                  </Button>
                </div>
              </div>

              {/* Форма изменения своего условия */}
              {current && (
                <div className="mt-4 space-y-3 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 text-xs sm:text-sm">
                  <div className="font-semibold text-ink">
                    Ваше новое условие для пересчета торга:
                  </div>
                  {range ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-dim">От</label>
                        <Input
                          value={current.values.min ?? ""}
                          onChange={(e) =>
                            setEdit({
                              ...current,
                              values: { ...current.values, min: e.target.value },
                            })
                          }
                          placeholder={p.min || "мин"}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-dim">До</label>
                        <Input
                          value={current.values.max ?? ""}
                          onChange={(e) =>
                            setEdit({
                              ...current,
                              values: { ...current.values, max: e.target.value },
                            })
                          }
                          placeholder={p.max || "макс"}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Input
                        value={current.values.value ?? ""}
                        onChange={(e) =>
                          setEdit({
                            ...current,
                            values: { ...current.values, value: e.target.value },
                          })
                        }
                        placeholder={p.value || "Значение"}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="secondary" onClick={simulate}>
                      Пересчитать с ботом
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        setConfirmation({ key: c.key, version: current.version, action: "propose" })
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

      {/* 4. Краткий пересказ ИИ и аккордеон с ботами */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-brand" />
            <h3 className="font-semibold text-ink text-sm sm:text-base">
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

        {summary.data?.text && (
          <p className="mt-3 text-xs sm:text-sm text-dim leading-relaxed bg-brand/5 border border-brand/20 p-3 rounded-lg">
            {summary.data.text}
          </p>
        )}

        {/* Раскрывающийся лог диалога ботов */}
        <details className="group mt-3 border-t border-border/80 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs sm:text-sm font-medium text-dim hover:text-ink">
            <span>Показать полный лог согласования условий ботами</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-2 text-xs sm:text-sm text-dim">
            {snapshot.conditions.map((c) => (
              <div key={c.key} className="rounded-lg bg-foreground/[0.02] p-2.5">
                <span className="font-semibold text-ink">{LABELS[c.key]}:</span>{" "}
                {c.term?.rationale || "Условие принято автоматически на основе диапазонов заявок."}
              </div>
            ))}
          </div>
        </details>
      </section>

      {/* 5. Финальный блок: Предложить условия / Оформить договор */}
      <section className="sticky bottom-4 z-20 rounded-2xl border-2 border-brand bg-card p-5 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-bold text-ink">Итоговое согласование сделки</div>
            <div className="text-xs sm:text-sm text-dim">
              {allAgreed
                ? "Обе стороны подтвердили все параметры. Можно оформлять официальный договор!"
                : myCheckedAll
                ? "Вы приняли все параметры! Ожидаем подтверждения от второй стороны."
                : "Отметьте каждый параметр выше, чтобы сформировать финальное предложение."}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory((v) => !v)}
              className="text-xs"
            >
              <History className="size-3.5" />
              История ({row.version})
            </Button>

            {allAgreed ? (
              <Button
                size="lg"
                className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-md font-semibold text-base"
                disabled={makeContract.isPending}
                onClick={() => makeContract.mutate()}
              >
                {makeContract.isPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-5" />
                )}
                Оформить договор
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={!myCheckedAll || send.isPending}
                className={cn(
                  myCheckedAll
                    ? "bg-brand text-brand-foreground shadow-md font-semibold"
                    : "opacity-60",
                )}
                onClick={() => toast.success("Все условия подтверждены с вашей стороны!")}
              >
                {myCheckedAll ? "✓ Все условия предложены" : "Предложить условия сделки"}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Диалог истории версий */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>История изменений торга</DialogTitle>
            <DialogDescription>Все версии согласования между сторонами.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs sm:text-sm">
            {history.data?.map((h) => (
              <div key={h.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between font-medium">
                  <span>Версия #{h.version}</span>
                  <span className="text-dim">{new Date(h.created_at).toLocaleString("ru-RU")}</span>
                </div>
                <div className="text-dim mt-1">
                  Действие: {h.action} {h.param_key ? `(${LABELS[h.param_key as ParamKey]})` : ""}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения отправки изменения */}
      <Dialog open={!!confirmation} onOpenChange={(open) => !open && setConfirmation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение условия</DialogTitle>
            <DialogDescription>
              {confirmation?.action === "accept"
                ? `Вы соглашаетесь с условием по параметру «${
                    confirmation?.key ? LABELS[confirmation.key] : ""
                  }». Вторая сторона увидит ваш выбор.`
                : `Отправить новое условие по параметру «${
                    confirmation?.key ? LABELS[confirmation.key] : ""
                  }» на согласование?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              Отмена
            </Button>
            <Button disabled={send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="size-4 animate-spin" /> : "Подтвердить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parameterText(
  p: (ConditionValues & { ignore?: boolean }) | undefined | null,
  range: boolean,
) {
  if (!p) return "—";
  if (p.ignore) return "Неважно";
  if (!range) return p.value || "Не задано";

  const min = p.min?.trim();
  const max = p.max?.trim();
  const unit = p.unit?.trim() ? ` ${p.unit.trim()}` : "";

  if (min && max && min === max) {
    return `${min}${unit}`;
  }
  if (min && max) {
    return `${min}–${max}${unit}`;
  }
  return `${min || max || "—"}${unit}`;
}
