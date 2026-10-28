import { useEnvironment } from '../hooks/useEnvironment';
import { PHASES } from '../lib/environment';

export const SunsetSky = () => {
  const { weights, phase, weather } = useEnvironment();
  return <div className={`sunset-sky sky-${weather}`} aria-hidden="true" data-testid="sunset-sky" data-daytime={phase} style={{ '--night': weights[3] }}>
    {PHASES.map((p, i) => <div key={p} className={`sky-layer sky-${p}`} style={{ opacity: weights[i] }} />)}
    <div className="sky-stars" style={{ opacity: weights[3] }} />
    <div className="sunset-sun" style={{ opacity: 1 - weights[3] }} />
    <div className="sky-moon" style={{ opacity: weights[3] }} />
    <div className="sky-mountains mountains-back"/><div className="sky-mountains mountains-front"/>
    {['one', 'two', 'three', 'four', 'five'].map(n => <div key={n} className={`sky-cloud cloud-${n}`}><i/><b/><span/></div>)}
  </div>;
};
