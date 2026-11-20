export const SOURCE = 'https://github.com/sshikora/crypto-analytics/blob/master';

export function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            {head.map(h => (
              <th key={h} className="pr-4 py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row[0]} className="border-t border-gray-100">
              {row.map((cell, i) => (
                <td key={i} className="pr-4 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold text-gray-900 pt-4">{children}</h2>;
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-primary-600 hover:text-primary-700">
      {children}
    </a>
  );
}
