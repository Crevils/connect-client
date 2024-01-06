import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import ChatRoomHeader from './ChatRoomHeader';
import ChatRoomMessage from './ChatRoomMessage';
import ChatRoomInput from './ChatRoomInput';
import { useChatContext } from '../../context/ChatContext';
import { useAuthContext } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { chatAPI } from '../../api';
import { useAxios } from '../../hooks/useAxios';

function ChatRoom() {
  const { user } = useAuthContext();
  const { chatId, chatInfo, updateMessageStatusToRead } = useChatContext();
  const { isLoading: messageLoading, sendRequest: getUserMessages } = useAxios();
  const {
    socketValue: { messageData, messageReadStatus },
    resetSocketValue
  } = useSocketContext();

  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    if (chatId) {
      getUserMessages(
        {
          method: 'GET',
          url: chatAPI.getUserMessages({
            userId: user._id,
            chatId,
            type: chatInfo.chatType
          })
        },
        (data) => {
          setChatMessages(data.data);
        }
      );
    }
  }, [chatId, getUserMessages, user._id, chatInfo]);

  const checkIsChatting = useCallback(
    (messageData) => {
      // 
      const { type, sender, receiver } = messageData;
      return type === 'user' ? chatId === sender : chatId === receiver;
    },
    [chatId]
  );

  const updateSelfMessageStatus = useCallback(
    (messageData) => {
      setChatMessages((prev) => [
        ...prev,
        {
          ...messageData,
          readers: [user._id]
        }
      ]);
    },
    [user]
  );

  // socket 
  useEffect(() => {
    if (messageData) {
      console.log('=== socket ===', messageData);
      
      const isChatting = checkIsChatting(messageData);
      // 
      if (isChatting) {
        // 
        updateSelfMessageStatus(messageData);
        // API 
        const { receiver, sender, type } = messageData;
        const toId = type === 'room' ? receiver : sender;
        updateMessageStatusToRead(toId, type);
      }
      // RESET
      resetSocketValue('messageData');
    }
  }, [messageData, checkIsChatting, updateSelfMessageStatus, updateMessageStatusToRead, resetSocketValue]);

  // socket  message update status
  useEffect(() => {
    if (messageReadStatus) {
      const { type, readerId, toId: receiveRoomId } = messageReadStatus;
      // 
      const isChatting = type === 'user' ? chatId === readerId : chatId === receiveRoomId;
      if (isChatting) {
        console.log('*** set chat message read status ***', messageReadStatus);
        setChatMessages((prev) =>
          prev.map((msg) => (msg.sender !== readerId ? { ...msg, readers: [...msg.readers, readerId] } : msg))
        );
      }
    }
  }, [messageReadStatus, chatId]);

  return (
    <RoomWrapper>
      <ChatRoomHeader />
      <ChatRoomMessage chatMessages={chatMessages} messageLoading={messageLoading} />
      <ChatRoomInput setChatMessages={setChatMessages} />
    </RoomWrapper>
  );
}

const RoomWrapper = styled.div`
  margin: 1rem 0 0;
  width: 100%;
  height: calc(100% - 1rem);
  background-color: var(--bg-color-main);
  border-top-left-radius: 20px;
  border-top-right-radius: 8px;
  border: 2px solid var(--bg-color-darken);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

export default ChatRoom;
