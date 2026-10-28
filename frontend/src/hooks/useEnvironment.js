import { useEffect, useState } from 'react';
import { dayInfo, weatherAt } from '../lib/environment';

const snapshot = () => { const d = dayInfo(); return { ...d, weights: d.weights.map(w => Math.round(w * 50) / 50), weather: weatherAt() }; };
export function useEnvironment() {
  const [state, setState] = useState(snapshot);
  useEffect(() => {
    const id = setInterval(() => setState(prev => { const next = snapshot(); return JSON.stringify(next.weights) === JSON.stringify(prev.weights) && next.weather === prev.weather && next.phase === prev.phase ? prev : next; }), 1000);
    return () => clearInterval(id);
  }, []);
  return state;
}
