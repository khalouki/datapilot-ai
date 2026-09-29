import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { format } from '@/lib/api';
import type { Visual, VisualResult } from '@/types/dashboard';
export function TableWidget({
  visual: v,
  result: r,
  onChange,
}: {
  visual: Visual;
  result: VisualResult;
  onChange: (patch: Partial<Visual>) => void;
}) {
  return (
    <div className="bi-table">
      <div className="bi-table-tools bi-edit-only">
        <label>
          <Search size={14} />
          <input
            aria-label={`Search ${v.title}`}
            placeholder="Search selected columns…"
            maxLength={200}
            value={v.search}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
          />
        </label>
        <select
          aria-label={`Page size ${v.title}`}
          value={v.page_size}
          onChange={(e) => onChange({ page_size: Number(e.target.value), page: 1 })}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} rows
            </option>
          ))}
        </select>
      </div>
      <div className="table-scroll" style={{ maxHeight: v.height + 60 }}>
        <table>
          <thead>
            <tr>
              {r.columns?.map((c) => (
                <th key={c}>
                  <button
                    onClick={() =>
                      onChange({
                        sort_column: c,
                        descending: v.sort_column === c ? !v.descending : false,
                        page: 1,
                      })
                    }
                  >
                    {c}
                    {v.sort_column === c &&
                      (v.descending ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.rows?.map((row, i) => (
              <tr key={i}>
                {r.columns?.map((c) => (
                  <td key={c}>
                    {row[c] == null ? (
                      <span className="null" aria-label="Missing value">NULL</span>
                    ) : typeof row[c] === 'number' ? (
                      format(row[c] as number, 4)
                    ) : (
                      String(row[c])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!r.rows?.length && <div className="bi-no-data">No matching rows.</div>}
      </div>
      <div className="bi-table-footer">
        <span>
          {format(r.total, 0)} matching rows · Page {r.page || 1} / {r.pages || 1}
        </span>
        <div className="bi-edit-only">
          <button
            className="icon-button"
            aria-label={`Previous page ${v.title}`}
            disabled={(r.page || 1) <= 1}
            onClick={() => onChange({ page: (r.page || 1) - 1 })}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            className="icon-button"
            aria-label={`Next page ${v.title}`}
            disabled={(r.page || 1) >= (r.pages || 1)}
            onClick={() => onChange({ page: (r.page || 1) + 1 })}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
