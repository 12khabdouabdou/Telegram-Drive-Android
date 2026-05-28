import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { TelegramFile } from '../../types';

interface StreamInfo {
  token: string;
  base_url: string;
}

interface MediaPlayerProps {
  file: TelegramFile;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  activeFolderId: number | null;
}

export function MediaPlayer({ file, onClose, onNext, onPrev, activeFolderId }: MediaPlayerProps) {
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    invoke<StreamInfo>('cmd_get_stream_info').then(setStreamInfo).catch(console.error);
  }, []);

  const folderIdParam = activeFolderId !== null ? activeFolderId.toString() : 'home';
  const streamUrl = streamInfo
    ? `${streamInfo.base_url}/stream/${folderIdParam}/${file.id}?token=${streamInfo.token}`
    : null;

  const isVideo = /\.(mp4|mkv|avi|mov|webm|m4v)$/i.test(file.name);
  const isAudio = /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  // Touch swipe handlers
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > 100) {
      if (diff > 0 && onNext) {
        onNext();
      } else if (diff < 0 && onPrev) {
        onPrev();
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (e.key === 'ArrowLeft' && onPrev) {
        onPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev]);

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-10"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation Arrows */}
      {onPrev && (
        <button
          onClick={onPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-10"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      
      {onNext && (
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-10"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Media Content */}
      <div className="w-full max-w-4xl aspect-video bg-black flex items-center justify-center">
        {!streamUrl ? (
          <div className="flex flex-col items-center gap-4 text-white">
            <div className="w-12 h-12 border-4 border-telegram-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm opacity-80">Preparing stream...</p>
          </div>
        ) : isVideo ? (
          <video
            ref={videoRef}
            src={streamUrl}
            className="w-full h-full"
            controls={false}
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              if (onNext) onNext();
            }}
          />
        ) : isAudio ? (
          <div className="flex flex-col items-center gap-6 text-white p-8">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-telegram-primary/30 to-telegram-secondary/30 flex items-center justify-center">
              <Music className="w-16 h-16 text-telegram-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold truncate max-w-xs">{file.name}</h2>
              <p className="text-sm opacity-70 mt-2">{file.sizeStr}</p>
            </div>
            {streamUrl && (
              <audio
                ref={videoRef as any}
                src={streamUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            )}
          </div>
        ) : (
          <div className="text-white text-center">
            <p>Unsupported file type</p>
          </div>
        )}
      </div>

      {/* Controls */}
      {(isVideo || isAudio) && streamUrl && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-telegram-primary"
            />
            <div className="flex justify-between mt-2 text-xs text-white/70">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-8">
            {isAudio && onPrev && (
              <button onClick={onPrev} className="p-2 text-white/70 hover:text-white transition-colors">
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}
            
            <button
              onClick={togglePlay}
              className="p-4 rounded-full bg-telegram-primary text-black hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
            </button>
            
            {isAudio && onNext && (
              <button onClick={onNext} className="p-2 text-white/70 hover:text-white transition-colors">
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-3 mt-4 justify-center">
            <Volume2 className="w-5 h-5 text-white/70" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Music(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.className?.split(' ')[1]?.replace('w-', '') || '24'}
      height={props.className?.split(' ')[1]?.replace('h-', '') || '24'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}