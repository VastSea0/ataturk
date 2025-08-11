import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, voice_id = 'pNInz6obpgDQGcFmaJgB', model_id = 'eleven_multilingual_v2' } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text gerekli' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key bulunamadı' }, { status: 500 })
    }

    console.log('ElevenLabs API çağrısı:', { text: text.substring(0, 50) + '...', voice_id, model_id })

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API hatası:', response.status, errorText)
      return NextResponse.json({ 
        error: `ElevenLabs API hatası: ${response.status}` 
      }, { status: response.status })
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    })

  } catch (error) {
    console.error('ElevenLabs route hatası:', error)
    return NextResponse.json({ 
      error: 'Sunucu hatası' 
    }, { status: 500 })
  }
}
