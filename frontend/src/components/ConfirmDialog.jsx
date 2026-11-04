import Modal from './Modal.jsx'

// Hộp xác nhận cho thao tác nguy hiểm (khóa, ngừng hoạt động, đóng lớp, đổi lớp...)
export default function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', danger, busy, error, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel} disabled={busy}>Hủy</button>
        <button type="button" className={`btn btn-sm ${danger ? 'btn-danger' : ''}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Đang xử lý...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
