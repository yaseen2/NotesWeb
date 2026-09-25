// src/context/useReading.js - Dedicated hook export for clean Vite Fast Refresh
import { useContext, createContext } from 'react';

export const ReadingContext = createContext(null);

export function useReading() {
  const context = useContext(ReadingContext);
  if (!context) {
    throw new Error('useReading must be used within a ReadingProvider');
  }
  return context;
}
