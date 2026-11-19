import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"NEXUS · Classroom Attendance",description:"NEXUS classroom security and attendance operations"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" data-theme="daylight"><body>{children}</body></html>}
