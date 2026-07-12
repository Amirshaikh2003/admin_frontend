import React, { useState, useEffect } from "react";

// A wrapper for fetch that includes auth headers, similar to what PDFQuestionExtractorGui uses
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("admin_auth_token");
  const headers = {
    ...options.headers,
    "Authorization": `Bearer ${token}`
  };
  return fetch(url, { ...options, headers });
};

export default function ManageQuestionPapers() {
  const [papers, setPapers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPapers = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/question-paper/list");
      if (!res.ok) throw new Error("Failed to fetch papers");
      const data = await res.json();
      setPapers(data.papers || []);
    } catch (err) {
      console.error("Failed to fetch papers", err);
    } finally {
      setLoading(false);
    }
  };

  const deletePaper = async (paperId: string, paperTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${paperTitle}"? This will permanently delete the paper and all its questions.`)) return;

    try {
      const res = await fetchWithAuth(`/api/question-paper/${paperId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete paper");
      alert("Paper deleted successfully!");
      fetchPapers(); // Refresh the list
    } catch (err) {
      alert("Error deleting paper");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  const filteredPapers = papers.filter(p => 
    p.paper_title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: '#fff' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Manage Question Papers</h2>
      
      <input 
        type="text" 
        placeholder="Search question paper by name..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          color: 'white',
          borderRadius: '6px'
        }}
      />

      {loading ? (
        <p>Loading papers...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {filteredPapers.map(paper => (
            <div key={paper.paper_id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              backgroundColor: '#1f2937',
              borderRadius: '8px',
              border: '1px solid #374151'
            }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>{paper.paper_title}</h3>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>
                  {paper.subjects?.subject_name} | {paper.exam_type} | {paper.year}
                </p>
              </div>
              <button 
                onClick={() => deletePaper(paper.paper_id, paper.paper_title)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Delete
              </button>
            </div>
          ))}
          {filteredPapers.length === 0 && <p>No papers found matching your search.</p>}
        </div>
      )}
    </div>
  );
}
