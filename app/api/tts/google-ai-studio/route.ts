import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import mime from 'mime'

interface WavConversionOptions {
  numChannels: number
  sampleRate: number
  bitsPerSample: number
}

function parseMimeType(mimeType: string): WavConversionOptions {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim())
  const [_, format] = fileType.split('/')

  const options: Partial<WavConversionOptions> = {
    numChannels: 1,
    sampleRate: 22050,
    bitsPerSample: 16,
  }

  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10)
    if (!isNaN(bits)) {
      options.bitsPerSample = bits
    }
  }

  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim())
    if (key === 'rate') {
      options.sampleRate = parseInt(value, 10)
    }
  }

  return options as WavConversionOptions
}

function createWavHeader(dataLength: number, options: WavConversionOptions): Buffer {
  const { numChannels, sampleRate, bitsPerSample } = options

  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const buffer = Buffer.alloc(44)

  buffer.write('RIFF', 0)                      // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4)     // ChunkSize
  buffer.write('WAVE', 8)                      // Format
  buffer.write('fmt ', 12)                     // Subchunk1ID
  buffer.writeUInt32LE(16, 16)                 // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20)                  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22)        // NumChannels
  buffer.writeUInt32LE(sampleRate, 24)         // SampleRate
  buffer.writeUInt32LE(byteRate, 28)           // ByteRate
  buffer.writeUInt16LE(blockAlign, 32)         // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34)      // BitsPerSample
  buffer.write('data', 36)                     // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40)         // Subchunk2Size

  return buffer
}

function convertToWav(rawData: string, mimeType: string): Buffer {
  const options = parseMimeType(mimeType)
  const wavHeader = createWavHeader(rawData.length, options)
  const buffer = Buffer.from(rawData, 'base64')

  return Buffer.concat([wavHeader, buffer])
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'Zephyr' } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text gerekli' }, { status: 400 })
    }

    const apiKey = process.env.AI_STUDIO_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Google AI Studio API key bulunamadı' }, { status: 500 })
    }

    console.log('Google AI Studio TTS çağrısı:', { 
      text: text.substring(0, 50) + '...', 
      voice,
      textLength: text.length 
    })

    const ai = new GoogleGenAI({
      apiKey: apiKey,
    })

    const config = {
      temperature: 1,
      responseModalities: ['audio'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice, // Zephyr, Aoede, Circe, Fenrir gibi sesler
          }
        }
      },
    }

    const model = 'gemini-2.5-pro-preview-tts'
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: text,
          },
        ],
      },
    ]

    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    })

    let audioBuffers: Buffer[] = []
    
    for await (const chunk of response) {
      if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
        continue
      }
      
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const inlineData = chunk.candidates[0].content.parts[0].inlineData
        let buffer = Buffer.from(inlineData.data || '', 'base64')
        
        // Eğer WAV değilse, WAV'a çevir
        let fileExtension = mime.getExtension(inlineData.mimeType || '')
        if (!fileExtension || fileExtension !== 'wav') {
          buffer = Buffer.from(convertToWav(inlineData.data || '', inlineData.mimeType || ''))
        }
        
        audioBuffers.push(buffer)
      }
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json({ error: 'Ses üretilemedi' }, { status: 500 })
    }

    // Tüm audio parçalarını birleştir
    const finalAudioBuffer = Buffer.concat(audioBuffers)
    
    console.log('Google AI Studio TTS başarılı, ses boyutu:', finalAudioBuffer.byteLength)

    return new NextResponse(finalAudioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': finalAudioBuffer.byteLength.toString(),
      },
    })

  } catch (error) {
    console.error('Google AI Studio TTS hatası:', error)
    return NextResponse.json({ 
      error: 'Sunucu hatası: ' + (error as Error).message 
    }, { status: 500 })
  }
}
