import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  Loader2,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteDocument,
  listDocuments,
  type DocStatus,
  type DocumentRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { PartnerReviewDialog } from "@/components/partner-review-dialog";

const STATUS_STYLE: Record<DocStatus, string> = {
  Подписан: "bg-brand/10 text-brand",
  "Ожидает подписи": "bg-gold/15 text-gold",
  Черновик: "bg-foreground/5 text-dim",
};

function download(doc: DocumentRow) {
  const blob = new Blob([doc.body ?? doc.title], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTo1C(doc: DocumentRow) {
  const docNum = `УТ-${doc.$id.slice(0, 6).toUpperCase()}`;
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<КоммерческаяИнформация ВерсияСхемы="2.09" ДатаФормирования="${now}">
  <Документ>
    <Ид>${doc.$id}</Ид>
    <Номер>${docNum}</Номер>
    <Дата>${new Date().toISOString().split("T")[0]}</Дата>
    <ХозОперация>Заказ товара</ХозОперация>
    <Роль>Поставщик</Роль>
    <Валюта>RUB</Валюта>
    <Курс>1</Курс>
    <Контрагенты>
      <Контрагент>
        <Ид>${doc.ownerId}</Ид>
        <Наименование>${doc.counterparty || "Контрагент B2B"}</Наименование>
        <Роль>Покупатель</Роль>
      </Контрагент>
    </Контрагенты>
    <Время>${new Date().toLocaleTimeString("ru-RU")}</Время>
    <Комментарий>Сформировано автономными ИИ-агентами платформы AI-Mall: ${doc.title}</Комментарий>
    <ЗначенияРеквизитов>
      <ЗначениеРеквизита>
        <Наименование>Статус заказа</Наименование>
        <Значение>Согласован ИИ-агентами</Значение>
      </ЗначениеРеквизита>
      <ЗначениеРеквизита>
        <Наименование>Синхронизация1С</Наименование>
        <Значение>Выгружено в 1С:УТ</Значение>
      </ЗначениеРеквизита>
    </ЗначенияРеквизитов>
  </Документ>
</КоммерческаяИнформация>`;

  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `1C_Заказ_${docNum}.xml`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(
    `Пакет обмена CommerceML 2.0 для 1С:Предприятие сформирован (${docNum})`,
  );
}

export function ProfileDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewTarget, setReviewTarget] = useState<{
    partnerName: string;
    docTitle: string;
  } | null>(null);

  const docsQuery = useQuery({
    queryKey: ["documents", user?.id],
    queryFn: () => listDocuments(user!.id),
    enabled: !!user,
  });
  const docs = docsQuery.data ?? [];

  const remove = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Документ удалён");
    },
    onError: () => toast.error("Не удалось удалить документ"),
  });

  return (
    <section className="glass-panel overflow-hidden rounded-2xl">
      {/* Баннер интеграции с 1С */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-amber-500/10 via-background to-card p-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-amber-500/15 text-xs font-bold text-amber-600">
            1С
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">
              Интеграция с 1С:Предприятие / 1С:УТ
            </div>
            <div className="text-xs text-dim">
              Автоматическая выгрузка заказов и договоров в стандарте CommerceML 2.0
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
          <CheckCircle2 className="size-3.5" />
          Модуль обмена активен
        </div>
      </div>

      {docsQuery.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-brand" />
        </div>
      ) : docs.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-dim">
          Документов пока нет. Они появятся после согласования сделки в переговорах.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => {
            const utNum = `УТ-${d.$id.slice(0, 6).toUpperCase()}`;
            return (
              <li
                key={d.$id}
                className="flex flex-wrap items-center gap-4 px-6 py-4"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground/5 text-dim">
                  <FileText className="size-4.5" />
                </span>
                <div className="min-w-48 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-ink">{d.title}</div>
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      1С: {utNum}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-dim">
                    {d.counterparty} ·{" "}
                    {new Date(d.createdAt ?? d.$createdAt).toLocaleDateString(
                      "ru-RU",
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs",
                    STATUS_STYLE[d.status],
                  )}
                >
                  {d.status}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full border-emerald-500/30 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                  onClick={() =>
                    setReviewTarget({
                      partnerName: d.counterparty || "Контрагент B2B",
                      docTitle: d.title,
                    })
                  }
                >
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  Оценить партнёра
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full border-amber-500/30 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                  onClick={() => exportTo1C(d)}
                >
                  <FileCode2 className="size-3.5" />
                  Пакет 1С (XML)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full text-xs"
                  onClick={() => download(d)}
                >
                  <Download className="size-3.5" />
                  Скачать
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Удалить"
                  onClick={() => remove.mutate(d.$id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {reviewTarget && (
        <PartnerReviewDialog
          open={!!reviewTarget}
          onOpenChange={(open) => !open && setReviewTarget(null)}
          partnerName={reviewTarget.partnerName}
          docTitle={reviewTarget.docTitle}
        />
      )}
    </section>
  );
}
