import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();
    
    if (!videoUrl) {
      throw new Error('URL do vídeo é obrigatória');
    }

    console.log('Processando vídeo:', videoUrl);

    // Extrair o ID do vídeo do YouTube
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('URL do YouTube inválida');
    }

    console.log('ID do vídeo:', videoId);

    // Obter informações do vídeo
    const videoInfo = await getVideoInfo(videoId);
    
    // Obter a transcrição usando a YouTube Transcript API
    const transcript = await getYouTubeTranscript(videoId);
    
    // Formatar a transcrição com timestamps
    const formattedTranscript = formatTranscript(transcript);

    return new Response(
      JSON.stringify({
        success: true,
        videoTitle: videoInfo.title,
        transcript: formattedTranscript,
        language: transcript.language || 'pt',
        hasNoise: false, // YouTube transcripts são geralmente limpos
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro na transcrição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar o vídeo';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

async function getVideoInfo(videoId: string) {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Erro ao obter informações do vídeo');
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error('Vídeo não encontrado');
  }

  return {
    title: data.items[0].snippet.title,
    description: data.items[0].snippet.description,
  };
}

async function getYouTubeTranscript(videoId: string) {
  // Usar a API do YouTube para obter legendas
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  
  // Primeiro, obter a lista de legendas disponíveis
  const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&key=${apiKey}&part=snippet`;
  
  const captionsResponse = await fetch(captionsUrl);
  if (!captionsResponse.ok) {
    throw new Error('Erro ao obter legendas do vídeo. O vídeo pode não ter legendas disponíveis ou ser privado.');
  }

  const captionsData = await captionsResponse.json();
  
  if (!captionsData.items || captionsData.items.length === 0) {
    throw new Error('Este vídeo não possui legendas disponíveis. Tente outro vídeo.');
  }

  // Procurar por legendas em português ou a primeira disponível
  let captionTrack = captionsData.items.find((item: any) => 
    item.snippet.language === 'pt' || item.snippet.language === 'pt-BR'
  );
  
  if (!captionTrack) {
    captionTrack = captionsData.items[0];
  }

  const captionId = captionTrack.id;
  const language = captionTrack.snippet.language;

  // Baixar o conteúdo da legenda
  const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKey}&tfmt=srt`;
  
  const transcriptResponse = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    }
  });

  if (!transcriptResponse.ok) {
    // Se não conseguir baixar, vamos usar uma abordagem alternativa
    // Retornar um formato que simula uma transcrição
    throw new Error('Não foi possível baixar a transcrição. O vídeo pode ter restrições de acesso às legendas.');
  }

  const transcriptText = await transcriptResponse.text();
  
  return {
    language,
    text: transcriptText,
  };
}

function formatTranscript(transcript: any): string {
  // Formatar a transcrição com timestamps
  const lines = transcript.text.split('\n');
  let formatted = '';
  let currentTime = '';
  let currentText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detectar timestamp no formato SRT (00:00:00,000 --> 00:00:05,000)
    if (line.includes('-->')) {
      if (currentText) {
        formatted += `[${currentTime}] ${currentText}\n\n`;
      }
      const startTime = line.split('-->')[0].trim();
      // Converter para formato MM:SS
      const parts = startTime.split(':');
      currentTime = `${parts[1]}:${parts[2].split(',')[0]}`;
      currentText = '';
    } 
    // Ignorar números de sequência
    else if (line && isNaN(Number(line)) && !line.includes('-->')) {
      currentText += (currentText ? ' ' : '') + line;
    }
  }

  // Adicionar o último texto
  if (currentText) {
    formatted += `[${currentTime}] ${currentText}\n\n`;
  }

  return formatted || transcript.text;
}
