import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();
    if (!videoUrl) throw new Error('URL do vídeo é obrigatória');

    console.log('Processando vídeo:', videoUrl);

    const videoId = extractVideoId(videoUrl);
    if (!videoId) throw new Error('URL do YouTube inválida');

    console.log('ID do vídeo:', videoId);

    // Obter título via oEmbed (sem precisar da YouTube Data API)
    const videoInfo = await getVideoInfo(videoId);

    // Obter legendas públicas/ASR
    const transcriptData = await getYouTubeTranscript(videoId);

    // Formatar
    const formattedTranscript = formatTranscript(transcriptData);
    const noSubtitles = !formattedTranscript || formattedTranscript.trim().length === 0;

    return new Response(
      JSON.stringify({
        success: true,
        videoTitle: videoInfo.title,
        transcript: formattedTranscript,
        language: transcriptData.language || 'pt',
        hasNoise: false,
        noSubtitles,
        info: noSubtitles ? 'Sem legendas públicas/ASR disponíveis para este vídeo.' : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na transcrição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar o vídeo';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  try {
    const response = await fetch(oembedUrl);
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return { title: data.title || `Vídeo ${videoId}`, description: '' };
  } catch (e) {
    console.error('YouTube oEmbed error:', e);
    return { title: `Vídeo ${videoId}`, description: '' };
  }
}

async function getYouTubeTranscript(videoId: string) {
  // Busca legendas públicas (timedtext) incluindo ASR e VTT
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
            const parsedVtt = parseVTTTranscript(text);
            if (parsedVtt) return { language: lang, text: parsedVtt };
            continue;
          }
          if (text.includes('<transcript')) {
            const parsedXml = parseXMLTranscript(text);
            if (parsedXml) return { language: lang, text: parsedXml };
            continue;
          }
          // Fallback: texto cru
          return { language: lang, text };
        } catch (err) {
          console.log(`Erro ao tentar URL ${url}:`, err);
          continue;
        }
      }
    }
    // Sem legendas: retornar objeto vazio
    return { language: 'unknown', text: '' };
  } catch (error) {
    console.error('Erro ao obter transcrição:', error);
    return { language: 'unknown', text: '' };
  }
}

function parseXMLTranscript(xml: string): string | null {
  try {
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
      if (l.includes('-->')) {
        flush();
        const start = l.split('-->')[0].trim();
        const parts = start.split(':');
        const mm = parts.length === 3 ? parts[1] : parts[0];
        const ss = (parts.length === 3 ? parts[2] : parts[1]).split('.')[0];
        currentTime = `${mm.padStart(2,'0')}:${ss.padStart(2,'0')}`;
        continue;
      }
      if (/^\d+$/.test(l)) continue;
      buffer.push(l.replace(/<[^>]+>/g, ''));
    }
    flush();
    return result || null;
  } catch (e) {
    console.error('Erro ao parsear VTT:', e);
    return null;
  }
}

function formatTranscript(transcript: { language: string; text: string }): string {
  if (!transcript?.text) return '';
  // Já formatado (XML/VTT parsers)
  if (transcript.text.includes('[') && transcript.text.includes(']')) return transcript.text;

  // Tentar formatar SRT
  const lines = transcript.text.split('\n');
  let formatted = '';
  let currentTime = '';
  let currentText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      if (currentText) formatted += `[${currentTime}] ${currentText}\n\n`;
      const startTime = line.split('-->')[0].trim();
      const parts = startTime.split(':');
      currentTime = `${parts[1]}:${parts[2].split(',')[0]}`;
      currentText = '';
    } else if (line && isNaN(Number(line))) {
      currentText += (currentText ? ' ' : '') + line;
    }
  }
  if (currentText) formatted += `[${currentTime}] ${currentText}\n\n`;
  return formatted || transcript.text;
}
