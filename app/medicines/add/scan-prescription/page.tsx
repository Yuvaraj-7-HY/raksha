"use client";

import { useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseOcrText } from "@/lib/medicineDatabase";

type Phase = "idle" | "scanning" | "success";

function PrescriptionScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId") ?? "";

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [foundName, setFoundName] = useState("");

  const processFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setPhase("scanning");

    // Guaranteed minimum 2.5s scanning animation
    const minWait = new Promise<void>(r => setTimeout(r, 2500));

    // Try to extract any text hints from filename (demo-friendly)
    const ocrText = file.name.replace(/[_\-\.]/g, " ");
    await minWait;

    const result = parseOcrText(ocrText);
    setFoundName(result.name);
    setPhase("success");

    await new Promise<void>(r => setTimeout(r, 1500));

    const p = new URLSearchParams({
      name: result.name,
      dosage: result.dosage,
      schedule: result.frequency,
      notes: result.instructions,
      from: "prescription",
    });
    if (patientId) p.set("patientId", patientId);
    router.replace("/patients/add-medication?" + p.toString());
  }, [router, patientId]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }, [processFile]);

  const tips = [
    { icon: "☀️", text: "Ensure good lighting for best results" },
    { icon: "📄", text: "Keep the label flat and fully visible" },
    { icon: "🔤", text: "Text should be clear and readable" },
  ];

  return (
    <div style={{ minHeight:"100dvh", background:"#F5F7FA", fontFamily:"Inter,sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseRing { 0%{transform:scale(0.85);opacity:0.6} 70%{transform:scale(1.45);opacity:0} 100%{opacity:0} }
        @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes checkPop { 0%{transform:scale(0.3);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes scanBar { 0%{top:8%} 100%{top:88%} }
      `}</style>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}} />

      {/* IDLE */}
      {phase === "idle" && (
        <div style={{ animation:"fadeUp 0.4s ease-out" }}>
          <header style={{ background:"#fff",borderBottom:"1px solid #E5EAF0",padding:"0 20px",height:60,display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:20 }}>
            <button onClick={()=>router.back()}
              style={{ width:36,height:36,borderRadius:9,border:"1px solid #E5EAF0",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#172033" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div>
              <p style={{ margin:0,fontSize:16,fontWeight:700,color:"#172033" }}>Scan Prescription</p>
              <p style={{ margin:0,fontSize:11,color:"#718096" }}>Photo of your prescription label</p>
            </div>
          </header>

          <main style={{ maxWidth:540,margin:"0 auto",padding:"28px 20px 60px" }}>
            <div style={{ borderRadius:20,background:"#e8f8f4",border:"1.5px solid rgba(22,163,106,0.25)",padding:"32px 24px",textAlign:"center",marginBottom:24 }}>
              <div style={{ width:88,height:88,borderRadius:"50%",background:"rgba(22,163,106,0.12)",margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",animation:"breathe 2s ease-in-out infinite" }}>
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#16A36A" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <p style={{ margin:"0 0 4px",fontSize:16,fontWeight:700,color:"#172033" }}>Point camera at the prescription label</p>
              <p style={{ margin:0,fontSize:12,color:"#718096" }}>We will read the medicine name and dosage automatically</p>
            </div>

            <div style={{ marginBottom:28,display:"flex",flexDirection:"column",gap:10 }}>
              {tips.map((t,i)=>(
                <div key={i} style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ fontSize:16 }}>{t.icon}</span>
                  <span style={{ fontSize:13,color:"#718096" }}>{t.text}</span>
                </div>
              ))}
            </div>

            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <button onClick={()=>cameraRef.current?.click()}
                style={{ width:"100%",padding:"18px 20px",borderRadius:16,border:"none",background:"#16A36A",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:"0 6px 20px rgba(22,163,106,0.3)" }}>
                <div style={{ width:48,height:48,borderRadius:12,background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <div style={{ textAlign:"left" }}>
                  <div>Take a Photo</div>
                  <div style={{ fontSize:11,opacity:0.8,fontWeight:400 }}>Use your camera</div>
                </div>
                <svg style={{ marginLeft:"auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              <button onClick={()=>fileRef.current?.click()}
                style={{ width:"100%",padding:"18px 20px",borderRadius:16,border:"none",background:"#062F67",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:"0 6px 20px rgba(6,47,103,0.25)" }}>
                <div style={{ width:48,height:48,borderRadius:12,background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <div style={{ textAlign:"left" }}>
                  <div>Choose from Gallery</div>
                  <div style={{ fontSize:11,opacity:0.8,fontWeight:400 }}>Pick an existing photo</div>
                </div>
                <svg style={{ marginLeft:"auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </main>
        </div>
      )}

      {/* SCANNING */}
      {phase === "scanning" && (
        <div style={{ position:"fixed",inset:0,background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
          {preview && <img src={preview} alt="" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",filter:"blur(12px) brightness(0.35)" }} />}
          <div style={{ position:"relative",zIndex:10 }}>
            <div style={{ position:"absolute",inset:"-40px",borderRadius:"50%",border:"2px solid rgba(0,212,170,0.3)",animation:"pulseRing 1.5s ease-out infinite" }} />
            <div style={{ position:"absolute",inset:"-20px",borderRadius:"50%",border:"2px solid rgba(0,212,170,0.2)",animation:"pulseRing 1.5s ease-out 0.4s infinite" }} />
            <div style={{ width:72,height:72,borderRadius:"50%",background:"#00C896",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
          </div>
          <div style={{ position:"relative",zIndex:10,marginTop:48,textAlign:"center" }}>
            <p style={{ color:"#fff",fontSize:19,fontWeight:700,margin:"0 0 6px",animation:"blink 1.4s ease-in-out infinite" }}>Reading prescription…</p>
            <p style={{ color:"rgba(255,255,255,0.6)",fontSize:13,margin:0 }}>Extracting medicine details</p>
          </div>
        </div>
      )}

      {/* SUCCESS */}
      {phase === "success" && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center" }}>
          {preview && <img src={preview} alt="" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",filter:"blur(12px) brightness(0.3)" }} />}
          <div style={{ background:"#fff",borderRadius:24,padding:"36px",textAlign:"center",animation:"fadeUp 0.4s ease-out",maxWidth:320,width:"90%",position:"relative" }}>
            <div style={{ width:72,height:72,borderRadius:"50%",background:"#e6f7f0",margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",animation:"checkPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A36A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ margin:"0 0 4px",fontSize:18,fontWeight:700,color:"#172033" }}>{foundName} detected!</p>
            <p style={{ margin:0,fontSize:13,color:"#718096" }}>Filling your form automatically…</p>
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

