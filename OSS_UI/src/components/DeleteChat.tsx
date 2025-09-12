import { Trash } from 'lucide-react';
import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Chat } from '@/app/library/page';

const DeleteChat = ({
  chatId,
  chats,
  setChats,
  redirect = false,
}: {
  chatId: string;
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
  redirect?: boolean;
}) => {
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Get API base URL with fallback
  const getApiBase = () => process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

  const handleDelete = async () => {
    setLoading(true);
    try {
      const API_BASE = getApiBase();
      
      // ✅ FIXED: Use correct backend endpoint
      const res = await fetch(`${API_BASE}/api/conversation/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        // ✅ Better error handling with backend response
        let errorMessage = 'Failed to delete chat';
        try {
          const errorData = await res.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // ✅ Get success response
      const result = await res.json();
      console.log('✅ Delete successful:', result);

      // ✅ Update local state
      const newChats = chats.filter((chat) => chat.id !== chatId);
      setChats(newChats);

      // ✅ Success feedback
      toast.success('Chat deleted successfully');

      // ✅ Optional redirect
      if (redirect) {
        window.location.href = '/';
      }

    } catch (err: any) {
      console.error('❌ Delete error:', err);
      toast.error(err.message || 'Failed to delete chat');
    } finally {
      setConfirmationDialogOpen(false);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setConfirmationDialogOpen(true);
        }}
        className="bg-transparent text-red-400 hover:scale-105 transition duration-200 disabled:opacity-50"
        disabled={loading}
        title="Delete chat"
      >
        <Trash size={17} />
      </button>
      
      <Transition appear show={confirmationDialogOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (!loading) {
              setConfirmationDialogOpen(false);
            }
          }}
        >
          <DialogBackdrop className="fixed inset-0 bg-black/30" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle className="text-lg font-medium leading-6 dark:text-white">
                    Delete Confirmation
                  </DialogTitle>
                  <Description className="text-sm dark:text-white/70 text-black/70 mt-2">
                    Are you sure you want to delete this chat? This action cannot be undone.
                  </Description>
                  
                  <div className="flex flex-row items-end justify-end space-x-4 mt-6">
                    <button
                      onClick={() => {
                        if (!loading) {
                          setConfirmationDialogOpen(false);
                        }
                      }}
                      className="text-black/50 dark:text-white/50 text-sm hover:text-black/70 hover:dark:text-white/70 transition duration-200 disabled:opacity-50"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="text-red-400 text-sm hover:text-red-500 transition duration-200 disabled:opacity-50 flex items-center gap-2"
                      disabled={loading}
                    >
                      {loading && (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {loading ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default DeleteChat;
