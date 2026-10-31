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
  delivery: { badge: "bg-amber-500/10 text-amber-600 border-amber-500/20", border: "border-amber-500/20" },
  term: { badge: "bg-rose-500/10 text-rose-600 border-rose-500/20", border: "border-rose-500/20" },
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

  const summary = useMutation({
    mutationFn: async () => {
      if (!snapshot) return { text: "" };
      return explain({
        data: {
          title: `${buyer.title} / ${seller.title}`,
          agreed: humansAgreed(snapshot),
          terms: snapshot.conditions.flatMap((c) =>
            c.term ? [{ label: LABELS[c.key], value: c.term.value, note: c.term.note }] : [],
          ),
        },
      });
    },
    onError: () => toast.error("ИИ сейчас недоступен; условия сохранены."),
  });

  const draft = useMutation({
    mutationFn: () => {
      if (!row) throw new Error("Переговоры недоступны.");
      return contract({ data: { id: row.id, version: row.version } });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["documents"] });
      await navigate({ to: "/dashboard", search: { tab: "documents" } });
    },
    onError: (error) => toast.error(error.message),
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
        <p>Не удалось открыть переговоры. Проверьте вход и попробуйте снова.</p>
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
    try {
      setEdit({ ...edit, preview: proposeCondition(snapshot, side, edit.key, edit.values) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Проверьте значения.");
    }
  };

  const confirmationCondition = (
    confirmation?.action === "propose" ? edit?.preview : snapshot
  )?.conditions.find((c) => c.key === confirmation?.key);

  const stale = !!edit && edit.version !== row.version;
  const lastVersion = row.version;

  // Проверка: отметил ли текущий пользователь все условия
  const allMyChecked = snapshot.conditions.every((c) =>
    side === "buyer" ? c.buyerAccepted : c.sellerAccepted,
  );
  const fullyAgreed = humansAgreed(snapshot);

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
          const color = PARAM_COLORS[c.key];

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
              <div className="my-4 rounded-xl border border-brand/20 bg-brand/5 p-4">
                <div className="text-xs uppercase tracking-wider text-brand font-semibold">
                  {current?.preview ? "Предварительный результат" : "Итог торга ботов"}
                </div>
                <p className="mt-1 text-lg sm:text-xl font-bold text-ink">
                  {shown.term?.value ?? "Не задано"}
                </p>
                <p className="mt-1 text-xs sm:text-sm text-dim">
                  {shown.term?.note ?? "Условия отсутствуют в обеих заявках"}
                </p>
              </div>

              {/* 4. Разговор ботов (свернут по умолчанию) */}
              <details className="mb-4 rounded-xl border border-border bg-foreground/[0.02] p-3 text-sm">
                <summary className="flex cursor-pointer items-center justify-between font-medium text-ink hover:text-brand">
                  <span className="flex items-center gap-2">
                    <Bot className="size-4 text-brand" />
                    К чему пришли боты:{" "}
                    <span className="text-dim font-normal">
                      «{shown.term?.value ?? "нет консенсуса"}»
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-brand">
                    Показать диалог <ChevronDown className="size-3.5" />
                  </span>
                </summary>
                <div className="mt-3 space-y-2 border-t border-border/80 pt-3 text-xs sm:text-sm leading-relaxed">
                  {shown.log.length === 0 && (
                    <p className="text-dim">{shown.term?.note ?? "Бот не предложил условий."}</p>
                  )}
                  {shown.log.map((line, i) => {
                    const mine = line.side === side;
                    const sys = line.side === "system";
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex",
                          sys ? "justify-center" : mine ? "justify-end" : "justify-start",
                        )}
                      >
                        <p
                          className={cn(
                            "max-w-[90%] rounded-2xl px-3 py-2",
                            sys
                              ? "border border-gold/50 bg-gold/10 text-ink"
                              : mine
                                ? "bg-brand text-brand-foreground"
                                : "border border-border bg-card text-ink",
                          )}
                        >
                          <span className="block text-xs font-semibold opacity-80">
                            {sys ? "Результат" : mine ? "Мой бот" : "Бот второй стороны"}
                          </span>
                          {line.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </details>

              {/* Статус подтверждения */}
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {(
                  [
                    ["Покупатель", c.buyerAccepted, side === "buyer"],
                    ["Продавец", c.sellerAccepted, side === "seller"],
                  ] as const
                ).map(([who, ok, me]) => (
                  <span
                    key={who}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium",
                      ok
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-600",
                    )}
                  >
                    {ok ? <Check className="size-3" /> : "⏳"} {who}
                    {me ? " (вы)" : ""}: {ok ? "подтвердил" : "не подтвердил"}
                  </span>
                ))}
              </div>

              {/* Управление пунктом */}
              {current ? (
                <div className="space-y-3 border-t border-border pt-3">
                  {stale && (
                    <p role="alert" className="text-xs text-destructive">
                      Другая сторона изменила условия. Закройте черновик и проверьте новую версию.
                    </p>
                  )}
                  {range ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(["min", "max", "unit"] as const).map((field) => (
                        <label key={field} className="min-w-0 text-xs text-dim">
                          {field === "min" ? "От" : field === "max" ? "До" : "Единица"}
                          <Input
                            type={field === "unit" ? "text" : "number"}
                            min={0}
                            step="any"
                            value={current.values[field]}
                            onChange={(e) =>
                              setEdit({
                                ...current,
                                values: { ...current.values, [field]: e.target.value },
                                preview: null,
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label className="block text-xs text-dim">
                      Ваше условие
                      <Input
                        maxLength={500}
                        value={current.values.value}
                        onChange={(e) =>
                          setEdit({
                            ...current,
                            values: { ...current.values, value: e.target.value },
                            preview: null,
                          })
                        }
                      />
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={stale} onClick={simulate}>
                      <Bot className="size-4" />
                      Пересчитать пункт
                    </Button>
                    {current.preview && (
                      <Button
                        size="sm"
                        disabled={stale || send.isPending}
                        onClick={() =>
                          setConfirmation({
                            key: c.key,
                            version: current.version,
                            action: "propose",
                          })
                        }
                      >
                        <Send className="size-4" />
                        Отправить предложение
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setEdit(null)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={send.isPending || p.ignore}
                    onClick={() => beginEdit(c.key)}
                  >
                    <Pencil className="size-3.5" />
                    Изменить условие
                  </Button>
                  {c.term && (
                    <Button
                      variant={myAccepted ? "ghost" : "default"}
                      size="sm"
                      disabled={myAccepted || send.isPending}
                      onClick={() =>
                        setConfirmation({ key: c.key, version: row.version, action: "accept" })
                      }
                    >
                      <Check className="size-4" />
                      {myAccepted ? "Вы приняли пункт" : "Согласен с условием"}
                    </Button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* 5. Итоговый блок: Кнопка "Предложить условие" и "Составить договор" */}
      <section className="rounded-2xl border-2 border-brand/30 bg-card p-5 text-center shadow-md">
        {!allMyChecked ? (
          <div className="text-sm text-dim">
            Чтобы отправить финальное согласие, подтвердите каждый из параметров выше.
          </div>
        ) : fullyAgreed ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="size-4" /> Все условия согласованы обеими сторонами!
            </div>
            <div>
              <Button
                variant="hero"
                size="lg"
                className="h-12 px-8 text-base font-semibold"
                disabled={draft.isPending}
                onClick={() => draft.mutate()}
              >
                {draft.isPending && <Loader2 className="size-5 animate-spin" />}
                СОСТАВИТЬ ДОГОВОР
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-ink font-medium">
              Вы подтвердили все условия со своей стороны. Ожидаем подтверждения второй стороны.
            </div>
            <Button
              variant="default"
              size="lg"
              className="h-11 px-6 font-semibold"
              onClick={() => toast.success("Ваши условия уже подтверждены и отправлены партнеру")}
            >
              <Check className="size-4" /> Условия согласованы вами
            </Button>
          </div>
        )}
      </section>

      {/* История и ИИ-резюме */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={summary.isPending}
          onClick={() => summary.mutate()}
        >
          {summary.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
          Пересказать условия
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <History className="size-4" />
          История версий
        </Button>
      </div>

      {summary.data?.text && (
        <p className="border-l-2 border-brand pl-4 text-sm leading-relaxed text-ink">
          {summary.data.text}
        </p>
      )}

      {showHistory && (
        <div className="space-y-3 border-t border-border pt-4 text-xs text-dim">
          {history.isPending
            ? "Загружаем историю…"
            : history.isError
              ? "Не удалось загрузить историю."
              : history.data?.map((v) => {
                  const old = v.snapshot as unknown as NegotiationSnapshot;
                  const condition = old.conditions.find((c) => c.key === v.param_key);
                  return (
                    <details key={v.id}>
                      <summary className="cursor-pointer">
                        Версия {v.version} · {v.actor_id === my.owner_id ? "Вы" : "Вторая сторона"} ·{" "}
                        {v.action === "start"
                          ? "Начало торга"
                          : v.action === "propose"
                            ? "Встречное условие"
                            : "Подтверждение"}
                        {v.param_key ? ` · ${LABELS[v.param_key as ParamKey]}` : ""}
                      </summary>
                      <div className="mt-2 space-y-1 pl-3">
                        {(condition ? [condition] : old.conditions).map((c) => (
                          <p key={c.key}>
                            {LABELS[c.key]}: {c.term?.value ?? "Не задано"}
                          </p>
                        ))}
                      </div>
                    </details>
                  );
                })}
        </div>
      )}

      {/* Диалог подтверждения */}
      <Dialog
        open={!!confirmation}
        onOpenChange={(isOpen) => {
          if (!isOpen && !send.isPending) setConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmation?.action === "propose"
                ? "Отправить встречное условие?"
                : "Подтвердить условие?"}
            </DialogTitle>
            <DialogDescription>
              {confirmation ? LABELS[confirmation.key] : ""} · Версия {confirmation?.version}.
              Получатель: владелец заявки «{other.title}».
            </DialogDescription>
          </DialogHeader>
          <p className="break-words font-semibold text-ink">
            {confirmationCondition?.term?.value ?? ""}
          </p>
          {confirmation?.action === "propose" && edit && (
            <p className="text-sm text-dim">
              Ваше условие:{" "}
              {parameterText(edit.values, ["qty", "price", "term"].includes(edit.key))}
            </p>
          )}
          {confirmation?.version !== lastVersion && (
            <p role="alert" className="text-sm text-destructive">
              Условия изменились. Проверьте новую версию перед отправкой.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={send.isPending} onClick={() => setConfirmation(null)}>
              Вернуться
            </Button>
            <Button
              disabled={send.isPending || confirmation?.version !== lastVersion}
              onClick={() => send.mutate()}
            >
              {send.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Подтвердить и отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 3. Форматирование одинаковых чисел: 500-500 превращается в просто 500
function parameterText(p: ConditionValues & { ignore?: boolean }, range: boolean) {
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
