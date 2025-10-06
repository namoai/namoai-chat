// src/components/chat/ConfirmationModal.tsx
import React from 'react';
import type { ModalState } from '@/types/chat';

interface ConfirmationModalProps {
  modalState: ModalState;
  setModalState: (state: ModalState) => void;
}

/**
 * 汎用的な確認モーダルコンポーネント
 */
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ modalState, setModalState }) => {
  if (!modalState.isOpen) return null;

  const handleClose = () => {
    modalState.onCancel?.();
    setModalState({ ...modalState, isOpen: false });
  };
  const handleConfirm = () => {
    modalState.onConfirm?.();
    setModalState({ ...modalState, isOpen: false });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
        <h2 className="text-xl font-bold mb-4">{modalState.title}</h2>
        <p className="text-gray-300 mb-6">{modalState.message}</p>
        <div className={`flex ${modalState.isAlert ? "justify-end" : "justify-between"} gap-4`}>
          {!modalState.isAlert && (
            <button onClick={handleClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg">
              キャンセル
            </button>
          )}
          <button onClick={handleConfirm} className={`px-4 py-2 ${modalState.confirmText?.includes("削除") ? "bg-red-600 hover:bg-red-500" : "bg-pink-600 hover:bg-pink-500"} rounded-lg`}>
            {modalState.confirmText || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
