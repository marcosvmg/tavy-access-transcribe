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

    // Obter informações do vídeo (sem precisar de API key)
    const videoInfo = await getVideoInfo(videoId);

    // Obter a transcrição usando a API pública de legendas do YouTube
    const transcript = await getYouTubeTranscript(videoId);

    // Formatar a transcrição com timestamps
    const formattedTranscript = formatTranscript(transcript);

    return new Response(
      JSON.stringify({
        success: true,
        videoTitle: videoInfo.title,
        transcript: formattedTranscript,
        language: transcript.language || 'pt',
        hasNoise: false,
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
  // Usar o endpoint oEmbed do YouTube para obter o título sem precisar de API Key
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

  const response = await fetch(oembedUrl);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('YouTube oEmbed error:', errorText);
    // Fallback: retornar um título básico em vez de falhar toda a função
    return {
      title: `Vídeo ${videoId}`,
      description: ''
    };
  }

  const data = await response.json();
  return {
    title: data.title || `Vídeo ${videoId}`,
    description: ''
  };
}

async function getYouTubeTranscript(videoId: string) {
  // Usar a API pública de transcrição do YouTube (timedtext)
  // Funciona com legendas públicas e ASR (auto-geradas)
  try {
    const languages = ['pt', 'pt-BR', 'en', 'es'];

    for (const lang of languages) {
      const variants = [
        `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}`,
        `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&kind=asr`,
        `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=vtt`,
        `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&kind=asr&fmt=vtt`,
      ];

      for (const url of variants) {
        try {
          console.log(`Tentando legendas: ${url}`);
          const response = await fetch(url);
          if (!response.ok) continue;
          const text = await response.text();
          if (!text || text.trim().length === 0) continue;

          if (text.startsWith('WEBVTT')) {
            const parsed = parseVTTTranscript(text);
            if (parsed) return { language: lang, text: parsed };
            continue;
          }

          if (text.includes('<transcript')) {
            const parsedText = parseXMLTranscript(text);
            if (parsedText) return { language: lang, text: parsedText };
            continue;
          }

          // Último recurso, retornar texto cru
          return { language: lang, text };
        } catch (err) {
          console.log(`Erro ao tentar URL ${url}:`, err);
          continue;
        }
      }
    }

    throw new Error('Este vídeo não possui legendas disponíveis em pt, en ou es (públicas/ASR). Tente outro vídeo com legendas.');
  } catch (error) {
    console.error('Erro ao obter transcrição:', error);
    throw error;
  }
}

function parseXMLTranscript(xml: string): string | null {
  try {
    // Usar RegExp via string para evitar problemas de parsing de regex literal com </
    const re = new RegExp('<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([\\s\\S]*?)<\\/text>', 'g');
    let result = '';

    const textMatches = xml.matchAll(re);
    for (const match of textMatches) {
      const start = parseFloat(match[1]);
      const raw = match[3]
        .replace(/\n/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      const minutes = Math.floor(start / 60);
      const seconds = Math.floor(start % 60);
      const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      const text = raw.replace(/<[^>]+>/g, '').trim();
      if (!text) continue;
      result += `[${timestamp}] ${text}\n`;
    }

    return result || null;
  } catch (error) {
    console.error('Erro ao fazer parsing do XML:', error);
    return null;
  }
}

function parseVTTTranscript(vtt: string): string | null {
  try {
    const lines = vtt.split(/\r?\n/);
    let result = '';
    let currentTime = '';
    let buffer: string[] = [];

    const flush = () => {
      const text = buffer.join(' ').trim();
      if (!text || !currentTime) return;
      result += `[${currentTime}] ${text}\n`;
      buffer = [];
    };

    for (const line of lines) {
      const l = line.trim();
      if (!l) { flush(); continue; }
      // Ex: 00:00:05.000 --> 00:00:07.000
      if (l.includes('-->')) {
        flush();
        const start = l.split('-->')[0].trim();
        const parts = start.split(':');
        const mm = parts.length === 3 ? parts[1] : parts[0];
        const ss = (parts.length === 3 ? parts[2] : parts[1]).split('.')[0];
        currentTime = `${mm.padStart(2,'0')}:${ss.padStart(2,'0')}`;
        continue;
      }
      if (/^\d+$/.test(l)) continue; // Ignorar índice
      buffer.push(l.replace(/<[^>]+>/g, ''));
    }
    flush();
    return result || null;
  } catch (e) {
    console.error('Erro ao parsear VTT:', e);
    return null;
  }
}

function formatTranscript(transcript: any): string {
  // Se já está formatado (por parseXMLTranscript/VTT), retornar direto
  if (transcript.text.includes('[') && transcript.text.includes(']')) {
    return transcript.text;
  }
  
  // Caso contrário, tentar formatar SRT
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
