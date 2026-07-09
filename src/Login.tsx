import React, { useState } from 'react';

const cleanApiBaseUrl = (import.meta.env as any).VITE_API_URL
  ? (import.meta.env as any).VITE_API_URL.replace(/\/+$/, "")
  : "http://127.0.0.1:8000/api";

interface LoginProps {
  onLoginSuccess: (adminName: string) => void;
}

const ADMINS = ["Amir", "Saloni", "Nilesh", "Shweeta"];

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (admin: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${cleanApiBaseUrl}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_name: admin }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedAdmin(admin);
        setOtpSent(true);
      } else {
        setError(data.detail || "Failed to send OTP.");
      }
    } catch (err: any) {
      setError("Network error. Could not send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${cleanApiBaseUrl}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_name: selectedAdmin, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("admin_auth_token", data.token);
        localStorage.setItem("admin_name", data.admin_name);
        onLoginSuccess(data.admin_name);
      } else {
        setError(data.detail || "Invalid OTP.");
      }
    } catch (err: any) {
      setError("Network error. Could not verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f1f5f9"
    }}>
      <div style={{
        backgroundColor: "#fff",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
        width: "100%",
        maxWidth: "400px",
        textAlign: "center"
      }}>
        <h1 style={{ margin: "0 0 10px 0", color: "#1e293b", fontSize: "24px" }}>
          Climbup Admin
        </h1>
        <p style={{ color: "#64748b", marginBottom: "30px", fontSize: "14px" }}>
          {otpSent ? `Enter the OTP sent to ${selectedAdmin}'s email` : "Select your profile to continue"}
        </p>

        {error && (
          <div style={{
            backgroundColor: "#fee2e2",
            color: "#ef4444",
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "14px"
          }}>
            {error}
          </div>
        )}

        {!otpSent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {ADMINS.map(admin => (
              <button
                key={admin}
                disabled={loading}
                onClick={() => handleSendOtp(admin)}
                style={{
                  padding: "14px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#fff",
                  color: "#334155",
                  fontSize: "16px",
                  fontWeight: "500",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  opacity: loading ? 0.7 : 1
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = "#3b82f6"}
                onMouseOut={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
              >
                {loading && selectedAdmin === admin ? "Sending OTP..." : `Login as ${admin}`}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              disabled={loading}
              style={{
                padding: "14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "18px",
                textAlign: "center",
                letterSpacing: "4px",
                outline: "none"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
            />
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              style={{
                padding: "14px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: (loading || otp.length !== 6) ? "#93c5fd" : "#3b82f6",
                color: "#fff",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: (loading || otp.length !== 6) ? "not-allowed" : "pointer",
                transition: "background-color 0.2s"
              }}
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            
            <button
              type="button"
              onClick={() => { setOtpSent(false); setOtp(""); setError(null); }}
              disabled={loading}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: "10px"
              }}
            >
              &larr; Back to Admin list
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
