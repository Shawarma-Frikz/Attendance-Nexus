"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {Building2,CalendarCheck2,GraduationCap,History,MonitorPlay,Moon,Plus,QrCode,Smartphone,Sun,Users,X} from "lucide-react";

type InstructorSidebarProps={active:"attendance"|"history"|"enroll"|"students"|"remote";enrollmentHref?:string};

export default function InstructorSidebar({active,enrollmentHref="/enroll"}:InstructorSidebarProps){
 const [qrOpen,setQrOpen]=useState(false),[theme,setTheme]=useState<"daylight"|"midnight">("daylight");
 const installUrl=process.env.NEXT_PUBLIC_STUDENT_APP_INSTALL_URL;
 useEffect(()=>{const saved=window.localStorage.getItem("nexus-attendance-theme");if(saved==="daylight"||saved==="midnight"){setTheme(saved);document.documentElement.setAttribute("data-theme",saved)}},[]);
 useEffect(()=>{if(!qrOpen)return;const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setQrOpen(false)};document.addEventListener("keydown",onKey);document.body.style.overflow="hidden";return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=""}},[qrOpen]);
 function toggleTheme(){const next=theme==="daylight"?"midnight":"daylight";setTheme(next);document.documentElement.setAttribute("data-theme",next);window.localStorage.setItem("nexus-attendance-theme",next)}
 const links=[
  {key:"attendance",label:"Attendance",href:"/",icon:CalendarCheck2},
  {key:"remote",label:"Remote start",href:"/remote",icon:MonitorPlay},
  {key:"history",label:"Session history",href:"/history",icon:History},
  {key:"students",label:"Students",href:"/students",icon:Users},
  {key:"enroll",label:"Enroll student",href:enrollmentHref,icon:Plus},
 ] as const;
 return <div className="nexus-shell-header">
  <header className="nexus-topbar"><div className="nexus-topbar-inner">
   <Link className="nexus-brand" href="/" aria-label="NEXUS Attendance home"><span className="nexus-brand-mark"><Building2 size={19}/></span><span className="nexus-brand-copy"><b>NEXUS</b><small>Smart Building Monitor</small></span></Link>
   <span className="nexus-top-divider"/>
   <span className="nexus-module-name">Classroom Attendance</span>
   <div className="nexus-header-actions"><span className="nexus-live-pill"><i/>INSTRUCTOR CONSOLE</span>
    {installUrl&&<button className="nexus-icon-button qr-quick-action" type="button" onClick={()=>setQrOpen(true)} aria-label="Show student app QR code" title="Student app QR"><QrCode size={16}/></button>}
    <Link className="nexus-icon-button student-portal-action" href="/student" aria-label="Student phone page" title="Student phone page"><Smartphone size={16}/></Link>
    <button className="nexus-theme-button" type="button" onClick={toggleTheme}>{theme==="daylight"?<Moon size={15}/>:<Sun size={15}/>}<span>{theme==="daylight"?"Dark mode":"Light mode"}</span></button>
   </div>
  </div></header>
  <nav className="nexus-service-bar" aria-label="Classroom attendance tools"><div className="nexus-service-inner"><span className="nexus-service-label"><GraduationCap size={14}/>CLASSROOM</span><div className="nexus-service-links">{links.map(({key,label,href,icon:Icon})=><Link key={key} className={`nexus-service-link${active===key?" active":""}`} href={href}><Icon size={15}/><span>{label}</span></Link>)}
   {installUrl&&<button className="nexus-service-link qr-nav-button" type="button" onClick={()=>setQrOpen(true)}><QrCode size={15}/><span>Student app QR</span></button>}
  </div></div></nav>
  {qrOpen&&installUrl&&<div className="qr-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setQrOpen(false)}}><section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title"><button className="qr-modal-close" type="button" aria-label="Close QR code" onClick={()=>setQrOpen(false)}><X size={18}/></button><div className="eyebrow">NEXUS · STUDENT APP</div><h2 id="qr-modal-title">Scan to install</h2><p className="muted">Open your phone camera and scan this code to download NEXUS Student.</p><a className="qr-modal-code" href={installUrl} target="_blank" rel="noreferrer" aria-label="Open NEXUS Student install page"><QRCodeSVG value={installUrl} size={240} level="H" includeMargin/></a><a className="btn qr-modal-link" href={installUrl} target="_blank" rel="noreferrer">Open install page</a><p className="small muted">After installing, connect your phone to the same Wi-Fi as the attendance computer.</p></section></div>}
 </div>;
}
