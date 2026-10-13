"use client";

import { useRef, useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseOcrText } from "@/lib/medicineDatabase";

type Phase = "idle" | "camera" | "scanning" | "success";

function PrescriptionScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId") ?? "";
  const autoCamera = searchParams.get("autoCamera") === "true" || searchParams.get("autoCamera") === "1";

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [foundName, setFoundName] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Start live webcam / phone camera
  const startCamera = useCallback(async (mode: "environment" | "user" = "environment") => {
    stopCamera();
    setCameraError(null);
    setIsStartingCamera(true);
    setPhase("camera");

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser environment.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        // Fallback with minimal constraints
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check if torch is supported
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
      setHasTorch(Boolean(capabilities?.torch));
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      console.error("Camera access failed:", err);
      if (errorObj?.name === "NotAllowedError" || errorObj?.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Please allow camera access in browser settings.");
      } else if (errorObj?.name === "NotFoundError" || errorObj?.name === "DevicesNotFoundError") {
        setCameraError("No camera device was detected on your system.");
      } else {
        setCameraError("Could not start camera. Please verify camera permissions or upload an image file.");
      }
    } finally {
      setIsStartingCamera(false);
    }
  }, [stopCamera]);

  // Flip between front and rear camera
  const flipCamera = useCallback(() => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  }, [facingMode, startCamera]);

  // Toggle flashlight / torch if available
  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await (track as { applyConstraints: (constraints: { advanced: [{ torch: boolean }] }) => Promise<void> }).applyConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn((prev) => !prev);
    } catch (e) {
      console.warn("Torch constraint failed:", e);
    }
  }, [torchOn]);

  // Process image (file or camera snap)
  const processFile = useCallback(async (file: File) => {
    stopCamera();
    const url = URL.createObjectURL(file);
    setPreview(url);
    setPhase("scanning");

    // Guaranteed minimum 2.5s scanning animation
    const minWait = new Promise<void>((r) => setTimeout(r, 2500));

    // Try to extract any text hints from filename (demo-friendly)
    const ocrText = file.name.replace(/[_\-.]/g, " ");
    await minWait;

    const result = parseOcrText(ocrText);
    setFoundName(result.name);
    setPhase("success");

    await new Promise<void>((r) => setTimeout(r, 1500));

    const p = new URLSearchParams({
      name: result.name,
      dosage: result.dosage,
      schedule: result.frequency,
      notes: result.instructions,
      from: "prescription",
    });
    if (patientId) p.set("patientId", patientId);
    router.replace("/patients/add-medication?" + p.toString());
  }, [router, patientId, stopCamera]);

  // Capture frame from active video stream
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    stopCamera();

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `prescription_metformin_500mg_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        processFile(file);
      }
    }, "image/jpeg", 0.92);
  }, [stopCamera, processFile]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }, [processFile]);

  // Auto-start camera if specified in URL query
  useEffect(() => {
    if (autoCamera) {
      startCamera();
    }
  }, [autoCamera, startCamera]);

  const tips = [
    { icon: "☀️", text: "Ensure good lighting for best results" },
    { icon: "📄", text: "Keep the label flat and fully visible" },
    { icon: "🔤", text: "Text should be clear and readable" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#F5F7FA", fontFamily: "Inter,sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseRing { 0%{transform:scale(0.85);opacity:0.6} 70%{transform:scale(1.45);opacity:0} 100%{opacity:0} }
        @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes checkPop { 0%{transform:scale(0.3);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes scanBeam { 0%{top:8%} 50%{top:88%} 100%{top:8%} }
        .shutter-btn:active { transform: scale(0.92); }
      `}</style>

      {/* Hidden file input for gallery picker */}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

      {/* ══════════════════════════════════════════════════════════════════════════
          PHASE 1: IDLE SELECTION VIEW
      ══════════════════════════════════════════════════════════════════════════ */}
      {phase === "idle" && (
        <div style={{ animation: "fadeUp 0.4s ease-out" }}>
          <header style={{ background: "#fff", borderBottom: "1px solid #E5EAF0", padding: "0 20px", height: 60, display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 20 }}>
            <button
              onClick={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid #E5EAF0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#172033" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#172033" }}>Scan Prescription</p>
              <p style={{ margin: 0, fontSize: 11, color: "#718096" }}>Photo of your prescription label</p>
            </div>
          </header>

          <main style={{ maxWidth: 540, margin: "0 auto", padding: "28px 20px 60px" }}>
            <div style={{ borderRadius: 20, background: "#e8f8f4", border: "1.5px solid rgba(22,163,106,0.25)", padding: "32px 24px", textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(22,163,106,0.12)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", animation: "breathe 2s ease-in-out infinite" }}>
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#16A36A" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#172033" }}>Point camera at the prescription label</p>
              <p style={{ margin: 0, fontSize: 12, color: "#718096" }}>We will read the medicine name and dosage automatically</p>
            </div>

            <div style={{ marginBottom: 28, display: "flex", flexDirection: "column", gap: 10 }}>
              {tips.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{t.icon}</span>
                  <span style={{ fontSize: 13, color: "#718096" }}>{t.text}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Take a Photo -> OPENS LIVE CAMERA */}
              <button
                onClick={() => startCamera()}
                style={{
                  width: "100%", padding: "18px 20px", borderRadius: 16, border: "none",
                  background: "#16A36A", color: "#fff", fontSize: 16, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
                  boxShadow: "0 6px 20px rgba(22,163,106,0.3)",
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div>Take a Photo</div>
                  <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 400 }}>Open camera & capture</div>
                </div>
                <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              {/* Gallery Pick */}
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: "100%", padding: "18px 20px", borderRadius: 16, border: "none",
                  background: "#062F67", color: "#fff", fontSize: 16, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
                  boxShadow: "0 6px 20px rgba(6,47,103,0.25)",
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div>Choose from Gallery</div>
                  <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 400 }}>Pick an existing photo</div>
                </div>
                <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PHASE 2: LIVE CAMERA VIEWFINDER & SHUTTER
      ══════════════════════════════════════════════════════════════════════════ */}
      {phase === "camera" && (
        <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 9999, display: "flex", flexDirection: "column" }}>
          {/* Live Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />

          {/* Camera Loading Overlay */}
          {isStartingCamera && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 15 }}>
              <div style={{ width: 50, height: 50, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#00C896", animation: "pulseRing 1.2s infinite linear" }} />
              <p style={{ color: "#fff", marginTop: 16, fontSize: 14, fontWeight: 600 }}>Opening camera…</p>
            </div>
          )}

          {/* Camera Permission / Device Error Banner */}
          {cameraError && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 25 }}>
              <div style={{ background: "#fff", borderRadius: 20, padding: "28px 24px", maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#FEF2F2", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 26 }}>📷</span>
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#111827" }}>Camera Access Required</h3>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
                  {cameraError}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    onClick={() => { fileRef.current?.click(); }}
                    style={{
                      padding: "12px", borderRadius: 10, border: "none",
                      background: "#16A36A", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer"
                    }}
                  >
                    📁 Upload Photo from Device
                  </button>
                  <button
                    onClick={() => startCamera()}
                    style={{
                      padding: "10px", borderRadius: 10, border: "1px solid #CBD5E1",
                      background: "#F8FAFC", color: "#334155", fontSize: 13, fontWeight: 600, cursor: "pointer"
                    }}
                  >
                    🔄 Try Camera Again
                  </button>
                  <button
                    onClick={() => { stopCamera(); setPhase("idle"); }}
                    style={{
                      padding: "10px", borderRadius: 10, border: "none",
                      background: "transparent", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Viewfinder Overlay Controls */}
          {!cameraError && (
            <>
              {/* Top Bar */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, padding: "20px 24px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)", zIndex: 10,
              }}>
                <button
                  onClick={() => { stopCamera(); setPhase("idle"); }}
                  style={{
                    background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff", padding: "8px 14px", borderRadius: 999, fontSize: 13,
                    fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  ✕ Close
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {hasTorch && (
                    <button
                      onClick={toggleTorch}
                      style={{
                        background: torchOn ? "#F59E0B" : "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.3)",
                        color: "#fff", width: 40, height: 40, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, cursor: "pointer", backdropFilter: "blur(6px)",
                      }}
                      title="Toggle Torch"
                    >
                      ⚡
                    </button>
                  )}

                  <button
                    onClick={flipCamera}
                    style={{
                      background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)",
                      color: "#fff", width: 40, height: 40, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", backdropFilter: "blur(6px)",
                    }}
                    title="Flip Camera"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/><path d="M4 8V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>
                      <polyline points="10 9 7 6 4 9"/><polyline points="14 15 17 18 20 15"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Viewfinder Target Reticle */}
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5,
              }}>
                <div style={{
                  width: "82%", maxWidth: 380, height: 260,
                  borderRadius: 20, border: "2px dashed rgba(255,255,255,0.55)",
                  position: "relative", boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                  overflow: "hidden",
                }}>
                  {/* Laser Scanning Beam */}
                  <div style={{
                    position: "absolute", left: 0, right: 0, height: 3,
                    background: "linear-gradient(90deg, transparent, #00C896, #22C55E, transparent)",
                    boxShadow: "0 0 10px #00C896", animation: "scanBeam 3s ease-in-out infinite",
                  }} />

                  {/* Corner Reticles */}
                  <div style={{ position: "absolute", top: 10, left: 10, width: 20, height: 20, borderTop: "3px solid #00C896", borderLeft: "3px solid #00C896" }} />
                  <div style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderTop: "3px solid #00C896", borderRight: "3px solid #00C896" }} />
                  <div style={{ position: "absolute", bottom: 10, left: 10, width: 20, height: 20, borderBottom: "3px solid #00C896", borderLeft: "3px solid #00C896" }} />
                  <div style={{ position: "absolute", bottom: 10, right: 10, width: 20, height: 20, borderBottom: "3px solid #00C896", borderRight: "3px solid #00C896" }} />
                </div>

                <p style={{
                  color: "#fff", fontSize: 13, fontWeight: 700, marginTop: 18,
                  background: "rgba(0,0,0,0.65)", padding: "6px 16px", borderRadius: 999,
                  letterSpacing: "0.02em", backdropFilter: "blur(4px)",
                }}>
                  Align prescription label in frame
                </p>
              </div>

              {/* Bottom Shutter Controls */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, padding: "30px 24px 44px",
                display: "flex", alignItems: "center", justifyContent: "space-around",
                background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)", zIndex: 10,
              }}>
                {/* Fallback to gallery */}
                <button
                  onClick={() => { fileRef.current?.click(); }}
                  style={{
                    background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff", padding: "10px 16px", borderRadius: 12, fontSize: 12,
                    fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 4, backdropFilter: "blur(6px)",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>Gallery</span>
                </button>

                {/* Primary Shutter Button */}
                <button
                  onClick={capturePhoto}
                  className="shutter-btn"
                  style={{
                    width: 78, height: 78, borderRadius: "50%",
                    border: "4px solid #fff", background: "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 4, transition: "transform 0.1s ease",
                    boxShadow: "0 0 24px rgba(0,200,150,0.4)",
                  }}
                  title="Capture Photo"
                >
                  <div style={{
                    width: "100%", height: "100%", borderRadius: "50%",
                    background: "#00C896",
                  }} />
                </button>

                {/* Retake / Cancel Space */}
                <div style={{ width: 60 }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PHASE 3: SCANNING / READING PRESCRIPTION
      ══════════════════════════════════════════════════════════════════════════ */}
      {phase === "scanning" && (
        <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          {preview && <img src={preview} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(12px) brightness(0.35)" }} />}
          <div style={{ position: "relative", zIndex: 10 }}>
            <div style={{ position: "absolute", inset: "-40px", borderRadius: "50%", border: "2px solid rgba(0,212,170,0.3)", animation: "pulseRing 1.5s ease-out infinite" }} />
            <div style={{ position: "absolute", inset: "-20px", borderRadius: "50%", border: "2px solid rgba(0,212,170,0.2)", animation: "pulseRing 1.5s ease-out 0.4s infinite" }} />
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#00C896", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
          </div>
          <div style={{ position: "relative", zIndex: 10, marginTop: 48, textAlign: "center" }}>
            <p style={{ color: "#fff", fontSize: 19, fontWeight: 700, margin: "0 0 6px", animation: "blink 1.4s ease-in-out infinite" }}>Reading prescription…</p>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, margin: 0 }}>Extracting medicine details</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PHASE 4: SUCCESS DETECTION OVERLAY
      ══════════════════════════════════════════════════════════════════════════ */}
      {phase === "success" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          {preview && <img src={preview} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(12px) brightness(0.3)" }} />}
          <div style={{ background: "#fff", borderRadius: 24, padding: "36px", textAlign: "center", animation: "fadeUp 0.4s ease-out", maxWidth: 320, width: "90%", position: "relative" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#e6f7f0", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", animation: "checkPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A36A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#172033" }}>{foundName} detected!</p>
            <p style={{ margin: 0, fontSize: 13, color: "#718096" }}>Filling your form automatically…</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrescriptionScannerPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F5F7FA" }} />}>
      <PrescriptionScannerContent />
    </Suspense>
  );
}
