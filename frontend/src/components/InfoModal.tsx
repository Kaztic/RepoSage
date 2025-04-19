import { TbInfoCircle, TbX } from 'react-icons/tb';

interface InfoModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export default function InfoModal({
  isOpen,
  title,
  message,
  onClose
}: InfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-surface-950/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-surface-800 rounded-xl shadow-prominent w-full max-w-md mx-4 overflow-hidden border border-surface-700/50">
        <div className="px-6 py-4 border-b border-surface-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-surface-100 flex items-center">
            <TbInfoCircle className="mr-2 text-primary-400" />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-200 p-1 rounded-full hover:bg-surface-700/50 transition-colors"
          >
            <TbX size={20} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-surface-200">{message}</p>
        </div>

        <div className="px-6 py-4 bg-surface-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors shadow-sm"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
} 