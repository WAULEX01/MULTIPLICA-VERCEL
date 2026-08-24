import React, { useState, useRef } from 'react';
import { Upload, X, Image, Video, Loader2 } from 'lucide-react';
import { apiUploadMedia } from '../services/api';

interface MediaUploaderProps {
  currentUrl?: string;
  currentType?: 'image' | 'video';
  onMediaChange: (url: string | undefined, type: 'image' | 'video' | undefined) => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({ currentUrl, currentType, onMediaChange }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(currentUrl);
  const [mediaType, setMediaType] = useState<'image' | 'video' | undefined>(currentType);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine type
    const isVideo = file.type.startsWith('video/');
    const detectedType: 'image' | 'video' = isVideo ? 'video' : 'image';

    // Show local preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setMediaType(detectedType);
    setUploading(true);

    try {
      const result = await apiUploadMedia(file, detectedType);
      // Replace local preview with server URL
      setPreview(result.url);
      onMediaChange(result.url, result.type as 'image' | 'video');
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Erro ao enviar mídia. Verifique sua conexão e tente novamente.');
      // Revert
      setPreview(currentUrl);
      setMediaType(currentType);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(undefined);
    setMediaType(undefined);
    onMediaChange(undefined, undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Preview */}
      {preview && mediaType === 'image' && (
        <div style={{ position: 'relative', display: 'inline-block', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--power-line)' }}>
          <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', display: 'block' }} />
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            style={{
              position: 'absolute', top: '4px', right: '4px',
              background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
              borderRadius: '50%', width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {preview && mediaType === 'video' && (
        <div style={{ position: 'relative', display: 'inline-block', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--power-line)' }}>
          <video src={preview} controls style={{ maxWidth: '100%', maxHeight: '200px', display: 'block' }} />
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            style={{
              position: 'absolute', top: '4px', right: '4px',
              background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
              borderRadius: '50%', width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Upload button */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {uploading ? (
            <Loader2 size={14} className="spin" />
          ) : preview ? (
            <Upload size={14} />
          ) : (
            <Image size={14} />
          )}
          {uploading ? 'Enviando...' : preview ? 'Trocar Mídia' : 'Adicionar Imagem/Vídeo'}
        </button>
        {!preview && (
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            JPG, PNG, GIF, WEBP, MP4
          </span>
        )}
      </div>
    </div>
  );
};
