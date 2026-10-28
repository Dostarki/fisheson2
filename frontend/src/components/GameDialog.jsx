import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
export const GameDialog = ({ open, onClose, title, subtitle, className='', children, id }) => <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
  <DialogContent className={`game-dialog ${className}`} data-testid={`${id}-dialog`} onCloseAutoFocus={event=>event.preventDefault()}>
    <div className="dialog-heading"><span className="dialog-eyebrow" data-testid={`${id}-eyebrow`}>FROSTFISH · ROBINHOOD CHAIN</span><DialogTitle className="dialog-title" data-testid={`${id}-title`}>{title}</DialogTitle><DialogDescription className="dialog-subtitle" data-testid={`${id}-description`}>{subtitle}</DialogDescription></div>
    {children}
  </DialogContent>
</Dialog>;