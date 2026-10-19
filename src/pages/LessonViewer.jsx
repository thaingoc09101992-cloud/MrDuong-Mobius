import PdfViewer from './PdfViewer.jsx'
import EmbedViewer from './EmbedViewer.jsx'

/** Chọn trình xem theo nguồn của bài học: liên kết nhúng (Google Drive) hoặc file PDF trong kho. */
export default function LessonViewer({ lesson, onClose }) {
  return lesson.source_url ? <EmbedViewer lesson={lesson} onClose={onClose} /> : <PdfViewer lesson={lesson} onClose={onClose} />
}