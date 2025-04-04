import React from 'react';
import { useRouter } from 'next/router';
import { formatDistanceToNow } from 'date-fns';

export default function ChatroomList({ chatrooms }) {
  const router = useRouter();

  const handleChatroomClick = (id) => {
    router.push(`/chatrooms/${id}`);
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {chatrooms.map((chatroom) => (
        <div 
          key={chatroom.id}
          onClick={() => handleChatroomClick(chatroom.id)}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{chatroom.title}</h3>
            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
              {chatroom.type === 'private' ? 'Private' : 'Group'}
            </span>
          </div>
          
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Created by {chatroom.owner_name || 'You'}
          </p>
          
          <div className="mt-4 flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Updated {formatDistanceToNow(new Date(chatroom.updated_at), { addSuffix: true })}
            </span>
            <button 
              className="text-primary-600 hover:text-primary-800 text-sm font-medium"
              onClick={(e) => {
                e.stopPropagation();
                handleChatroomClick(chatroom.id);
              }}
            >
              Open →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
