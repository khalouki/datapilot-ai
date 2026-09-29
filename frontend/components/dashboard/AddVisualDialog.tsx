import { X, BarChart3, Table, Hash } from 'lucide-react';
import { typeNames, visualTypes } from '@/lib/dashboard/dashboardConfig';
import type { VisualType } from '@/types/dashboard';
export function AddVisualDialog({
  onAdd,
  onClose,
}: {
  onAdd: (t: VisualType) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="modal bi-add-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add a visual"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Add a visual</h2>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close visual picker"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div>
          {visualTypes.map((t) => (
            <button className="bi-visual-choice" key={t} onClick={() => onAdd(t)}>
              {t === 'kpi' ? (
                <Hash size={19} />
              ) : t === 'table' ? (
                <Table size={19} />
              ) : (
                <BarChart3 size={19} />
              )}
              <span>{typeNames[t]}</span>
            </button>
          ))}
        </div>
        <p className="caption">Every visual uses the active working dataset and shared filters.</p>
      </div>
    </div>
  );
}
