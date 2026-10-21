import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "אוכל לשבת — משפחת טיקו", description: "התפריט המשפחתי לשבת", manifest:"/manifest.webmanifest", icons:{icon:"/icons/icon-transparent-192.png",apple:"/icons/icon-transparent-180.png"}, appleWebApp:{capable:true,title:"אוכל לשבת",statusBarStyle:"default"}, robots:{index:false,follow:false} };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="he" dir="rtl"><body>{children}</body></html>; }
