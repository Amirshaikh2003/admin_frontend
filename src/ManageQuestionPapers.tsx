import React, { useState, useEffect } from "react";

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

  // Hierarchy States
  const [universities, setUniversities] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [selUni, setSelUni] = useState("");
  const [selBranch, setSelBranch] = useState("");
  const [selSem, setSelSem] = useState("");
  const [selSub, setSelSub] = useState("");

  const cleanApiBaseUrl = "/api";

  const fetchPapers = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${cleanApiBaseUrl}/question-paper/list`);
      if (!res.ok) throw new Error("Failed to fetch papers");
      const data = await res.json();
      setPapers(data.papers || []);
    } catch (err) {
      console.error("Failed to fetch papers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  // Fetch Hierarchy
  useEffect(() => {
    fetchWithAuth(`${cleanApiBaseUrl}/academic/universities`)
      .then(res => res.json())
      .then(data => { if(data.success) setUniversities(data.universities); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setSelBranch(""); setSelSem(""); setSelSub("");
    setBranches([]); setSemesters([]); setSubjects([]);
    if (selUni) {
      fetchWithAuth(`${cleanApiBaseUrl}/academic/branches?university_id=${selUni}`)
        .then(res => res.json())
        .then(data => { if(data.success) setBranches(data.branches); })
        .catch(console.error);
    }
  }, [selUni]);

  useEffect(() => {
    setSelSem(""); setSelSub("");
    setSemesters([]); setSubjects([]);
    if (selBranch) {
      fetchWithAuth(`${cleanApiBaseUrl}/academic/semesters?branch_id=${selBranch}`)
        .then(res => res.json())
        .then(data => { if(data.success) setSemesters(data.semesters); })
        .catch(console.error);
    }
  }, [selBranch]);

  useEffect(() => {
    setSelSub("");
    setSubjects([]);
    if (selSem && selBranch) {
      fetchWithAuth(`${cleanApiBaseUrl}/academic/subjects?branch_id=${selBranch}&semester_id=${selSem}`)
        .then(res => res.json())
        .then(data => { if(data.success) setSubjects(data.subjects); })
        .catch(console.error);
    }
  }, [selSem, selBranch]);

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

  // Filter papers based on text search AND selected hierarchy (if any)
  const filteredPapers = papers.filter(p => {
    const matchesSearch = p.paper_title?.toLowerCase().includes(search.toLowerCase());
    
    let matchesSubject = true;
    if (selSub) {
      matchesSubject = p.subject_id === selSub;
    } else if (selSem && selBranch && subjects.length > 0) {
      matchesSubject = subjects.some(s => s.subject_id === p.subject_id);
    }
    
    return matchesSearch && matchesSubject;
  });

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: '#fff' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Manage Question Papers</h2>
      
      {/* Hierarchy Selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#9ca3af' }}>University</label>
          <select value={selUni} onChange={e => setSelUni(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }}>
            <option value="">-- All Universities --</option>
            {universities.map(u => <option key={u.university_id} value={u.university_id}>{u.university_name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#9ca3af' }}>Branch</label>
          <select value={selBranch} onChange={e => setSelBranch(e.target.value)} disabled={!selUni} style={{ width: '100%', padding: '10px', backgroundColor: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }}>
            <option value="">-- All Branches --</option>
            {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#9ca3af' }}>Semester</label>
          <select value={selSem} onChange={e => setSelSem(e.target.value)} disabled={!selBranch} style={{ width: '100%', padding: '10px', backgroundColor: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }}>
            <option value="">-- All Semesters --</option>
            {semesters.map(s => <option key={s.semester_id} value={s.semester_id}>Semester {s.semester_number}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#9ca3af' }}>Subject (Filter)</label>
          <select value={selSub} onChange={e => setSelSub(e.target.value)} disabled={!selSem} style={{ width: '100%', padding: '10px', backgroundColor: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }}>
            <option value="">-- Filter by Subject --</option>
            {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}
          </select>
        </div>
      </div>

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
          {filteredPapers.length === 0 && <p>No papers found matching your filters.</p>}
        </div>
      )}
    </div>
  );
}
