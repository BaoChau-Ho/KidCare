export default function Pagination({ pageInfo, onChange }) {
  if (!pageInfo) return null
  const { page, totalPages, totalItems } = pageInfo
  return (
    <div className="pager">
      <span className="muted">
        {totalItems === 0 ? 'Không có kết quả' : `Trang ${page}/${totalPages} (${totalItems} kết quả)`}
      </span>
      {totalPages > 1 && (
        <div className="actions">
          <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trang trước</button>
          <button className="btn btn-sm btn-ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Trang sau</button>
        </div>
      )}
    </div>
  )
}
