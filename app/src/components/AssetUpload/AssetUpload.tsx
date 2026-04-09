import React, { useState, useRef } from 'react'
import { uploadAsset } from '../../lib/assetService'
import { useProjectManager } from '../../hooks/useProjectManager'
import { toast } from '../../lib/toastStore'
import { ButtonSpinner } from '../Spinner/Spinner'

interface AssetUploadProps {
  onUploadComplete?: (url: string, assetId: string) => void
}

export const AssetUpload: React.FC<AssetUploadProps> = ({ onUploadComplete }) => {
  const { projectId } = useProjectManager()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB')
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      toast.info('Uploading asset...')
      
      const asset = await uploadAsset({
        file,
        projectId: projectId || undefined,
        onProgress: setProgress,
      })

      setProgress(100)
      toast.success(`"${file.name}" uploaded successfully!`)
      
      if (onUploadComplete) {
        onUploadComplete(asset.playback_url, asset.id)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Failed to upload asset')
    } finally {
      setUploading(false)
      setProgress(0)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div style={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        onChange={handleFileSelect}
        disabled={uploading}
        style={{ display: 'none' }}
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          ...styles.button,
          opacity: uploading ? 0.6 : 1,
          cursor: uploading ? 'not-allowed' : 'pointer',
        }}
      >
        {uploading ? (
          <>
            <ButtonSpinner />
            <span>Uploading... {progress}%</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 16 }}>📁</span>
            <span>Upload Asset</span>
          </>
        )}
      </button>

      {uploading && (
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
            }}
          />
        </div>
      )}

      <div style={styles.hint}>
        Supports video, audio, and image files (max 50MB)
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 16,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 16px',
    background: '#252525',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  progressBar: {
    width: '100%',
    height: 4,
    background: '#252525',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#e94560',
    transition: 'width 0.3s ease',
  },
  hint: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
}
