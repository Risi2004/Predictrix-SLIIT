import { useEffect } from 'react';

export default function Toasts({ toasts, onDismissToast }) {
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        onDismissToast(t.id);
      }, 5200)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismissToast]);

  return (
    <div id="toasts" aria-live="polite">
      {toasts.slice(0, 3).map((t) => (
        <div key={t.id} className={`toast ${t.kind || ''}`}>
          <i />
          <div>
            <b>{t.title}</b>
            <span>{t.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
