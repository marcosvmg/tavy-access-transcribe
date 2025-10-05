import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [hasQualityIssues, setHasQualityIssues] = useState(false);

  const processTranscription = async (url: string) => {
    setState("processing");
    setProgress(0);
    setProcessingStatus("Iniciando processamento...");

    try {
      // Simulate progress steps with updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 500);

      setProcessingStatus("Extraindo informações do vídeo...");

      const { data, error: functionError } = await supabase.functions.invoke('transcribe-youtube', {
        body: { videoUrl: url }
      });

      clearInterval(progressInterval);

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar o vídeo');
      }

      setProgress(100);
      if (!data.transcript || !data.transcript.trim()) {
        setProcessingStatus("Sem legendas públicas/ASR disponíveis para este vídeo.");
        toast.info("Este vídeo não possui legendas públicas; não foi possível transcrever.");
        setState("input");
        return;
      }
      setProcessingStatus("Transcrição concluída!");
      setVideoTitle(data.videoTitle);
      setTranscription(data.transcript);
      setHasQualityIssues(data.hasNoise || false);
      
      toast.success("Transcrição concluída com sucesso!");
      
      setTimeout(() => {
        setState("editor");
      }, 500);

    } catch (err: any) {
      console.error('Erro na transcrição:', err);
      toast.error(err.message || 'Erro ao transcrever o vídeo. Tente novamente.');
      setState("input");
    }
  };

  const handleStartTranscription = (url: string) => {
    processTranscription(url);
  };

  const handleBackToInput = () => {
    setState("input");
    setProgress(0);
    setTranscription("");
    setVideoTitle("");
    setHasQualityIssues(false);
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
            hasQualityIssues={hasQualityIssues}
            onBack={handleBackToInput}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
