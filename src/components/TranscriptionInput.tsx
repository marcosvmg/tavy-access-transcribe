import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Youtube } from "lucide-react";

interface TranscriptionInputProps {
  onStartTranscription: (url: string) => void;
  isProcessing: boolean;
}

export const TranscriptionInput = ({ onStartTranscription, isProcessing }: TranscriptionInputProps) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const validateYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (value && !validateYouTubeUrl(value)) {
      setError("URL inválida. Por favor, insira um link válido do YouTube.");
    } else {
      setError("");
    }
  };

  const handleSubmit = () => {
    if (!url) {
      setError("Por favor, insira uma URL do YouTube.");
      return;
    }
    if (!validateYouTubeUrl(url)) {
      setError("URL inválida. Por favor, insira um link válido do YouTube.");
      return;
    }
    onStartTranscription(url);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Youtube className="w-12 h-12 text-accent" />
          <h1 className="text-5xl font-bold tracking-tight">TAVY</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Transcrição Acessível de Vídeos do YouTube
        </p>
        <p className="text-lg max-w-2xl mx-auto">
          Obtenha transcrições precisas e confiáveis de qualquer vídeo do YouTube.
          Desenvolvido especialmente para pessoas com deficiência auditiva.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="youtube-url" className="text-lg font-medium">
            Cole o link do vídeo do YouTube:
          </label>
          <div className="flex gap-3">
            <Input
              id="youtube-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={isProcessing}
              className="h-14 text-lg"
              aria-describedby={error ? "url-error" : undefined}
            />
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !!error || !url}
              className="h-14 px-8 text-lg font-semibold"
              variant="accent"
            >
              {isProcessing ? "Processando..." : "Transcrever"}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" id="url-error">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-base">{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="bg-card rounded-lg p-6 space-y-3">
        <h2 className="text-xl font-semibold">Como usar:</h2>
        <ol className="list-decimal list-inside space-y-2 text-lg">
          <li>Cole o link do vídeo do YouTube no campo acima</li>
          <li>Clique em "Transcrever" e aguarde o processamento</li>
          <li>Edite o texto transcrito se necessário</li>
          <li>Baixe nos formatos TXT, PDF ou DOCX</li>
        </ol>
      </div>
    </div>
  );
};
