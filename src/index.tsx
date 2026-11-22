import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ProgressProvider } from './contexts/ProgressContext';
import { WordbookProvider } from './contexts/WordbookContext';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ProgressProvider>
        <WordbookProvider>
          <App />
        </WordbookProvider>
      </ProgressProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
