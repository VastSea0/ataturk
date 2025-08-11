import styles from './Content.module.css'
import { useSearchParams } from 'next/navigation'
import data from '@/app/data/data.json'
import Image from 'next/image'
import { formatDate } from '@/app/helpers/date'
import { useEffect, useState } from 'react'

type ItemType = {
  id: number
  date: string
  title: string
  description?: string
  images?: ImageType[]
  sounds?: SoundType[]
  source?: string
}

type ImageType = {
  url: string
  alt: string
  source?: string
}

type SoundType = {
  url: string
  alt: string
  source?: string
}

export default function Content() {
  const searchParams = useSearchParams()
  const [modalImage, setModalImage] = useState<ImageType | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)

  const selectedItem = data.find((item: ItemType) => item.id === Number(searchParams.get('id')))

  // ESC ile modal kapama
  useEffect(() => {
    if (!modalImage) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalImage(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalImage])

 
  useEffect(() => {
    console.log('TTS sistemi hazır')
    
    return () => {
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.src = ''
      }
      if (typeof window !== 'undefined' && (window as any).responsiveVoice) {
        (window as any).responsiveVoice.cancel()
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [currentAudio])

  // ElevenLabs Text-to-Speech fonksiyonu
  const speakText = async (text: string) => {
    console.log('speakText çağrıldı, metin:', text)
    
    // Eğer şu anda konuşuyorsa, durdur
    if (isSpeaking) {
      console.log('Konuşma durduruluyor')
      return
    }

    // Temiz metin oluştur
    const cleanText = text.replace(/undefined/g, '').replace(/\.\s*\./g, '.').trim()
    console.log('Temizlenmiş metin:', cleanText)

    if (!cleanText) {
      console.warn('Okunacak metin boş')
      return
    }

    setIsSpeaking(true)

    try {
      console.log('ElevenLabs TTS başlatılıyor...')
      await speakWithElevenLabs(cleanText)
      console.log('ElevenLabs TTS başarılı')
      
    } catch (error) {
      console.error('ElevenLabs TTS hatası:', error)
      alert('Ses servisi kullanılamıyor. ElevenLabs API hatası.')
      setIsSpeaking(false)
    }
  }


  const speakWithElevenLabs = async (text: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('ElevenLabs API çağrısı yapılıyor...')
        
        const response = await fetch('/api/tts/elevenlabs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text,
            voice_id: 'onwK4e9ZLuTAKqWW03F9', // Adam sesi - çok doğal
            model_id: 'eleven_multilingual_v2'
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
        }

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        
        setCurrentAudio(audio)
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          setIsSpeaking(false)
          setCurrentAudio(null)
          console.log('ElevenLabs konuşma tamamlandı')
          resolve()
        }
        
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          setCurrentAudio(null)
          reject(new Error('Audio playback failed'))
        }
        
        console.log('ElevenLabs ses çalınıyor...')
        await audio.play()
        
      } catch (error) {
        console.error('ElevenLabs hatası:', error)
        setCurrentAudio(null)
        reject(error)
      }
    })
  }


  return (
    <div className={styles.content}>
      <div className={styles.dateAndTitle}>
        <div className={styles.date}>{formatDate(selectedItem?.date || '')}</div>
        <p className={styles.title}>
          {selectedItem?.title}
          {selectedItem?.source && (
            <span className={styles.source} title={`Bilgi kaynağı: ${selectedItem.source}`}>
              <a href={selectedItem.source} target='_blank' rel='noopener noreferrer'>
                {selectedItem.source.includes('https://') ? '*' : 'Bilgi Kaynağı'}
              </a>
            </span>
          )}
          {/* Text-to-Speech butonları */}
          {(selectedItem?.title || selectedItem?.description) && (
            <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => {
                  const textToSpeak = [
                    selectedItem?.title,
                    selectedItem?.description
                  ].filter(Boolean).join('. ')
                  speakText(textToSpeak)
                }}
                className={styles.speakButton}
                title={isSpeaking ? 'Konuşmayı durdur' : 'Metni seslendir'}
                aria-label={isSpeaking ? 'Konuşmayı durdur' : 'Metni seslendir'}
              >
                {isSpeaking ? '🔊' : '🔈'}
              </button>
              
           
            </div>
          )}
        </p>

        {selectedItem?.description && (
          <p className={styles.description}>{selectedItem.description}</p>
        )}
      </div>

      {selectedItem?.images && selectedItem.images.length > 0 && (
        <div className={styles.images}>
          {selectedItem.images.map((image: ImageType, index) => (
            <div
              key={index}
              className={styles.image}
              onClick={() => setModalImage(image)}
              style={{ cursor: 'pointer' }}
            >
              <Image src={image.url} alt='External Image' width={2000} height={2000} />
              <p title={`Bilgi kaynağı: ${image.source}`}>
                {image.alt}
                <a href={image.source} target='_blank' rel='noopener noreferrer'>
                  *
                </a>
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedItem?.sounds && selectedItem.sounds.length > 0 && (
        <div className={styles.sounds}>
          {selectedItem.sounds.map((sound: SoundType, index) => (
            <div key={index} className={styles.sound}>
              <p title={`Bilgi kaynağı: ${sound.source}`}>
                {sound.alt}
                {sound.source && (
                  <a href={sound.source} target='_blank' rel='noopener noreferrer'>
                    {sound.source.includes('https://') ? '*' : 'Bilgi Kaynağı'}
                  </a>
                )}
              </p>

              <audio controls controlsList='nodownload' onContextMenu={(e) => e.preventDefault()}>
                <source src={sound.url} type='audio/mpeg' />
                İnternet tarayıcınız ses yürütmeyi desteklemiyor.
              </audio>
            </div>
          ))}
        </div>
      )}

      {modalImage && (
        <div className={styles.modal} onClick={() => setModalImage(null)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative' }}
          >
            <button
              className={styles.closeButton}
              onClick={() => setModalImage(null)}
              aria-label='Kapat'
            >
              ×
            </button>

            <Image
              src={modalImage.url}
              alt={modalImage.alt}
              width={800}
              height={800}
              style={{ width: '100%', height: 'auto' }}
            />
            <p title={`Bilgi kaynağı: ${modalImage.source}`}>
              {modalImage.alt}
              {modalImage.source && (
                <a href={modalImage.source} target='_blank' rel='noopener noreferrer'>
                  {modalImage.source.includes('https://') ? '*' : 'Bilgi Kaynağı'}
                </a>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
