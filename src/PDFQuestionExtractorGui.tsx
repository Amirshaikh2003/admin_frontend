import React, { useState, useRef } from "react";
import "./styles.css";

type ExtractedQuestion = {
  page: number;
  question_no: string;
  sub_question: string;
  question_key: string;
  question: string;
  marks: number;
  has_or_before: boolean;
  image_urls: string[];
};

type ExtractedPaper = {
  source_pdf: string;
  total_pages: number;
  total_questions: number;
  total_diagrams: number;
};

type ExtractionResult = {
  paper: ExtractedPaper;
  questions: ExtractedQuestion[];
};

type AnswerStatus = "idle" | "loading" | "success" | "error";
type AnswerData = {
  status: AnswerStatus;
  text?: string;
  error?: string;
  fullAnswer?: any;
  analysis?: any;
};

type PDFQuestionExtractorGuiProps = {
  apiBaseUrl?: string;
  selectedSubject?: any;
};

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export default function PDFQuestionExtractorGui({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  selectedSubject,
}: PDFQuestionExtractorGuiProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerData>>({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [manualSubjectId, setManualSubjectId] = useState("");
  const [paperTitle, setPaperTitle] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ExtractedQuestion>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cleanApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, "");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setFile(selected);
      setPdfPreviewUrl(URL.createObjectURL(selected));
      setResult(null);
      setError(null);
      setPaperId(null);
      setAnswers({});
      setIsGeneratingAll(false);
    }
  };

  const handleExtract = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setPaperId(null);
    setAnswers({});
    setIsGeneratingAll(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${cleanApiBaseUrl}/extract-questions`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }

      const data = await response.json();
      if (data.success && data.questions) {
        setResult({
          paper: data.paper,
          questions: data.questions,
        });

        const effectiveSubjectId = selectedSubject?.subject_id || manualSubjectId.trim();
        // Removed lazy background paper creation. We will strictly create the paper 
        // (and upload the PDF to Cloudinary) only when the user decides to Generate.
      } else {
        throw new Error("Invalid response format from server.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to extract questions");
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (q: ExtractedQuestion) => {
    setEditingKey(q.question_key);
    setEditForm({ ...q });
  };

  const handleEditCancel = () => {
    setEditingKey(null);
    setEditForm({});
  };

  const handleEditSave = (originalKey: string) => {
    if (!result || !result.questions) return;
    setResult({
      ...result,
      questions: result.questions.map(q => 
        q.question_key === originalKey ? { ...q, ...editForm } as ExtractedQuestion : q
      )
    });
    setEditingKey(null);
    setEditForm({});
  };

  const handleAddQuestion = () => {
    if (!result) return;
    const newKey = `manual-${Date.now()}`;
    const newQuestion: ExtractedQuestion = {
      page: result.paper.total_pages || 1,
      question_no: "",
      sub_question: "",
      question_key: newKey,
      question: "",
      marks: 5,
      has_or_before: false,
      image_urls: []
    };
    setResult({
      ...result,
      questions: [...result.questions, newQuestion]
    });
    setEditingKey(newKey);
    setEditForm({ ...newQuestion });
  };

  const ensurePaperId = async () => {
    if (paperId) return paperId;

    const effectiveSubjectId = selectedSubject?.subject_id || manualSubjectId.trim();
    if (!effectiveSubjectId) {
      alert("Please select a subject from the Academic Import tab or enter a Subject ID before processing questions!");
      return null;
    }

    let uploadedPaperUrl = pdfPreviewUrl || undefined;
    if (file && !pdfPreviewUrl) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch(`${cleanApiBaseUrl}/upload-paper-pdf`, {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.paper_url) {
            uploadedPaperUrl = uploadData.paper_url;
          }
        } else {
          console.error("Upload failed", await uploadRes.text());
        }
      } catch (err) {
        console.error("Failed to upload PDF to Cloudinary", err);
      }
    }

    return uploadedPaperUrl;
  };

  const processSingleQuestion = async (q: ExtractedQuestion) => {
    const key = `${q.question_key}`;
    setAnswers(prev => ({ ...prev, [key]: { status: "loading" } }));
    
    const isImageQuestion = q.image_urls && q.image_urls.length > 0;

    let attempt = 0;
    const maxRetries = 3;
    
    while (attempt < maxRetries) {
      try {
        const payload: any = {
          question: q.question,
          question_number: q.question_no + (q.sub_question || ""),
          marks: q.marks || 5
        };

        if (isImageQuestion) {
          payload.skip_answer = true;
          payload.image_urls = q.image_urls;
        }

        const response = await fetch(`${cleanApiBaseUrl}/generate-only`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
           if (response.status === 429) {
             throw new Error("Rate limit exceeded");
           }
           throw new Error("Failed to process question");
        }
        
        const data = await response.json();
        const successMsg = isImageQuestion 
          ? "Question processed locally. (AI generation skipped for images)" 
          : "Answer generated successfully locally.";

        setAnswers(prev => ({ 
          ...prev, 
          [key]: { 
            status: "success", 
            text: successMsg,
            fullAnswer: data.answer,
            analysis: data.analysis
          } 
        }));
        
        return; // Success, exit loop
        
      } catch (err: any) {
        attempt++;
        if (attempt >= maxRetries) {
          setAnswers(prev => ({ 
            ...prev, 
            [key]: { status: "error", error: err.message } 
          }));
        } else {
          // Update status to show it's retrying
          setAnswers(prev => ({ 
            ...prev, 
            [key]: { status: "loading", text: `Retrying (${attempt}/${maxRetries})...` } 
          }));
          // Wait a bit before retrying, increasing wait time each attempt
          await new Promise(r => setTimeout(r, attempt * 2000));
        }
      }
    }
  };

  const handleGenerateAnswer = async (q: ExtractedQuestion) => {
    await processSingleQuestion(q);
  };

  const handleGenerateAll = async () => {
    if (!result || !result.questions) return;
    
    setIsGeneratingAll(true);
    
    const CONCURRENCY_LIMIT = 4;
    const questionsToProcess = result.questions.filter(q => answers[`${q.question_key}`]?.status !== "success");
    
    for (let i = 0; i < questionsToProcess.length; i += CONCURRENCY_LIMIT) {
      const chunk = questionsToProcess.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(chunk.map(q => processSingleQuestion(q)));
    }
    
    setIsGeneratingAll(false);
  };

  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const handleSaveEntirePaper = async () => {
    const effectiveSubjectId = selectedSubject?.subject_id || manualSubjectId.trim();
    if (!effectiveSubjectId) {
      alert("Please select a subject or enter a Subject ID first!");
      return;
    }
    
    if (!result || !result.questions) return;
    
    setIsSavingBatch(true);
    
    try {
      const paperUrl = await ensurePaperId();
      
      const batchQuestions = result.questions.map(q => {
        const key = `${q.question_key}`;
        const ansData = answers[key];
        
        return {
          question: q.question,
          question_number: q.question_no + (q.sub_question || ""),
          marks: q.marks || 5,
          difficulty: "Easy",
          image_urls: q.image_urls,
          answer: ansData?.fullAnswer || null,
          analysis: ansData?.analysis || null,
          skip_answer: Boolean(!ansData?.fullAnswer && q.image_urls && q.image_urls.length > 0)
        };
      });
      
      const payload = {
        subject_id: effectiveSubjectId,
        paper_title: paperTitle.trim() || "Untitled Paper",
        year: new Date().getFullYear(),
        exam_type: "Extraction",
        duration: 180,
        total_marks: 80,
        paper_url: paperUrl,
        questions: batchQuestions
      };
      
      const response = await fetch(`${cleanApiBaseUrl}/save-entire-paper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        let errorMsg = "Failed to save paper to database";
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || JSON.stringify(errorData);
        } catch (e) {}
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      alert(`Success! Entire paper uploaded. Saved ${data.total_questions_saved} questions.`);
      setPaperId(data.paper_id);
    } catch (e: any) {
      alert("Error saving paper: " + e.message);
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Check if all questions are successfully generated
  const allQuestionsSuccess = result?.questions.every(q => answers[`${q.question_key}`]?.status === "success") ?? false;


  return (
    <div className="pdf-extractor-container" style={{ padding: "24px", maxWidth: pdfPreviewUrl ? "100%" : "900px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #eaeaea" }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", color: "#111" }}>PDF Question Extractor</h1>
        <p style={{ margin: 0, color: "#666" }}>Upload a question paper PDF to extract text and diagrams.</p>
        {!selectedSubject && (
          <div style={{ marginTop: "12px", padding: "16px", backgroundColor: "#fffbeb", color: "#b45309", borderRadius: "6px", fontSize: "14px", border: "1px solid #fef3c7" }}>
            <strong style={{ display: "block", marginBottom: "8px" }}>Note: Select a subject from the "Academic Import" tab OR enter a Subject ID below to enable Answer Generation.</strong>
            <input 
              type="text" 
              placeholder="Paste Subject ID (UUID) here..." 
              value={manualSubjectId}
              onChange={(e) => setManualSubjectId(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "4px", border: "1px solid #fcd34d", backgroundColor: "#fff", marginBottom: "8px" }}
            />
            <input 
              type="text" 
              placeholder="Paper Title (e.g. Midterm 2024)" 
              value={paperTitle}
              onChange={(e) => setPaperTitle(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "4px", border: "1px solid #fcd34d", backgroundColor: "#fff" }}
            />
          </div>
        )}
      </header>

      <div style={{ display: "flex", gap: "24px", flexDirection: pdfPreviewUrl ? "row" : "column", alignItems: "flex-start" }}>
        
        {/* LEFT COLUMN: Extraction UI */}
        <div style={{ flex: "1", minWidth: "50%", width: pdfPreviewUrl ? "50%" : "100%" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "24px" }}>
            <input 
              type="file" 
              accept="application/pdf"
              onChange={handleFileChange}
          ref={fileInputRef}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            flex: "1"
          }}
        />
        <button 
          onClick={handleExtract}
          disabled={!file || loading}
          style={{
            padding: "10px 20px",
            backgroundColor: !file || loading ? "#ccc" : "#0066ff",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: !file || loading ? "not-allowed" : "pointer",
            fontWeight: 600,
            transition: "background-color 0.2s"
          }}
        >
          {loading ? "Extracting..." : "Extract"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "16px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "24px" }}>
          <strong>Error: </strong> {error}
        </div>
      )}

      {result && (
        <div>
          <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "24px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: "0 0 12px 0" }}>Extraction Summary</h3>
              <div style={{ display: "flex", gap: "24px", color: "#475569" }}>
                <span><strong>Pages:</strong> {result.paper.total_pages}</span>
                <span><strong>Questions:</strong> {result.paper.total_questions}</span>
                <span><strong>Diagrams:</strong> {result.paper.total_diagrams}</span>
              </div>
            </div>
            
            <button 
              onClick={handleGenerateAll}
              disabled={isGeneratingAll}
              style={{
                padding: "12px 24px",
                backgroundColor: isGeneratingAll ? "#ccc" : "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isGeneratingAll ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "15px",
                transition: "all 0.2s"
              }}
            >
              {isGeneratingAll ? "Processing Missing..." : "Process Missing Answers"}
            </button>
          </div>
          
          {allQuestionsSuccess && !isSavingBatch && (
            <div style={{ padding: "16px", backgroundColor: "#ecfdf5", borderRadius: "6px", marginBottom: "24px", border: "1px solid #10b981", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", color: "#065f46" }}>All Answers Generated!</h3>
                <p style={{ margin: 0, color: "#047857", fontSize: "14px" }}>Ready to safely upload the complete paper to the database.</p>
              </div>
              <button 
                onClick={handleSaveEntirePaper}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "15px",
                  boxShadow: "0 2px 4px rgba(5, 150, 105, 0.3)",
                  transition: "all 0.2s"
                }}
              >
                Upload Entire Paper to Database
              </button>
            </div>
          )}
          
          {isSavingBatch && (
            <div style={{ padding: "16px", backgroundColor: "#eff6ff", borderRadius: "6px", marginBottom: "24px", border: "1px solid #3b82f6", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div style={{ color: "#1d4ed8", fontWeight: 600, fontSize: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <span className="spinner"></span> Uploading entire paper to database... Please wait...
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {result.questions.map((q, idx) => (
              <React.Fragment key={`${q.question_key}-${idx}`}>
                {q.has_or_before && (
                  <div style={{ textAlign: "center", margin: "16px 0", color: "#64748b", fontWeight: "bold", position: "relative" }}>
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px solid #cbd5e1", zIndex: 1 }}></div>
                    <span style={{ position: "relative", zIndex: 2, backgroundColor: "#fff", padding: "0 16px" }}>OR</span>
                  </div>
                )}
                
                <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  
                  {editingKey === q.question_key ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Question No</label>
                          <input 
                            type="text" 
                            value={editForm.question_no || ""} 
                            onChange={(e) => setEditForm({...editForm, question_no: e.target.value})}
                            style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Sub-question</label>
                          <input 
                            type="text" 
                            value={editForm.sub_question || ""} 
                            onChange={(e) => setEditForm({...editForm, sub_question: e.target.value})}
                            style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Marks</label>
                          <input 
                            type="number" 
                            value={editForm.marks || ""} 
                            onChange={(e) => setEditForm({...editForm, marks: parseInt(e.target.value) || 0})}
                            style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Question Text</label>
                        <textarea 
                          value={editForm.question || ""} 
                          onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                          style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px", minHeight: "100px", resize: "vertical" }}
                        />
                      </div>
                      
                      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                        <button 
                          onClick={handleEditCancel}
                          style={{ padding: "6px 12px", backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleEditSave(q.question_key)}
                          style={{ padding: "6px 12px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: 500 }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                        <h4 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>
                          Q{q.question_no}{q.sub_question && `(${q.sub_question})`}
                        </h4>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {q.marks != null && (
                            <span style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "4px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" }}>
                              {q.marks} Marks
                            </span>
                          )}
                          {!answers[q.question_key] && (
                            <button 
                              onClick={() => handleEditStart(q)}
                              style={{ border: "none", background: "none", color: "#64748b", cursor: "pointer", fontSize: "14px", textDecoration: "underline" }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <p style={{ margin: "0 0 16px 0", color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                        {q.question}
                      </p>
                    </>
                  )}

                  {q.image_urls && q.image_urls.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "16px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                      {q.image_urls.map((url, imgIdx) => (
                        <div key={imgIdx} style={{ border: "1px solid #e2e8f0", borderRadius: "4px", padding: "4px", backgroundColor: "#f8fafc" }}>
                          <img 
                            src={url} 
                            alt={`Diagram for Q${q.question_no}${q.sub_question}`}
                            style={{ maxHeight: "200px", maxWidth: "100%", objectFit: "contain" }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Processing Block */}
                  <div style={{ marginTop: "24px", borderTop: "1px dashed #cbd5e1", paddingTop: "16px" }}>
                    {!answers[q.question_key] && (
                      <button 
                        onClick={() => handleGenerateAnswer(q)}
                        disabled={isGeneratingAll || (!selectedSubject && !manualSubjectId.trim())}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: (!isGeneratingAll && (selectedSubject || manualSubjectId.trim())) ? "#f1f5f9" : "#e2e8f0",
                          color: (!isGeneratingAll && (selectedSubject || manualSubjectId.trim())) ? "#334155" : "#94a3b8",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          cursor: (!isGeneratingAll && (selectedSubject || manualSubjectId.trim())) ? "pointer" : "not-allowed",
                          fontWeight: 500
                        }}
                      >
                        {q.image_urls && q.image_urls.length > 0 ? "Store Question to Database" : "Generate Answer"}
                      </button>
                    )}

                    {answers[q.question_key]?.status === "loading" && (
                      <div style={{ color: "#0284c7", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="spinner"></span> Processing...
                      </div>
                    )}

                    {answers[q.question_key]?.status === "error" && (
                      <div style={{ color: "#dc2626", fontWeight: 500, backgroundColor: "#fef2f2", padding: "12px", borderRadius: "6px", border: "1px solid #fecaca" }}>
                        Error: {answers[q.question_key].error}
                        <button onClick={() => handleGenerateAnswer(q)} style={{ marginLeft: "12px", border: "none", background: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}>Retry</button>
                      </div>
                    )}

                    {answers[q.question_key]?.status === "success" && (
                      <div style={{ backgroundColor: (q.image_urls && q.image_urls.length > 0) ? "#fffbeb" : "#f0fdf4", padding: "16px", borderRadius: "6px", border: `1px solid ${(q.image_urls && q.image_urls.length > 0) ? "#fde68a" : "#bbf7d0"}` }}>
                        <h5 style={{ margin: "0 0 8px 0", color: (q.image_urls && q.image_urls.length > 0) ? "#b45309" : "#166534" }}>
                          {(q.image_urls && q.image_urls.length > 0) ? "Question Stored Successfully" : "Generated Answer Saved"}
                        </h5>
                        <p style={{ margin: 0, color: (q.image_urls && q.image_urls.length > 0) ? "#92400e" : "#15803d", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
                          {answers[q.question_key].text}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ))}
            
            <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
              <button
                onClick={handleAddQuestion}
                disabled={editingKey !== null || isGeneratingAll}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#fff",
                  color: (editingKey !== null || isGeneratingAll) ? "#94a3b8" : "#3b82f6",
                  border: `1px dashed ${(editingKey !== null || isGeneratingAll) ? "#cbd5e1" : "#3b82f6"}`,
                  borderRadius: "6px",
                  cursor: (editingKey !== null || isGeneratingAll) ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  transition: "all 0.2s"
                }}
              >
                + Add Missing Question
              </button>
            </div>
          </div>
        </div>
      )}
      </div> {/* End Left Column */}

      {/* RIGHT COLUMN: PDF Preview */}
      {pdfPreviewUrl && (
        <div style={{ flex: "1", height: "calc(100vh - 100px)", position: "sticky", top: "24px", minWidth: "40%", width: "50%", border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden", backgroundColor: "#f8fafc" }}>
          <iframe 
            src={pdfPreviewUrl} 
            width="100%" 
            height="100%" 
            style={{ border: "none", display: "block" }}
            title="PDF Preview"
          />
        </div>
      )}
      
      </div> {/* End Flex Container */}
    </div>
  );
}
