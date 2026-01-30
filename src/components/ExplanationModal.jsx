import React, { useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import { CloseIcon, BookOpenIcon, LoaderIcon } from './Icons';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease-out;
  backdrop-filter: blur(5px);
  padding: 16px;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalContent = styled.div`
  background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
  border: 2px solid #00d4ff;
  border-radius: 24px;
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: slideIn 0.3s ease-out;
  position: relative;

  @keyframes slideIn {
    from { 
      transform: translateY(20px); 
      opacity: 0;
    }
    to { 
      transform: translateY(0); 
      opacity: 1;
    }
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const TitleWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const IconWrapper = styled.div`
  background: rgba(0, 212, 255, 0.1);
  padding: 8px;
  border-radius: 12px;
  color: #00d4ff;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Title = styled.h2`
  color: #00d4ff;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
`;

const ScrollArea = styled.div`
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  color: #e0e0e0;
  font-size: 16px;
  line-height: 1.7;

  /* Custom Scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
  }

  &::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #00d4ff;
  gap: 16px;

  p {
    color: #aaaaaa;
    font-size: 14px;
    margin: 0;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
`;

const MarkdownContent = styled.div`
  h3 {
    color: #ffffff;
    font-size: 18px;
    margin: 24px 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid rgba(0, 212, 255, 0.3);
  }

  h3:first-of-type {
    margin-top: 0;
  }

  p {
    margin-bottom: 16px;
  }

  ul, ol {
    margin-bottom: 16px;
    padding-left: 24px;
  }

  li {
    margin-bottom: 8px;
  }

  strong {
    color: #00d4ff;
    font-weight: 600;
  }

  blockquote {
    border-left: 4px solid #00d4ff;
    margin: 16px 0;
    padding: 12px 16px;
    background: rgba(0, 212, 255, 0.05);
    border-radius: 0 8px 8px 0;
  }
`;

const ExplanationModal = ({ isOpen, onClose, explanation, isLoading }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  // Convert simple markdown to JSX (basic implementation)
  // For production, use a library like react-markdown
  const renderMarkdown = (text) => {
    if (!text) return null;

    return text.split('\n').map((line, index) => {
      // Headers
      if (line.startsWith('### ')) return <h3 key={index}>{line.replace('### ', '')}</h3>;
      if (line.startsWith('## ')) return <h2 key={index}>{line.replace('## ', '')}</h2>;
      if (line.startsWith('**') && line.endsWith('**')) return <h3 key={index}>{line.replace(/\*\*/g, '')}</h3>;

      // Bullets
      if (line.trim().startsWith('- ')) {
        return (
          <li key={index} style={{ listStyle: 'none', position: 'relative', paddingLeft: '16px' }}>
            <span style={{ position: 'absolute', left: 0, color: '#00d4ff' }}>•</span>
            {line.replace('- ', '').split(/(\*\*.*?\*\*)/).map((part, i) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : part
            )}
          </li>
        );
      }

      // Normal text with bold support
      return (
        <p key={index}>
          {line.split(/(\*\*.*?\*\*)/).map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={i}>{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContent ref={modalRef}>
        <Header>
          <TitleWrapper>
            <IconWrapper>
              <BookOpenIcon />
            </IconWrapper>
            <Title>AI 선생님의 문장 강의</Title>
          </TitleWrapper>
          <CloseButton onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </CloseButton>
        </Header>

        <ScrollArea>
          {isLoading ? (
            <LoadingContainer>
              <LoaderIcon size="h-10 w-10" />
              <p>선생님이 문장을 분석하고 있어요...</p>
              <p style={{ fontSize: '12px', color: '#666' }}>잠시만 기다려주세요</p>
            </LoadingContainer>
          ) : (
            <MarkdownContent>
              {renderMarkdown(explanation)}
            </MarkdownContent>
          )}
        </ScrollArea>
      </ModalContent>
    </ModalOverlay>
  );
};

export default ExplanationModal;
