import { useEffect, useRef, useState } from "react";
import { CreditCard, FileText, ImageIcon, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseInvoice } from "@/lib/invoice.functions";
import {
  CREDIT_CARDS,
  brl,
  formatDate,
  type Category,
  type TransactionInput,
} from "@/lib/finance";

type Draft = {
  description: string;
  amount: number;
  purchase_date: string;
  category_id: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  defaultDate?: string;
  onConfirm: (rows: TransactionInput[]) => Promise<void>;
};

export function InvoiceImportDialog({
  open,
  onOpenChange,
  categories,
  defaultDate,
  onConfirm,
}: Props) {
  const parse = useServerFn(parseInvoice);
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  const [cardName, setCardName] = useState<string>("Nubank G");
  const [customCard, setCustomCard] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    defaultDate || new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    if (open && defaultDate) {
      setInvoiceDate(defaultDate);
    }
  }, [open, defaultDate]);

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const catNames = expenseCats.map((c) => c.name);

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const toDrafts = (
    items: Array<{ description: string; amount: number; occurred_on: string; category: string }>,
  ) =>
    items.map((i) => {
      const itemNorm = normalize(i.category);
      return {
        description: i.description,
        amount: i.amount,
        purchase_date: i.occurred_on,
        category_id:
          expenseCats.find((c) => normalize(c.name) === itemNorm)?.id ??
          expenseCats.find((c) => c.name === "Outros")?.id ??
          null,
      };
    });

  const runText = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await parse({ data: { mode: "text", text, categories: catNames } });
      setDrafts(toDrafts(res.items));
      if (!res.items.length) toast.error("Nenhum lançamento identificado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao ler a fatura");
    } finally {
      setLoading(false);
    }
  };

  const runFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
      const base64 = btoa(binary);
      const res = await parse({
        data: {
          mode: "file",
          fileData: base64,
          mimeType: file.type || "application/pdf",
          categories: catNames,
        },
      });
      setDrafts(toDrafts(res.items));
      if (!res.items.length) toast.error("Nenhum lançamento identificado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao ler o arquivo");
    } finally {
      setLoading(false);
    }
  };

  const resolvedCard =
    cardName === "Outro" ? customCard.trim() || "Cartão de Crédito" : cardName || "Cartão";

  const confirm = async () => {
    if (!drafts?.length) return;
    setSaving(true);
    try {
      await onConfirm(
        drafts.map((d) => ({
          kind: "expense" as const,
          description: d.description,
          amount: d.amount,
          occurred_on: invoiceDate, // Todas as compras entram no mês de vencimento da fatura!
          category_id: d.category_id,
          payment_method: "credito",
          card_name: resolvedCard,
          is_paid: false,
          source: "fatura",
          notes: d.purchase_date ? `Compra em ${formatDate(d.purchase_date)}` : null,
        })),
      );
      toast.success(`${drafts.length} lançamentos da fatura (${resolvedCard}) importados!`);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDrafts(null);
    setText("");
    setFileName("");
  };

  const total = drafts?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar fatura do cartão
          </DialogTitle>
          <DialogDescription>
            Envie a fatura para extrair cada compra com sua categoria. Todos os gastos serão
            unificados na fatura do mês selecionado.
          </DialogDescription>
        </DialogHeader>

        {/* Configuração do Cartão e Vencimento */}
        <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" />
                Qual cartão é esta fatura?
              </Label>
              <Select value={cardName} onValueChange={setCardName}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar cartão" />
                </SelectTrigger>
                <SelectContent>
                  {CREDIT_CARDS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cardName === "Outro" ? (
                <Input
                  value={customCard}
                  onChange={(e) => setCustomCard(e.target.value)}
                  placeholder="Nome do cartão"
                  className="h-8 mt-1.5 text-xs"
                />
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-date" className="text-xs font-medium">
                Vencimento / Mês da Fatura
              </Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            ℹ️ Independente do dia em que cada compra foi feita, todos os lançamentos entrarão na
            fatura de <strong>{formatDate(invoiceDate)}</strong> e serão classificados por categoria.
          </p>
        </div>

        {!drafts ? (
          <Tabs defaultValue="file">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">PDF ou imagem</TabsTrigger>
              <TabsTrigger value="text">Texto</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-4">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-12 text-center transition-colors hover:border-primary/60 hover:bg-secondary/50"
              >
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : (
                  <Upload className="h-8 w-8 text-primary" />
                )}
                <span className="text-sm font-medium">
                  {loading ? "Lendo a fatura..." : fileName || "Clique para escolher o arquivo"}
                </span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </span>
                  <span className="flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" /> JPG / PNG
                  </span>
                </span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void runFile(file);
                  e.target.value = "";
                }}
              />
            </TabsContent>

            <TabsContent value="text" className="mt-4 space-y-3">
              <Textarea
                rows={9}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole aqui as linhas da fatura..."
              />
              <Button onClick={runText} disabled={loading || !text.trim()} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Analisar com IA
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">
                <strong>{drafts.length}</strong> compras identificadas em{" "}
                <strong className="text-foreground">{resolvedCard}</strong>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Total da fatura:</span>
                <span className="numeric font-bold text-foreground">{brl(total)}</span>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {drafts.map((d, index) => (
                <div
                  key={`${d.description}-${index}`}
                  className="grid grid-cols-12 items-center gap-2 rounded-xl border border-border bg-secondary/30 p-2 text-xs"
                >
                  <div className="col-span-12 sm:col-span-5 space-y-0.5">
                    <Input
                      className="h-8 text-xs"
                      value={d.description}
                      onChange={(e) =>
                        setDrafts((prev) =>
                          prev!.map((row, i) =>
                            i === index ? { ...row, description: e.target.value } : row,
                          ),
                        )
                      }
                      placeholder="Descrição"
                    />
                    {d.purchase_date ? (
                      <p className="text-[10px] text-muted-foreground px-1">
                        Data original: {formatDate(d.purchase_date)}
                      </p>
                    ) : null}
                  </div>

                  <div className="col-span-4 sm:col-span-3">
                    <Input
                      className="numeric h-8 text-xs font-semibold"
                      value={d.amount}
                      onChange={(e) =>
                        setDrafts((prev) =>
                          prev!.map((row, i) =>
                            i === index ? { ...row, amount: Number(e.target.value) || 0 } : row,
                          ),
                        )
                      }
                    />
                  </div>

                  <div className="col-span-7 sm:col-span-3">
                    <Select
                      value={d.category_id ?? ""}
                      onValueChange={(v) =>
                        setDrafts((prev) =>
                          prev!.map((row, i) => (i === index ? { ...row, category_id: v } : row)),
                        )
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="col-span-1 h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDrafts((prev) => prev!.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {drafts ? (
            <>
              <Button variant="ghost" onClick={reset}>
                Recomeçar
              </Button>
              <Button onClick={confirm} disabled={saving || !drafts.length}>
                {saving ? "Salvando..." : `Importar ${drafts.length} compras na fatura`}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
