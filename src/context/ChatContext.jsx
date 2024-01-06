import PropTypes from 'prop-types';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAxios } from '../hooks/useAxios';
import { chatAPI } from '../api';
import { useAuthContext } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { socketEmitEvent } from '../socket/emit';

export const ChatContext = createContext({});

export const useChatContext = () => useContext(ChatContext);

function ChatContextProvider({ children }) {
  const { user } = useAuthContext();
  const {
    socketValue: { socket, onlineUsers, messageData }
  } = useSocketContext();
  const [chatInfo, setChatInfo] = useLocalStorage('chat-app-chat-info', null);
  const [contacts, setContacts] = useState([]);

  const { sendRequest: getUserContacts } = useAxios();
  const { sendRequest: updateReadStatus } = useAxios();

  const chatId = chatInfo?._id || null;

  const fetchUserContacts = useCallback(() => {
    if (user) {
      return getUserContacts(
        {
          method: 'GET',
          url: chatAPI.getUserContacts(user._id)
        },
        (data) => {
          const contactsWithOnlineStatus = data.data.map((contact) => ({
            ...contact,
            isOnline: onlineUsers?.some((user) => user.userId === contact._id) || false
          }));
          setContacts(contactsWithOnlineStatus);
        }
      );
    }
  }, [user, getUserContacts, onlineUsers]);

  // fetch user contacts
  useEffect(() => {
    fetchUserContacts();
  }, [fetchUserContacts]);


  const updateContactLatestMessage = useCallback(
    (latestMessageData) => {
      const { updateId, sender, message, updatedAt, unreadCount } = latestMessageData;

      setContacts((prevContact) =>
        prevContact.map((contact) => {
          return contact._id === updateId
            ? {
                ...contact,
                latestMessage: message,
                latestMessageSender: sender,
                latestMessageUpdatedAt: updatedAt,
                unreadCount: chatId === sender ? 0 : unreadCount
              }
            : contact;
        })
      );
    },
    [chatId]
  );

  useEffect(() => {
    if (messageData) {
      const { type, receiver, sender } = messageData;
      updateContactLatestMessage({ ...messageData, updateId: type === 'room' ? receiver : sender });
    }
  }, [messageData, updateContactLatestMessage]);


  const updateMessageStatusToRead = (chatId, type) => {
    // API 
    updateReadStatus({
      method: 'PUT',
      url: chatAPI.updateReadStatus({
        userId: user._id,
        chatId,
        type
      })
    });
    // socket 
    socketEmitEvent(socket).updateMessageReaders({
      readerId: user._id,
      toId: chatId,
      type
    });
  };

  const handleChatSelect = async (selected) => {
    if (selected._id !== chatId) {
      if (selected.chatType === 'room') {
        socketEmitEvent(socket).enterChatRoom({ roomId: selected._id, message: `${user.name}` });
      }
      if (chatInfo?.chatType === 'room') {
        socketEmitEvent(socket).leaveChatRoom({ roomId: chatId, message: `${user.name}` });
      }
      setChatInfo(selected);
      updateMessageStatusToRead(selected._id, selected.chatType);
      setContacts((prevContacts) =>
        prevContacts.map((prev) => (prev._id === selected._id ? { ...prev, unreadCount: 0 } : prev))
      );
    }
  };

  return (
    <ChatContext.Provider
      value={{
        chatId,
        chatInfo,
        setChatInfo,
        contacts,
        setContacts,
        handleChatSelect,
        updateContactLatestMessage,
        updateMessageStatusToRead,
        fetchUserContacts
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

ChatContextProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default ChatContextProvider;
