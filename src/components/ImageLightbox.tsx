import { X } from 'lucide-react';

interface ImageLightboxProps {
  imageUrl: string;
  onClose: () => void;
}

export function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center transition-opacity duration-500 cursor-zoom-out"
      onClick={onClose}
    >
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-[110] active:scale-90"
      >
        <X size={28} />
      </button>
      
      <div 
        className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center transition-all duration-500 pointer-events-none"
      >
        <img 
          src={imageUrl} 
          alt="Preview" 
          className="max-w-full max-h-full object-contain shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-lg pointer-events-auto transition-transform hover:scale-[1.01]"
        />
      </div>
    </div>
  );
}
