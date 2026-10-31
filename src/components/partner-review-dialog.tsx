import { useState } from "react";
import { Star, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export interface ReviewCriteria {
  terms: number;        // Соблюдение сроков
  quality: number;      // Качество товара/услуги
  discipline: number;   // Договорная дисциплина
  communication: number;// Коммуникация
  recommend: number;    // Готовность рекомендовать
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerName: string;
  docTitle: string;
}

export function PartnerReviewDialog({ open, onOpenChange, partnerName, docTitle }: Props) {
  const [ratings, setRatings] = useState<ReviewCriteria>({
    terms: 5,
    quality: 5,
    discipline: 5,
    communication: 5,
    recommend: 5,
  });
  const [comment, setComment] = useState("");

  const CRITERIA = [
    { key: "terms" as const, label: "Соблюдение сроков поставки" },
    { key: "quality" as const, label: "Качество и соответствие заявке" },
    { key: "discipline" as const, label: "Финансовая и договорная дисциплина" },
    { key: "communication" as const, label: "Оперативность и коммуникация" },
    { key: "recommend" as const, label: "Готовность к повторным сделкам" },
  ];

  const submit = () => {
    // Сохраняем отзыв в LocalStorage или таблицу reviews
    const avg = Object.values(ratings).reduce((a, b) => a + b, 0) / 5;
    const existing = JSON.parse(localStorage.getItem("ai_mall_partner_reviews") || "{}");
    existing[partnerName] = {
      score: avg.toFixed(1),
      count: (existing[partnerName]?.count || 0) + 1,
      comment,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem("ai_mall_partner_reviews", JSON.stringify(existing));

    toast.success(`Отзыв о контрагенте «${partnerName}» сохранён! Рейтинг: ${avg.toFixed(1)}/5`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-brand">
            <ShieldCheck className="size-5" />
            <DialogTitle>Оценка надёжности партнёра</DialogTitle>
          </div>
          <DialogDescription>
            Сделка: <b>{docTitle}</b>. Партнёр: <b>{partnerName}</b>.
            Оценка влияет на ИИ-индекс надёжности при будущих торгах.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          {CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <span className="text-xs sm:text-sm text-ink">{c.label}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatings({ ...ratings, [c.key]: star })}
                    className="p-0.5 text-amber-400 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`size-4.5 ${
                        star <= ratings[c.key] ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-2">
            <label className="text-xs text-dim block mb-1">Заметка или комментарий (опционально):</label>
            <textarea
              className="w-full rounded-lg border border-border bg-background p-2 text-xs"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Как прошла сделка, были ли задержки..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={submit} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="size-4 mr-1.5" />
            Сохранить оценку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
