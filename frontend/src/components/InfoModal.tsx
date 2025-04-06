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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <TbInfoCircle className="mr-2" />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <TbX size={24} />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-gray-300">{message}</p>
        </div>

        <div className="px-6 py-3 bg-gray-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
} 