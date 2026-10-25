import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { WordbookProvider } from './contexts/WordbookContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <WordbookProvider>
        <App />
      </WordbookProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
