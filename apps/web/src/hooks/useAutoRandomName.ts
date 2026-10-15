'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useI18nStore } from '@/store/useI18nStore';
import { generateRandomFunnyName } from '@/lib/name-generator';

export function useAutoRandomName() {
  const { myName, setName } = useGameStore();
  const language = useI18nStore((state) => state.language);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    if (!myName) {
      const savedName = typeof window !== 'undefined' ? localStorage.getItem('kz-name') : null;
      if (savedName && savedName.trim()) {
        setName(savedName.trim());
      } else {
        const generated = generateRandomFunnyName(language);
        setName(generated);
      }
    }
  }, [myName, setName, language]);

  const randomizeName = () => {
    const generated = generateRandomFunnyName(language);
    setName(generated);
    return generated;
  };

  return {
    myName,
    setName,
    randomizeName,
  };
}
