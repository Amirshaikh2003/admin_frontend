import React, { useState, useEffect } from "react";
import PDFQuestionExtractorGui from "./PDFQuestionExtractorGui";
import Login from "./Login";
import ManageQuestionPapers from "./ManageQuestionPapers";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [activeTab, setActiveTab] = useState("extractor");

  useEffect(() => {
    const token = localStorage.getItem("admin_auth_token");
    const admin = localStorage.getItem("admin_name");
    if (token && admin) {
      setIsAuthenticated(true);
      setAdminName(admin);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("admin_auth_token");
    localStorage.removeItem("admin_name");
    setIsAuthenticated(false);
    setAdminName("");
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={(name) => {
      setIsAuthenticated(true);
      setAdminName(name);
    }} />;
  }

  return (
    <div className="app-shell">
      <header className="app-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="app-title">
          <span>CU</span>
          <div>
            <h1>Climbup Admin</h1>
            <p>Welcome, {adminName} | Manage academic data, extract questions, and save answers</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setActiveTab("extractor")}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === "extractor" ? '#3b82f6' : '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Extract Questions
          </button>
          <button 
            onClick={() => setActiveTab("manage")}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === "manage" ? '#3b82f6' : '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Manage Papers
          </button>
          <button 
            onClick={handleLogout}
          style={{
            marginRight: '20px',
            padding: '8px 16px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Logout
        </button>
        </div>
      </header>

      {activeTab === "extractor" ? (
        <PDFQuestionExtractorGui selectedSubject={null} />
      ) : (
        <ManageQuestionPapers />
      )}
    </div>
  );
}
