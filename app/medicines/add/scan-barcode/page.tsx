"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { lookupBarcode } from "@/lib/medicineDatabase";

type ScanState = "requesting" | "active" | "found" | "notfound" | "denied";

export default function BarcodeScannerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<unknown>(null);
  const detectedRef = useRef(false);
  const [scanState, setScanState] = useState<ScanState>("requesting");
  const [torchOn, setTorchOn] = useState(false);
  const [foundName, setFoundName] = useState("");
  const [notFoundCode, setNotFoundCode] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (scannerRef.current) {
      try { (scannerRef.current as { stop: () => void }).stop(); } catch { /* noop */ }
    }
  }, []);

  const navigateToForm = useCallback((med: ReturnType<typeof lookupBarcode>) => {
    stopCamera();
    if (!med) return;
    const p = new URLSearchParams({
      name: med.name, dosage: med.dosage,
      frequency: med.frequency, instructions: med.instructions,
      from: "barcode",
    });
    router.replace("/medicines/add?" + p.toString());
  }, [router, stopCamera]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"environment" } });
        if (!active) { stream.getTracks().forEach(t=>t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        scannerRef.current = reader;
        setScanState("active");

        reader.decodeFromStream(stream, videoRef.current!, (result) => {
          if (!active || detectedRef.current) return;
          if (result) {
            detectedRef.current = true;
            const raw = result.getText();
            const med = lookupBarcode(raw);
            if (med) {
              setFoundName(med.name);
              setScanState("found");
              setTimeout(() => navigateToForm(med), 1600);
            } else {
              setNotFoundCode(raw.length > 30 ? raw.slice(0, 28) + "…" : raw);
              setScanState("notfound");
            }
          }
        });
      } catch {
        if (active) setScanState("denied");
      }
    })();
    return () => { active = false; stopCamera(); };
  }, [navigateToForm, stopCamera]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(t => !t);
    } catch { /* noop */ }
  }, [torchOn]);

  return (
    <div style={{ minHeight:"100dvh", background:"#000", position:"relative", overflow:"hidden" }}>
      <style>{`
        @keyframes scanLine { 0%{top:10%} 100%{top:90%} }
        @keyframes cornerPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes checkPop { 0%{transform:scale(0.3);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes spinRing { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>

      {/* Camera feed */}
      <video ref={videoRef} autoPlay playsInline muted style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover" }} />

      {/* Dark overlay with cutout */}
      {scanState !== "denied" && (
        <div style={{ position:"absolute",inset:0, background:"rgba(0,0,0,0.68)",
          WebkitMaskImage:"radial-gradient(ellipse 270px 270px at 50% 42%,transparent 100%,black 100%)" }} />
      )}

      {/* Scan window corners + scan line */}
      {scanState === "active" && (
        <div style={{ position:"absolute", left:"50%", top:"42%", transform:"translate(-50%,-50%)", width:270, height:270 }}>
          {/* Top-left */}
          <div style={{ position:"absolute",top:0,left:0,width:32,height:32,borderTop:"3px solid #00D4AA",borderLeft:"3px solid #00D4AA",filter:"drop-shadow(0 0 4px rgba(0,212,170,0.8))",animation:"cornerPulse 2s ease-in-out infinite",animationDelay:"0ms" }} />
          {/* Top-right */}
          <div style={{ position:"absolute",top:0,right:0,width:32,height:32,borderTop:"3px solid #00D4AA",borderRight:"3px solid #00D4AA",filter:"drop-shadow(0 0 4px rgba(0,212,170,0.8))",animation:"cornerPulse 2s ease-in-out infinite",animationDelay:"200ms" }} />
          {/* Bottom-left */}
          <div style={{ position:"absolute",bottom:0,left:0,width:32,height:32,borderBottom:"3px solid #00D4AA",borderLeft:"3px solid #00D4AA",filter:"drop-shadow(0 0 4px rgba(0,212,170,0.8))",animation:"cornerPulse 2s ease-in-out infinite",animationDelay:"400ms" }} />
          {/* Bottom-right */}
          <div style={{ position:"absolute",bottom:0,right:0,width:32,height:32,borderBottom:"3px solid #00D4AA",borderRight:"3px solid #00D4AA",filter:"drop-shadow(0 0 4px rgba(0,212,170,0.8))",animation:"cornerPulse 2s ease-in-out infinite",animationDelay:"600ms" }} />
          {/* Scan line */}
          <div style={{ position:"absolute",left:4,right:4,height:2,
            background:"linear-gradient(90deg,transparent,rgba(0,212,170,0.9),#00D4AA,rgba(0,212,170,0.9),transparent)",
            boxShadow:"0 0 8px rgba(0,212,170,0.6)",animation:"scanLine 1.8s ease-in-out infinite alternate" }} />
        </div>
      )}

      {/* Top bar */}
      <div style={{ position:"absolute",top:0,left:0,right:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px",zIndex:10 }}>
        <button onClick={()=>{ stopCamera(); router.back(); }}
          style={{ width:44,height:44,borderRadius:"50%",background:"rgba(0,0,0,0.45)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ color:"#fff",fontSize:16,fontWeight:600 }}>Scan Barcode / QR</span>
        <button onClick={toggleTorch}
          style={{ width:44,height:44,borderRadius:"50%",background:torchOn?"rgba(255,214,10,0.25)":"rgba(0,0,0,0.45)",border:"1px solid " + (torchOn?"rgba(255,214,10,0.6)":"rgba(255,255,255,0.2)"),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={torchOn?"#FFD60A":"none"} stroke={torchOn?"#FFD60A":"white"} strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </button>
      </div>

      {/* Requesting / loading */}
      {scanState === "requesting" && (
        <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16 }}>
          <div style={{ width:48,height:48,border:"3px solid rgba(255,255,255,0.2)",borderTop:"3px solid #00D4AA",borderRadius:"50%",animation:"spinRing 0.9s linear infinite" }} />
          <p style={{ color:"rgba(255,255,255,0.8)",fontSize:14,margin:0 }}>Starting camera…</p>
        </div>
      )}

      {/* Permission denied */}
      {scanState === "denied" && (
        <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center",gap:16 }}>
          <div style={{ width:72,height:72,borderRadius:"50%",background:"rgba(227,24,55,0.15)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E31837" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </div>
          <p style={{ color:"#fff",fontSize:18,fontWeight:700,margin:0 }}>Camera Access Denied</p>
          <p style={{ color:"rgba(255,255,255,0.6)",fontSize:14,margin:0 }}>Please allow camera access in your browser settings and reload.</p>
          <button onClick={()=>router.back()} style={{ marginTop:8,padding:"12px 28px",borderRadius:10,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontSize:15,cursor:"pointer" }}>Go Back</button>
        </div>
      )}

      {/* Found overlay */}
      {scanState === "found" && (
        <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"#fff",borderRadius:24,padding:"32px 36px",textAlign:"center",animation:"fadeUp 0.4s ease-out",maxWidth:320,width:"90%" }}>
            <div style={{ width:68,height:68,borderRadius:"50%",background:"#e6f7f0",margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",animation:"checkPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#16A36A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ margin:"0 0 4px",fontSize:18,fontWeight:700,color:"#172033" }}>Medicine found!</p>
            <p style={{ margin:"0 0 12px",fontSize:22,fontWeight:800,color:"#062F67" }}>{foundName}</p>
            <p style={{ margin:0,fontSize:12,color:"#718096" }}>Filling your form automatically…</p>
          </div>
        </div>
      )}

      {/* Not found sheet */}
      {scanState === "notfound" && (
        <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"#fff",borderRadius:"24px 24px 0 0",padding:"20px 24px 40px",animation:"fadeUp 0.35s ease-out" }}>
          <div style={{ width:40,height:4,background:"#e5eaf0",borderRadius:2,margin:"0 auto 24px" }} />
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:12,textAlign:"center" }}>
            <div style={{ width:60,height:60,borderRadius:"50%",background:"#fff3e0",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e65100" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div>
              <p style={{ margin:"0 0 4px",fontSize:19,fontWeight:700,color:"#172033" }}>Medicine Not Found</p>
              <p style={{ margin:"0 0 8px",fontSize:13,color:"#718096" }}>This code is not in our database.</p>
              {notFoundCode && <code style={{ fontSize:11,color:"#a0aabf",background:"#f5f7fa",padding:"3px 8px",borderRadius:6 }}>{notFoundCode}</code>}
            </div>
            <button onClick={()=>{ stopCamera(); router.push("/medicines/add"); }}
              style={{ width:"100%",padding:15,borderRadius:12,border:"none",background:"#E31837",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",marginTop:8 }}>
              Enter Manually
            </button>
            <button onClick={()=>{ detectedRef.current=false; setScanState("active"); }}
              style={{ width:"100%",padding:15,borderRadius:12,border:"1.5px solid #e5eaf0",background:"#fff",color:"#172033",fontSize:16,fontWeight:600,cursor:"pointer" }}>
              Scan Again
            </button>
          </div>
        </div>
      )}

      {/* Instruction text */}
      {scanState === "active" && (
        <div style={{ position:"absolute",left:0,right:0,top:"calc(42% + 160px)",display:"flex",justifyContent:"center",pointerEvents:"none" }}>
          <span style={{ background:"rgba(0,0,0,0.5)",color:"#fff",fontSize:13,fontWeight:500,padding:"8px 18px",borderRadius:20 }}>
            Hold steady — align barcode in the frame
          </span>
        </div>
      )}

      {/* Bottom manual entry button */}
      {scanState === "active" && (
        <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"0 32px 44px" }}>
          <button onClick={()=>{ stopCamera(); router.push("/medicines/add"); }}
            style={{ width:"100%",padding:15,borderRadius:12,border:"1px solid rgba(255,255,255,0.3)",background:"rgba(0,0,0,0.3)",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",backdropFilter:"blur(8px)" }}>
            Enter manually instead
          </button>
        </div>
      )}
    </div>
  );
}
