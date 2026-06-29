import { useState, useCallback } from 'react';
import { interpolateMood } from '../utils/color';

export function useMoodSlider(initialValue = 0.5) {
  const [value, setValue] = useState(initialValue);
  const [color, setColor] = useState(() => interpolateMood(initialValue));

  const handleChange = useCallback((newValue: number) => {
    setValue(newValue);
    setColor(interpolateMood(newValue));
  }, []);

  return { value, color, handleChange };
}
