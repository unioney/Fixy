import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';

export default function ParticipantsList({ chatroom, onClose }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { user } = useAuth();
  const { addParticipant, removeParticipant } = useChat();

  const isOwner = user?.id === chatroom.owner_id;

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }
    
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    
    try {
      await addParticipant(chatroom.id, email);
      setSuccess(`Invitation sent to ${email}`);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add participant');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!isOwner && participantId !== user?.id) {
      setError('Only the owner can remove other participants');
      return;
    }
    
    setError('');
    setSuccess('');
    
    try {
      await removeParticipant(chatroom.id, participantId);
      setSuccess('Participant removed successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove participant');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Participants</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Participants ({chatroom.participants?.length || 0})
          </h3>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {chatroom.participants?.map((participant) => (
              <div 
                key={participant.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                    {participant.name?.charAt(0) || participant.email?.charAt(0) || 'U'}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {participant.name || 'Unnamed User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {participant.email}
                    </p>
                  </div>
                </div>
                
                {(isOwner || participant.id === user?.id) && participant.id !== chatroom.owner_id && (
                  <button
                    onClick={() => handleRemoveParticipant(participant.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
                
                {participant.id === chatroom.owner_id && (
                  <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full">
                    Owner
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {isOwner && (
          <form onSubmit={handleAddParticipant} className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add Participant
            </h3>
            
            <div className="flex">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input flex-1 mr-2"
                placeholder="Enter email address"
              />
              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Sending...' : 'Invite'}
              </button>
            </div>
          </form>
        )}
        
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          <p>
            {isOwner 
              ? 'As the owner, you can add or remove participants.' 
              : 'Only the owner can add participants. You can leave the chatroom by removing yourself.'}
          </p>
        </div>
      </div>
    </div>
  );
}
