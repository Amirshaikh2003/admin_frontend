import PDFQuestionExtractorGui from "./PDFQuestionExtractorGui";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-title">
          <span>CU</span>
          <div>
            <h1>Climbup Admin</h1>
            <p>Manage academic data, extract questions, and save answers</p>
          </div>
        </div>
      </header>

      <PDFQuestionExtractorGui selectedSubject={null} />
    </div>
  );
}
