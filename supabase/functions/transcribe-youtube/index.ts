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
    const errorText = await response.text();
    console.error('YouTube API Error:', errorText);
    throw new Error('Erro ao obter informações do vídeo. Verifique se a API key está correta e se a YouTube Data API v3 está habilitada.');
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
  // Usar a API pública de transcrição do YouTube (timedtext)
  // Esta API não requer autenticação OAuth e funciona com legendas públicas
  
  try {
    // Primeiro, tentar obter legendas em português
    const languages = ['pt', 'pt-BR', 'en', 'es'];
    
    for (const lang of languages) {
      try {
        const url = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}`;
        console.log(`Tentando obter legendas em ${lang}:`, url);
        
        const response = await fetch(url);
        
        if (response.ok) {
          const text = await response.text();
          
          // Verificar se realmente obtivemos legendas
          if (text && text.trim().length > 0 && !text.includes('<?xml version')) {
            console.log(`Legendas encontradas em ${lang}`);
            return {
              language: lang,
              text: text,
            };
          }
          
          // Se for XML, fazer parsing
          if (text.includes('<?xml version')) {
            const parsedText = parseXMLTranscript(text);
            if (parsedText) {
              console.log(`Legendas XML encontradas em ${lang}`);
              return {
                language: lang,
                text: parsedText,
              };
            }
          }
        }
      } catch (err) {
        console.log(`Erro ao tentar ${lang}:`, err);
        continue;
      }
    }
    
    throw new Error('Este vídeo não possui legendas disponíveis em português, inglês ou espanhol. Por favor, tente outro vídeo com legendas ativadas.');
  } catch (error) {
    console.error('Erro ao obter transcrição:', error);
    throw error;
  }
}

function parseXMLTranscript(xml: string): string | null {
  try {
    // Extrair texto de tags <text>
    const textMatches = xml.matchAll(/<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([^<]*)<\/text>/g);
    let result = '';
    
    for (const match of textMatches) {
      const start = parseFloat(match[1]);
      const text = match[3]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      // Converter segundos para MM:SS
      const minutes = Math.floor(start / 60);
      const seconds = Math.floor(start % 60);
      const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      result += `[${timestamp}] ${text}\n`;
    }
    
    return result || null;
  } catch (error) {
    console.error('Erro ao fazer parsing do XML:', error);
    return null;
  }
}

function formatTranscript(transcript: any): string {
  // Se já está formatado (do parseXMLTranscript), retornar direto
  if (transcript.text.includes('[') && transcript.text.includes(']')) {
    return transcript.text;
  }
  
  // Caso contrário, formatar a transcrição com timestamps
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
