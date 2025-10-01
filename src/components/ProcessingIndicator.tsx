import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface ProcessingIndicatorProps {
  progress: number;
  status: string;
}

export const ProcessingIndicator = ({ progress, status }: ProcessingIndicatorProps) => {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <Loader2 className="w-16 h-16 animate-spin text-accent" />
        </div>
        <h2 className="text-3xl font-bold">Processando transcrição...</h2>
        <p className="text-xl text-muted-foreground">{status}</p>
      </div>

      <div className="space-y-3">
        <Progress value={progress} className="h-4" />
        <p className="text-center text-lg font-medium">{progress}%</p>
      </div>

      <div className="bg-card rounded-lg p-6 space-y-2">
        <h3 className="text-lg font-semibold">O que estamos fazendo:</h3>
        <ul className="space-y-2 text-base">
          <li className={progress >= 25 ? "text-success" : "text-muted-foreground"}>
            ✓ Extraindo áudio do vídeo
          </li>
          <li className={progress >= 50 ? "text-success" : "text-muted-foreground"}>
            ✓ Detectando idioma
          </li>
          <li className={progress >= 75 ? "text-success" : "text-muted-foreground"}>
            ✓ Transcrevendo com máxima precisão
          </li>
          <li className={progress === 100 ? "text-success" : "text-muted-foreground"}>
            ✓ Formatando e adicionando timestamps
          </li>
        </ul>
      </div>
    </div>
  );
};
