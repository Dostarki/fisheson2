import { useState } from 'react';
import { ArrowRight, Loader2, UserRound } from 'lucide-react';
import { GameDialog } from './GameDialog';
import { Button } from './ui/button';

const VALID = /^[A-Za-z0-9_]{3,16}$/;

export const UsernameGate = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!VALID.test(name)) { setError('Use 3–16 letters, numbers or _.'); return; }
    setSaving(true); setError('');
    const err = await onSubmit(name);
    if (err) setError(err);
    setSaving(false);
  };
  return <GameDialog open onClose={() => {}} id="username-gate" title="Pick your name." subtitle="This is how other islanders will see you on the leaderboard." className="wallet-dialog username-dialog">
    <div className="wallet-emblem"><UserRound size={30} strokeWidth={1.5}/></div>
    <form onSubmit={submit} className="username-form" data-testid="username-form">
      <input className="username-input" data-testid="username-input" autoFocus maxLength={16} placeholder="e.g. FrostAngler" value={name} onChange={e => { setName(e.target.value); setError(''); }}/>
      <Button type="submit" className="pixel-button" data-testid="username-submit-button" disabled={saving || !name}>{saving ? <Loader2 className="spin"/> : <UserRound/>}{saving ? 'Saving…' : 'Save & play'}<ArrowRight/></Button>
    </form>
    {error && <p role="alert" className="form-error" data-testid="username-error">{error}</p>}
    <p className="wallet-note" data-testid="username-note">3–16 characters · letters, numbers and _ · can't be changed later</p>
  </GameDialog>;
};
