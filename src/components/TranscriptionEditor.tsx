import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileText, File, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface TranscriptionEditorProps {
  videoTitle: string;
  transcription: string;
  hasQualityIssues?: boolean;
  onBack: () => void;
}

export const TranscriptionEditor = ({
  videoTitle,
  transcription: initialTranscription,
  hasQualityIssues = false,
  onBack,
}: TranscriptionEditorProps) => {
  const [transcription, setTranscription] = useState(initialTranscription);

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Arquivo ${filename} baixado com sucesso!`);
  };

  const handleDownloadTxt = () => {
    const content = `${videoTitle}\n\n${transcription}`;
    const filename = `transc-${videoTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}.txt`;
    downloadFile(content, filename, "text/plain;charset=utf-8");
  };

  const handleDownloadPdf = () => {
    // This is a placeholder - in production, you'd use a library like jsPDF
    toast.info("Funcionalidade PDF em desenvolvimento. Use TXT ou DOCX por enquanto.");
  };

  const handleDownloadDocx = () => {
    // This is a placeholder - in production, you'd use a library like docx
    toast.info("Funcionalidade DOCX em desenvolvimento. Use TXT por enquanto.");
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">{videoTitle}</h2>
          <p className="text-muted-foreground text-lg mt-2">
            Edite a transcrição se necessário antes de fazer o download
          </p>
        </div>
        <Button onClick={onBack} variant="outline" className="h-12 px-6">
          Voltar
        </Button>
      </div>

      {hasQualityIssues && (
        <Alert variant="warning" className="border-warning bg-warning/10">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <AlertDescription className="text-base text-warning-foreground">
            Este vídeo contém ruídos que podem ter afetado a precisão da transcrição.
            Recomendamos revisar o texto cuidadosamente.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <label htmlFor="transcription-editor" className="text-lg font-medium">
          Transcrição:
        </label>
        <Textarea
          id="transcription-editor"
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          className="min-h-[500px] font-mono text-base"
          placeholder="A transcrição aparecerá aqui..."
        />
        <p className="text-sm text-muted-foreground">
          {transcription.length} caracteres
        </p>
      </div>

      <div className="bg-card rounded-lg p-6 space-y-4">
        <h3 className="text-xl font-semibold">Baixar transcrição:</h3>
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={handleDownloadTxt}
            className="h-14 px-8 text-lg"
            variant="accent"
          >
            <FileText className="mr-2 h-5 w-5" />
            Download TXT
          </Button>
          <Button
            onClick={handleDownloadPdf}
            className="h-14 px-8 text-lg"
            variant="outline"
          >
            <File className="mr-2 h-5 w-5" />
            Download PDF
          </Button>
          <Button
            onClick={handleDownloadDocx}
            className="h-14 px-8 text-lg"
            variant="outline"
          >
            <Download className="mr-2 h-5 w-5" />
            Download DOCX
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Nomenclatura: transc-[titulo-do-video].extensao
        </p>
      </div>
    </div>
  );
};
