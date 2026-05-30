import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AvatarProvider } from './avatar/AvatarContext.jsx';
import { ThemeProvider } from './theme/ThemeContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AvatarProvider>
        <App />
      </AvatarProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
