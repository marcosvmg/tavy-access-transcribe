import { useState } from "react";
import { TranscriptionInput } from "@/components/TranscriptionInput";
import { ProcessingIndicator } from "@/components/ProcessingIndicator";
import { TranscriptionEditor } from "@/components/TranscriptionEditor";
import { toast } from "sonner";

type AppState = "input" | "processing" | "editor";

const Index = () => {
  const [state, setState] = useState<AppState>("input");
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [transcription, setTranscription] = useState("");

  const simulateProcessing = async (url: string) => {
    setState("processing");
    setProgress(0);
    setProcessingStatus("Iniciando processamento...");

    // Simulate video title extraction
    const videoId = extractVideoId(url);
    setVideoTitle(`Vídeo do YouTube - ${videoId}`);

    // Simulate progress steps
    const steps = [
      { progress: 25, status: "Extraindo áudio do vídeo...", delay: 1500 },
      { progress: 50, status: "Detectando idioma...", delay: 1000 },
      { progress: 75, status: "Transcrevendo com máxima precisão...", delay: 2000 },
      { progress: 100, status: "Formatando e adicionando timestamps...", delay: 1000 },
    ];

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, step.delay));
      setProgress(step.progress);
      setProcessingStatus(step.status);
    }

    // Simulate transcription result with timestamps
    const mockTranscription = `[00:00] Olá, bem-vindos ao nosso canal! Hoje vamos falar sobre um assunto muito importante.

[00:15] A acessibilidade digital é fundamental para garantir que todas as pessoas possam acessar e utilizar recursos online.

[00:35] Orador 2: Isso mesmo! E ferramentas como legendas e transcrições fazem toda a diferença.

[00:50] Vamos começar explicando os principais conceitos de acessibilidade na web...

[01:10] É importante destacar que a inclusão digital não é apenas uma questão técnica, mas também social.

[01:30] Orador 2: Concordo plenamente. Cada pequeno passo em direção à acessibilidade conta.

[01:50] Vamos agora para algumas demonstrações práticas de como implementar essas soluções...`;

    setTranscription(mockTranscription);
    
    toast.success("Transcrição concluída com sucesso!");
    setState("editor");
  };

  const extractVideoId = (url: string): string => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : "unknown";
  };

  const handleStartTranscription = (url: string) => {
    simulateProcessing(url);
  };

  const handleBackToInput = () => {
    setState("input");
    setProgress(0);
    setTranscription("");
    setVideoTitle("");
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container mx-auto">
        {state === "input" && (
          <TranscriptionInput
            onStartTranscription={handleStartTranscription}
            isProcessing={false}
          />
        )}

        {state === "processing" && (
          <ProcessingIndicator progress={progress} status={processingStatus} />
        )}

        {state === "editor" && (
          <TranscriptionEditor
            videoTitle={videoTitle}
            transcription={transcription}
            hasQualityIssues={Math.random() > 0.7}
            onBack={handleBackToInput}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
