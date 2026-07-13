import React, { useState, useRef, useEffect } from "react";
import "./styles.css";
import MathText from "./MathText";

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
  const cleanApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, "");
  const [file, setFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadIndex, setActiveUploadIndex] = useState<number | null>(null);
  const [imageUploading, setImageUploading] = useState<string | null>(null);
  const [isDeletingPaper, setIsDeletingPaper] = useState(false);
  const [manualSubjectId, setManualSubjectId] = useState("");

  // Academic Dropdown States
  const [universities, setUniversities] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  
  const [selUni, setSelUni] = useState("");
  const [selBranch, setSelBranch] = useState("");
  const [selSem, setSelSem] = useState("");

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("admin_auth_token");
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem("admin_auth_token");
      localStorage.removeItem("admin_name");
      window.location.reload();
    }
    return res;
  };

  useEffect(() => {
    authFetch(`${cleanApiBaseUrl}/academic/universities`)
      .then(res => res.json())
      .then(data => { if(data.success) setUniversities(data.universities); })
      .catch(console.error);
  }, [cleanApiBaseUrl]);

  useEffect(() => {
    setSelBranch(""); setSelSem(""); setManualSubjectId("");
    setBranches([]); setSemesters([]); setSubjects([]);
    if (selUni) {
      authFetch(`${cleanApiBaseUrl}/academic/branches?university_id=${selUni}`)
        .then(res => res.json())
        .then(data => { if(data.success) setBranches(data.branches); })
        .catch(console.error);
    }
  }, [selUni, cleanApiBaseUrl]);

  useEffect(() => {
    setSelSem(""); setManualSubjectId("");
    setSemesters([]); setSubjects([]);
    if (selBranch) {
      authFetch(`${cleanApiBaseUrl}/academic/semesters?branch_id=${selBranch}`)
        .then(res => res.json())
        .then(data => { if(data.success) setSemesters(data.semesters); })
        .catch(console.error);
    }
  }, [selBranch, cleanApiBaseUrl]);

  useEffect(() => {
    setManualSubjectId("");
    setSubjects([]);
    if (selSem && selBranch) {
      authFetch(`${cleanApiBaseUrl}/academic/subjects?branch_id=${selBranch}&semester_id=${selSem}`)
        .then(res => res.json())
        .then(data => { if(data.success) setSubjects(data.subjects); })
        .catch(console.error);
    }
  }, [selSem, selBranch, cleanApiBaseUrl]);
  const [paperTitle, setPaperTitle] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ExtractedQuestion>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setFile(selected);
      setPdfPreviewUrl(URL.createObjectURL(selected));
      setResult(null);
      setError(null);
      setPaperId(null);
    }
  };

  const handleExtract = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setPaperId(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await authFetch(`${cleanApiBaseUrl}/extract-questions`, {
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

  const uploadPdfToCloudinary = async () => {
    if (!file) return null;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await authFetch(`${cleanApiBaseUrl}/upload-paper-pdf`, {
        method: "POST",
        body: formData,
      });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.paper_url) {
          return uploadData.paper_url;
        }
      } else {
        console.error("Upload failed", await uploadRes.text());
      }
    } catch (err) {
      console.error("Failed to upload PDF to Cloudinary", err);
    }
    return null;
  };

  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const handleSaveEntirePaper = async () => {
    const effectiveSubjectId = selectedSubject?.subject_id || manualSubjectId.trim();
    if (!effectiveSubjectId) {
      alert("Please select a subject or enter a Subject ID first!");
      return;
    }
    
    if (!paperTitle.trim()) {
      alert("Please enter a Paper Title before uploading to the database!");
      return;
    }
    
    if (!result || !result.questions) return;
    
    setIsSavingBatch(true);
    
    try {
      const paperUrl = await uploadPdfToCloudinary();
      
      const batchQuestions = result.questions.map(q => {
        return {
          question: q.question,
          question_number: q.question_no + (q.sub_question || ""),
          marks: q.marks || 5,
          difficulty: "Easy",
          image_urls: q.image_urls,
          answer: null,
          analysis: null,
          skip_answer: true
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
      
      const response = await authFetch(`${cleanApiBaseUrl}/save-entire-paper`, {
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

  const handleDeletePaper = async () => {
    if (!paperId) return;
    if (!window.confirm("Are you sure you want to completely delete this uploaded paper and all its questions?")) return;
    setIsDeletingPaper(true);
    try {
      const res = await authFetch(`${cleanApiBaseUrl}/question-paper/${paperId}`, { method: "DELETE" });
      if (res.ok) {
        alert("Paper and questions deleted successfully!");
        setPaperId(null);
      } else {
        alert("Failed to delete paper.");
      }
    } catch (e) {
      alert("Error deleting paper.");
    } finally {
      setIsDeletingPaper(false);
    }
  };

  const handleDeleteImage = async (qIndex: number, imgUrl: string, imgIdx: number) => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;
    
    try {
      const res = await authFetch(`${cleanApiBaseUrl}/delete-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imgUrl })
      });
      if (res.ok) {
        setResult(prev => {
          if (!prev) return prev;
          const newQuestions = [...prev.questions];
          const updatedUrls = [...(newQuestions[qIndex].image_urls || [])];
          updatedUrls.splice(imgIdx, 1);
          newQuestions[qIndex].image_urls = updatedUrls;
          return { ...prev, questions: newQuestions };
        });
      } else {
        alert("Failed to delete image.");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting image.");
    }
  };

  const triggerImageUpload = (qIndex: number) => {
    setActiveUploadIndex(qIndex);
    if (imageInputRef.current) imageInputRef.current.click();
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeUploadIndex === null || !e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    await uploadImageFile(file, activeUploadIndex);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleImagePaste = async (e: React.ClipboardEvent, qIndex: number) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let imageFile = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    if (!imageFile) return; // If pasting text, let it happen normally
    
    e.preventDefault();
    await uploadImageFile(imageFile, qIndex);
  };

  const uploadImageFile = async (file: File, qIndex: number) => {
    if (!result || !result.questions[qIndex]) return;
    setImageUploading(result.questions[qIndex].question_key);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await authFetch(`${cleanApiBaseUrl}/upload-image`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        setResult(prev => {
          if (!prev) return prev;
          const newQuestions = [...prev.questions];
          newQuestions[qIndex].image_urls = [...(newQuestions[qIndex].image_urls || []), data.url];
          return { ...prev, questions: newQuestions };
        });
      } else {
        alert("Failed to upload image.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading image.");
    } finally {
      setImageUploading(null);
      setActiveUploadIndex(null);
    }
  };




  return (
    <div className="pdf-extractor-container" style={{ padding: "24px", maxWidth: pdfPreviewUrl ? "100%" : "900px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #eaeaea" }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", color: "#111" }}>PDF Question Extractor</h1>
        <p style={{ margin: 0, color: "#666" }}>Upload a question paper PDF to extract text and diagrams.</p>
        {!selectedSubject && (
          <div style={{ marginTop: "12px", padding: "16px", backgroundColor: "#f8fafc", color: "#334155", borderRadius: "6px", fontSize: "14px", border: "1px solid #cbd5e1" }}>
            <strong style={{ display: "block", marginBottom: "8px" }}>Academic Subject Selection</strong>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "140px" }}>
                <select value={selUni} onChange={e => setSelUni(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", backgroundColor: "#fff" }}>
                  <option value="">Select University</option>
                  {universities.map(u => <option key={u.university_id} value={u.university_id}>{u.university_name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: "140px" }}>
                <select value={selBranch} onChange={e => setSelBranch(e.target.value)} disabled={!selUni} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", backgroundColor: "#fff" }}>
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: "140px" }}>
                <select value={selSem} onChange={e => setSelSem(e.target.value)} disabled={!selBranch} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", backgroundColor: "#fff" }}>
                  <option value="">Select Semester</option>
                  {semesters.map(s => <option key={s.semester_id} value={s.semester_id}>Sem {s.semester_number}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: "140px" }}>
                <select value={manualSubjectId} onChange={e => setManualSubjectId(e.target.value)} disabled={!selSem} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", backgroundColor: "#fff" }}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name} ({s.subject_code})</option>)}
                </select>
              </div>
            </div>
            <input 
              type="text" 
              placeholder="Paper Title (e.g. Midterm 2024)" 
              value={paperTitle}
              onChange={(e) => setPaperTitle(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "4px", border: "1px solid #cbd5e1", backgroundColor: "#fff" }}
            />
          </div>
        )}
      </header>

      <div className={`pdf-extractor-layout ${pdfPreviewUrl ? 'has-pdf' : ''}`}>
        
        {/* LEFT COLUMN: Extraction UI */}
        <div className="pdf-extractor-left">
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
          {/* Hidden file input for image upload */}
          <input 
            type="file" 
            ref={imageInputRef} 
            style={{ display: "none" }} 
            accept="image/*" 
            onChange={handleImageSelect} 
          />
          <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "24px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: "0 0 12px 0" }}>Extraction Summary</h3>
              <div style={{ display: "flex", gap: "24px", color: "#475569" }}>
                <span><strong>Pages:</strong> {result.paper.total_pages}</span>
                <span><strong>Questions:</strong> {result.paper.total_questions}</span>
                <span><strong>Diagrams:</strong> {result.paper.total_diagrams}</span>
              </div>
            </div>
          </div>
          
          {paperId && !isSavingBatch && (
            <div style={{ padding: "16px", backgroundColor: "#fef2f2", borderRadius: "6px", marginBottom: "24px", border: "1px solid #fca5a5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", color: "#991b1b" }}>Paper Uploaded Successfully!</h3>
                <p style={{ margin: 0, color: "#b91c1c", fontSize: "14px" }}>The question paper and all questions are saved in the database.</p>
              </div>
              <button 
                onClick={handleDeletePaper}
                disabled={isDeletingPaper}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: isDeletingPaper ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  boxShadow: "0 2px 4px rgba(220, 38, 38, 0.3)",
                  transition: "all 0.2s"
                }}
              >
                {isDeletingPaper ? "Deleting..." : "Undo Upload (Delete Paper)"}
              </button>
            </div>
          )}

          {!paperId && !isSavingBatch && (
            <div style={{ padding: "16px", backgroundColor: "#ecfdf5", borderRadius: "6px", marginBottom: "24px", border: "1px solid #10b981", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", color: "#065f46" }}>Extraction Complete!</h3>
                <p style={{ margin: 0, color: "#047857", fontSize: "14px" }}>Ready to upload the question paper and questions to the database.</p>
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
                
                <div 
                  tabIndex={0}
                  onPaste={(e) => handleImagePaste(e, idx)}
                  style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", outline: "none" }}
                >
                  {editingKey === q.question_key ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "16px", backgroundColor: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)" }}>
                      <div style={{ display: "flex", gap: "16px" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>Question No</label>
                          <input 
                            type="text" 
                            value={editForm.question_no || ""} 
                            onChange={(e) => setEditForm({...editForm, question_no: e.target.value})}
                            style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", outline: "none", transition: "all 0.2s" }}
                            onFocus={(e) => { e.target.style.borderColor = "#0284c7"; e.target.style.boxShadow = "0 0 0 3px rgba(2, 132, 199, 0.1)"; }}
                            onBlur={(e) => { e.target.style.borderColor = "#cbd5e1"; e.target.style.boxShadow = "none"; }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>Sub-question</label>
                          <input 
                            type="text" 
                            value={editForm.sub_question || ""} 
                            onChange={(e) => setEditForm({...editForm, sub_question: e.target.value})}
                            style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", outline: "none", transition: "all 0.2s" }}
                            onFocus={(e) => { e.target.style.borderColor = "#0284c7"; e.target.style.boxShadow = "0 0 0 3px rgba(2, 132, 199, 0.1)"; }}
                            onBlur={(e) => { e.target.style.borderColor = "#cbd5e1"; e.target.style.boxShadow = "none"; }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>Marks</label>
                          <input 
                            type="number" 
                            value={editForm.marks || ""} 
                            onChange={(e) => setEditForm({...editForm, marks: parseInt(e.target.value) || 0})}
                            style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", outline: "none", transition: "all 0.2s" }}
                            onFocus={(e) => { e.target.style.borderColor = "#0284c7"; e.target.style.boxShadow = "0 0 0 3px rgba(2, 132, 199, 0.1)"; }}
                            onBlur={(e) => { e.target.style.borderColor = "#cbd5e1"; e.target.style.boxShadow = "none"; }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>Question Text</label>
                        <textarea 
                          value={editForm.question || ""} 
                          onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                          style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", minHeight: "120px", resize: "vertical", outline: "none", transition: "all 0.2s" }}
                          onFocus={(e) => { e.target.style.borderColor = "#0284c7"; e.target.style.boxShadow = "0 0 0 3px rgba(2, 132, 199, 0.1)"; }}
                          onBlur={(e) => { e.target.style.borderColor = "#cbd5e1"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                      
                      <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <button
                            onClick={() => triggerImageUpload(idx)}
                            disabled={imageUploading === q.question_key}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: "#fff",
                              color: "#0284c7",
                              border: "1px solid #0284c7",
                              borderRadius: "6px",
                              cursor: imageUploading === q.question_key ? "not-allowed" : "pointer",
                              fontWeight: 600,
                              fontSize: "13px",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                              transition: "all 0.2s"
                            }}
                            title="Or you can click anywhere in this question box and press Ctrl+V to paste a screenshot"
                            onMouseOver={(e) => { if (imageUploading !== q.question_key) e.currentTarget.style.backgroundColor = "#f0f9ff"; }}
                            onMouseOut={(e) => { if (imageUploading !== q.question_key) e.currentTarget.style.backgroundColor = "#fff"; }}
                          >
                            {imageUploading === q.question_key ? "Uploading..." : "+ Add Image"}
                          </button>
                          <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>(Or press Ctrl+V to paste screenshot)</span>
                        </div>
                        <div style={{ display: "flex", gap: "12px" }}>
                          <button 
                            onClick={handleEditCancel}
                            style={{ padding: "8px 20px", backgroundColor: "#fff", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "14px", transition: "all 0.2s" }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#fff"}
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => handleEditSave(q.question_key)}
                            style={{ padding: "8px 20px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "14px", boxShadow: "0 2px 4px rgba(2, 132, 199, 0.2)", transition: "all 0.2s" }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#0369a1"}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#0284c7"}
                          >
                            Save Changes
                          </button>
                        </div>
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
                          <button 
                            onClick={() => handleEditStart(q)}
                            style={{ border: "none", background: "none", color: "#64748b", cursor: "pointer", fontSize: "14px", textDecoration: "underline" }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ margin: "0 0 16px 0", color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                        <MathText text={q.question} />
                      </div>
                    </>
                  )}

                  {q.image_urls && q.image_urls.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "16px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                      {q.image_urls.map((url, imgIdx) => (
                        <div key={imgIdx} style={{ position: "relative", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "4px", backgroundColor: "#f8fafc", display: "inline-block", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                          <img 
                            src={url} 
                            alt={`Diagram for Q${q.question_no}${q.sub_question}`}
                            style={{ maxHeight: "200px", maxWidth: "100%", objectFit: "contain", display: "block", borderRadius: "4px" }}
                          />
                          <button
                            onClick={() => handleDeleteImage(idx, url, imgIdx)}
                            style={{
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              background: "rgba(220, 38, 38, 0.9)",
                              color: "white",
                              border: "none",
                              borderRadius: "50%",
                              width: "24px",
                              height: "24px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "bold",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                              transition: "transform 0.2s"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                            onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                            title="Delete Image"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </React.Fragment>
            ))}
            
            <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
              <button
                onClick={handleAddQuestion}
                disabled={editingKey !== null}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#fff",
                  color: (editingKey !== null) ? "#94a3b8" : "#3b82f6",
                  border: `1px dashed ${(editingKey !== null) ? "#cbd5e1" : "#3b82f6"}`,
                  borderRadius: "6px",
                  cursor: (editingKey !== null) ? "not-allowed" : "pointer",
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
        <div className="pdf-extractor-right">
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
